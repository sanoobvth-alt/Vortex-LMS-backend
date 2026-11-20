import * as service from './progress.service.js';

export const getProgress = async (req, res) => res.json({ data: await service.getProgress(req.auth.userId, req.query) });
export const getDashboard = async (req, res) => res.json({ data: await service.getDashboard(req.auth.userId) });
