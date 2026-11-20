import * as service from './enrollments.service.js';

export const list = async (req, res) => res.json({ data: await service.listEnrollments(req.auth.userId, req.query) });
export const get = async (req, res) => res.json({ data: { enrollment: await service.getEnrollment(req.auth.userId, req.params.enrollmentId) } });
export const weeks = async (req, res) => res.json({ data: { weeks: await service.getEnrollmentWeeks(req.auth.userId, req.params.enrollmentId) } });
