import * as service from './courses.service.js';

export const list = async (req, res) => res.json({ data: await service.listCourses(req.query) });
export const get = async (req, res) => res.json({ data: { course: await service.getCourse(req.params.courseId) } });
