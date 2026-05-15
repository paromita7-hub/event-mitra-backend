import { Router } from "express";
import {
  getPayouts,
  getPayoutSummary,
  updateBankAccount,
} from "../controllers/payout.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.use(requireAuth, requireRole("organizer"));
router.get("/", getPayouts);
router.get("/summary", getPayoutSummary);
router.patch("/bank-account", updateBankAccount);

export default router;
