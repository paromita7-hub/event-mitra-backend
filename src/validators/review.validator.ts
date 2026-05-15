import { z } from "zod";

export const createReviewSchema = z.object({
  entityType: z.enum(["venue", "event"]),
  entityId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(3),
  bookingId: z.string().optional(),
  ticketId: z.string().optional(),
});

export const replyReviewSchema = z.object({
  text: z.string().trim().min(2),
});
