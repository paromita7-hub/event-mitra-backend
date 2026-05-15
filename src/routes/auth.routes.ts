import { Router } from "express";
import {
  forgotPassword,
  login,
  logout,
  refreshToken,
  register,
  resendOtp,
  resetPassword,
  verifyOtpController,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { authRateLimit, otpRateLimit } from "../middleware/rateLimit.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resendOtpSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from "../validators/auth.validator";

const router = Router();

router.post("/register", authRateLimit, validate(registerSchema), register);
router.post("/verify-otp", otpRateLimit, validate(verifyOtpSchema), verifyOtpController);
router.post("/resend-otp", otpRateLimit, validate(resendOtpSchema), resendOtp);
router.post("/login", authRateLimit, validate(loginSchema), login);
router.post("/refresh-token", authRateLimit, validate(refreshTokenSchema), refreshToken);
router.post("/logout", requireAuth, validate(refreshTokenSchema), logout);
router.post("/forgot-password", otpRateLimit, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", authRateLimit, validate(resetPasswordSchema), resetPassword);

export default router;
