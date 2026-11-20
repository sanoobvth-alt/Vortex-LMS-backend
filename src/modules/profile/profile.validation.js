import { z } from 'zod';

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  highestQualification: z.enum(['SSLC', 'PLUS_TWO', 'DIPLOMA', 'DEGREE', 'POST_GRADUATION', 'OTHER']).optional(),
  otherQualification: z.string().trim().min(1).max(120).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one profile field is required');

export const uploadPhotoBody = z.object({}).strict().optional().default({});
export const uploadDocumentBody = z.object({ documentType: z.enum(['AADHAAR', 'PAN', 'PASSPORT', 'OTHER']) }).strict();
