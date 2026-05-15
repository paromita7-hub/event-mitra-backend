import { APP_CONSTANTS } from "../config/constants";

export const PLATFORM_COMMISSION_RATE = APP_CONSTANTS.platformCommissionRate;

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
