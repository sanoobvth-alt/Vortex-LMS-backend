import { z } from 'zod';

const phone = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use an E.164 phone number');
const password = z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes');
const strictObject = (shape) => z.object(shape).strict();

export const registerSchema = strictObject({ phone, password, fullName: z.string().trim().min(2).max(120), highestQualification: z.enum(['SSLC', 'PLUS_TWO', 'DIPLOMA', 'DEGREE', 'POST_GRADUATION', 'OTHER']), otherQualification: z.string().trim().min(1).max(120).optional() }).refine((v) => v.highestQualification === 'OTHER' ? Boolean(v.otherQualification) : !v.otherQualification, { message: 'otherQualification is required only for OTHER', path: ['otherQualification'] });
export const verifyOtpSchema = strictObject({ phone, otp: z.string().regex(/^\d{6}$/) });
export const loginSchema = strictObject({ phone, password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes') });
export const forgotPasswordSchema = strictObject({ phone });
export const resetPasswordSchema = strictObject({ phone, otp: z.string().regex(/^\d{6}$/), newPassword: password });
export const emptySchema = strictObject({}).optional().default({});
