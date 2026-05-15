import jwt, { type SignOptions } from "jsonwebtoken";
import type { StringValue } from "ms";

type JwtPayload = {
  _id: string;
  email: string;
  role: "customer" | "organizer";
};

const getSecret = (secret?: string): string => {
  if (!secret) {
    throw new Error("JWT secret is not configured");
  }

  return secret;
};

const signToken = (
  payload: JwtPayload,
  secret: string | undefined,
  expiresIn: string | undefined,
): string => {
  const options: SignOptions = expiresIn ? { expiresIn: expiresIn as StringValue } : {};
  return jwt.sign(payload, getSecret(secret), options);
};

export const signAccessToken = (payload: JwtPayload): string =>
  signToken(payload, process.env.JWT_SECRET, process.env.JWT_EXPIRES_IN);

export const signRefreshToken = (payload: JwtPayload): string =>
  signToken(payload, process.env.JWT_REFRESH_SECRET, process.env.JWT_REFRESH_EXPIRES_IN);

export const verifyAccessToken = (token: string): JwtPayload =>
  jwt.verify(token, getSecret(process.env.JWT_SECRET)) as JwtPayload;

export const verifyRefreshToken = (token: string): JwtPayload =>
  jwt.verify(token, getSecret(process.env.JWT_REFRESH_SECRET)) as JwtPayload;
