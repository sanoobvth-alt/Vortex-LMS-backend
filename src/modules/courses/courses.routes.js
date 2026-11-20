import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './courses.controller.js';
import * as schemas from './courses.validation.js';

export const coursesRouter = Router();
coursesRouter.use(authenticate, authorize('STUDENT'));
coursesRouter.get('/', validate({ query: schemas.listCoursesQuery }), asyncHandler(controller.list));
coursesRouter.get('/:courseId', validate({ params: schemas.uuidParams }), asyncHandler(controller.get));
