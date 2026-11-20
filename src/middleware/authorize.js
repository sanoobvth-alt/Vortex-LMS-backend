import { ApiError } from '../utils/ApiError.js';

export const authorize = (...roles) => (req, _res, next) => {
  if (!req.auth || !roles.includes(req.auth.role)) return next(new ApiError(403, 'Access denied', 'FORBIDDEN'));
  next();
};
