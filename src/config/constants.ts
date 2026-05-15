export const APP_CONSTANTS = {
  platformCommissionRate: 0.12,
  bcryptSaltRounds: 12,
  otpExpiryMinutes: 10,
  otpMaxAttempts: 5,
  otpBypassCode: "123456",
  bookingRefPrefix: "EM-",
  ticketRefPrefix: "TKT-",
} as const;

export const USER_ROLES = ["customer", "organizer"] as const;
export const VENUE_STATUS = ["active", "inactive", "under_review"] as const;
export const EVENT_STATUS = ["draft", "published", "paused", "completed", "cancelled"] as const;
