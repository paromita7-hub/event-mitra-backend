import { z } from "zod";

export const createBookingSchema = z.object({
  venueId: z.string().min(1),
  eventType: z.string().trim().min(2),
  eventDate: z.coerce.date(),
  eventTime: z.string().trim().optional(),
  guestCount: z.number().int().positive(),
  specialRequests: z.string().trim().optional(),
  advanceAmount: z.number().int().min(0).default(0),
});

export const declineBookingSchema = z.object({
  reason: z.string().trim().min(3),
});

export const cancelBookingSchema = z.object({
  reason: z.string().trim().min(3),
});
