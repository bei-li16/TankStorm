import type { GameState } from './types';

export const BOOK_PRICE = 19;
export const LEADERSHIP_BATCHES = [1, 10, 100, 1000] as const;
export function enableCommander(s: GameState) {
  // Older saves only retained the last batch. Import it once without inventing prior rolls.
  if (!s.leadershipHistory)
    s.leadershipHistory = s.lastLeadership ? [{ ...s.lastLeadership, legacy: true }] : [];

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
  1 + Math.floor(Math.sqrt(Math.max(0, prestige) / 40));
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
  rankNames[Math.min(rankNames.length - 1, Math.floor((earnedPrestigeLevel(prestige) - 1) / 10))];
export function prestigeOverview(s: GameState, startLevel = 1, count = 120) {
  if (
    !Number.isSafeInteger(startLevel) ||
    startLevel < 1 ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 120
  )
    throw Error('声望页面参数无效');
  const level = earnedPrestigeLevel(s.commander.prestige);
  const next = prestigeRequired(level + 1);
  return {
    level,
    rank: prestigeRank(s.commander.prestige),
    total: s.commander.prestige,
    floor: prestigeRequired(level),
    next,
    remaining: Math.max(0, next - s.commander.prestige),
    bonusBps: prestigeBonusBps(s.commander.prestige),
    trainingCap: prestigeLevel(s),
    levels: Array.from({ length: count }, (_, i) => {
      const n = startLevel + i;
      return {
        level: n,
        rank: rankNames[Math.min(rankNames.length - 1, Math.floor((n - 1) / 10))],
        required: prestigeRequired(n),
        next: prestigeRequired(n + 1),
        bonusBps: (n - 1) * 10,
        cap: 20 + (n - 1) * 5,
      };
    }),
  };
}
export function prestigeLevel(s: GameState) {
  return Math.max(
    s.prestigeFloor ?? s.commander.leadership,
    earnedPrestigeLevel(s.commander.prestige),
  );
}
export function leadershipChance(target: number) {
  if (!Number.isSafeInteger(target) || target < 2) throw Error('统率目标等级无效');
  return target <= 10
    ? 10000
    : Math.max(10, Math.round(9000 * (10 / 9000) ** ((target - 11) / 109)));
}
export function leadershipQuote(s: GameState) {
  const target = s.commander.leadership + 1;
  const chance = leadershipChance(target);
  return {
    target,
    chance,
    price: BOOK_PRICE,
    prestigeLevel: prestigeLevel(s),
    prestigeRequired: prestigeRequired(target),
    expectedAttempts: chance ? 10000 / chance : 0,
    block:
      target > prestigeLevel(s)
        ? `需要声望等级 ${target}，当前 ${prestigeLevel(s)}；还差 ${Math.max(0, prestigeRequired(target) - s.commander.prestige)} 声望`
        : '',
  };
}
