import type { Building, GameState, Job, JobKind, Technology, WorldSite, Formation } from './types';
import { durationCurve, units } from './content';

// Benefits: Rayjoy official VIP article 173 (2016-10-18). Purchase permissions
// become automatic unlocks for this offline edition. V10 threshold is our extension.
export const vipLevels = [0, 40, 460, 960, 3000, 7200, 20000, 60000, 180000, 500000, 1000000].map(
  (threshold, level) => ({
    level,
    threshold,
    building: [1, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7][level],
    waiting: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5][level],
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
export function queueStatus(s: GameState, kind: JobKind) {
  const active = Object.values(s.jobs)
    .filter((j): j is Job => j?.kind === kind)
    .sort((a, b) => a.seq - b.seq);
  const waiting = (s.jobBacklog ?? []).filter((j) => j.kind === kind);
  const v = vipBenefits(s);
  const slots = kind === 'building' ? v.building : 1;
  const waitingSlots = kind === 'production' || kind === 'research' ? v.waiting : 0;
  return {
    active,
    waiting,
    slots,
    waitingSlots,
    full: active.length >= slots && waiting.length >= waitingSlots,
  };
}
export const jobRemaining = (s: GameState, j: Job) =>
  Math.max(0, j.dueAt - s.now + (j.total - j.completed - 1) * j.duration);
export function queueWait(s: GameState, kind: JobKind) {
  const q = queueStatus(s, kind);
  return q.active.length
    ? jobRemaining(s, q.active[0]) + q.waiting.reduce((n, j) => n + j.duration * j.total, 0)
    : 0;
}
export function accelerationCost(s: GameState, j: Job) {
  const remaining = jobRemaining(s, j);
  if (
    (j.kind === 'building' || j.kind === 'research') &&
    vipBenefits(s).freeMinutes > 0 &&
    remaining <= vipBenefits(s).freeMinutes * 60000
  )
    return 0;
  return Math.max(1, Math.ceil(remaining / 60000));
}
export function queueView(s: GameState) {
  return (['building', 'production', 'research', 'repair'] as JobKind[]).flatMap((kind) => {
    const q = queueStatus(s, kind);
    let wait = q.active.length ? jobRemaining(s, q.active[0]) : 0;
    return [
      ...q.active.map((j) => ({
        ...j,
        waiting: false,
        waitMs: 0,
        remainingMs: jobRemaining(s, j),
        acceleration: accelerationCost(s, j),
      })),
      ...q.waiting.map((j) => {
        const row = {
          ...j,
          waiting: true,
          waitMs: wait,
          remainingMs: wait + j.duration * j.total,
          acceleration: 0,
        };
        wait = row.remainingMs;
        return row;
      }),
    ];
  });
}
export function buildingDuration(s: GameState, b: Building) {
  return Math.ceil((durationCurve[s.buildings[b]] * 10000) / (10000 + s.tech.construction * 500));
}
export function researchDuration(s: GameState, t: Technology) {
  return Math.ceil((30000 * (s.tech[t] + 1) * 100) / (100 + vipBenefits(s).research));
}
export function travelDuration(s: GameState, site: WorldSite) {
  const base = Math.max(
    1000,
    Math.ceil(Math.hypot(site.x - s.home.x, site.y - s.home.y) * 8) * 1000,
  );
  return Math.max(1000, Math.ceil((base * 100) / (100 + vipBenefits(s).marchSpeed)));
}
export function marchQuote(s: GameState, site: WorldSite, f: Formation) {
  const travelMs = travelDuration(s, site);
  const load = f.reduce((n, t) => n + (t ? units[t.unitId].load * t.count : 0), 0);
  const gatherRate = 300 + s.tech.gather * 15;
  const amount = site.kind === 'mine' ? Math.min(load, site.reserve) : 0;
  const gatherMs = Math.ceil((amount * 3600000) / gatherRate);
  return {
    outboundMs: travelMs,
    returnMs: travelMs,
    gatherMs,
    totalMs: travelMs * 2 + gatherMs,
    load,
    amount,
    gatherRate,
    contested: site.guards.some(Boolean),
  };
}
