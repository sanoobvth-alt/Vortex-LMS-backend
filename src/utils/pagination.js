import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const pagination = ({ page, pageSize }) => ({ skip: (page - 1) * pageSize, take: pageSize });
export const pageInfo = ({ page, pageSize }, total) => ({ page, pageSize, total, pageCount: Math.ceil(total / pageSize) });
