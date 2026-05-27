import type { Request, Response } from "express";
import Settings from "../models/Settings";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { APP_CONSTANTS } from "../config/constants";

export const getPublicStatus = asyncHandler(async (_req: Request, res: Response) => {
  const settings = (await Settings.findOne().lean()) as {
    maintenanceMode?: boolean;
    appVersion?: string;
    commissionRate?: number;
  } | null;
  res.json(
    ApiResponse.success({
      maintenanceMode: settings?.maintenanceMode ?? false,
      appVersion: settings?.appVersion ?? "1.0.0",
      platformName: "EventMitra",
      commissionRate: settings?.commissionRate ?? Math.round(APP_CONSTANTS.platformCommissionRate * 100),
    }, "Status fetched"),
  );
});
