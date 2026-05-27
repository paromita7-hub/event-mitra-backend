import mongoose, { Schema } from "mongoose";

const payoutSchema = new Schema(
  {
    organizer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    period: { type: String, trim: true },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    bookings: { type: [{ type: Schema.Types.ObjectId, ref: "Booking" }], default: [] },
    tickets: { type: [{ type: Schema.Types.ObjectId, ref: "Ticket" }], default: [] },
    grossRevenue: { type: Number, default: 0 },
    platformCommission: { type: Number, default: 0 },
    netPayout: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["upcoming", "processing", "paid"],
      default: "upcoming",
    },
    paidAt: { type: Date },
    transactionId: { type: String, trim: true },
    processedBy: { type: Schema.Types.ObjectId, ref: "User" },
    markedPaidBy: { type: Schema.Types.ObjectId, ref: "User" },
    bankSnapshot: {
      bankName: { type: String, trim: true },
      last4: { type: String, trim: true },
    },
  },
  { timestamps: true },
);

const Payout = mongoose.models.Payout || mongoose.model("Payout", payoutSchema);

export default Payout;
