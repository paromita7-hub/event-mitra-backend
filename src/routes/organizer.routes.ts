import { Router } from "express";
import { getAnalytics, getDashboard } from "../controllers/analytics.controller";
import {
  getFeaturedOrganizers,
  getOrganizerProfile,
  updateOrganizerProfile,
} from "../controllers/organizer.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.get("/featured", getFeaturedOrganizers);

router.use(requireAuth, requireRole("organizer"));
router.get("/profile", getOrganizerProfile);
router.patch("/profile", updateOrganizerProfile);
router.get("/dashboard", getDashboard);
router.get("/analytics", getAnalytics);

export default router;
