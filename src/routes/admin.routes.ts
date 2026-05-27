import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import * as admin from "../controllers/admin.controller";

const router = Router();
const adminOnly = [requireAuth, requireRole("admin")];

// ── VENUE & EVENT MANAGEMENT (before auth routes) ─────────────────────────────
router.get("/venues", ...adminOnly, admin.getAllVenues);
router.get("/venues/:id", ...adminOnly, admin.getVenueByIdAdmin);
router.patch("/venues/:id/approve", ...adminOnly, admin.approveVenue);
router.patch("/venues/:id/reject", ...adminOnly, admin.rejectVenue);
router.patch("/venues/:id/feature", ...adminOnly, admin.featureVenue);
router.patch("/venues/:id/suspend", ...adminOnly, admin.suspendVenue);

router.get("/events", ...adminOnly, admin.getAllEvents);
router.get("/events/:id", ...adminOnly, admin.getEventByIdAdmin);
router.patch("/events/:id/feature", ...adminOnly, admin.featureEvent);
router.patch("/events/:id/pause", ...adminOnly, admin.pauseEvent);
router.patch("/events/:id/cancel", ...adminOnly, admin.cancelEvent);

// ── DASHBOARD & ANALYTICS ─────────────────────────────────────────────────────
router.get("/dashboard", ...adminOnly, admin.getDashboard);
router.get("/analytics", ...adminOnly, admin.getAnalytics);

// ── USER MANAGEMENT ───────────────────────────────────────────────────────────
router.get("/users", ...adminOnly, admin.getAllUsers);
router.get("/users/:id", ...adminOnly, admin.getUserById);
router.patch("/users/:id/suspend", ...adminOnly, admin.suspendUser);
router.patch("/users/:id/activate", ...adminOnly, admin.activateUser);
router.patch("/users/:id/ban", ...adminOnly, admin.banUser);
router.patch("/users/:id/lift-ban", ...adminOnly, admin.liftBan);
router.post("/users/:id/notify", ...adminOnly, admin.notifyUser);

// ── KYC MANAGEMENT ────────────────────────────────────────────────────────────
router.get("/kyc/pending", ...adminOnly, admin.getPendingKYC);
router.get("/kyc/:organizerProfileId", ...adminOnly, admin.getKYCDetail);
router.patch("/kyc/:organizerProfileId/approve", ...adminOnly, admin.approveKYC);
router.patch("/kyc/:organizerProfileId/reject", ...adminOnly, admin.rejectKYC);

// ── BOOKING & TICKET MANAGEMENT ───────────────────────────────────────────────
router.get("/bookings", ...adminOnly, admin.getAllBookings);
router.get("/bookings/:id", ...adminOnly, admin.getBookingByIdAdmin);
router.patch("/bookings/:id/force-cancel", ...adminOnly, admin.forceCancelBooking);

router.get("/tickets", ...adminOnly, admin.getAllTickets);
router.get("/tickets/stats", ...adminOnly, admin.getTicketStats);

// ── PAYOUT MANAGEMENT ─────────────────────────────────────────────────────────
router.get("/payouts", ...adminOnly, admin.getAllPayouts);
router.get("/payouts/summary", ...adminOnly, admin.getPayoutSummaryAdmin);
router.patch("/payouts/:id/process", ...adminOnly, admin.processPayout);
router.patch("/payouts/:id/mark-paid", ...adminOnly, admin.markPayoutPaid);

// ── REVIEW MANAGEMENT ─────────────────────────────────────────────────────────
router.get("/reviews", ...adminOnly, admin.getAllReviews);
router.patch("/reviews/:id/remove", ...adminOnly, admin.removeReview);

// ── DISPUTE MANAGEMENT ────────────────────────────────────────────────────────
router.get("/disputes", ...adminOnly, admin.getAllDisputes);
router.get("/disputes/:id", ...adminOnly, admin.getDisputeById);
router.post("/disputes/:id/message", ...adminOnly, admin.sendDisputeMessage);
router.patch("/disputes/:id/assign", ...adminOnly, admin.assignDispute);
router.patch("/disputes/:id/resolve", ...adminOnly, admin.resolveDispute);
router.patch("/disputes/:id/close", ...adminOnly, admin.closeDispute);

// ── PLATFORM NOTIFICATIONS ────────────────────────────────────────────────────
router.get("/platform-notifications", ...adminOnly, admin.getPlatformNotifications);
router.get("/platform-notifications/estimate", ...adminOnly, admin.getNotificationEstimate);
router.post("/platform-notifications", ...adminOnly, admin.sendPlatformNotification);
router.delete("/platform-notifications/:id", ...adminOnly, admin.deactivatePlatformNotification);

// ── AUDIT LOG & SETTINGS ──────────────────────────────────────────────────────
router.get("/audit-log", ...adminOnly, admin.getAuditLog);
router.get("/settings", ...adminOnly, admin.getSettings);
router.patch("/settings", ...adminOnly, admin.updateSettings);

export default router;
