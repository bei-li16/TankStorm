import { army, extraFireChance, commanderStats } from './battle';
import { unitList, units, rules } from './content';
import type { ArmyStack, Formation, GameState, CombatStats } from './types';
import { leadershipCapacity } from './commander';
import { defenseStats } from './combat_research';

const coverage = { tank: 3, tank_destroyer: 1, spg: 2, rocket: 6 };
// Score relative defensive growth, not invulnerability against a chosen victim.
// Baseline class durability is normalized into the tier's common whiteboard score.
// Diminishing log gain remains finite for uncapped enemy research curves.
export function flatDefenseFactor(st: ArmyStack) {
  const u = units[st.unitId],
    base = u.defense;
  const peers = unitList.filter((p) => p.tier === u.tier);
  const reference = (4 * peers.reduce((sum, p) => sum + p.attack, 0)) / peers.length;
  const inherent = st.baseDefense !== undefined ? 1 / (1 - base / reference) : 1;
  return inherent * (1 + 0.25 * Math.log(Math.max(1, defenseStats(st).flat / base)));
}
// Neutral, full target coverage. Matchups and conditional team auras remain tactical,
// not an inflated prediction of damage against a specific enemy.
function ability(st: ArmyStack) {
  const hit = Math.max(0.1, Math.min(1, 0.95 + st.accuracy / 10000));
  const crit = Math.max(0, Math.min(0.75, 0.1 + st.crit / 10000));
  const enemyHit = Math.max(0.1, Math.min(1, 0.95 - st.evasion / 10000));
  const enemyCrit = Math.max(0, Math.min(0.75, 0.1 - st.armor / 10000));
  const damage =
    ((st.attack * (st.attackBonus ?? 10000)) / 10000) *
    coverage[st.classId] *
    hit *
    (1 + crit * ((st.critMultiplierBps ?? 15000) / 10000 - 1));
  const effectiveHp =
    (st.hp / enemyHit / (1 + enemyCrit * 0.5)) *
    flatDefenseFactor(st) *
    (1 + defenseStats(st).rating / 10000);
  return damage * effectiveHp;
}
export const tierPower = Array.from({ length: 7 }, (_, i) => {
  const baseline = unitList
    .filter((u) => u.tier === i + 1)
    .map((u) => Math.sqrt(ability(army([{ unitId: u.unitId, count: 1 }])[0])));
  return Math.round((10 * baseline.reduce((a, b) => a + b, 0)) / baseline.length);
});
export function unitPower(
  st: ArmyStack,
  tactics: CombatStats = { initiative: st.initiative ?? 100, extraFire: st.extraFire ?? 100 },
) {
  const u = units[st.unitId],
    base = army([{ unitId: st.unitId, count: 1 }])[0];
  const initiative = 1 + Math.max(0, tactics.initiative - 100) / 1000;
  const extra = (1 + extraFireChance(tactics.extraFire, 100) / 20000) / 1.05;
  return Math.round(
    tierPower[u.tier - 1] * Math.sqrt(ability(st) / ability(base)) * initiative * extra,
  );
}
export function armyPower(stacks: ArmyStack[], tactics?: CombatStats) {
  return stacks.reduce((n, st) => n + unitPower(st, tactics) * Math.ceil(st.totalHp / st.hp), 0);
}
export function powerUnits(s: GameState) {
  return Object.fromEntries(
    unitList.map((u) => [
      u.unitId,
      unitPower(
        army([{ unitId: u.unitId, count: 1 }], s.tech, s.commander.attackSkill, s.commander)[0],
        commanderStats(s.tech, s.commander),
      ),
    ]),
  );
}
export function arrangedFormation(s: GameState, mode: 'power' | 'tier'): Formation {
  const cap = leadershipCapacity(s.commander.leadership),
    power = powerUnits(s);
  const candidates = unitList.flatMap((u) => {
    let left = s.available[u.unitId];
    const stacks: { unitId: string; count: number }[] = [];
    while (left > 0 && stacks.length < 6) {
      const count = Math.min(cap, left);
      stacks.push({ unitId: u.unitId, count });
      left -= count;
    }
    return stacks;
  });
  candidates.sort(
    (a, b) =>
      (mode === 'tier' ? units[b.unitId].tier - units[a.unitId].tier : 0) ||
      b.count * power[b.unitId] - a.count * power[a.unitId] ||
      a.unitId.localeCompare(b.unitId),
  );
  const chosen = candidates.slice(0, 6);
  // Positions do not change additive power; durable stacks take the front.
  chosen.sort((a, b) => units[b.unitId].hp * b.count - units[a.unitId].hp * a.count);
  return Array.from({ length: 6 }, (_, i) => chosen[i] ?? null);
}
export function powerOverview(s: GameState, ready: Formation) {
  const points = powerUnits(s),
    cap = leadershipCapacity(s.commander.leadership);
  const level = Math.max(s.buildings.factory, s.industry?.factory2 ?? 0);
  const unlocked = unitList.filter(
    (u) => u.unlock.factoryLevel <= level || s.createdUnits[u.unitId] > 0,
  );
  const best = unlocked.reduce((a, b) => (points[a.unitId] >= points[b.unitId] ? a : b));
  const total = (f: Formation) =>
    f.reduce((n, st) => n + (st ? points[st.unitId] * st.count : 0), 0);
  return {
    units: points,
    base: Object.fromEntries(unitList.map((u) => [u.unitId, tierPower[u.tier - 1]])),
    current: total(ready),
    readyMax: total(arrangedFormation(s, 'power')),
    ceiling: points[best.unitId] * cap * 6,
    bestUnit: best.unitId,
    cap,
    rules: 'power-normalized-v3',
  };
}
