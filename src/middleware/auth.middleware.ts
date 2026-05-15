import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ApiResponse } from "../utils/ApiResponse";
import User, { type IUserLean } from "../models/User";
import { verifyAccessToken } from "../config/jwt";

export type AuthenticatedUser = IUserLean & { _id: string };

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      res.status(401).json(ApiResponse.error("Authentication token missing", 401));
      return;
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded._id)
      .select("-password -refreshToken")
      .lean<AuthenticatedUser | null>();

    if (!user || !user.isActive) {
      res.status(401).json(ApiResponse.error("Invalid token", 401));
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json(ApiResponse.error("Token expired", 401));
      return;
    }

    res.status(401).json(ApiResponse.error("Invalid token", 401));
  }
};
