import { APP_CONSTANTS } from "../config/constants";
import OrganizerProfile from "../models/OrganizerProfile";
import Settings from "../models/Settings";

export const PLATFORM_COMMISSION_RATE = APP_CONSTANTS.platformCommissionRate;

/** Resolves commission as a decimal rate (e.g. 0.12 for 12%). */
export async function resolveCommissionRate(organizerUserId: string): Promise<number> {
  const profile = (await OrganizerProfile.findOne({ user: organizerUserId }).select("commissionRate").lean()) as {
    commissionRate?: number;
  } | null;
  if (profile?.commissionRate != null) {
    return profile.commissionRate / 100;
  }

  const settings = (await Settings.findOne().lean()) as { commissionRate?: number } | null;
  if (settings?.commissionRate != null) {
    return settings.commissionRate / 100;
  }

  return APP_CONSTANTS.platformCommissionRate;
}

export async function calculateCommissionForOrganizer(
  amount: number,
  organizerUserId: string,
): Promise<{ gross: number; commission: number; payout: number; ratePercent: number }> {
  const rate = await resolveCommissionRate(organizerUserId);
  const gross = Math.round(amount);
  const commission = Math.round(gross * rate);
  const payout = gross - commission;

  return { gross, commission, payout, ratePercent: Math.round(rate * 100) };
}

/** @deprecated Use calculateCommissionForOrganizer — kept for legacy callers during migration */
export const calculateCommission = (amount: number): {
  gross: number;
  commission: number;
  payout: number;
} => {
  const gross = Math.round(amount);
  const commission = Math.round(gross * PLATFORM_COMMISSION_RATE);
  const payout = gross - commission;
  return { gross, commission, payout };
};
