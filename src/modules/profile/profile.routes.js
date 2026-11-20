import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './profile.controller.js';
import { updateProfileSchema } from './profile.validation.js';
import { uploadDocumentBody, uploadPhotoBody } from './profile.validation.js';
import { singlePrivateFile, uploadLimiter } from '../../middleware/upload.js';

export const profileRouter = Router();
profileRouter.use(authenticate, authorize('STUDENT'));
profileRouter.get('/', asyncHandler(controller.getProfile));
profileRouter.patch('/', validate({ body: updateProfileSchema }), asyncHandler(controller.updateProfile));
profileRouter.post('/photo', uploadLimiter, singlePrivateFile, validate({ body: uploadPhotoBody }), asyncHandler(controller.uploadPhoto));
profileRouter.post('/documents', uploadLimiter, singlePrivateFile, validate({ body: uploadDocumentBody }), asyncHandler(controller.uploadDocument));
