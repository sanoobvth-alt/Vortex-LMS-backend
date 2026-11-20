CREATE TYPE "MediaPurpose" AS ENUM ('COURSE_PDF', 'COURSE_THUMBNAIL', 'MODULE_THUMBNAIL', 'ASSIGNMENT_ATTACHMENT', 'PROFILE_PHOTO', 'IDENTITY_DOCUMENT', 'CERTIFICATE');
CREATE TYPE "CourseMaterialType" AS ENUM ('YOUTUBE_VIDEO', 'PDF_DOCUMENT', 'SELF_LEARNING_TOPIC');

ALTER TABLE "Certificate" ADD COLUMN "mediaAssetId" UUID;
ALTER TABLE "CourseWeek" ADD COLUMN "thumbnailKey" TEXT;
ALTER TABLE "Course" ADD COLUMN "thumbnailAssetId" UUID;
ALTER TABLE "CourseWeek" ADD COLUMN "thumbnailAssetId" UUID;
CREATE TABLE "MediaAsset" (
  "id" UUID NOT NULL, "publicId" TEXT NOT NULL, "cloudAssetId" TEXT, "secureUrl" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL, "deliveryType" TEXT NOT NULL, "format" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL, "fileSizeBytes" BIGINT NOT NULL, "originalFileName" TEXT NOT NULL,
  "folder" TEXT NOT NULL, "purpose" "MediaPurpose" NOT NULL, "deletionPending" BOOLEAN NOT NULL DEFAULT false, "ownerUserId" UUID NOT NULL,
  "courseId" UUID, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MediaAsset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MediaAsset_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MediaAsset_publicId_key" ON "MediaAsset"("publicId");
CREATE INDEX "MediaAsset_ownerUserId_purpose_createdAt_idx" ON "MediaAsset"("ownerUserId", "purpose", "createdAt");
CREATE INDEX "MediaAsset_courseId_purpose_idx" ON "MediaAsset"("courseId", "purpose");
ALTER TABLE "Course" ADD CONSTRAINT "Course_thumbnailAssetId_fkey" FOREIGN KEY ("thumbnailAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseWeek" ADD CONSTRAINT "CourseWeek_thumbnailAssetId_fkey" FOREIGN KEY ("thumbnailAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Course_thumbnailAssetId_key" ON "Course"("thumbnailAssetId");
CREATE UNIQUE INDEX "CourseWeek_thumbnailAssetId_key" ON "CourseWeek"("thumbnailAssetId");

CREATE TABLE "CourseMaterial" (
  "id" UUID NOT NULL, "courseId" UUID NOT NULL, "weekId" UUID NOT NULL, "type" "CourseMaterialType" NOT NULL,
  "title" TEXT NOT NULL, "description" TEXT, "externalUrl" TEXT, "mediaAssetId" UUID,
  "sortOrder" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseMaterial_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CourseMaterial_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CourseMaterial_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "CourseWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "CourseMaterial_mediaAssetId_key" ON "CourseMaterial"("mediaAssetId");
CREATE INDEX "CourseMaterial_weekId_sortOrder_idx" ON "CourseMaterial"("weekId", "sortOrder");

CREATE TABLE "Assignment" (
  "id" UUID NOT NULL, "courseId" UUID NOT NULL, "weekId" UUID NOT NULL, "title" TEXT NOT NULL,
  "description" TEXT NOT NULL, "isPublished" BOOLEAN NOT NULL DEFAULT false, "dueAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Assignment_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "CourseWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Assignment_weekId_isPublished_idx" ON "Assignment"("weekId", "isPublished");

CREATE TABLE "AssignmentSubmission" (
  "id" UUID NOT NULL, "assignmentId" UUID NOT NULL, "studentId" UUID NOT NULL,
  "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AssignmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_studentId_key" ON "AssignmentSubmission"("assignmentId", "studentId");
CREATE INDEX "AssignmentSubmission_studentId_submittedAt_idx" ON "AssignmentSubmission"("studentId", "submittedAt");

CREATE TABLE "SubmissionAttachment" (
  "id" UUID NOT NULL, "submissionId" UUID NOT NULL, "mediaAssetId" UUID NOT NULL,
  CONSTRAINT "SubmissionAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubmissionAttachment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssignmentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "SubmissionAttachment" ADD CONSTRAINT "SubmissionAttachment_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "SubmissionAttachment_mediaAssetId_key" ON "SubmissionAttachment"("mediaAssetId");
CREATE INDEX "SubmissionAttachment_submissionId_idx" ON "SubmissionAttachment"("submissionId");
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Certificate_mediaAssetId_key" ON "Certificate"("mediaAssetId");
