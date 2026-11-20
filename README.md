# Vortex LMS API

Student Portal backend foundation using Node.js JavaScript ES modules, Express, Prisma, PostgreSQL, and Zod. Administration and Super Admin APIs are out of scope and are not implemented.

## Current implementation phase

Implemented: student profile, course catalog, enrollments, assessments and attempts, notifications, assessment progress, dashboard, certificates, and private local-development profile/document uploads. Learning content/playback, task assignments/submissions, and lesson bookmarks have been removed from the API and database schema. The follow-up migration was applied and verified on clean PostgreSQL 18. Applying it to a database with existing learning/task data permanently drops lessons, resources, playback progress, tasks, submissions, and bookmarks.

The initial and module-removal migrations were applied with Prisma 7.10 to a clean temporary PostgreSQL 18 database, the sample seed ran through Prisma's configured seed command, and all 21 unit, HTTP, and database integration tests passed. This verifies schema deployment and the covered flows; configure and migrate the intended persistent database as part of deployment. Local private uploads use an authenticated development adapter; production object storage must be configured before production startup. A production SMS provider must also be selected/configured before production registration or password reset can deliver codes. Text assessment answers remain pending external grading because reviewer/admin APIs are out of scope.

Identity-document uploads are intended only for student identity verification. The business retention period has not been specified, and this phase does not automatically delete identity documents; define a retention/deletion policy before collecting real identity documents in production. Private file reads are ownership-checked and audit-logged.

## Requirements and setup

Use Node.js 20.19 or newer and PostgreSQL. This project uses Prisma ORM 7.10 with `@prisma/adapter-pg`; copy `.env.example` to `.env`, set a PostgreSQL `DATABASE_URL`, and generate a random `JWT_ACCESS_SECRET` with at least 32 characters. Set `COOKIE_SECURE=true` for production HTTPS deployments. `FRONTEND_URL` must match the portal origin, and `ACTIVITY_TIMEZONE` controls streak calendar days. The schema retains Prisma's JavaScript-compatible `prisma-client-js` generator to avoid generated TypeScript files; Prisma recommends its new `prisma-client` generator for new Prisma 7 projects.

Runtime configuration is loaded from `.env` by `dotenv` and read directly from `process.env`; it is not Zod-validated. Zod remains in use to validate API request bodies, parameters, and queries.

```sh
npm install
npx prisma format
npx prisma validate
npx prisma migrate dev
npm run prisma:generate
npm run prisma:seed
npm run dev
npm test
```

The migration command requires a reachable PostgreSQL database. Schema changes should use Prisma migrations; do not use `prisma db push` as the production workflow.

`npm run db:seed` adds only clearly labeled sample course content and does not create student or identity records. See `openapi.yaml` for the OpenAPI 3.1 contract. Local uploads are stored under `.private-uploads/`, which is git-ignored and never served statically. Set `UPLOAD_PROVIDER=none` to disable local upload handling. Production startup rejects the local provider; a production storage adapter still needs to be selected and implemented.

## API foundation

All routes use `/api/v1`. `GET /api/v1/health` is public.

Auth routes:

- `POST /api/v1/auth/register` accepts phone (E.164), password (12–72 characters), fullName and highestQualification. Role is never accepted from the client. It creates a pending student and starts registration OTP delivery. In development only, the mock includes a `developmentOtp` in the response; production never returns/logs OTPs.
- `POST /api/v1/auth/verify-otp` accepts phone and a six-digit OTP and activates the pending account.
- `POST /api/v1/auth/login` returns a short-lived bearer access token and sets the opaque refresh token in an HTTP-only cookie. Errors for unknown phones and bad passwords are generic.
- `POST /api/v1/auth/forgot-password` and `/reset-password` support OTP-based reset. Reset revokes existing refresh sessions.
- `POST /api/v1/auth/refresh` rotates the refresh cookie. Concurrent reuse of a rotated token fails.
- `POST /api/v1/auth/logout` revokes the presented refresh cookie and clears it.
- `GET /api/v1/auth/me` requires `Authorization: Bearer <access-token>`.
- `GET /api/v1/profile` returns the authenticated student's profile.
- `PATCH /api/v1/profile` accepts only `fullName`, `highestQualification`, and `otherQualification`; the service enforces the `OTHER` qualification rule. Phone, role, student code, and storage keys cannot be changed through this endpoint.
- `POST /api/v1/profile/photo` and `/documents` validate size, declared MIME and file signature; file downloads require authentication and ownership. Local private disk storage is development-only.
- `GET /api/v1/courses` and `/courses/:courseId`, `/enrollments`, `/enrollments/:enrollmentId`, `/enrollments/:enrollmentId/weeks`, and assessment routes are student-authenticated and check enrollment ownership.
- `/notifications`, `/progress`, `/dashboard`, and `/certificates` are student-scoped and paginated where they return lists.

Responses use `{ "data": ... }`; errors use `{ "error": { "code", "message" } }`. Validation errors include field details. Refresh cookies are scoped to `/api/v1/auth`; when cross-site deployment requires `SameSite=None`, also enable secure cookies and configure CORS for the exact frontend origin.

## Progress calculation

Course and week progress use the rounded percentage of published assessments with an evaluated passing score. Dashboard assessment average uses the best evaluated percentage per assessment. Activity streaks count assessment submissions by calendar date in `ACTIVITY_TIMEZONE`.

## Tests

`npm test` runs unit, HTTP middleware, calculation, upload-signature, and OpenAPI parse checks without PostgreSQL. With a clean seeded PostgreSQL database, set `RUN_DATABASE_TESTS=1` and run `npm test` to include the database-backed student API flow. Migration application was verified against a clean temporary PostgreSQL 18 database; production deployment still requires configuring and migrating its target database.
