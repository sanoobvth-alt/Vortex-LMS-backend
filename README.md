# Vortex LMS API

Student Portal backend using Node.js JavaScript ES modules, Express, Prisma, PostgreSQL, and Zod, including student APIs and media/course-content APIs guarded by existing Admin and Super Admin roles.

## Current implementation phase

Implemented: student profile, course catalog, enrollments, assessments and attempts, notifications, assessment progress, dashboard, certificates, Cloudinary media records, course materials, profile/document uploads, and assignment attachment uploads. Content administration uses the existing `ADMIN` and `SUPER_ADMIN` roles; this backend has no Academic role.

The original schema migrations were previously verified against a clean PostgreSQL 18 database. The Cloudinary media migration added in this change has not been applied to a database; apply it to the intended PostgreSQL environment before using the new APIs. A production SMS provider must also be selected/configured before production registration or password reset can deliver codes. Text assessment answers remain pending external grading because reviewer/admin grading APIs are out of scope.

Identity-document uploads are intended only for student identity verification. The business retention period has not been specified, and this phase does not automatically delete identity documents; define a retention/deletion policy before collecting real identity documents in production. Private file reads are ownership-checked and audit-logged.

## Requirements and setup

Use Node.js 20.19 or newer and PostgreSQL. This project uses Prisma ORM 7.10 with `@prisma/adapter-pg`; copy `.env.example` to `.env`, set a PostgreSQL `DATABASE_URL`, and generate a random `JWT_ACCESS_SECRET` with at least 32 characters. Set `COOKIE_SECURE=true` for production HTTPS deployments. `FRONTEND_URL` must match the portal origin, and `ACTIVITY_TIMEZONE` controls streak calendar days. To enable Cloudinary, set `UPLOAD_PROVIDER=cloudinary` and provide `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the backend `.env` only. Never place the API secret in frontend configuration. The application upload limit defaults to 5 MiB per file. Check the plan-specific image/raw upload limits in the Cloudinary console before raising it; account limits have not been checked.

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

`npm run db:seed` adds only clearly labeled sample course content and does not create student or identity records. See `openapi.yaml` for the OpenAPI 3.1 contract. Local uploads are stored under `.private-uploads/`, which is git-ignored and never served statically. Set `UPLOAD_PROVIDER=cloudinary` for Cloudinary-backed routes; leave it as `local` for the existing local adapter.

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
- `POST /api/v1/profile/photo` and `/documents` validate size, declared MIME and file signature. With Cloudinary enabled, file downloads are ownership-checked by the API before a short-lived authenticated delivery URL is issued; legacy local keys remain supported.
- Admin-only `POST /api/v1/courses/:courseId/thumbnail` and `/materials` support thumbnails, PDFs, YouTube URLs, and self-learning topics. YouTube remains an external URL and is never uploaded.
- Student-only `POST /api/v1/assignments/:assignmentId/submissions` accepts up to five authenticated attachments. Supported types are PDF, JPEG, PNG, WebP, and ZIP; the per-file limit defaults to 5 MiB.
- `GET /api/v1/courses` and `/courses/:courseId`, `/enrollments`, `/enrollments/:enrollmentId`, `/enrollments/:enrollmentId/weeks`, and assessment routes are student-authenticated and check enrollment ownership.
- `/notifications`, `/progress`, `/dashboard`, and `/certificates` are student-scoped and paginated where they return lists.

Responses use `{ "data": ... }`; errors use `{ "error": { "code", "message" } }`. Validation errors include field details. Refresh cookies are scoped to `/api/v1/auth`; when cross-site deployment requires `SameSite=None`, also enable secure cookies and configure CORS for the exact frontend origin.

## Progress calculation

Course and week progress use the rounded percentage of published assessments with an evaluated passing score. Dashboard assessment average uses the best evaluated percentage per assessment. Activity streaks count assessment submissions by calendar date in `ACTIVITY_TIMEZONE`.

## Tests

`npm test` runs unit, HTTP middleware, calculation, upload-signature, and OpenAPI parse checks without PostgreSQL. With a clean seeded PostgreSQL database, set `RUN_DATABASE_TESTS=1` and run `npm test` to include the database-backed student API flow. Migration application was verified against a clean temporary PostgreSQL 18 database; production deployment still requires configuring and migrating its target database.
