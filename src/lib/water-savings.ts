import type { WaterRecord } from "./hydra-types";

export type WaterConsumptionStatus = "insufficient" | "saving" | "higher" | "stable";

export type WaterBreakdownItem = {
  key: string;
  liters: number;
  percent: number;
};

export type WaterDailyTotal = {
  date: string;
  liters: number;
};

export type WaterConsumptionSummary = {
  status: WaterConsumptionStatus;
  totalRegistered: number;
  measuredDays: number;
  currentMonthTotal: number;
  currentMonthDays: number;
  comparisonDays: number;
  currentWindowTotal: number;
  previousWindowTotal: number;
  currentDailyAverage: number;
  previousDailyAverage: number;
  changePercent: number;
  differenceLiters: number;
  savingsLiters: number;
  readingsNeeded: number;
  dailyTotals: WaterDailyTotal[];
  recentDailyTotals: WaterDailyTotal[];
  purposeBreakdown: WaterBreakdownItem[];
  sourceBreakdown: WaterBreakdownItem[];
};

export type WaterSavingsInsight = {
  status: WaterConsumptionStatus;
  percent: number;
  litersPerReading: number;
  currentAverage: number;
  previousAverage: number;
  sampleSize: number;
  readingsNeeded: number;
  litersDifference: number;
  savingsLiters: number;
  comparisonDays: number;
  measuredDays: number;
  currentTotal: number;
  previousTotal: number;
};

function validAmount(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function buildBreakdown(records: WaterRecord[], keyFor: (record: WaterRecord) => string): WaterBreakdownItem[] {
  const grouped = new Map<string, number>();
  for (const record of records) {
    const amount = validAmount(record.amount);
    if (!amount) continue;
    const key = keyFor(record) || "Não informado";
    grouped.set(key, (grouped.get(key) ?? 0) + amount);
  }

  const total = sum([...grouped.values()]);
  if (total <= 0) return [];

  return [...grouped.entries()]
    .map(([key, liters]) => ({ key, liters, percent: (liters / total) * 100 }))
    .sort((left, right) => right.liters - left.liters);
}

function localMonthKey(now: Date) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function calculateWaterConsumption(records: WaterRecord[], now = new Date()): WaterConsumptionSummary {
  const cleanRecords = records.filter((record) => validAmount(record.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(record.date));
  const totalRegistered = sum(cleanRecords.map((record) => record.amount));

  const dailyMap = new Map<string, number>();
  for (const record of cleanRecords) {
    dailyMap.set(record.date, (dailyMap.get(record.date) ?? 0) + record.amount);
  }

  const dailyTotals = [...dailyMap.entries()]
    .map(([date, liters]) => ({ date, liters }))
    .sort((left, right) => left.date.localeCompare(right.date));

  const measuredDays = dailyTotals.length;
  const comparisonDays = Math.min(7, Math.floor(measuredDays / 2));
  const canCompare = comparisonDays >= 2;

  const currentWindow = canCompare
    ? dailyTotals.slice(-comparisonDays)
    : dailyTotals.slice(-Math.min(7, measuredDays));
  const previousWindow = canCompare
    ? dailyTotals.slice(-(comparisonDays * 2), -comparisonDays)
    : [];

  const currentWindowTotal = sum(currentWindow.map((item) => item.liters));
  const previousWindowTotal = sum(previousWindow.map((item) => item.liters));
  const currentDailyAverage = currentWindow.length ? currentWindowTotal / currentWindow.length : 0;
  const previousDailyAverage = previousWindow.length ? previousWindowTotal / previousWindow.length : 0;

  let status: WaterConsumptionStatus = "insufficient";
  let changePercent = 0;
  let differenceLiters = 0;

  if (canCompare && previousWindowTotal > 0) {
    differenceLiters = currentWindowTotal - previousWindowTotal;
    changePercent = (differenceLiters / previousWindowTotal) * 100;
    status = Math.abs(changePercent) < 3 ? "stable" : changePercent < 0 ? "saving" : "higher";
  }

  const currentDates = new Set(currentWindow.map((item) => item.date));
  const windowRecords = cleanRecords.filter((record) => currentDates.has(record.date));
  const breakdownRecords = windowRecords.length ? windowRecords : cleanRecords;

  const monthKey = localMonthKey(now);
  const monthRecords = cleanRecords.filter((record) => record.date.startsWith(monthKey));
  const monthDays = new Set(monthRecords.map((record) => record.date));

  return {
    status,
    totalRegistered,
    measuredDays,
    currentMonthTotal: sum(monthRecords.map((record) => record.amount)),
    currentMonthDays: monthDays.size,
    comparisonDays,
    currentWindowTotal,
    previousWindowTotal,
    currentDailyAverage,
    previousDailyAverage,
    changePercent,
    differenceLiters,
    savingsLiters: status === "saving" ? Math.abs(differenceLiters) : 0,
    readingsNeeded: canCompare ? 0 : Math.max(0, 4 - measuredDays),
    dailyTotals,
    recentDailyTotals: dailyTotals.slice(-7),
    purposeBreakdown: buildBreakdown(breakdownRecords, (record) => record.purpose),
    sourceBreakdown: buildBreakdown(breakdownRecords, (record) => record.sourceId),
  };
}

export function calculateWaterSavings(records: WaterRecord[]): WaterSavingsInsight {
  const summary = calculateWaterConsumption(records);
  const days = Math.max(summary.comparisonDays, 1);

  return {
    status: summary.status,
    percent: Math.abs(summary.changePercent),
    litersPerReading: Math.abs(summary.differenceLiters) / days,
    currentAverage: summary.currentDailyAverage,
    previousAverage: summary.previousDailyAverage,
    sampleSize: summary.comparisonDays,
    readingsNeeded: summary.readingsNeeded,
    litersDifference: summary.differenceLiters,
    savingsLiters: summary.savingsLiters,
    comparisonDays: summary.comparisonDays,
    measuredDays: summary.measuredDays,
    currentTotal: summary.currentWindowTotal,
    previousTotal: summary.previousWindowTotal,
  };
}
