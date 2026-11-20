import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination.js';

export const listQuery = paginationSchema;
export const enrollmentParams = z.object({ enrollmentId: z.string().uuid() }).strict();
