import mongoose, { Schema } from "mongoose";

const settingsSchema = new Schema(
  {
    commissionRate: { type: Number, default: 12, min: 1, max: 50 },
    maintenanceMode: { type: Boolean, default: false },
    supportEmail: { type: String, default: "support@eventmitra.com", trim: true },
    termsLastUpdated: { type: Date, default: Date.now },
    appVersion: { type: String, default: "1.0.0", trim: true },
    lastUpdatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

const Settings =
  mongoose.models.Settings || mongoose.model("Settings", settingsSchema, "settings");

export default Settings;
