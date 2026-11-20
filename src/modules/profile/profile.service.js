import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

export function buildProfileUpdate(current, input) {
  const highestQualification = input.highestQualification ?? current.highestQualification;
  const otherQualification = highestQualification === 'OTHER'
    ? (input.otherQualification !== undefined ? input.otherQualification : current.otherQualification)
    : null;

  if (highestQualification === 'OTHER' && !otherQualification) {
    throw new ApiError(400, 'otherQualification is required when highestQualification is OTHER', 'VALIDATION_ERROR');
  }

  const data = {};
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.highestQualification !== undefined) data.highestQualification = highestQualification;
  if (input.otherQualification !== undefined || (input.highestQualification && highestQualification !== current.highestQualification)) {
    data.otherQualification = otherQualification;
  }
  return data;
}

export async function getProfile(userId) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId }, include: { documents: { orderBy: { createdAt: 'desc' }, select: { id: true, storageKey: true, documentType: true, originalFileName: true, mimeType: true, fileSizeBytes: true, verificationStatus: true, verifiedAt: true, createdAt: true } } } });
  if (!profile) throw new ApiError(404, 'Student profile not found', 'PROFILE_NOT_FOUND');
  return presentProfile(profile);
}

function presentProfile(profile) {
  const { profilePhotoKey, documents = [], ...fields } = profile;
  return { ...fields, profilePhotoUrl: profilePhotoKey ? `/api/v1/files/${profilePhotoKey}` : null, documents: documents.map((document) => {
    const { storageKey, ...metadata } = document;
    return { ...metadata, fileSizeBytes: Number(metadata.fileSizeBytes), downloadUrl: `/api/v1/files/${storageKey}` };
  }) };
}

export async function updateProfile(userId, input) {
  const current = await getProfile(userId);
  const data = buildProfileUpdate(current, input);
  if (Object.keys(data).length === 0) return presentProfile(current);
  await prisma.studentProfile.update({ where: { id: current.id }, data });
  return getProfile(userId);
}

export async function updateProfilePhoto(userId, storageKey) {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.studentProfile.findUnique({ where: { userId }, select: { id: true, profilePhotoKey: true } });
    if (!profile) throw new ApiError(404, 'Student profile not found', 'PROFILE_NOT_FOUND');
    const updated = await tx.studentProfile.update({ where: { id: profile.id }, data: { profilePhotoKey: storageKey }, include: { documents: { orderBy: { createdAt: 'desc' }, select: { id: true, storageKey: true, documentType: true, originalFileName: true, mimeType: true, fileSizeBytes: true, verificationStatus: true, verifiedAt: true, createdAt: true } } } });
    return { profile: presentProfile(updated), previousStorageKey: profile.profilePhotoKey };
  });
}

export async function createStudentDocument(userId, input, storedFile) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new ApiError(404, 'Student profile not found', 'PROFILE_NOT_FOUND');
  const document = await prisma.studentDocument.create({ data: {
    studentId: profile.id,
    documentType: input.documentType,
    storageKey: storedFile.storageKey,
    originalFileName: input.originalFileName,
    mimeType: storedFile.mimeType,
    fileSizeBytes: BigInt(storedFile.fileSizeBytes),
  }, select: { id: true, documentType: true, originalFileName: true, mimeType: true, fileSizeBytes: true, verificationStatus: true, createdAt: true } });
  return { ...document, fileSizeBytes: Number(document.fileSizeBytes), downloadUrl: `/api/v1/files/${storedFile.storageKey}` };
}

export async function getOwnedFile(userId, storageKey) {
  const mediaAsset = await prisma.mediaAsset.findUnique({ where: { id: storageKey } });
  if (mediaAsset) {
    const photoAsset = await prisma.studentProfile.findFirst({ where: { userId, profilePhotoKey: storageKey }, select: { id: true } });
    const documentAsset = await prisma.studentDocument.findFirst({ where: { storageKey, student: { userId } }, select: { originalFileName: true, mimeType: true } });
    const certificateAsset = await prisma.certificate.findFirst({ where: { mediaAssetId: storageKey, student: { userId } }, select: { id: true } });
    const submissionAttachment = await prisma.submissionAttachment.findFirst({ where: { mediaAssetId: storageKey, submission: { student: { userId } } }, select: { id: true } });
    if (photoAsset) return { mimeType: mediaAsset.mimeType, fileName: 'profile-photo', inline: true, category: 'PROFILE_PHOTO' };
    if (documentAsset) return { mimeType: documentAsset.mimeType, fileName: documentAsset.originalFileName, inline: false, category: 'IDENTITY_DOCUMENT' };
    if (certificateAsset) return { mimeType: mediaAsset.mimeType, fileName: 'certificate.pdf', inline: false, category: 'CERTIFICATE' };
    if (submissionAttachment) return { mimeType: mediaAsset.mimeType, fileName: mediaAsset.originalFileName, inline: false, category: 'ASSIGNMENT_ATTACHMENT' };
    if (mediaAsset.purpose === 'COURSE_PDF' && mediaAsset.courseId) {
      const enrollment = await prisma.enrollment.findFirst({ where: { courseId: mediaAsset.courseId, status: 'ACTIVE', student: { userId } }, select: { id: true } });
      if (enrollment) return { mimeType: mediaAsset.mimeType, fileName: mediaAsset.originalFileName, inline: false, category: 'COURSE_PDF' };
    }
    throw new ApiError(404, 'File not found', 'FILE_NOT_FOUND');
  }
  const photo = await prisma.studentProfile.findFirst({ where: { userId, profilePhotoKey: storageKey }, select: { id: true } });
  if (photo) return { mimeType: mimeTypeFromKey(storageKey), fileName: 'profile-photo', inline: true, category: 'PROFILE_PHOTO' };
  const document = await prisma.studentDocument.findFirst({ where: { storageKey, student: { userId } }, select: { originalFileName: true, mimeType: true } });
  if (document) return { mimeType: document.mimeType, fileName: document.originalFileName, inline: false, category: 'IDENTITY_DOCUMENT' };
  const certificate = await prisma.certificate.findFirst({ where: { storageKey, student: { userId } }, select: { id: true } });
  if (certificate) return { mimeType: 'application/pdf', fileName: 'certificate.pdf', inline: false, category: 'CERTIFICATE' };
  throw new ApiError(404, 'File not found', 'FILE_NOT_FOUND');
}

function mimeTypeFromKey(key) {
  const extension = key.split('.').at(-1)?.toLowerCase();
  return ({ pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' })[extension] ?? 'application/octet-stream';
}
