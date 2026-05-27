import mongoose, { Schema } from "mongoose";

const adminAuditLogSchema = new Schema(
  {
    admin: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: {
      type: String,
      enum: [
        "user_suspended",
        "user_activated",
        "user_banned",
        "venue_approved",
        "venue_rejected",
        "venue_featured",
        "venue_unfeatured",
        "venue_suspended",
        "event_paused",
        "event_featured",
        "event_cancelled",
        "kyc_approved",
        "kyc_rejected",
        "payout_processed",
        "payout_paid",
        "review_removed",
        "dispute_resolved",
        "dispute_closed",
        "notification_sent",
        "notification_deactivated",
        "commission_updated",
        "maintenance_toggled",
        "dispute_message_sent",
        "booking_force_cancelled",
      ],
      required: true,
    },
    targetType: {
      type: String,
      enum: ["user", "venue", "event", "booking", "ticket", "payout", "review", "dispute", "platform", "kyc", "notification"],
      required: true,
    },
    targetId: { type: Schema.Types.ObjectId },
    targetRef: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    ipAddress: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

adminAuditLogSchema.index({ admin: 1, createdAt: -1 });
adminAuditLogSchema.index({ action: 1 });

const AdminAuditLog =
  mongoose.models.AdminAuditLog ||
  mongoose.model("AdminAuditLog", adminAuditLogSchema, "admin_audit_logs");

export default AdminAuditLog;
