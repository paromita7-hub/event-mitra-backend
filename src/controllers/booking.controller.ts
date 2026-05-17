import type { Request, Response } from "express";
import Booking from "../models/Booking";
import OrganizerProfile from "../models/OrganizerProfile";
import Payout from "../models/Payout";
import Venue from "../models/Venue";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { calculateCommission } from "../utils/commission.utils";
import { createNotification } from "../utils/notification.utils";
import { buildPaginationMeta, parsePaginationParams } from "../utils/pagination.utils";
import { sameDay, toDayStart } from "../utils/model.utils";

const normalizeId = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);

  if (typeof value === "object") {
    const objectValue = value as { _id?: unknown; _bsontype?: string };
    if (objectValue._bsontype === "ObjectId") return String(value);
    if ("_id" in objectValue && objectValue._id !== value) {
      return normalizeId(objectValue._id);
    }
  }

  return String(value);
};

const isSameId = (left: unknown, right: unknown): boolean =>
  normalizeId(left) === normalizeId(right);

const removeDate = (dates: Date[], targetDate: Date): Date[] =>
  dates.filter((date) => !sameDay(date, targetDate));

const calculateRefund = (
  booking: { pricing: { totalAmount: number }; eventDate: Date },
  cancelledByOrganizer: boolean,
): number => {
  if (cancelledByOrganizer) {
    return booking.pricing.totalAmount;
  }

  const today = new Date();
  const eventDate = new Date(booking.eventDate);
  const daysLeft = (toDayStart(eventDate).getTime() - toDayStart(today).getTime()) / (1000 * 60 * 60 * 24);

  if (daysLeft > 7) {
    return booking.pricing.totalAmount;
  }
  if (daysLeft >= 3) {
    return Math.round(booking.pricing.totalAmount * 0.5);
  }
  return 0;
};

export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  const { venueId, eventType, eventDate, eventTime, guestCount, specialRequests, advanceAmount } = req.body;

  const venue = await Venue.findOne({ _id: venueId, status: "active" }).lean<{
    _id: string;
    organizer: string;
    name: string;
    pricePerEvent: number;
    availability: { blockedDates: Date[]; bookedDates: Date[] };
    policies: { minAdvanceBookingDays?: number };
  } | null>();
  if (!venue) {
    throw new ApiError(404, "Venue not found");
  }

  const requestedDate = toDayStart(eventDate);
  if (venue.availability.blockedDates.some((date) => sameDay(date, requestedDate))) {
    throw new ApiError(409, "Selected date is blocked");
  }
  if (venue.availability.bookedDates.some((date) => sameDay(date, requestedDate))) {
    throw new ApiError(409, "Selected date is already booked");
  }

  const minAdvanceDate = new Date();
  minAdvanceDate.setDate(minAdvanceDate.getDate() + (venue.policies.minAdvanceBookingDays ?? 7));
  if (requestedDate < toDayStart(minAdvanceDate)) {
    throw new ApiError(400, "Date does not meet minimum advance booking policy");
  }

  const pricing = calculateCommission(venue.pricePerEvent);
  const paymentStatus = advanceAmount >= pricing.gross ? "paid" : advanceAmount > 0 ? "partial" : "pending";
  const booking = await Booking.create({
    customer: req.user!._id,
    organizer: venue.organizer,
    venue: venue._id,
    eventType,
    eventDate: requestedDate,
    eventTime,
    guestCount,
    specialRequests,
    pricing: {
      venueCharge: pricing.gross,
      addOns: 0,
      subtotal: pricing.gross,
      platformCommission: pricing.commission,
      organizerPayout: pricing.payout,
      totalAmount: pricing.gross,
    },
    payment: {
      advancePaid: advanceAmount,
      balanceDue: Math.max(pricing.gross - advanceAmount, 0),
      paymentStatus,
    },
    timeline: [
      {
        event: "Booking request created",
        timestamp: new Date(),
        actor: req.user!._id,
      },
    ],
  });

  await Venue.findByIdAndUpdate(venue._id, {
    $addToSet: { "availability.bookedDates": requestedDate },
  });

  await Promise.all([
    createNotification({
      recipient: String(venue.organizer),
      type: "new_booking",
      title: "New booking request",
      message: `A new ${eventType} booking request was created for ${venue.name}.`,
      actionRoute: `/organizer/booking/${booking._id}`,
      data: { bookingId: booking._id },
    }),
    createNotification({
      recipient: req.user!._id,
      type: "booking_confirmed",
      title: "Booking request sent",
      message: `Your booking request for ${venue.name} has been sent.`,
      actionRoute: "/(tabs)/bookings",
      data: { bookingId: booking._id },
    }),
  ]);

  res.status(201).json(ApiResponse.success({ booking }, "Booking created successfully", 201));
});

export const getMyBookings = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePaginationParams(req.query);
  const filters: Record<string, unknown> = { customer: req.user!._id };
  if (req.query.status) {
    filters.status = req.query.status;
  }
  const total = await Booking.countDocuments(filters);
  const bookings = await Booking.find(filters)
    .populate("venue", "name city coverImage pricePerEvent")
    .populate("organizer", "firstName lastName avatar city")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  res.json(
    ApiResponse.success(
      { bookings },
      "Bookings fetched successfully",
      200,
      buildPaginationMeta(total, page, limit),
    ),
  );
});

export const getBookingById = asyncHandler(async (req: Request, res: Response) => {
  const booking = await Booking.findById(req.params.id)
    .populate("venue", "name city address coverImage policies")
    .populate("organizer", "firstName lastName avatar phone email")
    .populate("customer", "firstName lastName avatar phone email city")
    .lean<{
      customer: string | { _id: string };
      organizer: string | { _id: string };
    } | null>();

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  const isCustomer = req.user!.role === "customer" && isSameId(booking.customer, req.user!._id);
  const isOrganizer = req.user!.role === "organizer" && isSameId(booking.organizer, req.user!._id);
  if (!isCustomer && !isOrganizer) {
    throw new ApiError(403, "Access denied");
  }

  res.json(ApiResponse.success({ booking }, "Booking fetched successfully"));
});

export const confirmBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await Booking.findOne({ _id: req.params.id, organizer: req.user!._id });
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }
  if (booking.status !== "pending_approval") {
    throw new ApiError(400, "Only pending bookings can be confirmed");
  }

  booking.status = "confirmed";
  booking.timeline.push({ event: "Booking confirmed", timestamp: new Date(), actor: req.user!._id });
  await booking.save();

  await createNotification({
    recipient: String(booking.customer),
    type: "booking_confirmed",
    title: "Booking confirmed",
    message: `Your booking ${booking.bookingRef} has been confirmed.`,
    actionRoute: "/(tabs)/bookings",
    data: { bookingId: booking._id },
  });

  res.json(ApiResponse.success({ booking }, "Booking confirmed successfully"));
});

export const declineBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await Booking.findOne({ _id: req.params.id, organizer: req.user!._id });
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }
  if (booking.status !== "pending_approval") {
    throw new ApiError(400, "Only pending bookings can be declined");
  }

  booking.status = "cancelled";
  booking.cancellation = {
    cancelledBy: req.user!._id,
    cancelledAt: new Date(),
    reason: req.body.reason,
    refundAmount: booking.payment.advancePaid,
  };
  booking.timeline.push({ event: "Booking declined", timestamp: new Date(), actor: req.user!._id });
  await booking.save();

  await Venue.findByIdAndUpdate(booking.venue, {
    $pull: { "availability.bookedDates": toDayStart(booking.eventDate) },
  });

  await createNotification({
    recipient: String(booking.customer),
    type: "booking_cancelled",
    title: "Booking declined",
    message: `Your booking ${booking.bookingRef} was declined.`,
    actionRoute: "/(tabs)/bookings",
    data: { bookingId: booking._id },
  });

  res.json(ApiResponse.success({ booking }, "Booking declined successfully"));
});

export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  const isCustomer = req.user!.role === "customer" && String(booking.customer) === req.user!._id;
  const isOrganizer = req.user!.role === "organizer" && String(booking.organizer) === req.user!._id;
  if (!isCustomer && !isOrganizer) {
    throw new ApiError(403, "Access denied");
  }
  if (booking.status === "cancelled") {
    throw new ApiError(400, "Booking is already cancelled");
  }

  const refundAmount = calculateRefund(booking, isOrganizer);
  booking.status = "cancelled";
  booking.cancellation = {
    cancelledBy: req.user!._id,
    cancelledAt: new Date(),
    reason: req.body.reason,
    refundAmount,
  };
  booking.timeline.push({ event: "Booking cancelled", timestamp: new Date(), actor: req.user!._id });
  await booking.save();

  const venue = await Venue.findById(booking.venue);
  if (venue) {
    venue.availability.bookedDates = removeDate(venue.availability.bookedDates, booking.eventDate);
    await venue.save();
  }

  const otherParty = isOrganizer ? String(booking.customer) : String(booking.organizer);
  await createNotification({
    recipient: otherParty,
    type: "booking_cancelled",
    title: "Booking cancelled",
    message: `Booking ${booking.bookingRef} has been cancelled.`,
    actionRoute: req.user!.role === "organizer" ? "/(tabs)/bookings" : "/organizer/bookings",
    data: { bookingId: booking._id },
  });

  res.json(ApiResponse.success({ booking }, "Booking cancelled successfully"));
});

export const completeBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await Booking.findOne({ _id: req.params.id, organizer: req.user!._id });
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }
  if (booking.status !== "confirmed") {
    throw new ApiError(400, "Only confirmed bookings can be completed");
  }

  booking.status = "completed";
  booking.timeline.push({ event: "Booking completed", timestamp: new Date(), actor: req.user!._id });
  await booking.save();

  const [venue, organizerProfile] = await Promise.all([
    Venue.findById(booking.venue),
    OrganizerProfile.findOne({ user: req.user!._id }),
  ]);

  if (venue) {
    venue.totalBookings += 1;
    venue.totalRevenue += booking.pricing.totalAmount;
    await venue.save();
  }

  if (organizerProfile) {
    organizerProfile.totalBookings += 1;
    organizerProfile.totalRevenue += booking.pricing.totalAmount;
    await organizerProfile.save();

    const periodDate = new Date(booking.eventDate);
    const periodLabel = periodDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    await Payout.create({
      organizer: req.user!._id,
      period: periodLabel,
      periodStart: new Date(periodDate.getFullYear(), periodDate.getMonth(), 1),
      periodEnd: new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0),
      bookings: [booking._id],
      tickets: [],
      grossRevenue: booking.pricing.totalAmount,
      platformCommission: booking.pricing.platformCommission,
      netPayout: booking.pricing.organizerPayout,
      status: "processing",
      bankSnapshot: organizerProfile.bankAccount?.bankName
        ? {
            bankName: organizerProfile.bankAccount.bankName,
            last4: organizerProfile.bankAccount.last4,
          }
        : undefined,
    });
  }

  await createNotification({
    recipient: String(booking.customer),
    type: "booking_confirmed",
    title: "How was your event?",
    message: "Your event is complete. Leave a review for your organizer.",
    actionRoute: "/(tabs)/bookings",
    data: { bookingId: booking._id },
  });

  res.json(ApiResponse.success({ booking }, "Booking completed successfully"));
});

export const getOrganizerBookings = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePaginationParams(req.query);
  const filters: Record<string, unknown> = { organizer: req.user!._id };
  if (req.query.status) {
    filters.status = req.query.status;
  }
  if (req.query.venueId) {
    filters.venue = req.query.venueId;
  }

  const total = await Booking.countDocuments(filters);
  const bookings = await Booking.find(filters)
    .populate("customer", "firstName lastName avatar city phone")
    .populate("venue", "name city coverImage")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  res.json(
    ApiResponse.success(
      { bookings },
      "Organizer bookings fetched successfully",
      200,
      buildPaginationMeta(total, page, limit),
    ),
  );
});
