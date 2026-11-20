import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { pageInfo, pagination } from '../../utils/pagination.js';

const isAssessmentComplete = (assessment) => assessment.attempts.some((attempt) => attempt.status === 'EVALUATED' && Number(attempt.score ?? -1) >= assessment.passingMarks);

export function calculateActivityProgress(assessments) {
  if (!assessments.length) return 0;
  return Math.round((assessments.filter(isAssessmentComplete).length / assessments.length) * 100);
}

export function calculateEnrollmentProgress(enrollment) {
  const weeks = enrollment.course.weeks.map((week) => ({ id: week.id, weekNumber: week.weekNumber, title: week.title,
    progressPercent: calculateActivityProgress(week.assessments),
    activities: { assessments: week.assessments.length } }));
  const assessments = enrollment.course.weeks.flatMap((week) => week.assessments);
  return {
    enrollmentId: enrollment.id,
    status: enrollment.status,
    course: { id: enrollment.course.id, title: enrollment.course.title, slug: enrollment.course.slug, durationWeeks: enrollment.course.durationWeeks },
    progressPercent: calculateActivityProgress(assessments), completedActivities: assessments.filter(isAssessmentComplete).length, totalActivities: assessments.length, weeks,
  };
}

async function getStudent(userId) {
  const student = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!student) throw new ApiError(404, 'Student profile not found', 'PROFILE_NOT_FOUND');
  return student.id;
}

function progressInclude(studentId) {
  return { course: { select: { id: true, title: true, slug: true, durationWeeks: true, weeks: { where: { isPublished: true }, orderBy: { weekNumber: 'asc' }, select: {
    id: true, weekNumber: true, title: true,
    assessments: { where: { isPublished: true }, select: { id: true, passingMarks: true, attempts: { where: { studentId }, select: { status: true, score: true } } } },
  } } } } };
}

export async function getProgress(userId, query) {
  const studentId = await getStudent(userId);
  const where = { studentId, status: { in: ['ACTIVE', 'COMPLETED'] } };
  const [enrollments, total] = await prisma.$transaction([
    prisma.enrollment.findMany({ where, ...pagination(query), orderBy: { enrolledAt: 'desc' }, include: progressInclude(studentId) }),
    prisma.enrollment.count({ where }),
  ]);
  return { courses: enrollments.map(calculateEnrollmentProgress), pagination: pageInfo(query, total) };
}

function activityDateKey(value) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.ACTIVITY_TIMEZONE || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}

export function calculateStreak(activityDates, now = new Date()) {
  const dates = new Set(activityDates.map(activityDateKey));
  const today = activityDateKey(now);
  let cursor = dates.has(today) ? today : dates.has(previousDateKey(today)) ? previousDateKey(today) : null;
  let streak = 0;
  while (cursor && streak < 366 && dates.has(cursor)) { streak += 1; cursor = previousDateKey(cursor); }
  return streak;
}

function previousDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

export async function getDashboard(userId) {
  const studentId = await getStudent(userId);
  const now = new Date();
  const cutoff = new Date(now.getTime() - 366 * 86_400_000);
  const activeCourse = { enrollments: { some: { studentId, status: 'ACTIVE' } } };
  const assessmentQuery = prisma.assessment.findMany({
    where: { isPublished: true, week: { course: activeCourse } },
    select: { id: true, title: true, passingMarks: true, attempts: { where: { studentId, status: 'EVALUATED' }, select: { score: true } }, week: { select: { weekNumber: true, course: { select: { id: true, title: true } } } } },
    take: 200,
  });
  const [enrollments, assessments, evaluatedAttempts, activityDates] = await Promise.all([
    prisma.enrollment.findMany({ where: { studentId, status: 'ACTIVE' }, include: progressInclude(studentId), orderBy: { enrolledAt: 'desc' } }),
    assessmentQuery,
    prisma.assessmentAttempt.findMany({ where: { studentId, status: 'EVALUATED', percentage: { not: null } }, select: { assessmentId: true, percentage: true } }),
    prisma.assessmentAttempt.findMany({ where: { studentId, submittedAt: { not: null, gte: cutoff } }, select: { submittedAt: true } }),
  ]);
  const bestByAssessment = new Map();
  for (const attempt of evaluatedAttempts) bestByAssessment.set(attempt.assessmentId, Math.max(bestByAssessment.get(attempt.assessmentId) ?? -1, Number(attempt.percentage)));
  const averages = [...bestByAssessment.values()];
  const courses = enrollments.map(calculateEnrollmentProgress);
  const needsAttention = assessments.filter((assessment) => !assessment.attempts.some((attempt) => Number(attempt.score ?? -1) >= assessment.passingMarks)).map((assessment) => ({ kind: 'INCOMPLETE_ASSESSMENT', id: assessment.id, title: assessment.title, course: assessment.week.course, weekNumber: assessment.week.weekNumber }));
  return { courses,
    summary: { activeEnrollments: courses.length, averageCourseProgress: courses.length ? Math.round(courses.reduce((sum, course) => sum + course.progressPercent, 0) / courses.length) : 0, assessmentAverage: averages.length ? Math.round(averages.reduce((sum, value) => sum + value, 0) / averages.length) : null, activityStreakDays: calculateStreak(activityDates.map((x) => x.submittedAt).filter(Boolean), now) },
    needsAttention,
  };
}
