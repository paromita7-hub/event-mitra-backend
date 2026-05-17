import type { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse";

export const requireRole =
  (role: "customer" | "organizer" | ("customer" | "organizer")[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(403).json(ApiResponse.error("Access denied", 403));
      return;
    }

    const allowedRoles = Array.isArray(role) ? role : [role];
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json(ApiResponse.error("Access denied", 403));
      return;
    }

    next();
  };
