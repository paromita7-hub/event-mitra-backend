import type { Request, Response, NextFunction } from "express";
import AdminAuditLog from "../models/AdminAuditLog";

type AuditAction =
  | "user_suspended"
  | "user_activated"
  | "user_banned"
  | "venue_approved"
  | "venue_rejected"
  | "venue_featured"
  | "venue_unfeatured"
  | "venue_suspended"
  | "event_paused"
  | "event_featured"
  | "event_cancelled"
  | "kyc_approved"
  | "kyc_rejected"
  | "payout_processed"
  | "payout_paid"
  | "review_removed"
  | "dispute_resolved"
  | "dispute_closed"
  | "dispute_message_sent"
  | "notification_sent"
  | "notification_deactivated"
  | "commission_updated"
  | "maintenance_toggled"
  | "booking_force_cancelled";

type AuditTargetType =
  | "user"
  | "venue"
  | "event"
  | "booking"
  | "ticket"
  | "payout"
  | "review"
  | "dispute"
  | "platform"
  | "kyc"
  | "notification";

export const getClientIp = (req: Request): string =>
  (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
  req.ip ||
  "unknown";

export const auditLog = async (
  req: Request,
  adminId: string,
  action: AuditAction,
  targetType: AuditTargetType,
  targetId: string | undefined,
  description: string,
  previousValue?: unknown,
  newValue?: unknown,
  targetRef?: string,
): Promise<void> => {
  try {
    await AdminAuditLog.create({
      admin: adminId,
      action,
      targetType,
      targetId: targetId || undefined,
      targetRef,
      description,
      previousValue,
      newValue,
      ipAddress: getClientIp(req),
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
};

export const withAudit =
  (
    action: AuditAction,
    targetType: AuditTargetType,
    getDescription: (req: Request) => string,
  ) =>
  (_req: Request, _res: Response, next: NextFunction): void => {
    void action;
    void targetType;
    void getDescription;
    next();
  };
