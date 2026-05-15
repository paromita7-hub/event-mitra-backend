import mongoose, { Schema } from "mongoose";
import PublicEvent from "./PublicEvent";
import Venue from "./Venue";

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
  },
  { timestamps: true },
);

const recalculateRatings = async (doc: {
  entityType: string;
  venue?: mongoose.Types.ObjectId | null;
  publicEvent?: mongoose.Types.ObjectId | null;
}): Promise<void> => {
  if (doc.entityType === "venue" && doc.venue) {
    const stats = await Review.aggregate<{ _id: null; avgRating: number; count: number }>([
      { $match: { venue: doc.venue } },
      { $group: { _id: null, avgRating: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);

    const summary = stats[0] ?? { avgRating: 0, count: 0 };
    await Venue.findByIdAndUpdate(doc.venue, {
      $set: {
        rating: Number(summary.avgRating.toFixed(1)),
        reviewCount: summary.count,
      },
    });
  }

  if (doc.entityType === "event" && doc.publicEvent) {
    const stats = await Review.aggregate<{ _id: null; avgRating: number; count: number }>([
      { $match: { publicEvent: doc.publicEvent } },
      { $group: { _id: null, avgRating: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);

    const summary = stats[0] ?? { avgRating: 0, count: 0 };
    await PublicEvent.findByIdAndUpdate(doc.publicEvent, {
      $set: {
        rating: Number(summary.avgRating.toFixed(1)),
        reviewCount: summary.count,
      },
    });
  }
};

reviewSchema.post("save", async function postSave() {
  await recalculateRatings(this);
});

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);

export default Review;
