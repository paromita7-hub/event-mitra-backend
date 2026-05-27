import mongoose, { Schema } from "mongoose";

const platformNotificationSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["promo", "announcement", "maintenance", "feature"],
      default: "announcement",
    },
    targetRole: {
      type: String,
      enum: ["all", "customer", "organizer"],
      default: "all",
    },
    targetCity: { type: String, trim: true },
    promoCode: { type: String, trim: true },
    promoDiscount: { type: Number },
    promoExpiresAt: { type: Date },
    sentBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sentAt: { type: Date, default: Date.now },
    recipientCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const PlatformNotification =
  mongoose.models.PlatformNotification ||
  mongoose.model("PlatformNotification", platformNotificationSchema, "platform_notifications");

export default PlatformNotification;
