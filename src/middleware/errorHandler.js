import { Prisma } from '@prisma/client';
import multer from 'multer';

export function errorHandler(error, _req, res, _next) {
  const isUploadError = error instanceof multer.MulterError;
  const uploadStatus = isUploadError && ['LIMIT_FILE_SIZE', 'LIMIT_FILE_COUNT', 'LIMIT_PART_COUNT'].includes(error.code) ? 413 : 400;
  const status = error.statusCode ?? (isUploadError ? uploadStatus : error instanceof Prisma.PrismaClientKnownRequestError ? 409 : 500);
  const code = error.code ?? (isUploadError ? 'UPLOAD_LIMIT_EXCEEDED' : status === 409 ? 'CONFLICT' : 'INTERNAL_ERROR');
  const message = status >= 500 && process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message;
  if (status >= 500 && process.env.NODE_ENV !== 'test') console.error(error);
  res.status(status).json({ error: { code, message } });
}
