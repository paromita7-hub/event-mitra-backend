import type { AuthenticatedUser } from "../middleware/auth.middleware";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      passwordResetVerifiedEmail?: string;
    }
  }
}

export {};
