import { randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { deleteFromCloudinary } from './cloudinaryStorage.js';

export async function saveMediaAsset(upload, { purpose, ownerUserId, courseId = null }) {
  const { assetId: cloudAssetId, ...metadata } = upload;
  return prisma.mediaAsset.create({ data: { id: randomUUID(), ...metadata, cloudAssetId, purpose, ownerUserId, courseId } });
}

export async function removeMediaAsset(assetId) {
  const asset = await prisma.mediaAsset.update({ where: { id: assetId }, data: { deletionPending: true } }).catch((error) => {
    if (error.code === 'P2025') return null;
    throw error;
  });
  if (!asset) return;
  await deleteFromCloudinary({ publicId: asset.publicId, resourceType: asset.resourceType, deliveryType: asset.deliveryType });
  await prisma.mediaAsset.delete({ where: { id: assetId } });
}

export async function getOwnedMediaAsset(userId, assetId) {
  const asset = await prisma.mediaAsset.findFirst({ where: { id: assetId, deletionPending: false, OR: [
    { ownerUserId: userId },
    { purpose: 'COURSE_PDF', courseId: { not: null }, course: { enrollments: { some: { student: { userId }, status: 'ACTIVE' } } } },
    { purpose: 'CERTIFICATE', certificate: { student: { userId } } },
  ] } });
  if (!asset) throw new ApiError(404, 'File not found', 'FILE_NOT_FOUND');
  return asset;
}
