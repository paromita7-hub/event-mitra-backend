import mongoose from "mongoose";
import PublicEvent from "../models/PublicEvent";
import Review from "../models/Review";
import Venue from "../models/Venue";

const notRemovedFilter = { isRemoved: { $ne: true } };

export async function recalculateEntityRating(
  entityType: "venue" | "event",
  entityId: string,
): Promise<void> {
  const objectId = new mongoose.Types.ObjectId(entityId);

  if (entityType === "venue") {
    const stats = await Review.aggregate<{ _id: null; avgRating: number; count: number }>([
      { $match: { venue: objectId, ...notRemovedFilter } },
      { $group: { _id: null, avgRating: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    const summary = stats[0] ?? { avgRating: 0, count: 0 };
    await Venue.findByIdAndUpdate(entityId, {
      $set: {
        rating: summary.count > 0 ? Number(summary.avgRating.toFixed(1)) : 0,
        reviewCount: summary.count,
      },
    });
    return;
  }

  const stats = await Review.aggregate<{ _id: null; avgRating: number; count: number }>([
    { $match: { publicEvent: objectId, ...notRemovedFilter } },
    { $group: { _id: null, avgRating: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const summary = stats[0] ?? { avgRating: 0, count: 0 };
  await PublicEvent.findByIdAndUpdate(entityId, {
    $set: {
      rating: summary.count > 0 ? Number(summary.avgRating.toFixed(1)) : 0,
      reviewCount: summary.count,
    },
  });
}
