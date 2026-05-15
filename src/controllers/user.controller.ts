import type { Request, Response } from "express";
import User from "../models/User";
import OrganizerProfile from "../models/OrganizerProfile";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user?._id)
    .select("-password -refreshToken")
    .lean<{
      _id: string;
      role: "customer" | "organizer";
      promos?: unknown[];
      preferences?: unknown;
    } | null>();
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const organizerProfile =
    user.role === "organizer"
      ? await OrganizerProfile.findOne({ user: user._id }).lean()
      : null;

  res.json(ApiResponse.success({ user, organizerProfile }, "Profile fetched successfully"));
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const updates = Object.fromEntries(
    Object.entries(
      (({
        firstName,
        lastName,
        phone,
        city,
        profileImage,
      }) => ({ firstName, lastName, phone, city, profileImage }))(req.body as Record<string, unknown>),
    ).filter(([, value]) => typeof value !== "undefined"),
  );

  const user = await User.findByIdAndUpdate(req.user?._id, updates, {
    new: true,
    runValidators: true,
  })
    .select("-password -refreshToken")
    .lean();

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.json(ApiResponse.success({ user }, "Profile updated successfully"));
});

export const updatePreferences = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        "preferences.currency": req.body.currency,
        "preferences.language": req.body.language,
        "preferences.notifications": req.body.notifications,
        "preferences.appearance": req.body.appearance,
      },
    },
    { new: true, runValidators: true },
  )
    .select("-password -refreshToken")
    .lean<{ preferences: unknown } | null>();

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.json(ApiResponse.success({ preferences: user.preferences }, "Preferences updated successfully"));
});

export const getPromos = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user?._id).select("promos").lean<{ promos?: unknown[] } | null>();
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.json(ApiResponse.success({ promos: user.promos ?? [] }, "Promos fetched successfully"));
});
