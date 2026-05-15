import { Router } from "express";
import {
  createVenue,
  getFeaturedVenues,
  getMyVenues,
  getTopPickVenues,
  getVenueById,
  getVenueCities,
  getVenues,
  toggleVenueStatus,
  updateVenue,
  updateVenueAvailability,
} from "../controllers/venue.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createVenueSchema,
  updateAvailabilitySchema,
  updateVenueSchema,
} from "../validators/venue.validator";

const router = Router();

router.get("/", getVenues);
router.get("/featured", getFeaturedVenues);
router.get("/top-picks", getTopPickVenues);
router.get("/cities", getVenueCities);
router.get("/organizer/my-venues", requireAuth, requireRole("organizer"), getMyVenues);
router.get("/:id", getVenueById);
router.post("/", requireAuth, requireRole("organizer"), validate(createVenueSchema), createVenue);
router.patch("/:id", requireAuth, requireRole("organizer"), validate(updateVenueSchema), updateVenue);
router.patch("/:id/status", requireAuth, requireRole("organizer"), toggleVenueStatus);
router.patch(
  "/:id/availability",
  requireAuth,
  requireRole("organizer"),
  validate(updateAvailabilitySchema),
  updateVenueAvailability,
);

export default router;
