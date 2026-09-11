import type { WaterRecord } from "./hydra-types";

export type WaterSavingsInsight = {
  status: "insufficient" | "saving" | "higher" | "stable";
  percent: number;
  litersPerReading: number;
  currentAverage: number;
  previousAverage: number;
  sampleSize: number;
  readingsNeeded: number;
};

export function calculateWaterSavings(records: WaterRecord[]): WaterSavingsInsight {
  if (records.length < 4) {
    return {
      status: "insufficient",
      percent: 0,
      litersPerReading: 0,
      currentAverage: 0,
      previousAverage: 0,
      sampleSize: 0,
      readingsNeeded: Math.max(0, 4 - records.length),
    };
  }

  const ordered = [...records].sort((left, right) => left.date.localeCompare(right.date));
  const sampleSize = Math.min(3, Math.floor(ordered.length / 2));
  const current = ordered.slice(-sampleSize);
  const previous = ordered.slice(-(sampleSize * 2), -sampleSize);
  const currentAverage = current.reduce((sum, item) => sum + item.amount, 0) / current.length;
  const previousAverage = previous.reduce((sum, item) => sum + item.amount, 0) / previous.length;

  if (!Number.isFinite(previousAverage) || previousAverage <= 0) {
    return {
      status: "insufficient",
      percent: 0,
      litersPerReading: 0,
      currentAverage,
      previousAverage,
      sampleSize,
      readingsNeeded: 0,
    };
  }

  const change = ((currentAverage - previousAverage) / previousAverage) * 100;
  const percent = Math.abs(change);
  const litersPerReading = Math.abs(previousAverage - currentAverage);
  const status: WaterSavingsInsight["status"] = Math.abs(change) < 3
    ? "stable"
    : change < 0
      ? "saving"
      : "higher";

  return {
    status,
    percent,
    litersPerReading,
    currentAverage,
    previousAverage,
    sampleSize,
    readingsNeeded: 0,
  };
}
