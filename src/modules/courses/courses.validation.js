import { paginationSchema } from '../../utils/pagination.js';
import { z } from 'zod';

export const listCoursesQuery = paginationSchema.extend({ search: z.string().trim().max(120).optional() }).strict();
export const uuidParams = z.object({ courseId: z.string().uuid() }).strict();
