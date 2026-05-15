import mongoose, { Schema } from "mongoose";

const ticketTypeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    totalSeats: { type: Number, required: true },
    soldSeats: { type: Number, default: 0 },
    available: { type: Boolean, default: true },
  },
  { _id: false },
);

const publicEventSchema = new Schema(
  {
    organizer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizerProfile: { type: Schema.Types.ObjectId, ref: "OrganizerProfile" },
    venue: { type: Schema.Types.ObjectId, ref: "Venue" },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: {
      type: String,
      enum: [
        "Concert",
        "Food Festival",
        "Comedy Show",
        "Cultural Show",
        "DJ Night",
        "Buffet Night",
        "Conference",
        "New Year Party",
        "Sunburn Party",
        "Other",
      ],
      required: true,
    },
    coverImage: { type: String, trim: true },
    images: { type: [String], default: [] },
    date: { type: Date, required: true },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    venueName: { type: String, trim: true },
    venueAddress: { type: String, trim: true },
    ticketTypes: { type: [ticketTypeSchema], default: [] },
    totalRevenue: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["draft", "published", "paused", "completed", "cancelled"],
      default: "draft",
    },
    isFeatured: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
    ageRestriction: { type: Boolean, default: false },
    dresscode: { type: String, trim: true },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    publishedAt: { type: Date },
  },
  { timestamps: true },
);

publicEventSchema.index({ date: 1, status: 1 });
publicEventSchema.index({ city: 1, category: 1 });
publicEventSchema.index({ title: "text", description: "text", city: "text", category: "text", tags: "text" });

const PublicEvent = mongoose.models.PublicEvent || mongoose.model("PublicEvent", publicEventSchema, "public_events");

export default PublicEvent;
