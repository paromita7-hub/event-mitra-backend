import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import User from "../models/User";
import OrganizerProfile from "../models/OrganizerProfile";
import OTP from "../models/OTP";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { generateOTP, hashOTP, verifyOTP } from "../utils/otp.utils";
import { APP_CONSTANTS } from "../config/constants";
import { verifyRefreshToken } from "../config/jwt";
import { sendOtpEmail } from "../services/email.service";

const buildAuthPayload = async (userId: string) => {
  const user = await User.findById(userId)
    .select("-password -refreshToken")
    .lean<{
      _id: string;
      role: "customer" | "organizer";
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      city?: string;
      avatar?: string;
      profileImage?: string;
      promos?: unknown[];
      preferences?: unknown;
    } | null>();
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const organizerProfile =
    user.role === "organizer"
      ? await OrganizerProfile.findOne({ user: user._id }).lean()
      : null;

  return { user, organizerProfile };
};

const issueOtp = async (email: string, purpose: "email_verify" | "forgot_password"): Promise<void> => {
  const normalizedEmail = email.toLowerCase();
  await OTP.deleteMany({ email: normalizedEmail, purpose });
  const otp = generateOTP();
  const hashedOtp = await hashOTP(otp);
  const expiresAt = new Date(Date.now() + APP_CONSTANTS.otpExpiryMinutes * 60 * 1000);

  const otpDoc = await OTP.create({
    email: normalizedEmail,
    otp: hashedOtp,
    purpose,
    expiresAt,
  });

  try {
    await sendOtpEmail(normalizedEmail, otp, purpose);
  } catch (error) {
    await OTP.deleteOne({ _id: otpDoc._id });
    throw new ApiError(500, error instanceof Error ? error.message : "Failed to send OTP email");
  }
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const {
    firstName,
    lastName,
    email,
    password,
    phone,
    city,
    role,
    businessName,
    businessDescription,
    specialties,
    yearsOfExperience,
    address,
  } = req.body;

  const existingUser = await User.findOne({ email: email.toLowerCase() }).lean();
  if (existingUser) {
    throw new ApiError(409, "User already exists");
  }

  const avatar = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    phone,
    city,
    role,
    avatar,
  });

  if (role === "organizer") {
    await OrganizerProfile.create({
      user: user._id,
      businessName: businessName || `${firstName} ${lastName} Events`,
      businessDescription,
      specialties: specialties ?? [],
      yearsOfExperience,
      city,
      address,
    });
  }

  await issueOtp(email, "email_verify");

  res
    .status(201)
    .json(ApiResponse.success({ userId: user._id.toString() }, "OTP sent to email", 201));
});

export const verifyOtpController = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp, purpose } = req.body as {
    email: string;
    otp: string;
    purpose: "email_verify" | "forgot_password";
  };

  const otpDoc = await OTP.findOne({
    email: email.toLowerCase(),
    purpose,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpDoc) {
    throw new ApiError(400, "OTP not found or expired");
  }

  if (otpDoc.attempts >= APP_CONSTANTS.otpMaxAttempts) {
    throw new ApiError(429, "Maximum OTP attempts exceeded. Please resend OTP.");
  }

  otpDoc.attempts += 1;
  const isValid = await verifyOTP(otp, otpDoc.otp);

  if (!isValid) {
    await otpDoc.save();
    throw new ApiError(400, "Invalid OTP");
  }

  otpDoc.isUsed = true;
  await otpDoc.save();

  const user = await User.findOne({ email: email.toLowerCase() }).select("+refreshToken");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (purpose === "forgot_password") {
    res.json(ApiResponse.success({ verified: true }, "OTP verified successfully"));
    return;
  }

  user.isEmailVerified = true;
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = await bcrypt.hash(refreshToken, APP_CONSTANTS.bcryptSaltRounds);
  user.lastLogin = new Date();
  await user.save();

  const payload = await buildAuthPayload(user._id.toString());
  res.json(
    ApiResponse.success(
      {
        accessToken,
        refreshToken,
        ...payload,
      },
      "OTP verified successfully",
    ),
  );
});

export const resendOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, purpose } = req.body as {
    email: string;
    purpose: "email_verify" | "forgot_password";
  };

  await issueOtp(email, purpose);
  res.json(ApiResponse.success({ message: "OTP resent" }, "OTP resent"));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, role } = req.body as {
    email: string;
    password: string;
    role: "customer" | "organizer";
  };

  const user = await User.findOne({ email: email.toLowerCase(), role }).select("+password +refreshToken");
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const passwordMatches = await user.comparePassword(password);
  if (!passwordMatches) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (!user.isActive) {
    throw new ApiError(403, "Account is inactive");
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = await bcrypt.hash(refreshToken, APP_CONSTANTS.bcryptSaltRounds);
  user.lastLogin = new Date();
  await user.save();

  const payload = await buildAuthPayload(user._id.toString());

  res.json(
    ApiResponse.success(
      {
        accessToken,
        refreshToken,
        ...payload,
      },
      "Login successful",
    ),
  );
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken: incomingRefreshToken } = req.body as { refreshToken: string };
  const decoded = verifyRefreshToken(incomingRefreshToken);

  const user = await User.findById(decoded._id).select("+refreshToken");
  if (!user || !user.refreshToken) {
    throw new ApiError(401, "Invalid refresh token");
  }

  const matches = await bcrypt.compare(incomingRefreshToken, user.refreshToken);
  if (!matches) {
    throw new ApiError(401, "Invalid refresh token");
  }

  const accessToken = user.generateAccessToken();
  const nextRefreshToken = user.generateRefreshToken();
  user.refreshToken = await bcrypt.hash(nextRefreshToken, APP_CONSTANTS.bcryptSaltRounds);
  await user.save();

  res.json(
    ApiResponse.success(
      {
        accessToken,
        refreshToken: nextRefreshToken,
      },
      "Token refreshed successfully",
    ),
  );
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await User.findByIdAndUpdate(req.user?._id, { $unset: { refreshToken: 1 } });
  res.json(ApiResponse.success({ message: "Logged out" }, "Logged out"));
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  const user = await User.findOne({ email: email.toLowerCase() }).lean();
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  await issueOtp(email, "forgot_password");
  res.json(ApiResponse.success({ message: "OTP sent" }, "OTP sent"));
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email, newPassword } = req.body as { email: string; newPassword: string };

  const verifiedOtp = await OTP.findOne({
    email: email.toLowerCase(),
    purpose: "forgot_password",
    isUsed: true,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!verifiedOtp) {
    throw new ApiError(401, "Password reset not authorized");
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password +refreshToken");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  user.password = newPassword;
  user.refreshToken = undefined;
  await user.save();
  await OTP.deleteMany({ email: email.toLowerCase(), purpose: "forgot_password" });

  res.json(ApiResponse.success({ message: "Password reset successfully" }, "Password reset successfully"));
});
