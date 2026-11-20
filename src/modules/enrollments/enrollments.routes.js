import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './enrollments.controller.js';
import * as schemas from './enrollments.validation.js';

export const enrollmentsRouter = Router();
enrollmentsRouter.use(authenticate, authorize('STUDENT'));
enrollmentsRouter.get('/', validate({ query: schemas.listQuery }), asyncHandler(controller.list));
enrollmentsRouter.get('/:enrollmentId', validate({ params: schemas.enrollmentParams }), asyncHandler(controller.get));
enrollmentsRouter.get('/:enrollmentId/weeks', validate({ params: schemas.enrollmentParams }), asyncHandler(controller.weeks));
