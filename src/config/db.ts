import mongoose from "mongoose";

export const connectDB = async (mongoUri = process.env.MONGO_URI): Promise<void> => {
  if (!mongoUri) {
    throw new Error("MONGO_URI is not configured");
  }

  await mongoose.connect(mongoUri);
  console.log("✓ MongoDB connected");
};
