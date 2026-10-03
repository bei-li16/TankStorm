// Shared level limits and extensions; booked orders retain their original snapshots.
export const MAX_LEVEL = 120;
export const growthLimits = {
  building: MAX_LEVEL,
  research: MAX_LEVEL,
  commander: MAX_LEVEL,
  skill: MAX_LEVEL,
};
export const MAX_PRODUCTION_BATCH = 100;
// Log interpolation keeps adjacent levels continuous without a special level-20 extension.
export function milestoneCurve(level: number, anchors: number[][]) {
  if (level <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    const [x, y] = anchors[i],
      [px, py] = anchors[i - 1];
    if (level <= x) return py * Math.pow(y / py, (level - px) / (x - px));
  }
  return anchors.at(-1)![1];
}
export const buildingBaseTime = (level: number) =>
  Math.round(
    milestoneCurve(level, [
      [0, 30000],
      [1, 60000],
      [6, 600000],
      [12, 2700000],
      [20, 10800000],
      [40, 43200000],
      [60, 108000000],
      [80, 216000000],
      [100, 345600000],
      [119, 432000000],
      [120, 436320000],
    ]),
  );
export const researchBaseTime = (level: number) =>
  Math.round(
    milestoneCurve(level, [
      [0, 45000],
      [1, 90000],
      [6, 720000],
      [12, 3600000],
      [20, 14400000],
      [40, 57600000],
      [60, 129600000],
      [80, 230400000],
      [100, 345600000],
      [119, 432000000],
      [120, 436320000],
    ]),
  );
// Bonus speeds only the variable work; inspection/assembly still takes time.
export const workDuration = (baseMs: number, bonusPercent: number, fixedShare: number) =>
  Math.ceil(baseMs * (fixedShare + (1 - fixedShare) / (1 + bonusPercent / 100)));
export const materialSavingBps = (level: number) => Math.min(6000, Math.max(0, level) * 50);
export const facilitySpeedBps = (level: number) =>
  Math.round((Math.max(0, Math.min(120, level) - 1) / 119) * 10000);
export const economyBonus = (level: number, step: number) =>
  Math.round(step * 40 * Math.pow(Math.max(0, Math.min(120, level)) / 120, 0.8) * 100) / 100;
