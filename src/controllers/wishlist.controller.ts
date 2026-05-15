import type { Request, Response } from "express";
import Wishlist from "../models/Wishlist";
import Venue from "../models/Venue";
import PublicEvent from "../models/PublicEvent";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

const ensureWishlist = async (customerId: string) => {
  let wishlist = await Wishlist.findOne({ customer: customerId });
  if (!wishlist) {
    wishlist = await Wishlist.create({ customer: customerId, venues: [], events: [] });
  }
  return wishlist;
};

export const getWishlist = asyncHandler(async (req: Request, res: Response) => {
  const wishlist = await ensureWishlist(req.user!._id);
  const populated = await Wishlist.findById(wishlist._id)
    .populate("venues")
    .populate("events")
    .lean();

  res.json(ApiResponse.success({ wishlist: populated }, "Wishlist fetched successfully"));
});

export const toggleVenueWishlist = asyncHandler(async (req: Request, res: Response) => {
  const venue = await Venue.findById(req.params.venueId).lean<{ _id: string } | null>();
  if (!venue) {
    throw new ApiError(404, "Venue not found");
  }

  const wishlist = await ensureWishlist(req.user!._id);
  const venueId = String(venue._id);
  const exists = wishlist.venues.some((id: unknown) => String(id) === venueId);
  wishlist.venues = exists
    ? wishlist.venues.filter((id: unknown) => String(id) !== venueId)
    : [...wishlist.venues, venue._id];
  wishlist.updatedAt = new Date();
  await wishlist.save();

  const populated = await Wishlist.findById(wishlist._id).populate("venues").populate("events").lean();
  res.json(ApiResponse.success({ added: !exists, wishlist: populated }, "Wishlist updated successfully"));
});

export const toggleEventWishlist = asyncHandler(async (req: Request, res: Response) => {
  const event = await PublicEvent.findById(req.params.eventId).lean<{ _id: string } | null>();
  if (!event) {
    throw new ApiError(404, "Event not found");
  }

  const wishlist = await ensureWishlist(req.user!._id);
  const eventId = String(event._id);
  const exists = wishlist.events.some((id: unknown) => String(id) === eventId);
  wishlist.events = exists
    ? wishlist.events.filter((id: unknown) => String(id) !== eventId)
    : [...wishlist.events, event._id];
  wishlist.updatedAt = new Date();
  await wishlist.save();

  const populated = await Wishlist.findById(wishlist._id).populate("venues").populate("events").lean();
  res.json(ApiResponse.success({ added: !exists, wishlist: populated }, "Wishlist updated successfully"));
});
