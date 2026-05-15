import type { Request, Response } from "express";
import Notification from "../models/Notification";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { buildPaginationMeta, parsePaginationParams } from "../utils/pagination.utils";

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePaginationParams(req.query);
  const filters: Record<string, unknown> = { recipient: req.user!._id };
  if (typeof req.query.isRead !== "undefined") {
    filters.isRead = req.query.isRead === "true";
  }
  const total = await Notification.countDocuments(filters);
  const notifications = await Notification.find(filters)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  res.json(
    ApiResponse.success(
      { notifications },
      "Notifications fetched successfully",
      200,
      buildPaginationMeta(total, page, limit),
    ),
  );
});

export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  await Notification.updateMany({ recipient: req.user!._id, isRead: false }, { $set: { isRead: true } });
  res.json(ApiResponse.success({ message: "All notifications marked as read" }, "All notifications marked as read"));
});

export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user!._id },
    { $set: { isRead: true } },
    { new: true },
  ).lean();

  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }

  res.json(ApiResponse.success({ notification }, "Notification marked as read"));
});

export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user!._id }).lean();
  if (!deleted) {
    throw new ApiError(404, "Notification not found");
  }

  res.json(ApiResponse.success({ deleted: true }, "Notification deleted successfully"));
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const count = await Notification.countDocuments({ recipient: req.user!._id, isRead: false });
  res.json(ApiResponse.success({ count }, "Unread count fetched successfully"));
});
