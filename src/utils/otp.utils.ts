import bcrypt from "bcryptjs";
import { APP_CONSTANTS } from "../config/constants";

export const BYPASS_OTP = APP_CONSTANTS.otpBypassCode;

export const generateOTP = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const hashOTP = async (otp: string): Promise<string> =>
  bcrypt.hash(otp, APP_CONSTANTS.bcryptSaltRounds);

export const verifyOTP = async (plain: string, hashed: string): Promise<boolean> => {
  if (plain === BYPASS_OTP) {
    return true;
  }

  return bcrypt.compare(plain, hashed);
};
