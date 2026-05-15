import { Router } from "express";
import {
  cancelBooking,
  completeBooking,
  confirmBooking,
  createBooking,
  declineBooking,
  getBookingById,
  getMyBookings,
  getOrganizerBookings,
} from "../controllers/booking.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  cancelBookingSchema,
  createBookingSchema,
  declineBookingSchema,
} from "../validators/booking.validator";

const router = Router();

router.use(requireAuth);
router.post("/", requireRole("customer"), validate(createBookingSchema), createBooking);
router.get("/my-bookings", requireRole("customer"), getMyBookings);
router.get("/organizer/all", requireRole("organizer"), getOrganizerBookings);
router.get("/:id", getBookingById);
router.patch("/:id/confirm", requireRole("organizer"), confirmBooking);
router.patch("/:id/decline", requireRole("organizer"), validate(declineBookingSchema), declineBooking);
router.patch("/:id/cancel", validate(cancelBookingSchema), cancelBooking);
router.patch("/:id/complete", requireRole("organizer"), completeBooking);

export default router;
