import type { GameState } from './types';

export const BOOK_PRICE = 19;
export const MAX_LEADERSHIP = 120;
export function enableCommander(s: GameState) {
  if (s.commandVersion === 1) return;
  // Grandfather earned leadership without minting prestige, books or currency.
  s.prestigeFloor = s.commander.leadership;
  s.commandVersion = 1;
}
export function prestigeRequired(level: number) {
  return 40 * (level - 1) ** 2;
}
// Earned prestige gives modest additive combat bonuses. Legacy leadership floors
// preserve training eligibility, but never mint prestige or unearned rank bonuses.
export const earnedPrestigeLevel = (prestige: number) =>
  Math.min(120, 1 + Math.floor(Math.sqrt(Math.max(0, prestige) / 40)));
export const prestigeBonusBps = (prestige: number) => (earnedPrestigeLevel(prestige) - 1) * 10;
export const rankNames = [
  '列兵',
  '下士',
  '中士',
  '上士',
  '少尉',
  '中尉',
  '上尉',
  '少校',
  '中校',
  '上校',
  '少将',
  '上将',
];
export const prestigeRank = (prestige: number) =>
  rankNames[Math.floor((earnedPrestigeLevel(prestige) - 1) / 10)];
export function prestigeOverview(s: GameState) {
  const level = earnedPrestigeLevel(s.commander.prestige);
  const next = level < 120 ? prestigeRequired(level + 1) : null;
  return {
    level,
    rank: prestigeRank(s.commander.prestige),
    total: s.commander.prestige,
    floor: prestigeRequired(level),
    next,
    remaining: next === null ? 0 : Math.max(0, next - s.commander.prestige),
    bonusBps: prestigeBonusBps(s.commander.prestige),
    trainingCap: prestigeLevel(s),
    levels: Array.from({ length: 120 }, (_, i) => ({
      level: i + 1,
      rank: rankNames[Math.floor(i / 10)],
      required: prestigeRequired(i + 1),
      next: i < 119 ? prestigeRequired(i + 2) : null,
      bonusBps: i * 10,
      cap: 20 + i * 5,
    })),
  };
}
export function prestigeLevel(s: GameState) {
  return Math.min(
    120,
    Math.max(
      s.prestigeFloor ?? s.commander.leadership,
      1 + Math.floor(Math.sqrt(s.commander.prestige / 40)),
    ),
  );
}
export function leadershipChance(target: number) {
  if (!Number.isInteger(target) || target < 2 || target > 120) throw Error('统率目标等级无效');
  return target <= 10
    ? 10000
    : Math.max(10, Math.round(9000 * (10 / 9000) ** ((target - 11) / 109)));
}
export function leadershipQuote(s: GameState) {
  const target = s.commander.leadership + 1;
  const chance = target > 120 ? 0 : leadershipChance(target);
  return {
    target,
    chance,
    price: BOOK_PRICE,
    prestigeLevel: prestigeLevel(s),
    prestigeRequired: target > 120 ? 0 : prestigeRequired(target),
    expectedAttempts: chance ? 10000 / chance : 0,
    block:
      target > 120
        ? '统率已达到 120 级'
        : target > prestigeLevel(s)
          ? `需要声望等级 ${target}，当前 ${prestigeLevel(s)}；还差 ${Math.max(0, prestigeRequired(target) - s.commander.prestige)} 声望`
          : '',
  };
}
