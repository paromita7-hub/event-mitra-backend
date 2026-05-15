import type { Request, Response } from "express";
import OrganizerProfile from "../models/OrganizerProfile";
import Payout from "../models/Payout";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export const getPayouts = asyncHandler(async (req: Request, res: Response) => {
  const payouts = await Payout.find({ organizer: req.user!._id }).sort({ createdAt: -1 }).lean();
  res.json(ApiResponse.success({ payouts }, "Payouts fetched successfully"));
});

export const getPayoutSummary = asyncHandler(async (req: Request, res: Response) => {
  const payouts = await Payout.find({ organizer: req.user!._id }).lean();
  const summary = payouts.reduce(
    (acc, payout) => {
      if (payout.status === "paid") acc.totalPaid += payout.netPayout;
      if (payout.status === "processing") acc.processing += payout.netPayout;
      if (payout.status === "upcoming") acc.upcoming += payout.netPayout;
      return acc;
    },
    { totalPaid: 0, processing: 0, upcoming: 0 },
  );

  res.json(ApiResponse.success(summary, "Payout summary fetched successfully"));
});

export const updateBankAccount = asyncHandler(async (req: Request, res: Response) => {
  const { accountNumber, ifsc, bankName, accountHolderName } = req.body as {
    accountNumber: string;
    ifsc: string;
    bankName: string;
    accountHolderName: string;
  };

  const organizerProfile = await OrganizerProfile.findOne({ user: req.user!._id });
  if (!organizerProfile) {
    throw new ApiError(404, "Organizer profile not found");
  }

  organizerProfile.bankAccount = {
    accountNumber,
    ifsc,
    bankName,
    accountHolderName,
    last4: accountNumber.slice(-4),
  };
  await organizerProfile.save();

  res.json(
    ApiResponse.success(
      {
        bankAccount: {
          ifsc,
          bankName,
          accountHolderName,
          last4: accountNumber.slice(-4),
        },
      },
      "Bank account updated successfully",
    ),
  );
});
