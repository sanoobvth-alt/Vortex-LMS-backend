import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './progress.controller.js';
import { listQuery } from './progress.validation.js';

export const progressRouter = Router();
progressRouter.use(authenticate, authorize('STUDENT'));
progressRouter.get('/dashboard', asyncHandler(controller.getDashboard));
progressRouter.get('/progress', validate({ query: listQuery }), asyncHandler(controller.getProgress));
