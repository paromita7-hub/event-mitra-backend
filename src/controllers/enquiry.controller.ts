import type { Request, Response } from "express";
import Enquiry from "../models/Enquiry";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { createNotification } from "../utils/notification.utils";
import { buildPaginationMeta, parsePaginationParams } from "../utils/pagination.utils";

export const createEnquiry = asyncHandler(async (req: Request, res: Response) => {
  const enquiry = await Enquiry.create({
    customer: req.user!._id,
    organizer: req.body.organizerId,
    venue: req.body.venueId,
    eventType: req.body.eventType,
    preferredDate: req.body.preferredDate,
    guestCount: req.body.guestCount,
    budgetMin: req.body.budgetMin,
    budgetMax: req.body.budgetMax,
    message: req.body.message,
  });

  await createNotification({
    recipient: req.body.organizerId,
    type: "new_enquiry",
    title: "New enquiry received",
    message: `A new enquiry for ${req.body.eventType} was received.`,
    actionRoute: "/organizer/enquiries",
    data: { enquiryId: enquiry._id },
  });

  res.status(201).json(ApiResponse.success({ enquiry }, "Enquiry created successfully", 201));
});

export const getMyEnquiries = asyncHandler(async (req: Request, res: Response) => {
  const enquiries = await Enquiry.find({ customer: req.user!._id }).sort({ createdAt: -1 }).lean();
  res.json(ApiResponse.success({ enquiries }, "Customer enquiries fetched successfully"));
});

export const getOrganizerEnquiries = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePaginationParams(req.query);
  const filters: Record<string, unknown> = { organizer: req.user!._id };
  if (req.query.status) {
    filters.status = req.query.status;
  }
  const total = await Enquiry.countDocuments(filters);
  const enquiries = await Enquiry.find(filters)
    .populate("customer", "firstName lastName city avatar phone email")
    .populate("venue", "name city")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  res.json(
    ApiResponse.success(
      { enquiries },
      "Organizer enquiries fetched successfully",
      200,
      buildPaginationMeta(total, page, limit),
    ),
  );
});

export const replyToEnquiry = asyncHandler(async (req: Request, res: Response) => {
  const enquiry = await Enquiry.findOne({ _id: req.params.id, organizer: req.user!._id });
  if (!enquiry) {
    throw new ApiError(404, "Enquiry not found");
  }

  enquiry.replies.push({
    sender: req.user!._id,
    senderRole: "organizer",
    message: req.body.message,
    sentAt: new Date(),
  });
  enquiry.status = "replied";
  await enquiry.save();

  await createNotification({
    recipient: String(enquiry.customer),
    type: "enquiry_replied",
    title: "Organizer replied to your enquiry",
    message: `You received a reply for your ${enquiry.eventType} enquiry.`,
    actionRoute: "/(tabs)/profile",
    data: { enquiryId: enquiry._id },
  });

  res.json(ApiResponse.success({ enquiry }, "Reply sent successfully"));
});

export const closeEnquiry = asyncHandler(async (req: Request, res: Response) => {
  const enquiry = await Enquiry.findOneAndUpdate(
    { _id: req.params.id, organizer: req.user!._id },
    { $set: { status: "closed" } },
    { new: true },
  ).lean();

  if (!enquiry) {
    throw new ApiError(404, "Enquiry not found");
  }

  res.json(ApiResponse.success({ enquiry }, "Enquiry closed successfully"));
});
