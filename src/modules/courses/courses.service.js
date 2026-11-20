import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { pageInfo, pagination } from "../../utils/pagination.js";

export async function listCourses(query) {
  const where = {
    status: "PUBLISHED",
    ...(query.search
      ? { title: { contains: query.search, mode: "insensitive" } }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.course.findMany({
      where,
      ...pagination(query),
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        thumbnailKey: true,
        thumbnailAsset: { select: { secureUrl: true } },
        durationWeeks: true,
        createdAt: true,
      },
    }),
    prisma.course.count({ where }),
  ]);
  return { items: items.map(({ thumbnailAsset, ...course }) => ({ ...course, thumbnailUrl: thumbnailAsset?.secureUrl ?? null })), pagination: pageInfo(query, total) };
}

export async function getCourse(courseId) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      thumbnailKey: true,
      thumbnailAsset: { select: { secureUrl: true } },
      durationWeeks: true,
      weeks: {
        where: { isPublished: true },
        orderBy: { weekNumber: "asc" },
        select: {
          id: true,
          weekNumber: true,
          title: true,
          description: true,
          thumbnailAsset: { select: { secureUrl: true } },
          assessments: {
            where: { isPublished: true },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              title: true,
              description: true,
              durationMinutes: true,
              totalMarks: true,
              passingMarks: true,
            },
          },
        },
      },
    },
  });
  if (!course) throw new ApiError(404, "Course not found", "COURSE_NOT_FOUND");
  return { ...course, thumbnailUrl: course.thumbnailAsset?.secureUrl ?? null, weeks: course.weeks.map(({ thumbnailAsset, ...week }) => ({ ...week, thumbnailUrl: thumbnailAsset?.secureUrl ?? null })) };
}
