import rateLimit from "express-rate-limit";
import { ApiResponse } from "../utils/ApiResponse";

const createLimiter = (max: number) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json(ApiResponse.error("Too many requests, please try again later", 429));
    },
  });

export const authRateLimit = createLimiter(10);
export const otpRateLimit = createLimiter(5);
export const generalRateLimit = createLimiter(100);
