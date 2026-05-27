import type { Request, Response } from "express";
import Booking from "../models/Booking";
import Enquiry from "../models/Enquiry";
import Payout from "../models/Payout";
import Review from "../models/Review";
import Ticket from "../models/Ticket";
import Venue from "../models/Venue";
import { PLATFORM_COMMISSION_RATE } from "../utils/commission.utils";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import {
  ANALYTICS_PERIOD_MAP,
  getPeriodStart,
  isOnOrAfter,
  monthKey,
  monthLabel,
  monthsBack,
  parseAnalyticsPeriod,
} from "../utils/analyticsPeriod.utils";

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const organizerId = req.user!._id;

  const [bookings, enquiries, payouts, venues, reviews, tickets] = await Promise.all([
    Booking.find({ organizer: organizerId })
      .populate("customer", "firstName lastName avatar city")
      .populate("venue", "name city coverImage capacity pricePerEvent")
      .sort({ createdAt: -1 })
      .lean(),
    Enquiry.find({ organizer: organizerId }).sort({ createdAt: -1 }).lean(),
    Payout.find({ organizer: organizerId }).sort({ createdAt: -1 }).lean(),
    Venue.find({ organizer: organizerId }).sort({ createdAt: -1 }).lean(),
    Review.find({ organizer: organizerId })
      .populate("customer", "firstName lastName city avatar")
      .sort({ createdAt: -1 })
      .lean(),
    Ticket.find({ organizer: organizerId }).lean(),
  ]);

  const totalRevenue =
    bookings.filter((booking) => booking.status === "completed").reduce((sum, booking) => sum + booking.pricing.totalAmount, 0) +
    tickets.filter((ticket) => ticket.status !== "cancelled").reduce((sum, ticket) => sum + ticket.totalAmount, 0);
  const totalBookings = bookings.length;
  const avgRating =
    reviews.length > 0 ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)) : 0;
  const totalCustomers = new Set([
    ...bookings.map((booking) => String(booking.customer)),
    ...tickets.map((ticket) => String(ticket.customer)),
  ]).size;

  const revenueMonths = monthsBack(6);
  const revenueChart = revenueMonths.map((month) => {
    const key = monthKey(month);
    const monthBookings = bookings.filter((booking) => monthKey(new Date(booking.createdAt)) === key);
    const revenue = monthBookings.reduce((sum, booking) => sum + booking.pricing.totalAmount, 0);
    return {
      month: monthLabel(month),
      revenue,
      bookings: monthBookings.length,
    };
  });

  res.json(
    ApiResponse.success(
      {
        stats: { totalRevenue, totalBookings, avgRating, totalCustomers },
        pendingBookings: bookings.filter((booking) => booking.status === "pending_approval").slice(0, 5),
        recentBookings: bookings.slice(0, 5),
        newEnquiries: enquiries.filter((enquiry) => enquiry.status === "new").slice(0, 5),
        processingPayouts: payouts.filter((payout) => payout.status === "processing"),
        revenueChart,
        activeVenues: venues.filter((venue) => venue.status === "active").slice(0, 3),
        recentReviews: reviews.slice(0, 2),
      },
      "Dashboard fetched successfully",
    ),
  );
});

export const getAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const organizerId = req.user!._id;
  const period = parseAnalyticsPeriod(req.query.period as string | undefined);
  const monthsCount = ANALYTICS_PERIOD_MAP[period];
  const periodStart = getPeriodStart(monthsCount);

  const [bookings, venues, reviews, tickets] = await Promise.all([
    Booking.find({ organizer: organizerId }).lean(),
    Venue.find({ organizer: organizerId }).lean(),
    Review.find({ organizer: organizerId }).lean(),
    Ticket.find({ organizer: organizerId }).lean(),
  ]);

  const periodBookings = bookings.filter((booking) => isOnOrAfter(booking.createdAt, periodStart));
  const periodTickets = tickets.filter(
    (ticket) => ticket.status !== "cancelled" && isOnOrAfter(ticket.createdAt, periodStart),
  );

  const buckets = monthsBack(monthsCount).map((month) => ({
    month,
    key: monthKey(month),
  }));

  const revenueByMonth = buckets.map(({ month, key }) => {
    const monthBookings = periodBookings.filter((booking) => monthKey(new Date(booking.createdAt)) === key);
    const monthTickets = periodTickets.filter((ticket) => monthKey(new Date(ticket.createdAt)) === key);
    const revenue =
      monthBookings.reduce((sum, booking) => sum + booking.pricing.totalAmount, 0) +
      monthTickets.reduce((sum, ticket) => sum + ticket.totalAmount, 0);

    return {
      month: monthLabel(month),
      revenue,
      bookings: monthBookings.length,
      newCustomers: new Set(monthBookings.map((booking) => String(booking.customer))).size,
    };
  });

  const totalRevenue = revenueByMonth.reduce((sum, item) => sum + item.revenue, 0);
  const totalBookings = periodBookings.length + periodTickets.length;
  const commissionPaid = Math.round(totalRevenue * PLATFORM_COMMISSION_RATE);
  const avgRating =
    reviews.length > 0 ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)) : 0;

  const venueStats = venues
    .map((venue) => {
      const venueBookings = periodBookings.filter((booking) => String(booking.venue) === String(venue._id));
      const revenue = venueBookings.reduce((sum, booking) => sum + booking.pricing.totalAmount, 0);
      return {
        venue,
        bookings: venueBookings.length,
        revenue,
        rating: venue.rating,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3);

  const bookingTrend = revenueByMonth.map(({ month, bookings: bookingCount }) => ({
    month,
    count: bookingCount,
  }));

  const eventTypeRevenue = periodBookings.reduce<Record<string, number>>((acc, booking) => {
    acc[booking.eventType] = (acc[booking.eventType] ?? 0) + booking.pricing.totalAmount;
    return acc;
  }, {});
  const eventTypeBreakdown = Object.entries(eventTypeRevenue).map(([type, revenue]) => ({
    type,
    percentage: totalRevenue ? Number(((revenue / totalRevenue) * 100).toFixed(1)) : 0,
    revenue,
  }));

  const confirmedBookings = periodBookings.filter((booking) => ["confirmed", "completed"].includes(booking.status));
  const repeatRate = confirmedBookings.length
    ? Number(
        (
          (confirmedBookings.length -
            new Set(confirmedBookings.map((booking) => String(booking.customer))).size) /
          confirmedBookings.length
        ).toFixed(2),
      )
    : 0;
  const avgGroupSize = confirmedBookings.length
    ? Number(
        (
          confirmedBookings.reduce((sum, booking) => sum + booking.guestCount, 0) /
          confirmedBookings.length
        ).toFixed(1),
      )
    : 0;
  const avgLeadTime = confirmedBookings.length
    ? Number(
        (
          confirmedBookings.reduce((sum, booking) => {
            const diff = new Date(booking.eventDate).getTime() - new Date(booking.createdAt).getTime();
            return sum + diff / (1000 * 60 * 60 * 24);
          }, 0) / confirmedBookings.length
        ).toFixed(1),
      )
    : 0;

  res.json(
    ApiResponse.success(
      {
        summary: { totalRevenue, totalBookings, commissionPaid, avgRating },
        revenueByMonth,
        bookingTrend,
        topVenues: venueStats,
        eventTypeBreakdown,
        customerInsights: { repeatRate, avgGroupSize, avgLeadTime },
        commissionSummary: {
          gross: totalRevenue,
          commission: commissionPaid,
          net: totalRevenue - commissionPaid,
        },
      },
      "Analytics fetched successfully",
    ),
  );
});
