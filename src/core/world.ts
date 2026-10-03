import { rateCurve, rules, units } from './content';
import { army } from './battle';
import { resources, type Formation, type GameState, type WorldSite } from './types';
export const WORLD_RULES = 'renewable-v3';
export const WORLD_INTERVAL = 3600000;
export const NPC_CAPACITY = rules.economy.productionCapacityPerResource;
export const NPC_PROTECTED = rules.economy.protectedPerResource;
export const WORLD_LEVELS = [1, 3, 6, 9, 12, 16, 20, 25, 30, 40, 50, 60, 75, 90, 105, 120];
// Frozen v18 rates are only used by old sites locked by an in-flight expedition.
const legacyRates = [
  0, 10000, 11600, 13456, 15609, 18106, 21003, 24364, 28262, 32784, 38030, 44114, 51173, 59360,
  68858, 79875, 92655, 107480, 124677, 144625, 167765,
];
const legacyBase = { iron: 7200, oil: 4800, lead: 4000, titanium: 1800, crystal: 1200 };
export const worldBaseRate = (site: WorldSite, r = site.resource) => {
  const curve =
    site.economyVersion === 3
      ? rateCurve[site.level]
      : (legacyRates[site.level] ?? Math.round(167765 * (1 + (site.level - 20) / 20) ** 0.75));
  return Math.floor(
    ((site.economyVersion === 3 ? rules.economy.baseRatePerHour[r] : legacyBase[r]) * curve) /
      10000,
  );
};
export const mineCapacity = (site: WorldSite) =>
  (site.economyVersion ?? 0) >= 2
    ? Math.ceil((worldBaseRate(site) * 32) / 4) * 4
    : 6000 + site.level * site.level * 6000;
export const npcCapacity = (site: WorldSite, r = site.resource) =>
  (site.economyVersion ?? 0) >= 2
    ? Math.max(NPC_CAPACITY, worldBaseRate(site, r) * 4)
    : NPC_CAPACITY;
export const npcProtected = (site: WorldSite, r = site.resource) =>
  (site.economyVersion ?? 0) >= 2 ? Math.floor(npcCapacity(site, r) * 0.1) : NPC_PROTECTED;
export const npcRate = (site: WorldSite, r = site.resource) =>
  worldBaseRate(site, r) * ((site.economyVersion ?? 0) >= 2 ? 2 : 1);
export const worldTier = (level: number) =>
  [1, 6, 12, 18, 30, 50, 80].filter((n) => level >= n).length;
export const scoutCost = (site: WorldSite) =>
  site.level <= 6 ? 3 : Math.ceil(worldBaseRate(site, 'crystal') / 120);
export function guardTemplate(level: number, kind: 'mine' | 'npc' = 'mine'): Formation {
  const tier = worldTier(level);
  const count =
    level <= 6
      ? 2 + level * 2
      : Math.ceil((20 + 5 * Math.floor((level - 1) / 2)) * (kind === 'npc' ? 0.8 : 0.55));
  return Array.from({ length: 6 }, (_, j) =>
    j < Math.min(6, Math.ceil(level / 3))
      ? {
          unitId: `${['tank', 'tank_destroyer', 'tank', 'spg', 'rocket', 'spg'][j]}_t${Math.max(1, tier - (j === 5 && level < 80 ? 1 : 0))}`,
          count,
        }
      : null,
  );
}
function legacyGuards(level: number): Formation {
  return Array.from({ length: 6 }, (_, j) =>
    j < Math.min(level, 6)
      ? {
          unitId: `${['tank', 'tank_destroyer', 'spg', 'rocket'][j % 4]}_t${level >= 6 ? 2 : 1}`,
          count: 2 + level * 2,
        }
      : null,
  );
}
export function guardArmy(site: WorldSite, formation = site.guards) {
  const level = (site.economyVersion ?? 0) >= 2 ? Math.floor(site.level / 2) : 0;
  return army(formation, {
    attack: level,
    hp: level,
    ballistics: level,
    armorPlating: level,
    march: level,
  } as GameState['tech']);
}
// Each resource receives a distance-sorted ladder; fixed regions do not follow the player's level.
export function worldLevels(sites: WorldSite[]) {
  const result: Record<string, number> = { 'site-0': 1, 'site-1': 1 };
  const distance = (s: WorldSite) => Math.hypot(s.x - 16, s.y - 16);
  for (const kind of [...resources, 'npc']) {
    const rows = sites
      .filter(
        (s) =>
          !(s.id in result) &&
          (kind === 'npc' ? s.kind === 'npc' : s.kind === 'mine' && s.resource === kind),
      )
      .sort((a, b) => distance(a) - distance(b) || a.id.localeCompare(b.id));
    rows.forEach(
      (site, i) =>
        (result[site.id] =
          WORLD_LEVELS[Math.round((i * (WORLD_LEVELS.length - 1)) / Math.max(1, rows.length - 1))]),
    );
  }
  return result;
}
export function configureSite(site: WorldSite, level: number, now: number, preserve = false) {
  const fraction = site.reserve / Math.max(1, mineCapacity(site));
  const oldWallet = { ...site.wallet };
  const oldCaps = Object.fromEntries(resources.map((r) => [r, npcCapacity(site, r)]));
  site.level = level;
  site.economyVersion = 3;
  site.lastGrowth = now;
  site.reserve = preserve
    ? Math.floor(mineCapacity(site) * Math.min(1, fraction))
    : mineCapacity(site);
  for (const r of resources)
    site.wallet[r] = preserve
      ? Math.min(
          npcCapacity(site, r),
          Math.floor((npcCapacity(site, r) * oldWallet[r]) / Math.max(1, oldCaps[r])),
        )
      : npcCapacity(site, r);
  if (!preserve || !site.conquered)
    site.guards = ['site-0', 'site-1'].includes(site.id)
      ? Array(6).fill(null)
      : guardTemplate(level, site.kind);
}
export function enableRenewableWorld(s: GameState) {
  if (!s.worldRules) for (const site of s.world) site.lastGrowth = s.now;
  s.worldRules = WORLD_RULES;
  if (s.world.every((site) => site.economyVersion === 3)) return;
  const levels = worldLevels(s.world);
  for (const site of s.world) {
    if (site.economyVersion === 3 || s.marches.some((m) => m.targetId === site.id)) continue;
    configureSite(site, levels[site.id], s.now, true);
    delete s.intel[site.id];
  }
}
export function nextWorldEvent(s: GameState) {
  return Math.min(...s.world.map((site) => site.lastGrowth + WORLD_INTERVAL));
}
export function settleWorld(s: GameState) {
  for (const site of s.world) {
    if (site.lastGrowth + WORLD_INTERVAL > s.now) continue;
    site.lastGrowth += WORLD_INTERVAL;
    if (site.kind === 'mine') {
      if (s.marches.some((m) => m.targetId === site.id)) continue;
      const before = site.reserve;
      site.reserve = Math.min(mineCapacity(site), before + mineCapacity(site) / 4);
      if (
        (site.economyVersion ?? 0) >= 2 &&
        before < mineCapacity(site) &&
        site.reserve === mineCapacity(site) &&
        !site.guards.some(Boolean) &&
        !['site-0', 'site-1'].includes(site.id)
      ) {
        site.guards = guardTemplate(site.level);
        site.conquered = false;
        delete s.intel[site.id];
      }
      continue;
    }
    for (const r of resources)
      if (site.wallet[r] < npcCapacity(site, r))
        site.wallet[r] = Math.min(npcCapacity(site, r), site.wallet[r] + npcRate(site, r));
    const template =
      (site.economyVersion ?? 0) >= 2 ? guardTemplate(site.level, 'npc') : legacyGuards(site.level);
    for (let i = 0; i < 6; i++) {
      const wanted = template[i],
        current = site.guards[i];
      if (
        !wanted ||
        (current && (current.unitId !== wanted.unitId || current.count >= wanted.count))
      )
        continue;
      const cost = units[wanted.unitId].cost;
      let count = Math.min(
        wanted.count - (current?.count ?? 0),
        (site.economyVersion ?? 0) >= 2 ? Math.ceil(wanted.count / 4) : 1,
      );
      for (const r of resources)
        if (cost[r]) count = Math.min(count, Math.floor(site.wallet[r] / cost[r]));
      if (!count) continue;
      for (const r of resources) site.wallet[r] -= (cost[r] ?? 0) * count;
      site.guards[i] = { unitId: wanted.unitId, count: (current?.count ?? 0) + count };
    }
    site.conquered = !site.guards.some(Boolean);
  }
}
