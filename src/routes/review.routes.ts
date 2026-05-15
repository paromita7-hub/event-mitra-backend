import { Router } from "express";
import {
  createReview,
  getEventReviews,
  getOrganizerReviews,
  getVenueReviews,
  replyToReview,
} from "../controllers/review.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { validate } from "../middleware/validate.middleware";
import { createReviewSchema, replyReviewSchema } from "../validators/review.validator";

const router = Router();

router.get("/venue/:venueId", getVenueReviews);
router.get("/event/:eventId", getEventReviews);

router.use(requireAuth);
router.post("/", requireRole("customer"), validate(createReviewSchema), createReview);
router.get("/organizer/all", requireRole("organizer"), getOrganizerReviews);
router.patch("/:id/reply", requireRole("organizer"), validate(replyReviewSchema), replyToReview);

export default router;
