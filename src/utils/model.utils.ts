export const toDayStart = (value: Date | string): Date => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const sameDay = (a: Date | string, b: Date | string): boolean =>
  toDayStart(a).getTime() === toDayStart(b).getTime();

export const makeBookingRef = (): string =>
  `EM-${Math.floor(100000 + Math.random() * 900000)}`;

export const makeTicketRef = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";

  for (let index = 0; index < 8; index += 1) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }

  return `TKT-${token}`;
};
