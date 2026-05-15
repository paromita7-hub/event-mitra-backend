import mongoose, { Schema } from "mongoose";
import { makeBookingRef } from "../utils/model.utils";

const bookingSchema = new Schema(
  {
    bookingRef: { type: String, unique: true, default: makeBookingRef },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    venue: { type: Schema.Types.ObjectId, ref: "Venue", required: true },
    eventType: { type: String, required: true, trim: true },
    eventDate: { type: Date, required: true },
    eventTime: { type: String, trim: true },
    guestCount: { type: Number, required: true },
    specialRequests: { type: String, trim: true },
    pricing: {
      venueCharge: { type: Number, default: 0 },
      addOns: { type: Number, default: 0 },
      subtotal: { type: Number, default: 0 },
      platformCommission: { type: Number, default: 0 },
      organizerPayout: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
    },
    payment: {
      advancePaid: { type: Number, default: 0 },
      balanceDue: { type: Number, default: 0 },
      paymentStatus: {
        type: String,
        enum: ["pending", "partial", "paid"],
        default: "pending",
      },
      paymentMethod: { type: String, trim: true },
    },
    status: {
      type: String,
      enum: ["pending_approval", "confirmed", "cancelled", "completed"],
      default: "pending_approval",
    },
    cancellation: {
      cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
      cancelledAt: { type: Date },
      reason: { type: String, trim: true },
      refundAmount: { type: Number },
    },
    timeline: {
      type: [
        {
          event: { type: String, required: true },
          timestamp: { type: Date, default: Date.now },
          actor: { type: Schema.Types.ObjectId, ref: "User" },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

bookingSchema.index({ customer: 1, status: 1 });
bookingSchema.index({ organizer: 1, status: 1 });
bookingSchema.index({ venue: 1, eventDate: 1 });

const Booking = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

export default Booking;
