import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { multipleSubmissionFiles, singleMetadataFile, singlePrivateFile, uploadLimiter } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { uploadToCloudinary } from '../services/cloudinaryStorage.js';
import { saveMediaAsset, removeMediaAsset } from '../services/mediaAssets.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const mediaRouter = Router();
const uuidParam = z.object({ courseId: z.string().uuid() }).strict();
const materialInput = z.object({ weekId: z.string().uuid(), type: z.enum(['YOUTUBE_VIDEO', 'PDF_DOCUMENT', 'SELF_LEARNING_TOPIC']), title: z.string().trim().min(1).max(180), description: z.string().max(4000).optional(), externalUrl: z.string().url().max(2000).optional() }).strict();
const assignmentParam = z.object({ assignmentId: z.string().uuid() }).strict();
const weekParams = z.object({ courseId: z.string().uuid(), weekId: z.string().uuid() }).strict();
const certificateBody = z.object({ studentId: z.string().uuid(), courseId: z.string().uuid(), certificateNumber: z.string().trim().min(1).max(100) }).strict();
const assignmentInput = z.object({ weekId: z.string().uuid(), title: z.string().trim().min(1).max(180), description: z.string().trim().min(1).max(5000), dueAt: z.string().datetime().optional() }).strict();
const allowedSubmissionTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/zip'];

mediaRouter.post('/courses/:courseId/thumbnail', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), uploadLimiter, validate({ params: uuidParam }), singlePrivateFile, asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'A file is required in the "file" field', 'FILE_REQUIRED');
  const course = await prisma.course.findUnique({ where: { id: req.params.courseId }, select: { id: true, thumbnailAssetId: true } });
  if (!course) throw new ApiError(404, 'Course not found', 'COURSE_NOT_FOUND');
  const upload = await uploadToCloudinary(req.file, { folder: 'vortex-lms/course-media/thumbnails', resourceType: 'image', deliveryType: 'upload', allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] });
  const asset = await saveMediaAsset(upload, { purpose: 'COURSE_THUMBNAIL', ownerUserId: req.auth.userId, courseId: course.id });
  try { await prisma.course.update({ where: { id: course.id }, data: { thumbnailAssetId: asset.id } }); }
  catch (error) { await removeMediaAsset(asset.id); throw error; }
  if (course.thumbnailAssetId) {
    try { await removeMediaAsset(course.thumbnailAssetId); } catch { console.error('Could not clean up replaced course thumbnail', { courseId: course.id }); }
  }
  return res.status(201).json({ data: { thumbnailUrl: asset.secureUrl, assetId: asset.id } });
}));

mediaRouter.post('/courses/:courseId/materials', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), uploadLimiter, singleMetadataFile, validate({ params: uuidParam, body: materialInput }), asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const input = req.body;
  const week = await prisma.courseWeek.findFirst({ where: { id: input.weekId, courseId }, select: { id: true } });
  if (!week) throw new ApiError(404, 'Module not found in this course', 'MODULE_NOT_FOUND');
  let asset;
  if (input.type === 'PDF_DOCUMENT') {
    if (!req.file) throw new ApiError(400, 'PDF_DOCUMENT requires a file in the "file" field', 'FILE_REQUIRED');
    const upload = await uploadToCloudinary(req.file, { folder: 'vortex-lms/course-materials/pdfs', resourceType: 'raw', deliveryType: 'authenticated', allowedMimeTypes: ['application/pdf'] });
    asset = await saveMediaAsset(upload, { purpose: 'COURSE_PDF', ownerUserId: req.auth.userId, courseId });
  } else if (req.file) throw new ApiError(400, 'Files are only accepted for PDF_DOCUMENT materials', 'UNEXPECTED_FILE');
  if (input.type === 'YOUTUBE_VIDEO') {
    let host;
    try { host = new URL(input.externalUrl).hostname.toLowerCase(); } catch { host = ''; }
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'].includes(host)) throw new ApiError(400, 'A valid YouTube URL is required', 'INVALID_VIDEO_URL');
  }
  if (input.type === 'SELF_LEARNING_TOPIC' && !input.externalUrl && !input.description) throw new ApiError(400, 'A topic requires accessible content or an external URL', 'CONTENT_REQUIRED');
  try {
    const material = await prisma.courseMaterial.create({ data: { courseId, weekId: week.id, type: input.type, title: input.title, description: input.description, externalUrl: input.type === 'PDF_DOCUMENT' ? null : input.externalUrl, mediaAssetId: asset?.id }, select: { id: true, type: true, title: true, description: true, externalUrl: true, sortOrder: true, createdAt: true } });
    return res.status(201).json({ data: { material, assetId: asset?.id } });
  } catch (error) { if (asset) await removeMediaAsset(asset.id); throw error; }
}));

mediaRouter.post('/courses/:courseId/assignments', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), validate({ params: uuidParam, body: assignmentInput }), asyncHandler(async (req, res) => {
  const week = await prisma.courseWeek.findFirst({ where: { id: req.body.weekId, courseId: req.params.courseId }, select: { id: true } });
  if (!week) throw new ApiError(404, 'Module not found in this course', 'MODULE_NOT_FOUND');
  const assignment = await prisma.assignment.create({ data: { courseId: req.params.courseId, weekId: week.id, title: req.body.title, description: req.body.description, dueAt: req.body.dueAt ? new Date(req.body.dueAt) : null, isPublished: true }, select: { id: true, title: true, description: true, dueAt: true, createdAt: true } });
  return res.status(201).json({ data: { assignment } });
}));

mediaRouter.get('/courses/:courseId/weeks/:weekId/assignments', authenticate, authorize('STUDENT'), validate({ params: weekParams }), asyncHandler(async (req, res) => {
  const profile = await prisma.studentProfile.findUnique({ where: { userId: req.auth.userId }, select: { id: true } });
  const week = profile && await prisma.courseWeek.findFirst({ where: { id: req.params.weekId, courseId: req.params.courseId, isPublished: true, course: { enrollments: { some: { studentId: profile.id, status: 'ACTIVE' } } } }, select: { id: true } });
  if (!week) throw new ApiError(404, 'Module not found', 'MODULE_NOT_FOUND');
  const assignments = await prisma.assignment.findMany({ where: { weekId: week.id, isPublished: true }, orderBy: { createdAt: 'asc' }, select: { id: true, title: true, description: true, dueAt: true, submissions: { where: { studentId: profile.id }, select: { id: true, submittedAt: true, attachments: { select: { mediaAsset: { select: { id: true, originalFileName: true } } } } } } } });
  return res.json({ data: { assignments: assignments.map(({ submissions, ...assignment }) => ({ ...assignment, submission: submissions[0] ? { id: submissions[0].id, submittedAt: submissions[0].submittedAt, attachments: submissions[0].attachments.map(({ mediaAsset }) => ({ fileName: mediaAsset.originalFileName, downloadUrl: `/api/v1/files/${mediaAsset.id}` })) } : null })) } });
}));

mediaRouter.get('/courses/:courseId/weeks/:weekId/materials', authenticate, authorize('STUDENT'), validate({ params: weekParams }), asyncHandler(async (req, res) => {
  const profile = await prisma.studentProfile.findUnique({ where: { userId: req.auth.userId }, select: { id: true } });
  const week = profile && await prisma.courseWeek.findFirst({ where: { id: req.params.weekId, courseId: req.params.courseId, isPublished: true, course: { enrollments: { some: { studentId: profile.id, status: 'ACTIVE' } } } }, select: { id: true, title: true, thumbnailAsset: { select: { secureUrl: true } } } });
  if (!week) throw new ApiError(404, 'Module not found', 'MODULE_NOT_FOUND');
  const materials = await prisma.courseMaterial.findMany({ where: { weekId: week.id }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, type: true, title: true, description: true, externalUrl: true, mediaAssetId: true } });
  return res.json({ data: { week: { id: week.id, title: week.title, thumbnailUrl: week.thumbnailAsset?.secureUrl ?? null }, materials: materials.map(({ mediaAssetId, ...material }) => ({ ...material, url: mediaAssetId ? `/api/v1/files/${mediaAssetId}` : material.externalUrl })) } });
}));

mediaRouter.post('/courses/:courseId/weeks/:weekId/thumbnail', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), uploadLimiter, validate({ params: weekParams }), singlePrivateFile, asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'A file is required in the "file" field', 'FILE_REQUIRED');
  const week = await prisma.courseWeek.findFirst({ where: { id: req.params.weekId, courseId: req.params.courseId }, select: { id: true, thumbnailAssetId: true } });
  if (!week) throw new ApiError(404, 'Module not found in this course', 'MODULE_NOT_FOUND');
  const upload = await uploadToCloudinary(req.file, { folder: 'vortex-lms/course-media/thumbnails', resourceType: 'image', deliveryType: 'upload', allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] });
  const asset = await saveMediaAsset(upload, { purpose: 'MODULE_THUMBNAIL', ownerUserId: req.auth.userId, courseId: req.params.courseId });
  try { await prisma.courseWeek.update({ where: { id: week.id }, data: { thumbnailAssetId: asset.id } }); }
  catch (error) { await removeMediaAsset(asset.id); throw error; }
  if (week.thumbnailAssetId) {
    try { await removeMediaAsset(week.thumbnailAssetId); } catch { console.error('Could not clean up replaced module thumbnail', { weekId: week.id }); }
  }
  return res.status(201).json({ data: { thumbnailUrl: asset.secureUrl, assetId: asset.id } });
}));

mediaRouter.post('/certificates', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), uploadLimiter, singleMetadataFile, validate({ body: certificateBody }), asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'A PDF file is required in the "file" field', 'FILE_REQUIRED');
  const [student, course] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { id: req.body.studentId }, select: { id: true } }),
    prisma.course.findUnique({ where: { id: req.body.courseId }, select: { id: true } }),
  ]);
  if (!student || !course) throw new ApiError(404, 'Student or course not found', 'CERTIFICATE_TARGET_NOT_FOUND');
  const upload = await uploadToCloudinary(req.file, { folder: 'vortex-lms/certificates', resourceType: 'raw', deliveryType: 'authenticated', allowedMimeTypes: ['application/pdf'] });
  const asset = await saveMediaAsset(upload, { purpose: 'CERTIFICATE', ownerUserId: req.auth.userId, courseId: course.id });
  try {
    const certificate = await prisma.certificate.create({ data: { studentId: student.id, courseId: course.id, certificateNumber: req.body.certificateNumber, storageKey: asset.id, mediaAssetId: asset.id }, select: { id: true, certificateNumber: true, issuedAt: true, studentId: true, courseId: true } });
    return res.status(201).json({ data: { certificate } });
  } catch (error) { await removeMediaAsset(asset.id); throw error; }
}));

mediaRouter.post('/assignments/:assignmentId/submissions', authenticate, authorize('STUDENT'), uploadLimiter, validate({ params: assignmentParam }), multipleSubmissionFiles, asyncHandler(async (req, res) => {
  if (!req.files?.length) throw new ApiError(400, 'At least one attachment is required in the "files" fields', 'FILE_REQUIRED');
  const profile = await prisma.studentProfile.findUnique({ where: { userId: req.auth.userId }, select: { id: true } });
  if (!profile) throw new ApiError(404, 'Student profile not found', 'PROFILE_NOT_FOUND');
  const assignment = await prisma.assignment.findFirst({ where: { id: req.params.assignmentId, isPublished: true, week: { course: { enrollments: { some: { studentId: profile.id, status: 'ACTIVE' } } } } }, select: { id: true, dueAt: true } });
  if (!assignment) throw new ApiError(404, 'Assignment not found', 'ASSIGNMENT_NOT_FOUND');
  if (assignment.dueAt && assignment.dueAt < new Date()) throw new ApiError(400, 'The assignment submission deadline has passed', 'SUBMISSION_CLOSED');
  const saved = [];
  try {
    for (const file of req.files) {
      const upload = await uploadToCloudinary(file, { folder: 'vortex-lms/student-submissions', resourceType: file.mimetype === 'application/pdf' || file.mimetype === 'application/zip' ? 'raw' : 'image', deliveryType: 'authenticated', allowedMimeTypes: allowedSubmissionTypes });
      const asset = await saveMediaAsset(upload, { purpose: 'ASSIGNMENT_ATTACHMENT', ownerUserId: req.auth.userId });
      saved.push(asset);
    }
    const submission = await prisma.$transaction(async (tx) => {
      const result = await tx.assignmentSubmission.upsert({ where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: profile.id } }, create: { assignmentId: assignment.id, studentId: profile.id }, update: { submittedAt: new Date() } });
      await tx.submissionAttachment.createMany({ data: saved.map((asset) => ({ submissionId: result.id, mediaAssetId: asset.id })) });
      return result;
    });
    return res.status(201).json({ data: { submissionId: submission.id, attachments: saved.map((asset) => ({ fileName: asset.originalFileName, downloadUrl: `/api/v1/files/${asset.id}` })), submittedAt: submission.submittedAt } });
  } catch (error) {
    for (const asset of saved) {
      try { await prisma.submissionAttachment.deleteMany({ where: { mediaAssetId: asset.id } }); await removeMediaAsset(asset.id); }
      catch { console.error('Could not clean up a failed submission attachment', { assetId: asset.id }); }
    }
    throw error;
  }
}));
