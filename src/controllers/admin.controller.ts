import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/User";
import OrganizerProfile from "../models/OrganizerProfile";
import Venue from "../models/Venue";
import PublicEvent from "../models/PublicEvent";
import Booking from "../models/Booking";
import Ticket from "../models/Ticket";
import Payout from "../models/Payout";
import Review from "../models/Review";
import Notification from "../models/Notification";
import Dispute from "../models/Dispute";
import PlatformNotification from "../models/PlatformNotification";
import AdminAuditLog from "../models/AdminAuditLog";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { auditLog } from "../middleware/adminAudit.middleware";
import Settings from "../models/Settings";
import { recalculateEntityRating } from "../utils/ratingUtils";
import { toDayStart } from "../utils/model.utils";
import { APP_CONSTANTS } from "../config/constants";
import {
  ANALYTICS_PERIOD_MAP,
  getPeriodStart,
  isOnOrAfter,
  monthKey,
  monthLabel,
  monthsBack,
  parseAnalyticsPeriod,
} from "../utils/analyticsPeriod.utils";

const createNotification = async (
  recipientId: string,
  type: string,
  title: string,
  message: string,
  data?: unknown,
) => {
  try {
    await Notification.create({ recipient: recipientId, type, title, message, data });
  } catch (_) {/* non-fatal */}
};

// ── ADMIN LOGIN ───────────────────────────────────────────────────────────────
export const adminLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  const user = await User.findOne({ email: email.toLowerCase(), role: "admin" }).select(
    "+password +refreshToken",
  );
  if (!user) throw new ApiError(403, "Admin access only");

  const passwordMatches = await user.comparePassword(password);
  if (!passwordMatches) throw new ApiError(401, "Invalid credentials");

  if (!user.isActive) throw new ApiError(403, "Account is inactive");

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = await bcrypt.hash(refreshToken, 12);
  user.lastLogin = new Date();
  await user.save();

  const plain = await User.findById(user._id).select("-password -refreshToken").lean();
  res.json(ApiResponse.success({ accessToken, refreshToken, user: plain, organizerProfile: null }, "Login successful"));
});

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const [
    totalUsers, totalCustomers, totalOrganizers,
    totalVenues, totalPublicEvents, totalBookings,
    totalTickets, bookingRevDocs, ticketRevDocs,
    payouts, openDisputeCount, pendingVenues, pendingKYC,
    recentBookings, recentSignups, openDisputesList,
    topOrganizers, topVenues, recentActivity,
  ] = await Promise.all([
    User.countDocuments({ role: { $ne: "admin" } }),
    User.countDocuments({ role: "customer" }),
    User.countDocuments({ role: "organizer" }),
    Venue.countDocuments(),
    PublicEvent.countDocuments(),
    Booking.countDocuments(),
    Ticket.countDocuments({ status: { $ne: "cancelled" } }),
    Booking.find({ status: "completed" }).select("pricing.totalAmount pricing.platformCommission").lean(),
    Ticket.find({ status: { $ne: "cancelled" } }).select("totalAmount platformCommission").lean(),
    Payout.find().select("status netPayout").lean(),
    Dispute.countDocuments({ status: "open" }),
    Venue.countDocuments({ status: "under_review" }),
    OrganizerProfile.countDocuments({ isKYCSubmitted: true, isKYCApproved: false }),
    Booking.find().populate("customer", "firstName lastName avatar").populate("venue", "name city").sort({ createdAt: -1 }).limit(5).lean(),
    User.find({ role: { $ne: "admin" } }).select("firstName lastName email role avatar createdAt").sort({ createdAt: -1 }).limit(5).lean(),
    Dispute.find({ status: "open" }).populate("raisedBy", "firstName lastName").populate("againstUser", "firstName lastName").sort({ createdAt: -1 }).limit(5).lean(),
    OrganizerProfile.find().populate("user", "firstName lastName email avatar").sort({ totalRevenue: -1 }).limit(5).lean(),
    Venue.find().populate("organizer", "firstName lastName").sort({ totalBookings: -1 }).limit(5).lean(),
    AdminAuditLog.find().populate("admin", "firstName lastName").sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  const totalGrossRevenue = bookingRevDocs.reduce((s, b) => s + b.pricing.totalAmount, 0) + ticketRevDocs.reduce((s, t) => s + t.totalAmount, 0);
  const totalCommissionEarned = bookingRevDocs.reduce((s, b) => s + b.pricing.platformCommission, 0) + ticketRevDocs.reduce((s, t) => s + t.platformCommission, 0);
  const totalPayoutsPaid = payouts.filter(p => p.status === "paid").reduce((s, p) => s + p.netPayout, 0);
  const pendingPayoutsCount = payouts.filter(p => p.status === "upcoming" || p.status === "processing").length;

  const months = monthsBack(6);
  const revenueChart = await Promise.all(
    months.map(async (month) => {
      const key = monthKey(month);
      const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      const [mBookings, mTickets, mPayouts] = await Promise.all([
        Booking.find({ status: "completed", createdAt: { $gte: month, $lt: nextMonth } }).select("pricing.totalAmount pricing.platformCommission").lean(),
        Ticket.find({ status: { $ne: "cancelled" }, createdAt: { $gte: month, $lt: nextMonth } }).select("totalAmount platformCommission organizerPayout").lean(),
        Payout.find({ status: "paid", paidAt: { $gte: month, $lt: nextMonth } }).select("netPayout").lean(),
      ]);
      const gross = mBookings.reduce((s, b) => s + b.pricing.totalAmount, 0) + mTickets.reduce((s, t) => s + t.totalAmount, 0);
      const commission = mBookings.reduce((s, b) => s + b.pricing.platformCommission, 0) + mTickets.reduce((s, t) => s + t.platformCommission, 0);
      const payoutsVal = mPayouts.reduce((s, p) => s + p.netPayout, 0);
      return { month: monthLabel(month), grossRevenue: gross, commission, payouts: payoutsVal };
    }),
  );

  const pendingApprovalVenues = await Venue.find({ status: "under_review" }).populate("organizer", "firstName lastName").sort({ createdAt: -1 }).limit(5).lean();
  const pendingApprovalKYC = await OrganizerProfile.find({ isKYCSubmitted: true, isKYCApproved: false }).populate("user", "firstName lastName email avatar").sort({ createdAt: -1 }).limit(5).lean();

  res.json(
    ApiResponse.success({
      stats: {
        totalUsers, totalCustomers, totalOrganizers, totalVenues, totalPublicEvents,
        totalBookings, totalTicketsSold: totalTickets,
        totalGrossRevenue, totalCommissionEarned, totalPayoutsPaid,
        pendingPayouts: pendingPayoutsCount, openDisputes: openDisputeCount,
        pendingVenueApprovals: pendingVenues, pendingKYCApprovals: pendingKYC,
      },
      revenueChart,
      recentBookings,
      recentSignups,
      pendingApprovals: { venues: pendingApprovalVenues, kyc: pendingApprovalKYC },
      openDisputes: openDisputesList,
      topOrganizers,
      topVenues,
      recentActivity,
    }, "Dashboard fetched"),
  );
});

// ── ANALYTICS ────────────────────────────────────────────────────────────────
export const getAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const period = parseAnalyticsPeriod(req.query.period as string | undefined);
  const count = ANALYTICS_PERIOD_MAP[period];
  const months = monthsBack(count);
  const periodStart = getPeriodStart(count);

  const [bookings, tickets, payouts] = await Promise.all([
    Booking.find().populate("venue", "name city category").lean(),
    Ticket.find().populate("publicEvent", "title category city").lean(),
    Payout.find().lean(),
  ]);

  const periodBookings = bookings.filter((b) => isOnOrAfter(b.createdAt, periodStart));
  const periodTickets = tickets.filter(
    (t) => t.status !== "cancelled" && isOnOrAfter(t.createdAt, periodStart),
  );
  const periodPayouts = payouts.filter((p) => p.paidAt && isOnOrAfter(p.paidAt, periodStart));

  const totalGross =
    periodBookings.reduce((s, b) => s + b.pricing.totalAmount, 0) +
    periodTickets.reduce((s, t) => s + t.totalAmount, 0);
  const totalCommission =
    periodBookings.reduce((s, b) => s + b.pricing.platformCommission, 0) +
    periodTickets.reduce((s, t) => s + t.platformCommission, 0);
  const totalPaidOut = periodPayouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.netPayout, 0);
  const pendingPayouts = payouts
    .filter((p) => p.status !== "paid" && isOnOrAfter(p.periodStart ?? p.createdAt, periodStart))
    .reduce((s, p) => s + p.netPayout, 0);

  const revenueByMonth = months.map((month) => {
    const key = monthKey(month);
    const mb = periodBookings.filter((b) => monthKey(new Date(b.createdAt)) === key);
    const mt = periodTickets.filter((t) => monthKey(new Date(t.createdAt)) === key);
    const mp = periodPayouts.filter((p) => p.paidAt && monthKey(new Date(p.paidAt)) === key);
    return {
      month: monthLabel(month),
      gross: mb.reduce((s, b) => s + b.pricing.totalAmount, 0) + mt.reduce((s, t) => s + t.totalAmount, 0),
      commission: mb.reduce((s, b) => s + b.pricing.platformCommission, 0) + mt.reduce((s, t) => s + t.platformCommission, 0),
      payouts: mp.reduce((s, p) => s + p.netPayout, 0),
      bookings: mb.length,
      tickets: mt.length,
    };
  });

  // Revenue by city (within selected period)
  const cityMap: Record<string, { gross: number; commission: number; bookingCount: number }> = {};
  for (const b of periodBookings) {
    const venue = b.venue as { city?: string } | null;
    const city = typeof venue === "object" && venue?.city ? venue.city : "Other";
    if (!cityMap[city]) cityMap[city] = { gross: 0, commission: 0, bookingCount: 0 };
    cityMap[city].gross += b.pricing.totalAmount;
    cityMap[city].commission += b.pricing.platformCommission;
    cityMap[city].bookingCount += 1;
  }
  const revenueByCity = Object.entries(cityMap)
    .map(([city, v]) => ({ city, ...v }))
    .sort((a, b) => b.gross - a.gross)
    .slice(0, 8);

  // Top organizers (within selected period)
  const orgProfileMap = new Map(
    (await OrganizerProfile.find().populate("user", "firstName lastName email avatar").lean()).map((op) => [
      String(op.user),
      op,
    ]),
  );
  const orgStats: Record<string, { gross: number; commission: number; bookings: number }> = {};
  for (const b of periodBookings) {
    const orgId = String(b.organizer);
    if (!orgStats[orgId]) orgStats[orgId] = { gross: 0, commission: 0, bookings: 0 };
    orgStats[orgId].gross += b.pricing.totalAmount;
    orgStats[orgId].commission += b.pricing.platformCommission;
    orgStats[orgId].bookings += 1;
  }
  const topOrganizers = Object.entries(orgStats)
    .map(([orgId, stats]) => {
      const op = orgProfileMap.get(orgId);
      return {
        organizer: op ?? { user: orgId },
        gross: stats.gross,
        commission: stats.commission,
        bookings: stats.bookings,
        rating: op?.rating ?? 0,
      };
    })
    .sort((a, b) => b.gross - a.gross)
    .slice(0, 10);

  // Top venues
  const topVenues = await Venue.find({ status: "active" }).populate("organizer", "firstName lastName").sort({ totalBookings: -1 }).limit(10).lean();

  // User growth
  const userGrowth = await Promise.all(
    months.map(async (month) => {
      const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      const [nc, no] = await Promise.all([
        User.countDocuments({ role: "customer", createdAt: { $gte: month, $lt: nextMonth } }),
        User.countDocuments({ role: "organizer", createdAt: { $gte: month, $lt: nextMonth } }),
      ]);
      return { month: monthLabel(month), newCustomers: nc, newOrganizers: no };
    }),
  );

  res.json(
    ApiResponse.success({
      summary: {
        grossRevenue: totalGross,
        commissionEarned: totalCommission,
        totalPayouts: totalPaidOut,
        pendingPayouts,
        avgBookingValue: periodBookings.length ? Math.round(totalGross / periodBookings.length) : 0,
        avgTicketValue: periodTickets.length
          ? Math.round(periodTickets.reduce((s, t) => s + t.totalAmount, 0) / periodTickets.length)
          : 0,
      },
      revenueByMonth,
      revenueByCity,
      topOrganizers,
      topVenues,
      userGrowth,
      bookingTrend: revenueByMonth.map(m => ({ month: m.month, count: m.bookings, value: m.gross })),
      commissionBreakdown: {
        fromBookings: periodBookings.reduce((s, b) => s + b.pricing.platformCommission, 0),
        fromTickets: periodTickets.reduce((s, t) => s + t.platformCommission, 0),
        total: totalCommission,
      },
    }, "Analytics fetched"),
  );
});

// ── USER MANAGEMENT ───────────────────────────────────────────────────────────
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const { role, isActive, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const p = Math.max(1, parseInt(page));
  const l = Math.min(50, parseInt(limit));
  const filter: Record<string, unknown> = { role: { $ne: "admin" } };
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive === "true";
  if (search) filter.$or = [
    { firstName: { $regex: search, $options: "i" } },
    { lastName: { $regex: search, $options: "i" } },
    { email: { $regex: search, $options: "i" } },
  ];

  const total = await User.countDocuments(filter);
  const users = await User.find(filter).select("-password -refreshToken").sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).lean();

  // For organizers, attach profile
  const enriched = await Promise.all(
    users.map(async (u) => {
      if (u.role === "organizer") {
        const profile = await OrganizerProfile.findOne({ user: u._id }).lean();
        return { ...u, organizerProfile: profile };
      }
      return u;
    }),
  );

  res.json(ApiResponse.success({ users: enriched }, "Users fetched", 200, {
    page: p, limit: l, total, totalPages: Math.ceil(total / l),
    hasNext: p * l < total, hasPrev: p > 1,
  }));
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const userDoc = await User.findById(req.params.id).select("-password -refreshToken").lean() as Record<string, unknown> | null;
  if (!userDoc) throw new ApiError(404, "User not found");
  const profile =
    userDoc.role === "organizer"
      ? ((await OrganizerProfile.findOne({ user: userDoc._id }).lean()) as {
          commissionRate?: number;
        } | null)
      : null;
  const platformSettings = (await Settings.findOne().lean()) as {
    commissionRate?: number;
  } | null;

  const [bookingCount, ticketCount, reviewCount, recentBookings, recentVenues, recentEvents, recentPayouts, totalSpentAgg] =
    await Promise.all([
      Booking.countDocuments({ customer: userDoc._id }),
      Ticket.countDocuments({ customer: userDoc._id }),
      Review.countDocuments({ customer: userDoc._id, isRemoved: { $ne: true } }),
      Booking.find({ customer: userDoc._id }).populate("venue", "name city").sort({ createdAt: -1 }).limit(3).lean(),
      userDoc.role === "organizer"
        ? Venue.find({ organizer: userDoc._id }).sort({ createdAt: -1 }).limit(3).lean()
        : Promise.resolve([]),
      userDoc.role === "organizer"
        ? PublicEvent.find({ organizer: userDoc._id }).sort({ createdAt: -1 }).limit(2).lean()
        : Promise.resolve([]),
      userDoc.role === "organizer"
        ? Payout.find({ organizer: userDoc._id }).sort({ createdAt: -1 }).limit(2).lean()
        : Promise.resolve([]),
      Booking.aggregate<{ total: number }>([
        { $match: { customer: userDoc._id, status: { $in: ["confirmed", "completed"] } } },
        { $group: { _id: null, total: { $sum: "$pricing.totalAmount" } } },
      ]),
    ]);

  const effectiveCommissionRate =
    profile?.commissionRate != null
      ? profile.commissionRate
      : platformSettings?.commissionRate ?? Math.round(APP_CONSTANTS.platformCommissionRate * 100);

  res.json(
    ApiResponse.success(
      {
        user: userDoc,
        organizerProfile: profile,
        bookingCount,
        ticketCount,
        reviewCount,
        totalSpent: totalSpentAgg[0]?.total ?? 0,
        recentBookings,
        recentVenues,
        recentEvents,
        recentPayouts,
        effectiveCommissionRate,
        commissionSource: profile?.commissionRate != null ? "custom" : "platform",
      },
      "User fetched",
    ),
  );
});

export const suspendUser = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason: string };
  const userDoc = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: false, suspensionReason: reason, $unset: { refreshToken: 1 } },
    { new: true },
  ).select("-password").lean() as Record<string, unknown> | null;
  if (!userDoc) throw new ApiError(404, "User not found");
  if (userDoc.role === "organizer") {
    await Promise.all([
      Venue.updateMany({ organizer: userDoc._id, status: "active" }, { status: "inactive" }),
      PublicEvent.updateMany({ organizer: userDoc._id, status: "published" }, { status: "paused" }),
    ]);
  }
  await createNotification(String(userDoc._id), "system_alert", "Account Suspended", `Your account has been suspended. Reason: ${reason}. Contact support@eventmitra.com`);
  await auditLog(req, req.user!._id, "user_suspended", "user", String(userDoc._id), `Suspended user ${userDoc.email}. Reason: ${reason}`, { isActive: true }, { isActive: false }, String(userDoc.email));
  res.json(ApiResponse.success({ user: userDoc }, "User suspended"));
});

export const activateUser = asyncHandler(async (req: Request, res: Response) => {
  const userDoc = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: true, isBanned: false, $unset: { suspensionReason: 1, bannedAt: 1, bannedReason: 1 } },
    { new: true },
  ).select("-password").lean() as Record<string, unknown> | null;
  if (!userDoc) throw new ApiError(404, "User not found");
  await createNotification(String(userDoc._id), "system_alert", "Account Reactivated", "Your EventMitra account is active again.");
  await auditLog(req, req.user!._id, "user_activated", "user", String(userDoc._id), `Activated user ${userDoc.email}`, undefined, undefined, String(userDoc.email));
  res.json(ApiResponse.success({ user: userDoc }, "User activated"));
});

export const liftBan = asyncHandler(async (req: Request, res: Response) => {
  const userDoc = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: true, isBanned: false, $unset: { bannedAt: 1, bannedReason: 1, suspensionReason: 1 } },
    { new: true },
  ).select("-password").lean() as Record<string, unknown> | null;
  if (!userDoc) throw new ApiError(404, "User not found");
  await createNotification(String(userDoc._id), "system_alert", "Ban Lifted", "Your account ban has been lifted. Welcome back to EventMitra.");
  await auditLog(req, req.user!._id, "user_activated", "user", String(userDoc._id), `Lifted ban for user ${userDoc.email}`, undefined, undefined, String(userDoc.email));
  res.json(ApiResponse.success({ user: userDoc }, "Ban lifted"));
});

export const banUser = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason: string };
  const userDoc = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: false, isBanned: true, bannedAt: new Date(), bannedReason: reason, $unset: { refreshToken: 1 } },
    { new: true },
  ).select("-password").lean() as Record<string, unknown> | null;
  if (!userDoc) throw new ApiError(404, "User not found");
  await createNotification(String(userDoc._id), "system_alert", "Account Banned", `Your account has been permanently banned. Reason: ${reason}`);
  await auditLog(req, req.user!._id, "user_banned", "user", String(userDoc._id), `Banned user ${userDoc.email}. Reason: ${reason}`, undefined, undefined, String(userDoc.email));
  res.json(ApiResponse.success({ user: userDoc }, "User banned"));
});

export const notifyUser = asyncHandler(async (req: Request, res: Response) => {
  const { title, message } = req.body as { title: string; message: string };
  const userDoc = await User.findById(req.params.id).lean() as { _id: string; email: string; isActive: boolean } | null;
  if (!userDoc) throw new ApiError(404, "User not found");
  if (!userDoc.isActive) throw new ApiError(400, "Cannot notify inactive user");

  await Notification.create({
    recipient: userDoc._id,
    type: "system_alert",
    title,
    message,
    data: { sentByAdmin: true },
  });

  await auditLog(
    req,
    req.user!._id,
    "notification_sent",
    "user",
    String(userDoc._id),
    `Sent notification to ${userDoc.email}: ${title}`,
    undefined,
    undefined,
    userDoc.email,
  );

  res.json(ApiResponse.success({ success: true }, "Notification sent"));
});

// ── KYC MANAGEMENT ────────────────────────────────────────────────────────────
export const getPendingKYC = asyncHandler(async (_req: Request, res: Response) => {
  const profiles = await OrganizerProfile.find({ isKYCSubmitted: true, isKYCApproved: false })
    .populate("user", "firstName lastName email avatar phone city")
    .sort({ createdAt: -1 })
    .lean();
  res.json(ApiResponse.success({ profiles }, "Pending KYC fetched"));
});

export const getKYCDetail = asyncHandler(async (req: Request, res: Response) => {
  const profile = await OrganizerProfile.findById(req.params.organizerProfileId)
    .populate("user", "firstName lastName email phone city avatar")
    .lean();
  if (!profile) throw new ApiError(404, "Organizer profile not found");
  res.json(ApiResponse.success({ profile }, "KYC detail fetched"));
});

export const approveKYC = asyncHandler(async (req: Request, res: Response) => {
  const profileDoc = await OrganizerProfile.findByIdAndUpdate(
    req.params.organizerProfileId,
    {
      isKYCApproved: true,
      isVerified: true,
      kycReviewedBy: req.user!._id,
      kycReviewedAt: new Date(),
      $unset: { kycRejectionReason: 1 },
    },
    { new: true },
  ).populate("user", "firstName lastName email").lean() as Record<string, unknown> | null;
  if (!profileDoc) throw new ApiError(404, "Organizer profile not found");
  const userId = typeof profileDoc.user === "object" ? (profileDoc.user as { _id: string })._id : profileDoc.user;
  await createNotification(String(userId), "listing_approved", "KYC Approved ✓", "Your KYC has been approved. You are now a Verified Partner on EventMitra!");
  await auditLog(req, req.user!._id, "kyc_approved", "kyc", String(profileDoc._id), `Approved KYC for organizer profile ${String(profileDoc._id)}`);
  res.json(ApiResponse.success({ profile: profileDoc }, "KYC approved"));
});

export const rejectKYC = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason: string };
  const profileDoc = await OrganizerProfile.findByIdAndUpdate(
    req.params.organizerProfileId,
    {
      isKYCApproved: false,
      isKYCSubmitted: false,
      kycRejectionReason: reason,
      kycReviewedBy: req.user!._id,
      kycReviewedAt: new Date(),
    },
    { new: true },
  ).populate("user", "firstName lastName email").lean() as Record<string, unknown> | null;
  if (!profileDoc) throw new ApiError(404, "Organizer profile not found");
  const userId = typeof profileDoc.user === "object" ? (profileDoc.user as { _id: string })._id : profileDoc.user;
  await User.findByIdAndUpdate(userId, { isEmailVerified: true });
  await createNotification(String(userId), "system_alert", "KYC Not Approved", `Reason: ${reason}. Please resubmit corrected documents.`);
  await auditLog(req, req.user!._id, "kyc_rejected", "kyc", String(profileDoc._id), `Rejected KYC for organizer profile ${String(profileDoc._id)}. Reason: ${reason}`);
  res.json(ApiResponse.success({ profile: profileDoc }, "KYC rejected"));
});

// ── VENUE MANAGEMENT ──────────────────────────────────────────────────────────
export const getAllVenues = asyncHandler(async (req: Request, res: Response) => {
  const { status, city, organizerId, isFeatured, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const p = Math.max(1, parseInt(page));
  const l = Math.min(50, parseInt(limit));
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (city) filter.city = { $regex: city, $options: "i" };
  if (organizerId) filter.organizer = organizerId;
  if (isFeatured !== undefined) filter.isFeatured = isFeatured === "true";
  if (search) filter.$or = [{ name: { $regex: search, $options: "i" } }, { city: { $regex: search, $options: "i" } }];

  const total = await Venue.countDocuments(filter);
  const venues = await Venue.find(filter).populate("organizer", "firstName lastName email avatar").sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).lean();
  res.json(ApiResponse.success({ venues }, "Venues fetched", 200, { page: p, limit: l, total, totalPages: Math.ceil(total / l), hasNext: p * l < total, hasPrev: p > 1 }));
});

export const getVenueByIdAdmin = asyncHandler(async (req: Request, res: Response) => {
  const venueDoc = await Venue.findById(req.params.id).populate("organizer", "firstName lastName email avatar phone city").lean() as Record<string, unknown> | null;
  if (!venueDoc) throw new ApiError(404, "Venue not found");
  const [bookingCount, reviewCount] = await Promise.all([
    Booking.countDocuments({ venue: venueDoc._id }),
    Review.countDocuments({ venue: venueDoc._id, isRemoved: { $ne: true } }),
  ]);
  res.json(ApiResponse.success({ venue: venueDoc, bookingCount, reviewCount }, "Venue fetched"));
});

export const approveVenue = asyncHandler(async (req: Request, res: Response) => {
  const venueDoc = await Venue.findByIdAndUpdate(
    req.params.id,
    { status: "active", approvedBy: req.user!._id, approvedAt: new Date(), $unset: { rejectionReason: 1 } },
    { new: true },
  ).populate("organizer", "firstName lastName email").lean() as Record<string, unknown> | null;
  if (!venueDoc) throw new ApiError(404, "Venue not found");
  const org = venueDoc.organizer as { _id: string; firstName: string } | null;
  if (org) await createNotification(String(org._id), "listing_approved", "Venue Listing Approved!", `Your venue "${venueDoc.name}" is now live on EventMitra. Customers can now discover and book it!`);
  await auditLog(req, req.user!._id, "venue_approved", "venue", String(venueDoc._id), `Approved venue "${venueDoc.name}"`);
  res.json(ApiResponse.success({ venue: venueDoc }, "Venue approved"));
});

export const rejectVenue = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason: string };
  const venueDoc = await Venue.findByIdAndUpdate(
    req.params.id,
    { status: "rejected", rejectionReason: reason },
    { new: true },
  ).populate("organizer", "firstName lastName email").lean() as Record<string, unknown> | null;
  if (!venueDoc) throw new ApiError(404, "Venue not found");
  const org = venueDoc.organizer as { _id: string } | null;
  if (org) await createNotification(String(org._id), "system_alert", "Venue Listing Rejected", `Your venue "${venueDoc.name}" was not approved. Reason: ${reason}`);
  await auditLog(req, req.user!._id, "venue_rejected", "venue", String(venueDoc._id), `Rejected venue "${venueDoc.name}". Reason: ${reason}`);
  res.json(ApiResponse.success({ venue: venueDoc }, "Venue rejected"));
});

export const featureVenue = asyncHandler(async (req: Request, res: Response) => {
  const { isFeatured, isTopPick } = req.body as { isFeatured: boolean; isTopPick: boolean };
  const venueDoc = await Venue.findByIdAndUpdate(req.params.id, { isFeatured, isTopPick }, { new: true }).lean() as Record<string, unknown> | null;
  if (!venueDoc) throw new ApiError(404, "Venue not found");
  const action = isFeatured ? "venue_featured" : "venue_unfeatured";
  await auditLog(req, req.user!._id, action, "venue", String(venueDoc._id), `${isFeatured ? "Featured" : "Unfeatured"} venue "${venueDoc.name}"`);
  res.json(ApiResponse.success({ venue: venueDoc }, "Venue updated"));
});

export const suspendVenue = asyncHandler(async (req: Request, res: Response) => {
  const venueDoc = await Venue.findByIdAndUpdate(req.params.id, { status: "inactive" }, { new: true }).populate("organizer", "firstName lastName").lean() as Record<string, unknown> | null;
  if (!venueDoc) throw new ApiError(404, "Venue not found");
  const org = venueDoc.organizer as { _id: string } | null;
  if (org) await createNotification(String(org._id), "system_alert", "Venue Suspended", `Your venue "${venueDoc.name}" has been temporarily suspended.`);
  await auditLog(req, req.user!._id, "venue_suspended", "venue", String(venueDoc._id), `Suspended venue "${venueDoc.name}"`);
  res.json(ApiResponse.success({ venue: venueDoc }, "Venue suspended"));
});

// ── EVENT MANAGEMENT ──────────────────────────────────────────────────────────
export const getAllEvents = asyncHandler(async (req: Request, res: Response) => {
  const { status, city, category, organizerId, isFeatured, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const p = Math.max(1, parseInt(page));
  const l = Math.min(50, parseInt(limit));
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (city) filter.city = { $regex: city, $options: "i" };
  if (category) filter.category = category;
  if (organizerId) filter.organizer = organizerId;
  if (isFeatured !== undefined) filter.isFeatured = isFeatured === "true";
  if (search) filter.$or = [{ title: { $regex: search, $options: "i" } }];

  const total = await PublicEvent.countDocuments(filter);
  const events = await PublicEvent.find(filter).populate("organizer", "firstName lastName email avatar").sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).lean();
  res.json(ApiResponse.success({ events }, "Events fetched", 200, { page: p, limit: l, total, totalPages: Math.ceil(total / l), hasNext: p * l < total, hasPrev: p > 1 }));
});

export const getEventByIdAdmin = asyncHandler(async (req: Request, res: Response) => {
  const eventDoc = await PublicEvent.findById(req.params.id).populate("organizer", "firstName lastName email avatar").lean() as Record<string, unknown> | null;
  if (!eventDoc) throw new ApiError(404, "Event not found");
  const ticketCount = await Ticket.countDocuments({ publicEvent: eventDoc._id, status: { $ne: "cancelled" } });
  res.json(ApiResponse.success({ event: eventDoc, ticketCount }, "Event fetched"));
});

export const featureEvent = asyncHandler(async (req: Request, res: Response) => {
  const { isFeatured } = req.body as { isFeatured: boolean };
  const eventDoc = await PublicEvent.findByIdAndUpdate(req.params.id, { isFeatured }, { new: true }).lean() as Record<string, unknown> | null;
  if (!eventDoc) throw new ApiError(404, "Event not found");
  await auditLog(req, req.user!._id, "event_featured", "event", String(eventDoc._id), `${isFeatured ? "Featured" : "Unfeatured"} event "${eventDoc.title}"`);
  res.json(ApiResponse.success({ event: eventDoc }, "Event updated"));
});

export const pauseEvent = asyncHandler(async (req: Request, res: Response) => {
  const eventDoc = await PublicEvent.findByIdAndUpdate(req.params.id, { status: "paused" }, { new: true }).populate("organizer", "firstName lastName").lean() as Record<string, unknown> | null;
  if (!eventDoc) throw new ApiError(404, "Event not found");
  const org = eventDoc.organizer as { _id: string } | null;
  if (org) await createNotification(String(org._id), "system_alert", "Event Paused", `Your event "${eventDoc.title}" has been paused by the platform admin.`);
  await auditLog(req, req.user!._id, "event_paused", "event", String(eventDoc._id), `Paused event "${eventDoc.title}"`);
  res.json(ApiResponse.success({ event: eventDoc }, "Event paused"));
});

export const cancelEvent = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason: string };
  const existing = (await PublicEvent.findById(req.params.id).lean()) as { status?: string } | null;
  if (!existing) throw new ApiError(404, "Event not found");

  const eventDoc = await PublicEvent.findByIdAndUpdate(
    req.params.id,
    { status: "cancelled" },
    { new: true },
  ).populate("organizer", "firstName lastName").lean() as Record<string, unknown> | null;
  if (!eventDoc) throw new ApiError(404, "Event not found");

  const cancelResult = await Ticket.updateMany(
    { publicEvent: eventDoc._id, status: "active" },
    { $set: { status: "cancelled" } },
  );
  const ticketHolders = await Ticket.find({ publicEvent: eventDoc._id, status: "cancelled" }).select("customer").lean();
  const uniqueCustomers = [...new Set(ticketHolders.map((t) => String(t.customer)))];

  const org = eventDoc.organizer as { _id: string } | null;
  const eventDate = eventDoc.date ? new Date(String(eventDoc.date)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
  if (org) {
    await createNotification(
      String(org._id),
      "system_alert",
      "Event Cancelled by Admin",
      `Your event "${eventDoc.title}" has been cancelled. Reason: ${reason}`,
    );
  }
  await Promise.all(
    uniqueCustomers.map((customerId) =>
      createNotification(
        customerId,
        "system_alert",
        "Event Cancelled",
        `${eventDoc.title} on ${eventDate} has been cancelled. A refund will be processed to your original payment method.`,
      ),
    ),
  );
  await auditLog(
    req,
    req.user!._id,
    "event_cancelled",
    "event",
    String(eventDoc._id),
    `Cancelled event: ${eventDoc.title}. ${cancelResult.modifiedCount} tickets cancelled.`,
    { status: existing.status },
    { status: "cancelled", reason },
    String(eventDoc.title),
  );
  res.json(ApiResponse.success({ event: eventDoc }, "Event cancelled"));
});

// ── BOOKING MANAGEMENT ────────────────────────────────────────────────────────
export const getAllBookings = asyncHandler(async (req: Request, res: Response) => {
  const { status, organizerId, customerId, venueId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const p = Math.max(1, parseInt(page));
  const l = Math.min(50, parseInt(limit));
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (organizerId) filter.organizer = organizerId;
  if (customerId) filter.customer = customerId;
  if (venueId) filter.venue = venueId;

  const total = await Booking.countDocuments(filter);
  const bookings = await Booking.find(filter)
    .populate("customer", "firstName lastName email avatar")
    .populate("organizer", "firstName lastName email avatar")
    .populate("venue", "name city coverImage")
    .sort({ createdAt: -1 })
    .skip((p - 1) * l)
    .limit(l)
    .lean();
  res.json(ApiResponse.success({ bookings }, "Bookings fetched", 200, { page: p, limit: l, total, totalPages: Math.ceil(total / l), hasNext: p * l < total, hasPrev: p > 1 }));
});

export const getBookingByIdAdmin = asyncHandler(async (req: Request, res: Response) => {
  const booking = await Booking.findById(req.params.id)
    .populate("customer", "firstName lastName email phone avatar")
    .populate("organizer", "firstName lastName email phone avatar")
    .populate("venue", "name city address coverImage capacity")
    .lean();
  if (!booking) throw new ApiError(404, "Booking not found");
  res.json(ApiResponse.success({ booking }, "Booking fetched"));
});

export const forceCancelBooking = asyncHandler(async (req: Request, res: Response) => {
  const { reason, refundAmount } = req.body as { reason: string; refundAmount?: number };
  const booking = await Booking.findById(req.params.id).populate("venue", "name");
  if (!booking) throw new ApiError(404, "Booking not found");

  booking.status = "cancelled";
  booking.cancellation = {
    cancelledBy: req.user!._id,
    cancelledAt: new Date(),
    reason,
    refundAmount: refundAmount ?? 0,
  };
  booking.timeline.push({
    event: "Cancelled by admin",
    timestamp: new Date(),
    actor: req.user!._id,
  });
  await booking.save();

  await Venue.findByIdAndUpdate(booking.venue, {
    $pull: { "availability.bookedDates": toDayStart(booking.eventDate) },
  });

  const venueName =
    typeof booking.venue === "object" && booking.venue && "name" in booking.venue
      ? String((booking.venue as { name: string }).name)
      : "venue";
  const eventDateLabel = new Date(booking.eventDate).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  await Promise.all([
    createNotification(
      String(booking.customer),
      "booking_cancelled",
      "Booking Cancelled by EventMitra",
      `Your booking for ${venueName} on ${eventDateLabel} was cancelled. Refund of ₹${refundAmount ?? 0} will be processed.`,
    ),
    createNotification(
      String(booking.organizer),
      "booking_cancelled",
      "Booking Force-Cancelled",
      `Booking #${booking.bookingRef} for ${venueName} was cancelled by admin. Reason: ${reason}`,
    ),
  ]);

  const bookingDoc = await Booking.findById(booking._id)
    .populate("customer", "firstName lastName")
    .populate("organizer", "firstName lastName")
    .lean();

  await auditLog(
    req,
    req.user!._id,
    "booking_force_cancelled",
    "booking",
    String(booking._id),
    `Force cancelled booking ${booking.bookingRef}. Reason: ${reason}`,
    undefined,
    undefined,
    booking.bookingRef,
  );
  res.json(ApiResponse.success({ booking: bookingDoc }, "Booking cancelled"));
});

// ── TICKET MANAGEMENT ─────────────────────────────────────────────────────────
export const getAllTickets = asyncHandler(async (req: Request, res: Response) => {
  const { status, eventId, organizerId, customerId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const p = Math.max(1, parseInt(page));
  const l = Math.min(50, parseInt(limit));
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (eventId) filter.publicEvent = eventId;
  if (organizerId) filter.organizer = organizerId;
  if (customerId) filter.customer = customerId;

  const total = await Ticket.countDocuments(filter);
  const tickets = await Ticket.find(filter)
    .populate("customer", "firstName lastName email avatar")
    .populate("publicEvent", "title date category coverImage")
    .populate("organizer", "firstName lastName")
    .sort({ createdAt: -1 })
    .skip((p - 1) * l)
    .limit(l)
    .lean();
  res.json(ApiResponse.success({ tickets }, "Tickets fetched", 200, { page: p, limit: l, total, totalPages: Math.ceil(total / l), hasNext: p * l < total, hasPrev: p > 1 }));
});

export const getTicketStats = asyncHandler(async (_req: Request, res: Response) => {
  const [totalSold, allTickets] = await Promise.all([
    Ticket.countDocuments({ status: { $ne: "cancelled" } }),
    Ticket.find({ status: { $ne: "cancelled" } }).populate("publicEvent", "category").lean(),
  ]);
  const totalRevenue = allTickets.reduce((s, t) => s + t.totalAmount, 0);
  const totalCommission = allTickets.reduce((s, t) => s + t.platformCommission, 0);
  res.json(ApiResponse.success({ totalSold, totalRevenue, totalCommission }, "Ticket stats fetched"));
});

// ── PAYOUT MANAGEMENT ─────────────────────────────────────────────────────────
export const getAllPayouts = asyncHandler(async (req: Request, res: Response) => {
  const { status, organizerId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const p = Math.max(1, parseInt(page));
  const l = Math.min(50, parseInt(limit));
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (organizerId) filter.organizer = organizerId;

  const total = await Payout.countDocuments(filter);
  const payouts = await Payout.find(filter)
    .populate("organizer", "firstName lastName email avatar")
    .sort({ createdAt: -1 })
    .skip((p - 1) * l)
    .limit(l)
    .lean();

  // Attach organizer profile for businessName
  const enriched = await Promise.all(
    payouts.map(async (p2) => {
      const orgId = typeof p2.organizer === "object" ? (p2.organizer as { _id: string })._id : p2.organizer;
      const profile = await OrganizerProfile.findOne({ user: orgId }).select("businessName").lean();
      return { ...p2, organizerProfile: profile };
    }),
  );
  res.json(ApiResponse.success({ payouts: enriched }, "Payouts fetched", 200, { page: p, limit: l, total, totalPages: Math.ceil(total / l), hasNext: p * l < total, hasPrev: p > 1 }));
});

export const getPayoutSummaryAdmin = asyncHandler(async (_req: Request, res: Response) => {
  const payouts = await Payout.find().select("status netPayout paidAt").lean();
  const totalPaid = payouts.filter(p => p.status === "paid").reduce((s, p) => s + p.netPayout, 0);
  const processing = payouts.filter(p => p.status === "processing").reduce((s, p) => s + p.netPayout, 0);
  const upcoming = payouts.filter(p => p.status === "upcoming").reduce((s, p) => s + p.netPayout, 0);
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = payouts.filter(p => p.status === "paid" && p.paidAt && new Date(p.paidAt) >= thisMonthStart).reduce((s, p) => s + p.netPayout, 0);
  res.json(ApiResponse.success({ totalPaid, processing, upcoming, thisMonth }, "Payout summary fetched"));
});

export const processPayout = asyncHandler(async (req: Request, res: Response) => {
  const payout = await Payout.findByIdAndUpdate(
    req.params.id,
    { status: "processing", processedBy: req.user!._id },
    { new: true },
  ).populate("organizer", "firstName lastName").lean() as Record<string, unknown> | null;
  if (!payout) throw new ApiError(404, "Payout not found");
  const org = payout.organizer as { _id: string } | null;
  if (org) await createNotification(String(org._id), "payout_processed", "Payout Initiated", `Your payout of ₹${Math.round(Number(payout.netPayout)).toLocaleString("en-IN")} is being processed.`);
  await auditLog(req, req.user!._id, "payout_processed", "payout", String(payout._id), `Marked payout ${String(payout._id)} as processing`);
  res.json(ApiResponse.success({ payout }, "Payout processing"));
});

export const assignDispute = asyncHandler(async (req: Request, res: Response) => {
  const disputeDoc = await Dispute.findByIdAndUpdate(
    req.params.id,
    {
      assignedTo: req.user!._id,
      $push: {
        messages: {
          sender: req.user!._id,
          senderRole: "admin",
          text: "Dispute assigned to admin for review.",
          sentAt: new Date(),
        },
      },
    },
    { new: true },
  ).lean() as Record<string, unknown> | null;
  if (!disputeDoc) throw new ApiError(404, "Dispute not found");
  await auditLog(
    req,
    req.user!._id,
    "dispute_message_sent",
    "dispute",
    String(disputeDoc._id),
    `Assigned dispute ${disputeDoc.disputeRef} to admin`,
    undefined,
    undefined,
    String(disputeDoc.disputeRef),
  );
  res.json(ApiResponse.success({ dispute: disputeDoc }, "Dispute assigned"));
});

export const markPayoutPaid = asyncHandler(async (req: Request, res: Response) => {
  const { transactionId } = req.body as { transactionId: string };
  const payout = await Payout.findByIdAndUpdate(
    req.params.id,
    { status: "paid", paidAt: new Date(), transactionId, markedPaidBy: req.user!._id },
    { new: true },
  ).populate("organizer", "firstName lastName").lean() as Record<string, unknown> | null;
  if (!payout) throw new ApiError(404, "Payout not found");
  const org = payout.organizer as { _id: string } | null;
  const bank = payout.bankSnapshot as { bankName?: string; last4?: string } | undefined;
  if (org) await createNotification(String(org._id), "payout_processed", "Payout Transferred!", `Your payout of ₹${Math.round(Number(payout.netPayout)).toLocaleString("en-IN")} has been transferred to ${bank?.bankName || "your bank"} ···· ${bank?.last4 || "----"}.`);
  await auditLog(req, req.user!._id, "payout_paid", "payout", String(payout._id), `Marked payout ${String(payout._id)} as paid`);
  res.json(ApiResponse.success({ payout }, "Payout marked as paid"));
});

// ── REVIEW MANAGEMENT ─────────────────────────────────────────────────────────
export const getAllReviews = asyncHandler(async (req: Request, res: Response) => {
  const { entityType, organizerId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const p = Math.max(1, parseInt(page));
  const l = Math.min(50, parseInt(limit));
  const filter: Record<string, unknown> = {};
  if (entityType) filter.entityType = entityType;
  if (organizerId) filter.organizer = organizerId;

  const total = await Review.countDocuments(filter);
  const reviews = await Review.find(filter)
    .populate("customer", "firstName lastName avatar")
    .populate("organizer", "firstName lastName")
    .populate("venue", "name city")
    .populate("publicEvent", "title")
    .sort({ createdAt: -1 })
    .skip((p - 1) * l)
    .limit(l)
    .lean();
  res.json(ApiResponse.success({ reviews }, "Reviews fetched", 200, { page: p, limit: l, total, totalPages: Math.ceil(total / l), hasNext: p * l < total, hasPrev: p > 1 }));
});

export const removeReview = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason?: string };
  const reviewDoc = await Review.findByIdAndUpdate(
    req.params.id,
    {
      isRemoved: true,
      removedBy: req.user!._id,
      removedAt: new Date(),
      removalReason: reason,
    },
    { new: true },
  ).lean() as Record<string, unknown> | null;
  if (!reviewDoc) throw new ApiError(404, "Review not found");

  if (reviewDoc.entityType === "venue" && reviewDoc.venue) {
    await recalculateEntityRating("venue", String(reviewDoc.venue));
  }
  if (reviewDoc.entityType === "event" && reviewDoc.publicEvent) {
    await recalculateEntityRating("event", String(reviewDoc.publicEvent));
  }

  await createNotification(
    String(reviewDoc.customer),
    "system_alert",
    "Review Removed",
    "Your review was removed for violating community guidelines.",
  );
  await auditLog(req, req.user!._id, "review_removed", "review", String(reviewDoc._id), `Removed review ${String(reviewDoc._id)}`, undefined, undefined, String(reviewDoc._id));
  res.json(ApiResponse.success({ review: reviewDoc }, "Review removed"));
});

// ── DISPUTE MANAGEMENT ────────────────────────────────────────────────────────
export const getAllDisputes = asyncHandler(async (req: Request, res: Response) => {
  const { status, priority, type, page = "1", limit = "20" } = req.query as Record<string, string>;
  const p = Math.max(1, parseInt(page));
  const l = Math.min(50, parseInt(limit));
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (type) filter.type = type;

  const total = await Dispute.countDocuments(filter);
  const disputes = await Dispute.find(filter)
    .populate("raisedBy", "firstName lastName email avatar role")
    .populate("againstUser", "firstName lastName email avatar role")
    .populate("booking", "bookingRef status pricing.totalAmount")
    .sort({ createdAt: -1 })
    .skip((p - 1) * l)
    .limit(l)
    .lean();
  res.json(ApiResponse.success({ disputes }, "Disputes fetched", 200, { page: p, limit: l, total, totalPages: Math.ceil(total / l), hasNext: p * l < total, hasPrev: p > 1 }));
});

export const getDisputeById = asyncHandler(async (req: Request, res: Response) => {
  const disputeDoc = await Dispute.findById(req.params.id)
    .populate("raisedBy", "firstName lastName email phone avatar role")
    .populate("againstUser", "firstName lastName email phone avatar role")
    .populate("booking", "bookingRef status pricing eventDate eventType guestCount")
    .populate("messages.sender", "firstName lastName role")
    .lean();
  if (!disputeDoc) throw new ApiError(404, "Dispute not found");
  res.json(ApiResponse.success({ dispute: disputeDoc }, "Dispute fetched"));
});

export const sendDisputeMessage = asyncHandler(async (req: Request, res: Response) => {
  const { text } = req.body as { text: string };
  const disputeDoc = await Dispute.findByIdAndUpdate(
    req.params.id,
    { $push: { messages: { sender: req.user!._id, senderRole: "admin", text, sentAt: new Date() } } },
    { new: true },
  ).lean() as Record<string, unknown> | null;
  if (!disputeDoc) throw new ApiError(404, "Dispute not found");
  await createNotification(String(disputeDoc.raisedBy), "system_alert", "Admin replied to your dispute", text);
  res.json(ApiResponse.success({ dispute: disputeDoc }, "Message sent"));
});

export const resolveDispute = asyncHandler(async (req: Request, res: Response) => {
  const { resolution, refundAmount } = req.body as { resolution: string; refundAmount?: number };
  const disputeDoc = await Dispute.findByIdAndUpdate(
    req.params.id,
    {
      status: "resolved",
      resolution: { text: resolution, resolvedBy: req.user!._id, resolvedAt: new Date(), refundAmount: refundAmount || 0 },
    },
    { new: true },
  ).lean() as Record<string, unknown> | null;
  if (!disputeDoc) throw new ApiError(404, "Dispute not found");

  if (refundAmount && refundAmount > 0 && disputeDoc.booking) {
    await Booking.findByIdAndUpdate(disputeDoc.booking, {
      $set: { "payment.paymentStatus": "refunded" },
      $push: {
        timeline: {
          event: `Refund of ₹${refundAmount} processed via dispute resolution`,
          timestamp: new Date(),
          actor: req.user!._id,
        },
      },
    });
  }

  await Promise.all([
    createNotification(String(disputeDoc.raisedBy), "system_alert", "Dispute Resolved", `Your dispute has been resolved. ${resolution}`),
    disputeDoc.againstUser ? createNotification(String(disputeDoc.againstUser), "system_alert", "Dispute Resolved", `A dispute regarding your account has been resolved.`) : Promise.resolve(),
  ]);
  await auditLog(req, req.user!._id, "dispute_resolved", "dispute", String(disputeDoc._id), `Resolved dispute ${disputeDoc.disputeRef}`, undefined, undefined, String(disputeDoc.disputeRef));
  res.json(ApiResponse.success({ dispute: disputeDoc }, "Dispute resolved"));
});

export const closeDispute = asyncHandler(async (req: Request, res: Response) => {
  const disputeDoc = await Dispute.findByIdAndUpdate(req.params.id, { status: "closed" }, { new: true }).lean() as Record<string, unknown> | null;
  if (!disputeDoc) throw new ApiError(404, "Dispute not found");
  await auditLog(req, req.user!._id, "dispute_closed", "dispute", String(disputeDoc._id), `Closed dispute ${disputeDoc.disputeRef}`);
  res.json(ApiResponse.success({ dispute: disputeDoc }, "Dispute closed"));
});

// ── PLATFORM NOTIFICATIONS ────────────────────────────────────────────────────
export const getPlatformNotifications = asyncHandler(async (_req: Request, res: Response) => {
  const notifications = await PlatformNotification.find().populate("sentBy", "firstName lastName").sort({ sentAt: -1 }).lean();
  res.json(ApiResponse.success({ notifications }, "Platform notifications fetched"));
});

export const sendPlatformNotification = asyncHandler(async (req: Request, res: Response) => {
  const { title, message, type, targetRole, targetCity, promoCode, promoDiscount, promoExpiresAt } = req.body as {
    title: string; message: string; type: string; targetRole: "all" | "customer" | "organizer";
    targetCity?: string; promoCode?: string; promoDiscount?: number; promoExpiresAt?: string;
  };

  const userFilter: Record<string, unknown> = { role: { $ne: "admin" } };
  if (targetRole !== "all") userFilter.role = targetRole;
  if (targetCity) userFilter.city = { $regex: targetCity, $options: "i" };

  const targetUsers = await User.find(userFilter).select("_id promos").lean();
  const recipientCount = targetUsers.length;

  // Fan out individual notifications
  const notifType = type === "promo" ? "promo" : "system_alert";
  await Promise.all(
    targetUsers.map(u => createNotification(String(u._id), notifType, title, message)),
  );

  // If promo: add promo to user.promos
  if (promoCode && promoDiscount && promoExpiresAt) {
    await User.updateMany(userFilter, {
      $push: { promos: { code: promoCode.toUpperCase(), discount: promoDiscount, expiresAt: new Date(promoExpiresAt), used: false } },
    });
  }

  const platformNotif = await PlatformNotification.create({
    title, message, type, targetRole, targetCity, promoCode, promoDiscount,
    promoExpiresAt: promoExpiresAt ? new Date(promoExpiresAt) : undefined,
    sentBy: req.user!._id, recipientCount,
  });

  await auditLog(req, req.user!._id, "notification_sent", "platform", undefined, `Sent platform notification "${title}" to ${recipientCount} users`);
  res.json(ApiResponse.success({ notification: platformNotif, recipientCount }, "Notification sent"));
});

export const deactivatePlatformNotification = asyncHandler(async (req: Request, res: Response) => {
  const notif = (await PlatformNotification.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true }).lean()) as {
    _id: unknown;
    title: string;
  } | null;
  if (!notif) throw new ApiError(404, "Notification not found");
  await auditLog(
    req,
    req.user!._id,
    "notification_deactivated",
    "notification",
    String(notif._id),
    `Deactivated platform notification "${notif.title}"`,
    undefined,
    undefined,
    notif.title,
  );
  res.json(ApiResponse.success({ notification: notif }, "Notification deactivated"));
});

export const getNotificationEstimate = asyncHandler(async (req: Request, res: Response) => {
  const { targetRole = "all", targetCity } = req.query as { targetRole?: string; targetCity?: string };
  const userFilter: Record<string, unknown> = { role: { $ne: "admin" }, isActive: { $ne: false } };
  if (targetRole && targetRole !== "all") userFilter.role = targetRole;
  if (targetCity) userFilter.city = { $regex: targetCity, $options: "i" };
  const estimatedRecipients = await User.countDocuments(userFilter);
  res.json(ApiResponse.success({ estimatedRecipients }, "Estimate fetched"));
});

// ── AUDIT LOG ─────────────────────────────────────────────────────────────────
export const getAuditLog = asyncHandler(async (req: Request, res: Response) => {
  const { action, targetType, dateFrom, dateTo, page = "1", limit = "30" } = req.query as Record<string, string>;
  const p = Math.max(1, parseInt(page));
  const l = Math.min(100, parseInt(limit));
  const filter: Record<string, unknown> = {};
  if (action) filter.action = action;
  if (targetType) filter.targetType = targetType;
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) (filter.createdAt as Record<string, Date>).$gte = new Date(dateFrom);
    if (dateTo) (filter.createdAt as Record<string, Date>).$lte = new Date(dateTo);
  }

  const total = await AdminAuditLog.countDocuments(filter);
  const logs = await AdminAuditLog.find(filter).populate("admin", "firstName lastName email").sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).lean();
  res.json(ApiResponse.success({ logs }, "Audit log fetched", 200, { page: p, limit: l, total, totalPages: Math.ceil(total / l), hasNext: p * l < total, hasPrev: p > 1 }));
});

// ── SETTINGS ──────────────────────────────────────────────────────────────────
export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  let settings = (await Settings.findOne().lean()) as {
    commissionRate: number;
    maintenanceMode: boolean;
    appVersion: string;
    supportEmail: string;
    termsLastUpdated?: Date;
  } | null;
  if (!settings) {
    const created = await Settings.create({
      commissionRate: Math.round(APP_CONSTANTS.platformCommissionRate * 100),
      maintenanceMode: false,
      supportEmail: "support@eventmitra.com",
      appVersion: "1.0.0",
    });
    settings = created.toObject() as typeof settings & object;
  }
  res.json(
    ApiResponse.success(
      {
        commissionRate: settings!.commissionRate,
        maintenanceMode: settings!.maintenanceMode,
        appVersion: settings!.appVersion,
        supportEmail: settings!.supportEmail,
        termsLastUpdated: settings!.termsLastUpdated,
        platformName: "EventMitra",
      },
      "Settings fetched",
    ),
  );
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const previous = (await Settings.findOne().lean()) as {
    commissionRate?: number;
    maintenanceMode?: boolean;
  } | null;
  const updates = req.body as Partial<{
    commissionRate: number;
    maintenanceMode: boolean;
    supportEmail: string;
    appVersion: string;
  }>;

  const settings = (await Settings.findOneAndUpdate(
    {},
    { ...updates, lastUpdatedBy: req.user!._id },
    { upsert: true, new: true },
  ).lean()) as unknown as {
    commissionRate: number;
    maintenanceMode: boolean;
    appVersion: string;
    supportEmail: string;
  };

  if (updates.commissionRate !== undefined && previous?.commissionRate !== updates.commissionRate) {
    await auditLog(
      req,
      req.user!._id,
      "commission_updated",
      "platform",
      undefined,
      `Commission rate updated from ${previous?.commissionRate ?? 12}% to ${updates.commissionRate}%`,
      { commissionRate: previous?.commissionRate },
      { commissionRate: updates.commissionRate },
    );
  }
  if (updates.maintenanceMode !== undefined && previous?.maintenanceMode !== updates.maintenanceMode) {
    await auditLog(
      req,
      req.user!._id,
      "maintenance_toggled",
      "platform",
      undefined,
      `Maintenance mode ${updates.maintenanceMode ? "enabled" : "disabled"}`,
      { maintenanceMode: previous?.maintenanceMode },
      { maintenanceMode: updates.maintenanceMode },
    );
  }

  res.json(ApiResponse.success({ settings }, "Settings updated"));
});
