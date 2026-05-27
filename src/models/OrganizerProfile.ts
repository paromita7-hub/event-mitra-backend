import mongoose, { Schema } from "mongoose";

const kycDocumentSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["aadhaar", "pan", "gst", "other"],
      required: true,
    },
    url: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { _id: false },
);

const organizerProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    businessName: { type: String, required: true, trim: true },
    businessDescription: { type: String, trim: true },
    specialties: { type: [String], default: [] },
    yearsOfExperience: { type: String, trim: true },
    city: { type: String, trim: true },
    address: { type: String, trim: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    totalBookings: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    isKYCSubmitted: { type: Boolean, default: false },
    isKYCApproved: { type: Boolean, default: false },
    kycRejectionReason: { type: String, trim: true },
    kycReviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    kycReviewedAt: { type: Date },
    kycDocuments: { type: [kycDocumentSchema], default: [] },
    bankAccount: {
      accountNumber: { type: String, select: false },
      ifsc: { type: String, trim: true },
      bankName: { type: String, trim: true },
      accountHolderName: { type: String, trim: true },
      last4: { type: String, trim: true },
    },
    commissionRate: { type: Number, min: 1, max: 50 },
    subscriptionPlan: { type: String, default: "Verified Partner" },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const OrganizerProfile =
  mongoose.models.OrganizerProfile ||
  mongoose.model("OrganizerProfile", organizerProfileSchema, "organizer_profiles");

export default OrganizerProfile;
