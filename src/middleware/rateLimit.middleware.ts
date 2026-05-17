import rateLimit from "express-rate-limit";
import { ApiResponse } from "../utils/ApiResponse";

const isProduction = process.env.NODE_ENV === "production";

const createLimiter = (max: number, windowMs = 15 * 60 * 1000) =>
  rateLimit({
    windowMs,
    max: isProduction ? max : max * 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !isProduction,
    handler: (_req, res) => {
      res.status(429).json(ApiResponse.error("Too many requests, please try again later", 429));
    },
  });

export const loginRateLimit = createLimiter(20, 10 * 60 * 1000);
export const refreshTokenRateLimit = createLimiter(60, 10 * 60 * 1000);
export const authRateLimit = createLimiter(30);
export const otpRateLimit = createLimiter(10);
export const generalRateLimit = createLimiter(500);
