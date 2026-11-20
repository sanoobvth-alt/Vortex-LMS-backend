import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { pageInfo, pagination } from '../../utils/pagination.js';

const enrollmentSelect = { id: true, status: true, enrolledAt: true, startedAt: true, completedAt: true,
  course: { select: { id: true, title: true, slug: true, description: true, thumbnailKey: true, durationWeeks: true } } };

export async function listEnrollments(userId, query) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new ApiError(404, 'Student profile not found', 'PROFILE_NOT_FOUND');
  const where = { studentId: profile.id };
  const [items, total] = await prisma.$transaction([
    prisma.enrollment.findMany({ where, ...pagination(query), orderBy: { enrolledAt: 'desc' }, select: enrollmentSelect }),
    prisma.enrollment.count({ where }),
  ]);
  return { items, pagination: pageInfo(query, total) };
}

export async function getEnrollment(userId, enrollmentId) {
  const enrollment = await prisma.enrollment.findFirst({ where: { id: enrollmentId, student: { userId } }, select: enrollmentSelect });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found', 'ENROLLMENT_NOT_FOUND');
  return enrollment;
}

export async function getEnrollmentWeeks(userId, enrollmentId) {
  const enrollment = await prisma.enrollment.findFirst({ where: { id: enrollmentId, student: { userId } }, select: { id: true, courseId: true } });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found', 'ENROLLMENT_NOT_FOUND');
  return prisma.courseWeek.findMany({ where: { courseId: enrollment.courseId, isPublished: true }, orderBy: { weekNumber: 'asc' }, select: {
    id: true, weekNumber: true, title: true, description: true,
    _count: { select: { assessments: { where: { isPublished: true } } } },
  } });
}
