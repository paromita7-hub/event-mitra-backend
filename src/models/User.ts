import bcrypt from "bcryptjs";
import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from "mongoose";
import { APP_CONSTANTS } from "../config/constants";
import { signAccessToken, signRefreshToken } from "../config/jwt";

const promoSchema = new Schema(
  {
    code: { type: String, required: true, trim: true },
    discount: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  { _id: false },
);

const preferenceSchema = new Schema(
  {
    currency: { type: String, default: "INR" },
    language: { type: String, default: "en" },
    notifications: { type: Boolean, default: true },
    appearance: {
      type: String,
      enum: ["light", "dark", "system"],
      default: "system",
    },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    phone: { type: String, required: true, trim: true },
    role: { type: String, enum: ["customer", "organizer"], required: true },
    city: { type: String, trim: true },
    avatar: { type: String, trim: true },
    profileImage: { type: String, trim: true },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    refreshToken: { type: String, select: false },
    lastLogin: { type: Date },
    promos: { type: [promoSchema], default: [] },
    preferences: { type: preferenceSchema, default: () => ({}) },
  },
  { timestamps: true },
);

type UserSchemaType = InferSchemaType<typeof userSchema>;

export type IUserLean = mongoose.FlattenMaps<UserSchemaType> & {
  _id: string;
};

export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
  generateAccessToken(): string;
  generateRefreshToken(): string;
}

export type IUserDocument = HydratedDocument<UserSchemaType, IUserMethods>;
type UserModel = Model<UserSchemaType, Record<string, never>, IUserMethods>;

userSchema.pre("save", async function preSave(next) {
  const user = this as IUserDocument;
  if (!user.isModified("password")) {
    next();
    return;
  }

  user.password = await bcrypt.hash(user.password, APP_CONSTANTS.bcryptSaltRounds);
  next();
});

userSchema.methods.comparePassword = async function comparePassword(candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.generateAccessToken = function generateAccessToken(): string {
  return signAccessToken({ _id: this._id.toString(), email: this.email, role: this.role });
};

userSchema.methods.generateRefreshToken = function generateRefreshToken(): string {
  return signRefreshToken({ _id: this._id.toString(), email: this.email, role: this.role });
};

const User = mongoose.models.User || mongoose.model<UserSchemaType, UserModel>("User", userSchema);

export default User;
