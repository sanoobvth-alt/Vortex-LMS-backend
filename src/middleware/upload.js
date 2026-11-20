import multer from 'multer';
import rateLimit from 'express-rate-limit';

export const singlePrivateFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES || 5_242_880), files: 1, fields: 2, parts: 3 },
}).single('file');

export const singleMetadataFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES || 5_242_880), files: 1, fields: 5, parts: 6 },
}).single('file');

export const multipleSubmissionFiles = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES || 5_242_880), files: 5, fields: 1, parts: 6 },
}).array('files', 5);

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many upload requests; try again later' } },
});
