import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './student.controller.js';
import * as schemas from './student.validation.js';

export const studentRouter = Router();
studentRouter.use(authenticate, authorize('STUDENT'));
studentRouter.get('/notifications', validate({ query: schemas.listQuery }), asyncHandler(controller.notifications));
studentRouter.patch('/notifications/:notificationId/read', validate({ params: schemas.notificationParams, body: schemas.emptyBody }), asyncHandler(controller.markRead));
studentRouter.get('/certificates', validate({ query: schemas.listQuery }), asyncHandler(controller.certificates));
