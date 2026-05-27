import mongoose, { Schema } from "mongoose";
import { recalculateEntityRating } from "../utils/ratingUtils";

const reviewSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    venue: { type: Schema.Types.ObjectId, ref: "Venue" },
    publicEvent: { type: Schema.Types.ObjectId, ref: "PublicEvent" },
    booking: { type: Schema.Types.ObjectId, ref: "Booking" },
    ticket: { type: Schema.Types.ObjectId, ref: "Ticket" },
    entityType: { type: String, enum: ["venue", "event"], required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true, trim: true },
    organizerReply: {
      text: { type: String, trim: true },
      repliedAt: { type: Date },
    },
    isVerified: { type: Boolean, default: true },
    isRemoved: { type: Boolean, default: false },
    removedBy: { type: Schema.Types.ObjectId, ref: "User" },
    removedAt: { type: Date },
    removalReason: { type: String, trim: true },
  },
  { timestamps: true },
);

reviewSchema.post("save", async function postSave() {
  if (this.isRemoved) return;
  if (this.entityType === "venue" && this.venue) {
    await recalculateEntityRating("venue", String(this.venue));
  }
  if (this.entityType === "event" && this.publicEvent) {
    await recalculateEntityRating("event", String(this.publicEvent));
  }
});

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);

export default Review;
