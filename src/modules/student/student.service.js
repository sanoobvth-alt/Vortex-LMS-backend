import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { pageInfo, pagination } from '../../utils/pagination.js';

async function getProfileId(userId) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new ApiError(404, 'Student profile not found', 'PROFILE_NOT_FOUND');
  return profile.id;
}

export async function listNotifications(userId, query) {
  const studentId = await getProfileId(userId);
  const where = { studentId };
  const [items, total] = await prisma.$transaction([
    prisma.notification.findMany({ where, ...pagination(query), orderBy: { createdAt: 'desc' }, select: { id: true, title: true, message: true, type: true, referenceType: true, referenceId: true, isRead: true, readAt: true, createdAt: true } }),
    prisma.notification.count({ where }),
  ]);
  return { items, pagination: pageInfo(query, total) };
}

export async function markNotificationRead(userId, notificationId) {
  const studentId = await getProfileId(userId);
  const notification = await prisma.notification.findFirst({ where: { id: notificationId, studentId }, select: { id: true, isRead: true, readAt: true } });
  if (!notification) throw new ApiError(404, 'Notification not found', 'NOTIFICATION_NOT_FOUND');
  if (notification.isRead) return notification;
  return prisma.notification.update({ where: { id: notification.id }, data: { isRead: true, readAt: new Date() }, select: { id: true, isRead: true, readAt: true } });
}

export async function listCertificates(userId, query) {
  const studentId = await getProfileId(userId);
  const where = { studentId };
  const [items, total] = await prisma.$transaction([
    prisma.certificate.findMany({ where, ...pagination(query), orderBy: { issuedAt: 'desc' }, select: { id: true, storageKey: true, certificateNumber: true, issuedAt: true, course: { select: { id: true, title: true, slug: true } } } }),
    prisma.certificate.count({ where }),
  ]);
  return { items: items.map(({ storageKey, ...certificate }) => ({ ...certificate, downloadUrl: `/api/v1/files/${storageKey}` })), pagination: pageInfo(query, total) };
}
