import type { Request, Response } from "express";
import OrganizerProfile from "../models/OrganizerProfile";
import User from "../models/User";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export const getOrganizerProfile = asyncHandler(async (req: Request, res: Response) => {
  const organizerProfile = await OrganizerProfile.findOne({ user: req.user?._id })
    .populate("user", "firstName lastName email phone city avatar profileImage")
    .lean();

  if (!organizerProfile) {
    throw new ApiError(404, "Organizer profile not found");
  }

  res.json(ApiResponse.success({ organizerProfile }, "Organizer profile fetched successfully"));
});

export const updateOrganizerProfile = asyncHandler(async (req: Request, res: Response) => {
  const updates = Object.fromEntries(
    Object.entries({
      businessName: req.body.businessName,
      businessDescription: req.body.businessDescription,
      specialties: req.body.specialties,
      yearsOfExperience: req.body.yearsOfExperience,
      city: req.body.city,
      address: req.body.address,
    }).filter(([, value]) => typeof value !== "undefined"),
  );

  const organizerProfile = await OrganizerProfile.findOneAndUpdate(
    { user: req.user?._id },
    {
      $set: updates,
    },
    { new: true, runValidators: true },
  )
    .populate("user", "firstName lastName email phone city avatar profileImage")
    .lean();

  if (!organizerProfile) {
    throw new ApiError(404, "Organizer profile not found");
  }

  res.json(ApiResponse.success({ organizerProfile }, "Organizer profile updated successfully"));
});

export const getFeaturedOrganizers = asyncHandler(async (_req: Request, res: Response) => {
  const profiles = await OrganizerProfile.find({ isVerified: true })
    .sort({ rating: -1, reviewCount: -1 })
    .limit(8)
    .populate("user", "firstName lastName city avatar profileImage")
    .lean();

  const organizers = profiles.map((profile) => {
    const user = profile.user as {
      firstName: string;
      lastName: string;
      city?: string;
      avatar?: string;
      profileImage?: string;
    };

    return {
      id: String(profile._id),
      name: `${user.firstName} ${user.lastName}`,
      avatar: user.profileImage || "",
      city: profile.city || user.city || "",
      specialty: profile.specialties?.[0] || "Events",
      rating: profile.rating,
      reviewCount: profile.reviewCount,
      eventsOrganized: profile.totalBookings,
      verified: profile.isVerified,
      bio: profile.businessDescription || "",
      businessName: profile.businessName,
    };
  });

  res.json(ApiResponse.success({ organizers }, "Featured organizers fetched successfully"));
});
