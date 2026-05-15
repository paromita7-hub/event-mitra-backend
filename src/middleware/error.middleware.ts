import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError";

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const isDevelopment = process.env.NODE_ENV === "development";

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
      ...(isDevelopment ? { stack: err.stack } : {}),
    });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ success: false, message: "Invalid ID" });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: Object.values(err.errors).map((value) => ({
        path: value.path,
        message: value.message,
      })),
      ...(isDevelopment ? { stack: err.stack } : {}),
    });
    return;
  }

  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  ) {
    res.status(409).json({ success: false, message: "Already exists" });
    return;
  }

  if (err instanceof jwt.JsonWebTokenError) {
    res.status(401).json({ success: false, message: "Invalid token" });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  const stack = err instanceof Error ? err.stack : undefined;

  res.status(500).json({
    success: false,
    message,
    ...(isDevelopment ? { stack } : {}),
  });
};
