import { z } from "zod";

const coordinateSchema = z.object({
  lng: z.number(),
  lat: z.number(),
});

const dateArraySchema = z.array(z.coerce.date()).default([]);

export const createVenueSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().optional(),
  city: z.string().trim().min(2),
  address: z.string().trim().min(5),
  location: coordinateSchema.optional(),
  coverImage: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),
  capacity: z.number().int().positive(),
  pricePerEvent: z.number().int().positive(),
  eventTypes: z.array(z.string().trim()).optional(),
  amenities: z.array(z.string().trim()).optional(),
  tags: z.array(z.string().trim()).optional(),
  isTopPick: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  policies: z
    .object({
      minAdvanceBookingDays: z.number().int().min(0).optional(),
      cancellationPolicy: z.enum(["full_refund", "partial_refund", "no_refund"]).optional(),
      checkInTime: z.string().trim().optional(),
      checkOutTime: z.string().trim().optional(),
      securityDeposit: z.number().int().min(0).optional(),
      specialTerms: z.string().trim().optional(),
    })
    .optional(),
});

export const updateVenueSchema = createVenueSchema.partial();

export const updateAvailabilitySchema = z.object({
  blockedDates: dateArraySchema.optional(),
  bookedDates: dateArraySchema.optional(),
});
