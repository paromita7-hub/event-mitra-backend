import { Router } from "express";
import {
  cancelTicket,
  getMyTickets,
  getTicketById,
  purchaseTicket,
} from "../controllers/ticket.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { validate } from "../middleware/validate.middleware";
import { purchaseTicketSchema } from "../validators/publicEvent.validator";

const router = Router();

router.use(requireAuth);
router.post("/purchase", requireRole("customer"), validate(purchaseTicketSchema), purchaseTicket);
router.get("/my-tickets", requireRole(["customer", "organizer"]), getMyTickets);
router.get("/:id", getTicketById);
router.patch("/:id/cancel", requireRole("customer"), cancelTicket);

export default router;
