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
