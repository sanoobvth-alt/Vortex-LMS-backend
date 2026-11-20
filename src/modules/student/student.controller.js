import * as service from './student.service.js';

export const notifications = async (req, res) => res.json({ data: await service.listNotifications(req.auth.userId, req.query) });
export const markRead = async (req, res) => res.json({ data: { notification: await service.markNotificationRead(req.auth.userId, req.params.notificationId) } });
export const certificates = async (req, res) => res.json({ data: await service.listCertificates(req.auth.userId, req.query) });
