import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { pageInfo, pagination } from '../../utils/pagination.js';

const access = (studentId) => ({ week: { course: { enrollments: { some: { studentId, status: { in: ['ACTIVE', 'COMPLETED'] } } } } } });
const attemptSelect = { id: true, assessmentId: true, attemptNumber: true, startedAt: true, submittedAt: true, score: true, percentage: true, status: true };

export function studentQuestion(question) {
  const { options = [], ...fields } = question;
  return { ...fields, options: options.map(({ isCorrect: _isCorrect, ...option }) => option) };
}

export function scoreObjectiveQuestion(question, answer) {
  const expected = question.options.filter((option) => option.isCorrect).map((option) => option.id).sort();
  let selected = answer?.selectedOptionId ? [answer.selectedOptionId] : [];
  if (question.questionType === 'MULTIPLE_SELECT' && answer?.answerText) {
    try { selected = JSON.parse(answer.answerText).sort(); } catch { selected = []; }
  }
  const isCorrect = selected.length === expected.length && selected.every((id, index) => id === expected[index]);
  return { isCorrect, marksObtained: isCorrect ? question.marks : 0 };
}

async function getProfileId(userId) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new ApiError(404, 'Student profile not found', 'PROFILE_NOT_FOUND');
  return profile.id;
}

export async function listAssessments(userId, query) {
  const studentId = await getProfileId(userId);
  const where = { isPublished: true, ...access(studentId), ...(query.weekId ? { weekId: query.weekId } : {}), ...(query.courseId ? { week: { ...access(studentId).week, courseId: query.courseId } } : {}) };
  const [items, total] = await prisma.$transaction([
    prisma.assessment.findMany({ where, ...pagination(query), orderBy: { createdAt: 'desc' }, select: { id: true, title: true, description: true, durationMinutes: true, totalMarks: true, passingMarks: true, attemptLimit: true, week: { select: { id: true, weekNumber: true, title: true, courseId: true } } } }),
    prisma.assessment.count({ where }),
  ]);
  return { items, pagination: pageInfo(query, total) };
}

export async function getAssessment(userId, assessmentId) {
  const studentId = await getProfileId(userId);
  const assessment = await prisma.assessment.findFirst({ where: { id: assessmentId, isPublished: true, ...access(studentId) }, select: {
    id: true, title: true, description: true, durationMinutes: true, totalMarks: true, passingMarks: true, attemptLimit: true,
    questions: { orderBy: { questionOrder: 'asc' }, select: { id: true, questionText: true, questionType: true, marks: true, questionOrder: true, options: { orderBy: { optionOrder: 'asc' }, select: { id: true, optionText: true, optionOrder: true } } } },
  } });
  if (!assessment) throw new ApiError(404, 'Assessment not found', 'ASSESSMENT_NOT_FOUND');
  return assessment;
}

export async function startAttempt(userId, assessmentId) {
  const studentId = await getProfileId(userId);
  return prisma.$transaction(async (tx) => {
    const assessment = await tx.assessment.findFirst({ where: { id: assessmentId, isPublished: true, ...access(studentId) }, select: { id: true, attemptLimit: true } });
    if (!assessment) throw new ApiError(404, 'Assessment not found', 'ASSESSMENT_NOT_FOUND');
    const count = await tx.assessmentAttempt.count({ where: { assessmentId, studentId } });
    if (count >= assessment.attemptLimit) throw new ApiError(409, 'Assessment attempt limit reached', 'ATTEMPT_LIMIT_REACHED');
    return tx.assessmentAttempt.create({ data: { assessmentId, studentId, attemptNumber: count + 1 }, select: attemptSelect });
  }, { isolationLevel: 'Serializable' });
}

async function getOwnedInProgressAttempt(tx, userId, attemptId) {
  const attempt = await tx.assessmentAttempt.findFirst({ where: { id: attemptId, student: { userId }, status: 'IN_PROGRESS' }, include: { assessment: { select: { id: true, durationMinutes: true } } } });
  if (!attempt) throw new ApiError(404, 'Attempt not found', 'ATTEMPT_NOT_FOUND');
  const expiresAt = attempt.assessment.durationMinutes ? new Date(attempt.startedAt.getTime() + attempt.assessment.durationMinutes * 60_000) : null;
  if (expiresAt && new Date() > expiresAt) throw new ApiError(409, 'Assessment time has expired', 'ATTEMPT_EXPIRED');
  return attempt;
}

export async function saveAnswers(userId, attemptId, inputs) {
  return prisma.$transaction(async (tx) => {
    const attempt = await getOwnedInProgressAttempt(tx, userId, attemptId);
    const questions = await tx.assessmentQuestion.findMany({ where: { assessmentId: attempt.assessmentId, id: { in: inputs.map((item) => item.questionId) } }, include: { options: { select: { id: true } } } });
    if (questions.length !== inputs.length) throw new ApiError(400, 'An answer references a question outside this assessment', 'INVALID_ANSWER');
    const questionById = new Map(questions.map((question) => [question.id, question]));
    for (const input of inputs) {
      const question = questionById.get(input.questionId);
      const allowedOptionIds = new Set(question.options.map((option) => option.id));
      if (input.selectedOptionId && !allowedOptionIds.has(input.selectedOptionId)) throw new ApiError(400, 'Selected option does not belong to its question', 'INVALID_ANSWER');
      if (input.selectedOptionIds?.some((optionId) => !allowedOptionIds.has(optionId))) throw new ApiError(400, 'Selected option does not belong to its question', 'INVALID_ANSWER');
      if (question.questionType === 'TEXT' && (!input.answerText || input.selectedOptionId || input.selectedOptionIds)) throw new ApiError(400, 'A text answer is required without option selections', 'INVALID_ANSWER');
      if (['MCQ', 'TRUE_FALSE'].includes(question.questionType) && (!input.selectedOptionId || input.selectedOptionIds || input.answerText)) throw new ApiError(400, 'Select exactly one answer option', 'INVALID_ANSWER');
      if (question.questionType === 'MULTIPLE_SELECT' && (!input.selectedOptionIds?.length || input.selectedOptionId || input.answerText)) throw new ApiError(400, 'Select one or more answer options using selectedOptionIds', 'INVALID_ANSWER');
      const answerText = question.questionType === 'MULTIPLE_SELECT' ? JSON.stringify(input.selectedOptionIds) : input.answerText;
      await tx.assessmentAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId: question.id } },
        create: { attemptId, questionId: question.id, selectedOptionId: input.selectedOptionId ?? null, answerText },
        update: { selectedOptionId: input.selectedOptionId ?? null, answerText, isCorrect: null, marksObtained: null },
      });
    }
    return tx.assessmentAnswer.findMany({ where: { attemptId, questionId: { in: inputs.map((item) => item.questionId) } }, select: { id: true, questionId: true, selectedOptionId: true, answerText: true } });
  });
}

export async function submitAttempt(userId, attemptId) {
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.assessmentAttempt.findFirst({ where: { id: attemptId, student: { userId }, status: 'IN_PROGRESS' }, include: { assessment: { include: { questions: { include: { options: true } } } }, answers: true } });
    if (!attempt) throw new ApiError(404, 'Attempt not found', 'ATTEMPT_NOT_FOUND');
    let score = 0;
    let autoGradable = true;
    const updates = [];
    for (const question of attempt.assessment.questions) {
      const answer = attempt.answers.find((entry) => entry.questionId === question.id);
      if (question.questionType === 'TEXT') { autoGradable = false; continue; }
      const { isCorrect: correct, marksObtained } = scoreObjectiveQuestion(question, answer);
      score += marksObtained;
      if (answer) updates.push(tx.assessmentAnswer.update({ where: { id: answer.id }, data: { isCorrect: correct, marksObtained } }));
    }
    if (updates.length) await Promise.all(updates);
    const evaluated = autoGradable;
    const percentage = evaluated ? (attempt.assessment.totalMarks ? (score / attempt.assessment.totalMarks) * 100 : 0) : null;
    return tx.assessmentAttempt.update({ where: { id: attemptId }, data: { submittedAt: new Date(), score: evaluated ? score : null, percentage, status: evaluated ? 'EVALUATED' : 'SUBMITTED' }, select: attemptSelect });
  });
}

export async function getAttemptResult(userId, attemptId) {
  const attempt = await prisma.assessmentAttempt.findFirst({
    where: { id: attemptId, student: { userId }, status: { in: ['SUBMITTED', 'EVALUATED'] } },
    select: {
      ...attemptSelect,
      assessment: {
        select: {
          title: true,
          totalMarks: true,
          passingMarks: true,
          questions: {
            orderBy: { questionOrder: 'asc' },
            select: {
              id: true,
              questionText: true,
              questionType: true,
              marks: true,
              options: { orderBy: { optionOrder: 'asc' }, select: { id: true, optionText: true, isCorrect: true } },
            },
          },
        },
      },
      answers: { select: { questionId: true, selectedOptionId: true, answerText: true, isCorrect: true, marksObtained: true } },
    },
  });
  if (!attempt) throw new ApiError(404, 'Submitted result not found', 'RESULT_NOT_FOUND');
  if (attempt.status !== 'EVALUATED') {
    attempt.assessment.questions = attempt.assessment.questions.map(studentQuestion);
    attempt.answers = attempt.answers.map(({ isCorrect, marksObtained, ...answer }) => answer);
  }
  return attempt;
}
