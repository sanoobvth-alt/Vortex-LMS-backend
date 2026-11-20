import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./auth.controller.js";
import * as schemas from "./auth.validation.js";

export const authRouter = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests; try again later",
    },
  },
});
const validateBody = (body) => validate({ body });

authRouter.post(
  "/register",
  authLimiter,
  validateBody(schemas.registerSchema),
  asyncHandler(controller.register),
);
authRouter.post(
  "/verify-otp",
  authLimiter,
  validateBody(schemas.verifyOtpSchema),
  asyncHandler(controller.verifyOtp),
);
authRouter.post(
  "/login",
  authLimiter,
  validateBody(schemas.loginSchema),
  asyncHandler(controller.login),
);
authRouter.post(
  "/forgot-password",
  authLimiter,
  validateBody(schemas.forgotPasswordSchema),
  asyncHandler(controller.forgotPassword),
);
authRouter.post(
  "/reset-password",
  authLimiter,
  validateBody(schemas.resetPasswordSchema),
  asyncHandler(controller.resetPassword),
);
authRouter.post(
  "/refresh",
  authLimiter,
  validateBody(schemas.emptySchema),
  asyncHandler(controller.refresh),
);
authRouter.post(
  "/logout",
  validateBody(schemas.emptySchema),
  asyncHandler(controller.logout),
);
authRouter.get("/me", authenticate, asyncHandler(controller.me));
