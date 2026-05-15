import mongoose, { Schema } from "mongoose";

export const notificationTypes = [
  "new_booking",
  "booking_confirmed",
  "booking_cancelled",
  "new_enquiry",
  "enquiry_replied",
  "payout_processed",
  "review_received",
  "listing_approved",
  "ticket_purchased",
  "system_alert",
  "promo",
] as const;

export type NotificationType = (typeof notificationTypes)[number];

const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: notificationTypes, required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    data: { type: Schema.Types.Mixed },
    isRead: { type: Boolean, default: false },
    actionRoute: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

export default Notification;
