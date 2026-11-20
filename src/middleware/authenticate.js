import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';

export function authenticate(req, _res, next) {
  const value = req.get('authorization');
  if (!value?.startsWith('Bearer ')) return next(new ApiError(401, 'Authentication required', 'UNAUTHENTICATED'));
  try {
    const claims = jwt.verify(value.slice(7), process.env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
    if (claims.typ !== 'access' || typeof claims.sub !== 'string') throw new Error('Invalid access token');
    req.auth = { userId: claims.sub, role: claims.role };
    next();
  } catch {
    next(new ApiError(401, 'Authentication required', 'UNAUTHENTICATED'));
  }
}
