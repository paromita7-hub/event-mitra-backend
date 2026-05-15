import { z } from "zod";

const ticketTypeSchema = z.object({
  name: z.string().trim().min(1),
  price: z.number().int().positive(),
  totalSeats: z.number().int().positive(),
  soldSeats: z.number().int().min(0).optional(),
  available: z.boolean().optional(),
});

export const createPublicEventSchema = z.object({
  venue: z.string().optional(),
  title: z.string().trim().min(2),
  description: z.string().trim().optional(),
  category: z.enum([
    "Concert",
    "Food Festival",
    "Comedy Show",
    "Cultural Show",
    "DJ Night",
    "Buffet Night",
    "Conference",
    "New Year Party",
    "Sunburn Party",
    "Other",
  ]),
  coverImage: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),
  date: z.coerce.date(),
  startTime: z.string().trim().min(1),
  endTime: z.string().trim().optional(),
  city: z.string().trim().min(2),
  venueName: z.string().trim().optional(),
  venueAddress: z.string().trim().optional(),
  ticketTypes: z.array(ticketTypeSchema).min(1),
  status: z.enum(["draft", "published", "paused", "completed", "cancelled"]).optional(),
  isFeatured: z.boolean().optional(),
  tags: z.array(z.string().trim()).optional(),
  ageRestriction: z.boolean().optional(),
  dresscode: z.string().trim().optional(),
});

export const updatePublicEventSchema = createPublicEventSchema.partial();

export const purchaseTicketSchema = z.object({
  eventId: z.string().min(1),
  ticketTypeIndex: z.number().int().min(0),
  quantity: z.number().int().positive(),
});
