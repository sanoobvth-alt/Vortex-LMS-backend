import * as service from './assessments.service.js';

export const list = async (req, res) => res.json({ data: await service.listAssessments(req.auth.userId, req.query) });
export const get = async (req, res) => res.json({ data: { assessment: await service.getAssessment(req.auth.userId, req.params.assessmentId) } });
export const start = async (req, res) => res.status(201).json({ data: { attempt: await service.startAttempt(req.auth.userId, req.params.assessmentId) } });
export const answers = async (req, res) => res.json({ data: { answers: await service.saveAnswers(req.auth.userId, req.params.attemptId, req.body.answers) } });
export const submit = async (req, res) => res.json({ data: { attempt: await service.submitAttempt(req.auth.userId, req.params.attemptId) } });
export const result = async (req, res) => res.json({ data: { result: await service.getAttemptResult(req.auth.userId, req.params.attemptId) } });
