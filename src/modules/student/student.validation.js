import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination.js';

export const listQuery = paginationSchema;
export const notificationParams = z.object({ notificationId: z.string().uuid() }).strict();
export const emptyBody = z.object({}).strict().optional().default({});
