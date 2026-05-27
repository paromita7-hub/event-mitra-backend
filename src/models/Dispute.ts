import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, enum: ["customer", "organizer", "admin"], required: true },
    text: { type: String, required: true, trim: true },
    sentAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const resolutionSchema = new Schema(
  {
    text: { type: String, trim: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    refundAmount: { type: Number, default: 0 },
  },
  { _id: false },
);

const makeDisputeRef = () => `DSP-${String(Math.floor(100000 + Math.random() * 900000))}`;

const disputeSchema = new Schema(
  {
    disputeRef: { type: String, unique: true, default: makeDisputeRef },
    raisedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    raisedByRole: { type: String, enum: ["customer", "organizer"], required: true },
    againstUser: { type: Schema.Types.ObjectId, ref: "User" },
    booking: { type: Schema.Types.ObjectId, ref: "Booking" },
    ticket: { type: Schema.Types.ObjectId, ref: "Ticket" },
    type: {
      type: String,
      enum: ["booking_issue", "payment_issue", "organizer_conduct", "venue_mismatch", "refund_request", "other"],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    evidence: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["open", "under_review", "resolved", "closed"],
      default: "open",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    resolution: { type: resolutionSchema },
    adminNotes: { type: String, trim: true },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true },
);

disputeSchema.index({ status: 1, priority: 1 });
disputeSchema.index({ raisedBy: 1 });

const Dispute = mongoose.models.Dispute || mongoose.model("Dispute", disputeSchema);

export default Dispute;
