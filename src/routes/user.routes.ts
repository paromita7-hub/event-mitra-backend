import { Router } from "express";
import { getMe, getPromos, updateMe, updatePreferences } from "../controllers/user.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.get("/me", getMe);
router.patch("/me", updateMe);
router.patch("/me/preferences", updatePreferences);
router.get("/me/promos", getPromos);

export default router;
