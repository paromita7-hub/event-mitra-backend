import type { Request, Response } from "express";
import PublicEvent from "../models/PublicEvent";
import Ticket from "../models/Ticket";
import Payout from "../models/Payout";
import OrganizerProfile from "../models/OrganizerProfile";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { calculateCommissionForOrganizer } from "../utils/commission.utils";
import { createNotification } from "../utils/notification.utils";
import { buildPaginationMeta, parsePaginationParams } from "../utils/pagination.utils";

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

export const purchaseTicket = asyncHandler(async (req: Request, res: Response) => {
  const { eventId, ticketTypeIndex, quantity } = req.body as {
    eventId: string;
    ticketTypeIndex: number;
    quantity: number;
  };

  const event = await PublicEvent.findOne({
    _id: eventId,
    status: "published",
    date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
  }).lean<{
    _id: string;
    title: string;
    organizer: string;
    date: Date;
    ticketTypes: Array<{ name: string; price: number; totalSeats: number; soldSeats: number }>;
  } | null>();

  if (!event) {
    throw new ApiError(404, "Event not found");
  }

  const ticketType = event.ticketTypes[ticketTypeIndex];
  if (!ticketType) {
    throw new ApiError(400, "Ticket type not found");
  }
  if (ticketType.soldSeats + quantity > ticketType.totalSeats) {
    throw new ApiError(409, "Seats no longer available");
  }

  const totalAmount = ticketType.price * quantity;
  const commission = await calculateCommissionForOrganizer(totalAmount, String(event.organizer));
  const soldSeatsPath = `ticketTypes.${ticketTypeIndex}.soldSeats`;
  const updatedEvent = await PublicEvent.findOneAndUpdate(
    {
      _id: eventId,
      status: "published",
      [soldSeatsPath]: { $lte: ticketType.totalSeats - quantity },
    },
    {
      $inc: {
        [soldSeatsPath]: quantity,
        totalRevenue: totalAmount,
      },
    },
    { new: true },
  );

  if (!updatedEvent) {
    throw new ApiError(409, "Seats no longer available");
  }

  const ticket = await Ticket.create({
    customer: req.user!._id,
    publicEvent: updatedEvent._id,
    organizer: updatedEvent.organizer,
    ticketType: {
      name: ticketType.name,
      price: ticketType.price,
    },
    quantity,
    totalAmount,
    platformCommission: commission.commission,
    organizerPayout: commission.payout,
    qrCode: undefined,
  });

  ticket.qrCode = ticket.ticketRef;
  await ticket.save();

  const organizerProfile = await OrganizerProfile.findOne({ user: updatedEvent.organizer });
  if (organizerProfile) {
    const periodDate = new Date(updatedEvent.date);
    const periodLabel = periodDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    await Payout.create({
      organizer: updatedEvent.organizer,
      period: periodLabel,
      periodStart: new Date(periodDate.getFullYear(), periodDate.getMonth(), 1),
      periodEnd: new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0),
      bookings: [],
      tickets: [ticket._id],
      grossRevenue: totalAmount,
      platformCommission: commission.commission,
      netPayout: commission.payout,
      status: "upcoming",
      bankSnapshot: organizerProfile.bankAccount?.bankName
        ? {
            bankName: organizerProfile.bankAccount.bankName,
            last4: organizerProfile.bankAccount.last4,
          }
        : undefined,
    });
  }

  await Promise.all([
    createNotification({
      recipient: String(updatedEvent.organizer),
      type: "ticket_purchased",
      title: "New ticket purchase",
      message: `${quantity} ${ticketType.name} ticket(s) were purchased for ${updatedEvent.title}.`,
      actionRoute: `/organizer/event/${updatedEvent._id}`,
      data: { eventId: updatedEvent._id, ticketId: ticket._id },
    }),
    createNotification({
      recipient: req.user!._id,
      type: "ticket_purchased",
      title: "Tickets confirmed",
      message: `Your tickets for ${updatedEvent.title} are confirmed.`,
      actionRoute: "/(tabs)/tickets",
      data: { ticketId: ticket._id },
    }),
  ]);

  res.status(201).json(ApiResponse.success({ ticket }, "Tickets purchased successfully", 201));
});

export const getMyTickets = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePaginationParams(req.query);
  const filters: Record<string, unknown> = { customer: req.user!._id };
  if (req.query.status) {
    filters.status = req.query.status;
  }
  const total = await Ticket.countDocuments(filters);
  const tickets = await Ticket.find(filters)
    .populate("publicEvent", "title date coverImage venueName city startTime")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  res.json(
    ApiResponse.success(
      { tickets },
      "Tickets fetched successfully",
      200,
      buildPaginationMeta(total, page, limit),
    ),
  );
});

export const getTicketById = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await Ticket.findById(req.params.id)
    .populate("publicEvent", "title date coverImage venueName city startTime")
    .lean<{ customer: string } | null>();

  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }
  if (!isSameId(ticket.customer, req.user!._id)) {
    throw new ApiError(403, "Access denied");
  }

  res.json(ApiResponse.success({ ticket }, "Ticket fetched successfully"));
});

export const cancelTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await Ticket.findOne({ _id: req.params.id, customer: req.user!._id });
  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }
  if (ticket.status !== "active") {
    throw new ApiError(400, "Only active tickets can be cancelled");
  }

  const event = await PublicEvent.findById(ticket.publicEvent);
  if (!event) {
    throw new ApiError(404, "Event not found");
  }
  const hoursLeft = (new Date(event.date).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursLeft < 48) {
    throw new ApiError(400, "Tickets can only be cancelled 48 hours before the event");
  }

  const ticketTypeIndex = event.ticketTypes.findIndex(
    (type: { name: string }) => type.name === ticket.ticketType.name,
  );
  if (ticketTypeIndex >= 0) {
    event.ticketTypes[ticketTypeIndex].soldSeats = Math.max(
      event.ticketTypes[ticketTypeIndex].soldSeats - ticket.quantity,
      0,
    );
  }
  event.totalRevenue = Math.max(event.totalRevenue - ticket.totalAmount, 0);
  await event.save();

  ticket.status = "cancelled";
  await ticket.save();

  res.json(ApiResponse.success({ ticket }, "Ticket cancelled successfully"));
});
