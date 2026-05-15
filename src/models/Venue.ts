import mongoose, { Schema } from "mongoose";

const venueSchema = new Schema(
  {
    organizer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizerProfile: { type: Schema.Types.ObjectId, ref: "OrganizerProfile" },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: { type: [Number] },
    },
    coverImage: { type: String, trim: true },
    images: { type: [String], default: [] },
    capacity: { type: Number, required: true },
    pricePerEvent: { type: Number, required: true },
    eventTypes: { type: [String], default: [] },
    amenities: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    totalBookings: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "inactive", "under_review"],
      default: "under_review",
    },
    isTopPick: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    availability: {
      blockedDates: { type: [Date], default: [] },
      bookedDates: { type: [Date], default: [] },
    },
    policies: {
      minAdvanceBookingDays: { type: Number, default: 7 },
      cancellationPolicy: {
        type: String,
        enum: ["full_refund", "partial_refund", "no_refund"],
        default: "partial_refund",
      },
      checkInTime: { type: String, trim: true },
      checkOutTime: { type: String, trim: true },
      securityDeposit: { type: Number, default: 0 },
      specialTerms: { type: String, trim: true },
    },
  },
  { timestamps: true },
);

venueSchema.index({ location: "2dsphere" });
venueSchema.index({ city: 1, status: 1 });
venueSchema.index({ eventTypes: 1 });
venueSchema.index({ pricePerEvent: 1 });
venueSchema.index({ name: "text", description: "text", city: "text", eventTypes: "text", tags: "text" });

const Venue = mongoose.models.Venue || mongoose.model("Venue", venueSchema);

export default Venue;
