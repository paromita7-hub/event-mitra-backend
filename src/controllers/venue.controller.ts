import type { Request, Response } from "express";
import Review from "../models/Review";
import Venue from "../models/Venue";
import OrganizerProfile from "../models/OrganizerProfile";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { buildPaginationMeta, parsePaginationParams } from "../utils/pagination.utils";
import { createNotification } from "../utils/notification.utils";

const buildVenueFilters = (query: Request["query"]) => {
  const filters: Record<string, unknown> = { status: "active" };

  if (query.city) {
    filters.city = new RegExp(String(query.city), "i");
  }
  if (query.eventType) {
    filters.eventTypes = { $in: [String(query.eventType)] };
  }
  if (query.capacity) {
    filters.capacity = { $gte: Number(query.capacity) };
  }
  if (query.rating) {
    filters.rating = { $gte: Number(query.rating) };
  }
  if (query.isTopPick === "true") {
    filters.isTopPick = true;
  }
  if (query.isFeatured === "true") {
    filters.isFeatured = true;
  }
  if (query.search) {
    const regex = new RegExp(String(query.search), "i");
    filters.$or = [
      { name: regex },
      { description: regex },
      { city: regex },
      { eventTypes: regex },
      { tags: regex },
    ];
  }

  if (query.minPrice || query.maxPrice) {
    filters.pricePerEvent = {
      ...(query.minPrice ? { $gte: Number(query.minPrice) } : {}),
      ...(query.maxPrice ? { $lte: Number(query.maxPrice) } : {}),
    };
  }

  return filters;
};

const getVenueSort = (sortBy?: string): Record<string, 1 | -1> => {
  switch (sortBy) {
    case "price_asc":
      return { pricePerEvent: 1 };
    case "price_desc":
      return { pricePerEvent: -1 };
    case "rating":
      return { rating: -1 };
    default:
      return { isFeatured: -1, rating: -1, createdAt: -1 };
  }
};

export const getVenues = asyncHandler(async (req: Request, res: Response) => {
  const filters = buildVenueFilters(req.query);
  const { page, limit, skip } = parsePaginationParams(req.query);
  const total = await Venue.countDocuments(filters);

  const venues = await Venue.find(filters)
    .populate("organizer", "firstName lastName")
    .populate("organizerProfile", "businessName rating")
    .sort(getVenueSort(req.query.sortBy as string | undefined))
    .skip(skip)
    .limit(limit)
    .lean();

  res.json(
    ApiResponse.success(
      { venues },
      "Venues fetched successfully",
      200,
      buildPaginationMeta(total, page, limit),
    ),
  );
});

export const getFeaturedVenues = asyncHandler(async (_req: Request, res: Response) => {
  const venues = await Venue.find({ status: "active", isFeatured: true })
    .populate("organizer", "firstName lastName")
    .populate("organizerProfile", "businessName rating")
    .sort({ rating: -1 })
    .limit(6)
    .lean();

  res.json(ApiResponse.success({ venues }, "Featured venues fetched successfully"));
});

export const getTopPickVenues = asyncHandler(async (_req: Request, res: Response) => {
  const venues = await Venue.find({ status: "active", isTopPick: true })
    .populate("organizer", "firstName lastName")
    .populate("organizerProfile", "businessName rating")
    .sort({ rating: -1 })
    .limit(10)
    .lean();

  res.json(ApiResponse.success({ venues }, "Top pick venues fetched successfully"));
});

export const getVenueCities = asyncHandler(async (_req: Request, res: Response) => {
  const cities = await Venue.aggregate<{ _id: string; count: number }>([
    { $match: { status: "active" } },
    { $group: { _id: "$city", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);

  res.json(
    ApiResponse.success(
      {
        cities: cities.map((item) => ({
          name: item._id,
          venueCount: item.count,
        })),
      },
      "Venue cities fetched successfully",
    ),
  );
});

export const getVenueById = asyncHandler(async (req: Request, res: Response) => {
  const venue = await Venue.findById(req.params.id)
    .populate("organizer", "firstName lastName email phone city avatar profileImage")
    .populate("organizerProfile", "businessName rating reviewCount isVerified specialties")
    .lean<{ _id: string } | null>();

  if (!venue) {
    throw new ApiError(404, "Venue not found");
  }

  const reviews = await Review.find({ venue: venue._id })
    .populate("customer", "firstName lastName city avatar")
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();

  res.json(ApiResponse.success({ venue, reviews }, "Venue fetched successfully"));
});

export const createVenue = asyncHandler(async (req: Request, res: Response) => {
  const organizerProfile = await OrganizerProfile.findOne({ user: req.user?._id }).lean<{ _id: string } | null>();

  // Destructure location out so it doesn't land in the spread as a partial object
  const { location: locationInput, ...rest } = req.body;

  const locationField =
    locationInput?.lat != null && locationInput?.lng != null
      ? { type: "Point" as const, coordinates: [Number(locationInput.lng), Number(locationInput.lat)] }
      : undefined;

  const venue = await Venue.create({
    ...rest,
    organizer: req.user?._id,
    organizerProfile: organizerProfile?._id,
    ...(locationField ? { location: locationField } : {}),
  });

  await createNotification({
    recipient: req.user!._id,
    type: "listing_approved",
    title: "Listing submitted for review",
    message: `${venue.name} has been submitted for review.`,
    actionRoute: `/organizer/venue/${venue._id}`,
  });

  res.status(201).json(ApiResponse.success({ venue }, "Venue created successfully", 201));
});

export const updateVenue = asyncHandler(async (req: Request, res: Response) => {
  const venue = await Venue.findOne({ _id: req.params.id, organizer: req.user?._id });
  if (!venue) {
    throw new ApiError(404, "Venue not found");
  }

  const { location: locationInput, ...rest } = req.body;
  Object.assign(venue, rest);

  if (locationInput?.lat != null && locationInput?.lng != null) {
    venue.location = {
      type: "Point",
      coordinates: [Number(locationInput.lng), Number(locationInput.lat)],
    };
  }
  await venue.save();

  res.json(ApiResponse.success({ venue }, "Venue updated successfully"));
});

export const toggleVenueStatus = asyncHandler(async (req: Request, res: Response) => {
  const venue = await Venue.findOne({ _id: req.params.id, organizer: req.user?._id });
  if (!venue) {
    throw new ApiError(404, "Venue not found");
  }
  if (venue.status === "under_review") {
    throw new ApiError(400, "Under review listings cannot be self-approved");
  }

  venue.status = venue.status === "active" ? "inactive" : "active";
  await venue.save();

  res.json(ApiResponse.success({ venue }, "Venue status updated successfully"));
});

export const updateVenueAvailability = asyncHandler(async (req: Request, res: Response) => {
  const venue = await Venue.findOneAndUpdate(
    { _id: req.params.id, organizer: req.user?._id },
    {
      $set: {
        "availability.blockedDates": req.body.blockedDates ?? [],
        "availability.bookedDates": req.body.bookedDates ?? [],
      },
    },
    { new: true },
  ).lean();

  if (!venue) {
    throw new ApiError(404, "Venue not found");
  }

  res.json(ApiResponse.success({ venue }, "Availability updated successfully"));
});

export const getMyVenues = asyncHandler(async (req: Request, res: Response) => {
  const venues = await Venue.find({ organizer: req.user?._id }).sort({ createdAt: -1 }).lean();
  res.json(ApiResponse.success({ venues }, "Organizer venues fetched successfully"));
});
