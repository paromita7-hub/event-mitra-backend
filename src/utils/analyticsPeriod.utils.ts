export type AnalyticsPeriod = "1m" | "3m" | "6m" | "1y";

export const ANALYTICS_PERIOD_MAP: Record<AnalyticsPeriod, number> = {
  "1m": 1,
  "3m": 3,
  "6m": 6,
  "1y": 12,
};

export const parseAnalyticsPeriod = (raw?: string): AnalyticsPeriod => {
  if (raw && raw in ANALYTICS_PERIOD_MAP) {
    return raw as AnalyticsPeriod;
  }
  return "6m";
};

export const monthsBack = (count: number): Date[] => {
  const result: Date[] = [];
  const today = new Date();
  for (let index = count - 1; index >= 0; index -= 1) {
    result.push(new Date(today.getFullYear(), today.getMonth() - index, 1));
  }
  return result;
};

export const monthKey = (date: Date): string => `${date.getFullYear()}-${date.getMonth()}`;

export const monthLabel = (date: Date): string =>
  date.toLocaleDateString("en-IN", { month: "short" });

export const getPeriodStart = (monthsCount: number): Date => {
  const months = monthsBack(monthsCount);
  return months[0] ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
};

export const isOnOrAfter = (date: Date | string, start: Date): boolean =>
  new Date(date).getTime() >= start.getTime();
