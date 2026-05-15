import type { Request, Response } from "express";
import Review from "../models/Review";
import Venue from "../models/Venue";
import PublicEvent from "../models/PublicEvent";
import OrganizerProfile from "../models/OrganizerProfile";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { buildPaginationMeta, parsePaginationParams } from "../utils/pagination.utils";

const buildEventFilters = (query: Request["query"]) => {
  const filters: Record<string, unknown> = {
    status: "published",
    date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
  };

  if (query.city) {
    filters.city = new RegExp(String(query.city), "i");
  }
  if (query.category) {
    filters.category = String(query.category);
  }
  if (query.isFeatured === "true") {
    filters.isFeatured = true;
  }
  if (query.search) {
    const regex = new RegExp(String(query.search), "i");
    filters.$or = [
      { title: regex },
      { description: regex },
      { city: regex },
      { category: regex },
      { tags: regex },
    ];
  }
  if (query.dateFrom || query.dateTo) {
    filters.date = {
      ...(query.dateFrom ? { $gte: new Date(String(query.dateFrom)) } : {}),
      ...(query.dateTo ? { $lte: new Date(String(query.dateTo)) } : {}),
    };
  }
  if (query.minPrice || query.maxPrice) {
    filters.ticketTypes = {
      $elemMatch: {
        ...(query.minPrice ? { price: { $gte: Number(query.minPrice) } } : {}),
        ...(query.maxPrice ? { price: { $lte: Number(query.maxPrice) } } : {}),
      },
    };
  }

  return filters;
};

export const getEvents = asyncHandler(async (req: Request, res: Response) => {
  const filters = buildEventFilters(req.query);
  const { page, limit, skip } = parsePaginationParams(req.query);
  const total = await PublicEvent.countDocuments(filters);

  const events = await PublicEvent.find(filters)
    .sort({ date: 1, isFeatured: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  res.json(
    ApiResponse.success(
      { events },
      "Events fetched successfully",
      200,
      buildPaginationMeta(total, page, limit),
    ),
  );
});

export const getFeaturedEvents = asyncHandler(async (_req: Request, res: Response) => {
  const events = await PublicEvent.find({
    isFeatured: true,
    status: "published",
    date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
  })
    .sort({ date: 1 })
    .limit(6)
    .lean();

  res.json(ApiResponse.success({ events }, "Featured events fetched successfully"));
});

export const getEventById = asyncHandler(async (req: Request, res: Response) => {
  const event = await PublicEvent.findById(req.params.id).lean<{ _id: string } | null>();
  if (!event) {
    throw new ApiError(404, "Event not found");
  }

  const reviews = await Review.find({ publicEvent: event._id })
    .populate("customer", "firstName lastName city avatar")
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();

  res.json(ApiResponse.success({ event, reviews }, "Event fetched successfully"));
});

export const createPublicEvent = asyncHandler(async (req: Request, res: Response) => {
  const organizerProfile = await OrganizerProfile.findOne({ user: req.user?._id }).lean<{ _id: string } | null>();
  let venueData: { name?: string; address?: string; city?: string } = {};

  if (req.body.venue) {
    const venue = await Venue.findOne({ _id: req.body.venue, organizer: req.user?._id }).lean<{
      _id: string;
      name: string;
      address: string;
      city: string;
    } | null>();
    if (!venue) {
      throw new ApiError(404, "Venue not found");
    }

    venueData = {
      name: venue.name,
      address: venue.address,
      city: venue.city,
    };
  }

  const event = await PublicEvent.create({
    ...req.body,
    organizer: req.user?._id,
    organizerProfile: organizerProfile?._id,
    venueName: req.body.venueName || venueData.name,
    venueAddress: req.body.venueAddress || venueData.address,
    city: req.body.city || venueData.city,
    publishedAt: req.body.status === "published" ? new Date() : undefined,
  });

  res.status(201).json(ApiResponse.success({ event }, "Public event created successfully", 201));
});

export const updatePublicEvent = asyncHandler(async (req: Request, res: Response) => {
  const event = await PublicEvent.findOne({ _id: req.params.id, organizer: req.user?._id });
  if (!event) {
    throw new ApiError(404, "Event not found");
  }

  Object.assign(event, req.body);
  if (event.status === "published" && !event.publishedAt) {
    event.publishedAt = new Date();
  }
  await event.save();

  res.json(ApiResponse.success({ event }, "Public event updated successfully"));
});

export const toggleEventStatus = asyncHandler(async (req: Request, res: Response) => {
  const event = await PublicEvent.findOne({ _id: req.params.id, organizer: req.user?._id });
  if (!event) {
    throw new ApiError(404, "Event not found");
  }

  if (event.status === "draft") {
    event.status = "published";
    event.publishedAt = new Date();
  } else if (event.status === "published") {
    event.status = "paused";
  } else if (event.status === "paused") {
    event.status = "published";
  }

  await event.save();
  res.json(ApiResponse.success({ event }, "Event status updated successfully"));
});

export const deletePublicEvent = asyncHandler(async (req: Request, res: Response) => {
  const event = await PublicEvent.findOne({ _id: req.params.id, organizer: req.user?._id });
  if (!event) {
    throw new ApiError(404, "Event not found");
  }
  if (event.status !== "draft") {
    throw new ApiError(400, "Only draft events can be deleted");
  }

  await event.deleteOne();
  res.json(ApiResponse.success({ deleted: true }, "Event deleted successfully"));
});

export const getMyEvents = asyncHandler(async (req: Request, res: Response) => {
  const events = await PublicEvent.find({ organizer: req.user?._id }).sort({ date: 1 }).lean();
  res.json(ApiResponse.success({ events }, "Organizer events fetched successfully"));
});
