import mongoose, { Schema } from "mongoose";
import { makeTicketRef } from "../utils/model.utils";

const ticketSchema = new Schema(
  {
    ticketRef: { type: String, unique: true, default: makeTicketRef },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    publicEvent: { type: Schema.Types.ObjectId, ref: "PublicEvent", required: true },
    organizer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ticketType: {
      name: { type: String, trim: true },
      price: { type: Number },
    },
    quantity: { type: Number, required: true, default: 1 },
    totalAmount: { type: Number, default: 0 },
    platformCommission: { type: Number, default: 0 },
    organizerPayout: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "used", "cancelled", "refunded"],
      default: "active",
    },
    qrCode: { type: String, trim: true },
    usedAt: { type: Date },
  },
  { timestamps: true },
);

ticketSchema.index({ customer: 1, status: 1 });
ticketSchema.index({ publicEvent: 1 });

const Ticket = mongoose.models.Ticket || mongoose.model("Ticket", ticketSchema);

export default Ticket;
