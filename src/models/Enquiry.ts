import mongoose, { Schema } from "mongoose";

const replySchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, enum: ["customer", "organizer"], required: true },
    message: { type: String, required: true, trim: true },
    sentAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const enquirySchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    venue: { type: Schema.Types.ObjectId, ref: "Venue" },
    eventType: { type: String, required: true, trim: true },
    preferredDate: { type: Date },
    guestCount: { type: Number },
    budgetMin: { type: Number },
    budgetMax: { type: Number },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["new", "replied", "closed"],
      default: "new",
    },
    replies: { type: [replySchema], default: [] },
  },
  { timestamps: true },
);

const Enquiry = mongoose.models.Enquiry || mongoose.model("Enquiry", enquirySchema);

export default Enquiry;
