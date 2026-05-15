import mongoose, { Schema } from "mongoose";

const wishlistSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    venues: { type: [{ type: Schema.Types.ObjectId, ref: "Venue" }], default: [] },
    events: { type: [{ type: Schema.Types.ObjectId, ref: "PublicEvent" }], default: [] },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

const Wishlist = mongoose.models.Wishlist || mongoose.model("Wishlist", wishlistSchema);

export default Wishlist;
