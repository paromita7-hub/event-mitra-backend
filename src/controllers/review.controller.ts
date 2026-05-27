import type { Request, Response } from "express";
import Booking from "../models/Booking";
import PublicEvent from "../models/PublicEvent";
import Review from "../models/Review";
import Ticket from "../models/Ticket";
import Venue from "../models/Venue";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { createNotification } from "../utils/notification.utils";
import { buildPaginationMeta, parsePaginationParams } from "../utils/pagination.utils";

export const createReview = asyncHandler(async (req: Request, res: Response) => {
  const { entityType, entityId, rating, text, bookingId, ticketId } = req.body as {
    entityType: "venue" | "event";
    entityId: string;
    rating: number;
    text: string;
    bookingId?: string;
    ticketId?: string;
  };

  const existingReview = await Review.findOne({
    customer: req.user!._id,
    ...(entityType === "venue" ? { venue: entityId } : { publicEvent: entityId }),
  });
  if (existingReview) {
    existingReview.rating = rating;
    existingReview.text = text;
    await existingReview.save();
    res.json(ApiResponse.success({ review: existingReview }, "Review updated successfully"));
    return;
  }

  if (entityType === "venue") {
    const booking = await Booking.findOne({
      _id: bookingId,
      customer: req.user!._id,
      venue: entityId,
      status: { $in: ["confirmed", "completed"] },
    }).lean<{ _id: string; organizer: string } | null>();
    if (!booking) {
      throw new ApiError(403, "Verified booking required to review this venue");
    }

    const review = await Review.create({
      customer: req.user!._id,
      organizer: booking.organizer,
      venue: entityId,
      booking: booking._id,
      entityType,
      rating,
      text,
    });

    await createNotification({
      recipient: String(booking.organizer),
      type: "review_received",
      title: "New review received",
      message: "A customer left a review on your venue.",
      actionRoute: "/organizer/reviews",
      data: { reviewId: review._id },
    });

    res.status(201).json(ApiResponse.success({ review }, "Review created successfully", 201));
    return;
  }

  const ticket = await Ticket.findOne({
    _id: ticketId,
    customer: req.user!._id,
    publicEvent: entityId,
    status: { $in: ["active", "used"] },
  }).lean<{ _id: string; organizer: string } | null>();
  if (!ticket) {
    throw new ApiError(403, "Verified ticket required to review this event");
  }

  const review = await Review.create({
    customer: req.user!._id,
    organizer: ticket.organizer,
    publicEvent: entityId,
    ticket: ticket._id,
    entityType,
    rating,
    text,
  });

  await createNotification({
    recipient: String(ticket.organizer),
    type: "review_received",
    title: "New review received",
    message: "A customer left a review on your public event.",
    actionRoute: "/organizer/reviews",
    data: { reviewId: review._id },
  });

  res.status(201).json(ApiResponse.success({ review }, "Review created successfully", 201));
});

export const getVenueReviews = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePaginationParams(req.query);
  const filters = { venue: req.params.venueId, isRemoved: { $ne: true } };
  const total = await Review.countDocuments(filters);
  const reviews = await Review.find(filters)
    .populate("customer", "firstName lastName city avatar")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  res.json(
    ApiResponse.success(
      { reviews },
      "Venue reviews fetched successfully",
      200,
      buildPaginationMeta(total, page, limit),
    ),
  );
});

export const getEventReviews = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePaginationParams(req.query);
  const filters = { publicEvent: req.params.eventId, isRemoved: { $ne: true } };
  const total = await Review.countDocuments(filters);
  const reviews = await Review.find(filters)
    .populate("customer", "firstName lastName city avatar")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  res.json(
    ApiResponse.success(
      { reviews },
      "Event reviews fetched successfully",
      200,
      buildPaginationMeta(total, page, limit),
    ),
  );
});

export const getOrganizerReviews = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePaginationParams(req.query);
  const filters: Record<string, unknown> = { organizer: req.user!._id, isRemoved: { $ne: true } };
  if (req.query.rating) {
    filters.rating = Number(req.query.rating);
  }
  if (req.query.hasReply === "true") {
    filters["organizerReply.text"] = { $exists: true, $ne: "" };
  }
  if (req.query.hasReply === "false") {
    filters["organizerReply.text"] = { $exists: false };
  }
  const total = await Review.countDocuments(filters);
  const reviews = await Review.find(filters)
    .populate("customer", "firstName lastName city avatar")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  res.json(
    ApiResponse.success(
      { reviews },
      "Organizer reviews fetched successfully",
      200,
      buildPaginationMeta(total, page, limit),
    ),
  );
});

export const replyToReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await Review.findOne({ _id: req.params.id, organizer: req.user!._id });
  if (!review) {
    throw new ApiError(404, "Review not found");
  }
  if (review.organizerReply?.text) {
    throw new ApiError(400, "Review has already been replied to");
  }

  review.organizerReply = { text: req.body.text, repliedAt: new Date() };
  await review.save();

  await createNotification({
    recipient: String(review.customer),
    type: "review_received",
    title: "Organizer replied to your review",
    message: "You received a reply to your review.",
    actionRoute: "/(tabs)/profile",
    data: { reviewId: review._id },
  });

  res.json(ApiResponse.success({ review }, "Review reply saved successfully"));
});
