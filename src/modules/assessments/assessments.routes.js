import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './assessments.controller.js';
import * as schemas from './assessments.validation.js';

export const assessmentsRouter = Router();
export const attemptsRouter = Router();
assessmentsRouter.use(authenticate, authorize('STUDENT'));
attemptsRouter.use(authenticate, authorize('STUDENT'));
assessmentsRouter.get('/', validate({ query: schemas.listQuery }), asyncHandler(controller.list));
assessmentsRouter.get('/:assessmentId', validate({ params: schemas.assessmentParams }), asyncHandler(controller.get));
assessmentsRouter.post('/:assessmentId/attempts', validate({ params: schemas.assessmentParams, body: schemas.emptyBody }), asyncHandler(controller.start));
attemptsRouter.put('/:attemptId/answers', validate({ params: schemas.attemptParams, body: schemas.answersBody }), asyncHandler(controller.answers));
attemptsRouter.post('/:attemptId/submit', validate({ params: schemas.attemptParams, body: schemas.emptyBody }), asyncHandler(controller.submit));
attemptsRouter.get('/:attemptId/result', validate({ params: schemas.attemptParams }), asyncHandler(controller.result));
