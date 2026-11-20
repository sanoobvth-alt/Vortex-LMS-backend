import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination.js';

const uuid = z.string().uuid();
export const listQuery = paginationSchema.extend({ weekId: uuid.optional(), courseId: uuid.optional() }).strict();
export const assessmentParams = z.object({ assessmentId: uuid }).strict();
export const attemptParams = z.object({ attemptId: uuid }).strict();
const answerSchema = z.object({
  questionId: uuid,
  selectedOptionId: uuid.optional(),
  selectedOptionIds: z.array(uuid).min(1).max(50).optional(),
  answerText: z.string().trim().max(10_000).optional(),
}).strict().refine((value) => Boolean(value.selectedOptionId || value.selectedOptionIds?.length || value.answerText), 'Provide an answer')
  .refine((value) => !value.selectedOptionIds || new Set(value.selectedOptionIds).size === value.selectedOptionIds.length, 'Selected options must be unique');
export const answersBody = z.object({ answers: z.array(answerSchema).min(1).max(200) }).strict().refine((value) => new Set(value.answers.map((answer) => answer.questionId)).size === value.answers.length, 'Each question can only appear once');
export const emptyBody = z.object({}).strict().optional().default({});
