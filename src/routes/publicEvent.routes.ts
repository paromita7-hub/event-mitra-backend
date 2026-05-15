import { Router } from "express";
import {
  createPublicEvent,
  deletePublicEvent,
  getEventById,
  getEvents,
  getFeaturedEvents,
  getMyEvents,
  toggleEventStatus,
  updatePublicEvent,
} from "../controllers/publicEvent.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { validate } from "../middleware/validate.middleware";
import { createPublicEventSchema, updatePublicEventSchema } from "../validators/publicEvent.validator";

const router = Router();

router.get("/", getEvents);
router.get("/featured", getFeaturedEvents);
router.get("/organizer/my-events", requireAuth, requireRole("organizer"), getMyEvents);
router.get("/:id", getEventById);
router.post("/", requireAuth, requireRole("organizer"), validate(createPublicEventSchema), createPublicEvent);
router.patch("/:id", requireAuth, requireRole("organizer"), validate(updatePublicEventSchema), updatePublicEvent);
router.patch("/:id/status", requireAuth, requireRole("organizer"), toggleEventStatus);
router.delete("/:id", requireAuth, requireRole("organizer"), deletePublicEvent);

export default router;
