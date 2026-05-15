import { Router } from "express";
import { getAnalytics, getDashboard } from "../controllers/analytics.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.use(requireAuth, requireRole("organizer"));
router.get("/dashboard", getDashboard);
router.get("/", getAnalytics);

export default router;
