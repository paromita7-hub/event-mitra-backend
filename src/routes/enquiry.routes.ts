import { Router } from "express";
import {
  closeEnquiry,
  createEnquiry,
  getMyEnquiries,
  getOrganizerEnquiries,
  replyToEnquiry,
} from "../controllers/enquiry.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.use(requireAuth);
router.post("/", requireRole("customer"), createEnquiry);
router.get("/my-enquiries", requireRole("customer"), getMyEnquiries);
router.get("/organizer/inbox", requireRole("organizer"), getOrganizerEnquiries);
router.patch("/:id/reply", requireRole("organizer"), replyToEnquiry);
router.patch("/:id/close", requireRole("organizer"), closeEnquiry);

export default router;
