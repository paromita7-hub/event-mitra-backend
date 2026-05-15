import Notification, { type NotificationType } from "../models/Notification";

type NotificationInput = {
  recipient: string;
  type: NotificationType;
  title: string;
  message: string;
  actionRoute?: string;
  data?: Record<string, unknown>;
};

export const createNotification = async (input: NotificationInput): Promise<void> => {
  await Notification.create(input);
};
