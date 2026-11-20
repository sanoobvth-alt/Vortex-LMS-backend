import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { downloadPrivateFile } from './profile.controller.js';
import { fileParams } from './file.validation.js';

export const filesRouter = Router();
filesRouter.get('/:storageKey', authenticate, authorize('STUDENT'), validate({ params: fileParams }), asyncHandler(downloadPrivateFile));
