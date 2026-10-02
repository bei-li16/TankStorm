import { rateCurve, rules, units } from './content';
import { resources, type Formation, type GameState, type WorldSite } from './types';

// A compatible world extension; historical combat snapshots keep their ruleset.
export const WORLD_RULES = 'renewable-v1';
export const WORLD_INTERVAL = 3600000;
export const NPC_CAPACITY = rules.economy.productionCapacityPerResource;
export const NPC_PROTECTED = rules.economy.protectedPerResource;
export const mineCapacity = (site: WorldSite) => 1000 + site.level * 1000;

export function guardTemplate(level: number): Formation {
  return Array.from({ length: 6 }, (_, j) =>
    j < Math.min(level, 6)
      ? {
          unitId: `${['tank', 'tank_destroyer', 'spg', 'rocket'][j % 4]}_t${level >= 6 ? 2 : 1}`,
          count: 2 + level * 2,
        }
      : null,
  );
}

export function enableRenewableWorld(s: GameState) {
  if (!s.worldRules) {
    s.worldRules = WORLD_RULES;
    // Old saves begin at their last saved time, without replaying growth for the
    // entire age of their previously static world.
    for (const site of s.world) site.lastGrowth = s.now;
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
      // Never replenish underneath a gathering party: its departure and cargo
      // accounting remain fixed. Cleared mine guards stay cleared.
      if (!s.marches.some((m) => m.targetId === site.id && m.phase === 'gathering'))
        site.reserve = Math.min(mineCapacity(site), site.reserve + mineCapacity(site) / 4);
      continue;
    }
    // NPC facilities share player rates and the integer level curve. Their fixed
    // level-one warehouse has the same stock cap and 1000-resource protection.
    for (const r of resources) {
      const gained = Math.floor((rules.economy.baseRatePerHour[r] * rateCurve[site.level]) / 10000);
      if (site.wallet[r] < NPC_CAPACITY)
        site.wallet[r] = Math.min(NPC_CAPACITY, site.wallet[r] + gained);
    }
    // Each hourly batch rebuilds at most one unit per original garrison slot,
    // paying ordinary unit prices from this NPC's visible resource balance.
    const template = guardTemplate(site.level);
    for (let i = 0; i < template.length; i++) {
      const wanted = template[i];
      if (!wanted) continue;
      const current = site.guards[i];
      if (current && (current.unitId !== wanted.unitId || current.count >= wanted.count)) continue;
      const cost = units[wanted.unitId].cost;
      if (resources.some((r) => site.wallet[r] < (cost[r] ?? 0))) continue;
      for (const r of resources) site.wallet[r] -= cost[r] ?? 0;
      site.guards[i] = { unitId: wanted.unitId, count: (current?.count ?? 0) + 1 };
    }
    site.conquered = !site.guards.some(Boolean);
  }
}
