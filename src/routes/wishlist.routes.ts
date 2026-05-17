import { Router } from "express";
import {
  getWishlist,
  toggleEventWishlist,
  toggleVenueWishlist,
} from "../controllers/wishlist.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.use(requireAuth, requireRole(["customer", "organizer"]));
router.get("/", getWishlist);
router.post("/venue/:venueId", toggleVenueWishlist);
router.post("/event/:eventId", toggleEventWishlist);

export default router;
