import { expeditionLoad } from './cargo';
import { MAX_LEVEL, researchBaseTime, economyBonus, workDuration } from './growth';
import { worldBaseRate } from './world';
import type { Building, GameState, Job, JobKind, Technology, WorldSite, Formation } from './types';
import { durationCurve, rateCurve, units } from './content';
import { techLevel } from './research';
import { facilityBlock, jobFacility, productionFacilities } from './industry';
import type { ProductionFacility } from './types';

// Benefits: Rayjoy official VIP article 173 (2016-10-18). Purchase permissions
// become automatic unlocks for this offline edition. V10 threshold is our extension.
// v0.26: all industrial/research/repair lines have three waiting positions at every VIP.
export const vipLevels = [0, 40, 460, 960, 3000, 7200, 20000, 60000, 180000, 500000, 1000000].map(
  (threshold, level) => ({
    level,
    threshold,
    building: [1, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7][level],
    waiting: 3,
    marches: [2, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8][level],
    freeMinutes: [0, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15][level],
    production: [0, 0, 0, 0, 30, 40, 50, 60, 70, 80, 90][level],
    refit: [0, 0, 0, 0, 15, 20, 25, 30, 35, 40, 45][level],
    research: [0, 0, 0, 0, 30, 40, 50, 60, 70, 80, 90][level],
    xp: [0, 0, 30, 30, 30, 60, 60, 60, 100, 100, 100][level],
    storage: [0, 0, 0, 0, 0, 0, 5, 5, 5, 10, 10][level],
    marchSpeed: [0, 0, 0, 0, 0, 0, 30, 40, 50, 60, 70][level],
    dailyGold: level * 5,
  }),
);
export function vipBenefits(s: GameState) {
  return [...vipLevels].reverse().find((v) => (s.vip?.paidGold ?? 0) >= v.threshold)!;
}
export function allJobs(s: GameState): Job[] {
  return [...Object.values(s.jobs).filter((j): j is Job => !!j), ...(s.jobBacklog ?? [])];
}
export function queueStatus(
  s: GameState,
  kind: JobKind,
  facility?: ProductionFacility,
): {
  active: Job[];
  waiting: Job[];
  slots: number;
  waitingSlots: number;
  full: boolean;
} {
  const matches = (j: Job) => j.kind === kind && (!facility || jobFacility(j) === facility);
  const active = Object.values(s.jobs)
    .filter((j): j is Job => !!j && matches(j))
    .sort((a, b) => a.seq - b.seq);
  const waiting = (s.jobBacklog ?? []).filter(matches).sort((a, b) => a.seq - b.seq);
  const v = vipBenefits(s);
  const lines = productionFacilities.filter((f) => !facilityBlock(s, f));
  const slots =
    kind === 'building' ? v.building : kind === 'production' && !facility ? lines.length : 1;
  const waitingSlots =
    kind === 'production' ? 3 * slots : kind === 'research' || kind === 'repair' ? 3 : 0;
  return {
    active,
    waiting,
    slots,
    waitingSlots,
    full:
      kind === 'production' && !facility
        ? lines.every((f) => queueStatus(s, kind, f).full)
        : active.length >= slots && waiting.length >= waitingSlots,
  };
}
export const jobRemaining = (s: GameState, j: Job) =>
  Math.max(0, j.dueAt - s.now + (j.total - j.completed - 1) * j.duration);
export const freeTime = (s: GameState) => vipBenefits(s).freeMinutes * 60000;
export const effectiveTime = (s: GameState, duration: number) =>
  Math.max(0, duration - freeTime(s));
export const jobEffectiveRemaining = (s: GameState, j: Job) => effectiveTime(s, jobRemaining(s, j));
export function queueWait(s: GameState, kind: JobKind, facility?: ProductionFacility) {
  const q = queueStatus(s, kind, facility);
  return q.active.length
    ? jobEffectiveRemaining(s, q.active[0]) +
        q.waiting.reduce((n, j) => n + effectiveTime(s, j.duration * j.total), 0)
    : 0;
}
export function accelerationCost(s: GameState, j: Job) {
  return Math.ceil(jobEffectiveRemaining(s, j) / 60000);
}
export function queueView(s: GameState) {
  const groups: { kind: JobKind; facility?: ProductionFacility }[] = [
    { kind: 'building' },
    ...productionFacilities.map((facility) => ({ kind: 'production' as const, facility })),
    { kind: 'research' },
    { kind: 'repair' },
  ];
  return groups.flatMap(({ kind, facility }) => {
    const q = queueStatus(s, kind, facility);
    let wait = q.active.length ? jobEffectiveRemaining(s, q.active[0]) : 0;
    return [
      ...q.active.map((j) => ({
        ...j,
        waiting: false,
        waitMs: 0,
        remainingMs: jobEffectiveRemaining(s, j),
        rawRemainingMs: jobRemaining(s, j),
        acceleration: accelerationCost(s, j),
      })),
      ...q.waiting.map((j) => {
        const row = {
          ...j,
          waiting: true,
          waitMs: wait,
          remainingMs: wait + effectiveTime(s, j.duration * j.total),
          rawRemainingMs: j.duration * j.total,
          acceleration: 0,
        };
        wait = row.remainingMs;
        return row;
      }),
    ];
  });
}
export function buildingDuration(s: GameState, b: Building) {
  if (s.buildings[b] >= MAX_LEVEL) return 0;
  const factor =
    b === 'hq' ? 1 : b === 'lab' ? 0.9 : b === 'factory' ? 0.8 : b === 'warehouse' ? 0.6 : 0.35;
  return workDuration(durationCurve[s.buildings[b]] * factor, s.tech.construction * 5, 0.5);
}
export function researchDuration(s: GameState, t: Technology) {
  if (techLevel(s, t) >= MAX_LEVEL) return 0;
  const factor = ['ballistics', 'armorPlating'].includes(t)
    ? 1
    : ['materials', 'refitSpeed', 'repairSpeed'].includes(t)
      ? 0.85
      : ['construction', 'researchSpeed', 'production'].includes(t)
        ? 0.75
        : ['gather', 'march', 'cargo', 'survey'].includes(t)
          ? 0.6
          : ['attack', 'hp'].includes(t)
            ? 0.5
            : 0.3;
  return workDuration(
    researchBaseTime(techLevel(s, t)) * factor,
    vipBenefits(s).research + techLevel(s, 'researchSpeed') * 5,
    0.5,
  );
}
export function travelDuration(s: GameState, site: WorldSite) {
  const base = Math.max(
    1000,
    Math.ceil(Math.hypot(site.x - s.home.x, site.y - s.home.y) * 8) * 1000,
  );
  return Math.max(
    1000,
    Math.ceil((base * 100) / (100 + vipBenefits(s).marchSpeed + techLevel(s, 'march') * 5)),
  );
}
export const loadBonus = (s: GameState) => 50000 + techLevel(s, 'cargo') * 2500;
export const troopLoad = (f: Formation, bps: number) =>
  Math.floor((f.reduce((n, t) => n + (t ? units[t.unitId].load * t.count : 0), 0) * bps) / 10000);
export { baseUnitLoad, unitLoad, expeditionLoad } from './cargo';
export const gatheringRate = (s: GameState, site: WorldSite) =>
  (site.economyVersion ?? 0) >= 2
    ? Math.floor(
        (worldBaseRate(site) *
          8 *
          (100 +
            economyBonus(techLevel(s, 'gather'), 5) +
            economyBonus(techLevel(s, 'survey'), 5))) /
          100,
      )
    : Math.floor(
        (((((4800 * rateCurve[s.buildings.hq]) / 10000) * (100 + (site.level - 1) * 20)) / 100) *
          (100 + techLevel(s, 'gather') * 5 + techLevel(s, 'survey') * 5)) /
          100,
      );
export function marchQuote(s: GameState, site: WorldSite, f: Formation) {
  const travelMs = travelDuration(s, site);
  const load = expeditionLoad(s, f);
  const gatherRate = gatheringRate(s, site);
  const amount = site.kind === 'mine' ? Math.min(load, site.reserve) : 0;
  const rawGatherMs = Math.ceil((amount * 3600000) / gatherRate);
  const gatherMs = effectiveTime(s, rawGatherMs);
  return {
    outboundMs: travelMs,
    returnMs: travelMs,
    gatherMs,
    rawGatherMs,
    totalMs: travelMs * 2 + gatherMs,
    load,
    amount,
    gatherRate,
    contested: site.guards.some(Boolean),
  };
}
