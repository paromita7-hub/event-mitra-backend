import type { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse";

export const requireRole =
  (role: "customer" | "organizer") =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || req.user.role !== role) {
      res.status(403).json(ApiResponse.error("Access denied", 403));
      return;
    }

    next();
  };
