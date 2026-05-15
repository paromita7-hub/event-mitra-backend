import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[!@#$%^&*]/, "Password must include a special character");

export const registerSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.email(),
  password: passwordSchema,
  phone: z.string().trim().min(10),
  city: z.string().trim().optional(),
  role: z.enum(["customer", "organizer"]),
  businessName: z.string().trim().optional(),
  businessDescription: z.string().trim().optional(),
  specialties: z.array(z.string().trim()).optional(),
  yearsOfExperience: z.string().trim().optional(),
  address: z.string().trim().optional(),
});

export const verifyOtpSchema = z.object({
  email: z.email(),
  otp: z.string().trim().length(6),
  purpose: z.enum(["email_verify", "forgot_password"]),
});

export const resendOtpSchema = z.object({
  email: z.email(),
  purpose: z.enum(["email_verify", "forgot_password"]),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  role: z.enum(["customer", "organizer"]),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.email(),
});

export const resetPasswordSchema = z.object({
  email: z.email(),
  newPassword: passwordSchema,
});
