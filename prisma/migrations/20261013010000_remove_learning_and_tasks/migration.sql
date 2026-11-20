-- The Student Portal no longer includes the Learning or task/submission modules.
-- These cascades remove their dependent lesson resources, progress, and bookmarks.
DROP TABLE IF EXISTS "Bookmark" CASCADE;
DROP TABLE IF EXISTS "TaskSubmission" CASCADE;
DROP TABLE IF EXISTS "LessonProgress" CASCADE;
DROP TABLE IF EXISTS "LessonResource" CASCADE;
DROP TABLE IF EXISTS "Task" CASCADE;
DROP TABLE IF EXISTS "Lesson" CASCADE;

DROP TYPE IF EXISTS "ResourceType";
DROP TYPE IF EXISTS "LessonProgressStatus";
DROP TYPE IF EXISTS "SubmissionType";
DROP TYPE IF EXISTS "SubmissionStatus";
