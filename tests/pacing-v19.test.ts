import { describe, it, expect } from 'vitest';
import {
  newGame,
  execute,
  advance,
  assertState,
  rate,
  capacity,
  facilityUpgradeQuote,
} from '../src/core/engine';
import { buildingNames, unitList, units, rules } from '../src/core/content';
import { researchTree } from '../src/core/research';
import { productionQuote } from '../src/core/arsenal';
import {
  buildingDuration,
  researchDuration,
  effectiveTime,
  queueView,
  gatheringRate,
} from '../src/core/vip';
import { exportSave, parseSave } from '../src/core/storage';
import { mineCapacity } from '../src/core/world';
import { resources, type Command, type GameState, type Building } from '../src/core/types';

const H = 3600000,
  T = 1791000000000;
let serial = 0;
const act = (s: GameState, c: Command) => execute(s, c, s.now, `pacing-${++serial}`).state;
function state(level = 120, tech = 120, paidGold = 1000000) {
  const s = newGame('pacing', '节奏验收', T);
  for (const b of Object.keys(buildingNames) as Building[]) s.buildings[b] = level;
  for (const t of researchTree) s.tech[t.id] = tech;
  for (const r of [...resources, 'gold'] as const) s.wallet[r] = 1e11;
  s.industry = { version: 1, factory2: level, refit: level };
  s.vip = { version: 1, paidGold, lastDaily: -1 };
  for (const u of unitList) {
    s.arsenal!.cores[u.classId + '_core6'] = 1000;
    s.arsenal!.cores[u.classId + '_core7'] = 1000;
  }
  return s;
}

describe('v19 real durations, batch limits and economy', () => {
  it.each([0, 60, 120])(
    'all upgrades to 101–120 stay 12–120 hours at %i speed tech and VIP0/10',
    (speed) => {
      for (const paid of [0, 1000000])
        for (let level = 100; level < 120; level++) {
          const s = state(level, speed, paid);
          const durations = (Object.keys(buildingNames) as Building[]).map((b) =>
            buildingDuration(s, b),
          );
          durations.push(
            ...['factory2', 'refit'].map(
              (f) => facilityUpgradeQuote(s, f as 'factory2' | 'refit').duration,
            ),
          );
          for (const node of researchTree) {
            const next = structuredClone(s);
            next.tech[node.id] = level;
            // Researching researchSpeed uses its own already completed level.
            durations.push(researchDuration(next, node.id));
          }
          for (const duration of durations) {
            expect(
              effectiveTime(s, duration),
              `L${level + 1}, speed${speed}, VIP${paid}`,
            ).toBeGreaterThanOrEqual(12 * H);
            expect(effectiveTime(s, duration)).toBeLessThanOrEqual(120 * H);
          }
        }
    },
  );
  it('differentiates project types and keeps every subsequent raw upgrade slower', () => {
    const s = state(119, 0, 0);
    expect(buildingDuration(s, 'hq')).toBe(120 * H);
    expect(buildingDuration(s, 'iron')).toBe(42 * H);
    s.tech.resourceOutput = s.tech.ballistics = 119;
    expect(researchDuration(s, 'ballistics')).toBe(120 * H);
    expect(researchDuration(s, 'resourceOutput')).toBe(36 * H);
    for (const node of researchTree) {
      let previous = 0;
      for (let level = 0; level < 120; level++) {
        s.tech[node.id] = level;
        const duration = researchDuration(s, node.id);
        expect(duration).toBeGreaterThan(previous);
        previous = duration;
      }
    }
  });
  it('tier VII hundred batches stay around two days after all speed bonuses, with class differences', () => {
    for (const s of [state(60, 0, 0), state()]) {
      const times = unitList
        .filter((u) => u.tier === 7)
        .map((u) => effectiveTime(s, productionQuote(s, u.unitId).duration * 100) / H);
      expect(Math.min(...times)).toBeGreaterThan(39);
      expect(Math.max(...times)).toBeLessThan(64);
      expect(new Set(times).size).toBe(4);
    }
    for (const classId of ['tank', 'tank_destroyer', 'spg', 'rocket']) {
      let previous = 0;
      for (let tier = 1; tier <= 7; tier++) {
        const duration = productionQuote(state(), `${classId}_t${tier}`).duration;
        expect(duration).toBeGreaterThan(previous);
        previous = duration;
      }
    }
  });
  it('enforces 100 for both manufacture and refit atomically while repair keeps its own limit', () => {
    const s = state();
    s.available.tank_t6 = s.createdUnits.tank_t6 = 200;
    s.damaged.tank_t7 = s.createdUnits.tank_t7 = 200;
    expect(productionQuote(s, 'tank_t7').max).toBe(100);
    expect(productionQuote(s, 'tank_t7', 'refit').max).toBe(100);
    expect(productionQuote(s, 'tank_t7', 'repair').max).toBe(200);
    const before = structuredClone(s);
    for (const type of ['produce', 'refit'] as const)
      expect(() => act(s, { type, unitId: 'tank_t7', count: 101 })).toThrow('100');
    expect(s).toEqual(before);
    s.arsenal!.cores.tank_core7 = 3;
    expect(productionQuote(s, 'tank_t7').max).toBe(3);
    expect(productionQuote(s, 'tank_t7', 'refit').max).toBe(3);
  });
  it('settles two multi-day FIFO factory lines, research, refit and repairs once across a large rest', async () => {
    let s = state(120, 119);
    s.buildings.factory = 119;
    s.available.tank_t6 = s.createdUnits.tank_t6 = 100;
    s.damaged.tank_t7 = s.createdUnits.tank_t7 = 12;
    s = act(s, { type: 'upgrade', building: 'factory' });
    s = act(s, { type: 'research', tech: 'attack' });
    for (const facility of ['factory', 'factory2'] as const)
      for (let i = 0; i < 2; i++)
        s = act(s, { type: 'produce', facility, unitId: 'tank_t7', count: 100 });
    s = act(s, { type: 'refit', unitId: 'tank_t7', count: 100 });
    s = act(s, { type: 'repair', unitId: 'tank_t7', count: 12 });
    s = await parseSave(await exportSave(s));
    const end = s.now + Math.max(...queueView(s).map((j) => j.remainingMs));
    const bulk = advance(s, end);
    let stepped = s;
    while (stepped.now < end) stepped = advance(stepped, Math.min(end, stepped.now + 8 * H));
    expect({ ...bulk, revision: 0 }).toEqual({ ...stepped, revision: 0 });
    expect(bulk.available.tank_t7).toBe(512);
    expect(bulk.arsenal!.cores.tank_core7).toBe(500);
    expect(bulk.arsenal!.converted.tank_t6).toBe(100);
    expect(bulk.buildings.factory).toBe(120);
    expect(bulk.tech.attack).toBe(120);
    expect(bulk.jobs).toEqual({});
    expect(advance(bulk, bulk.now + 1).available).toEqual(bulk.available);
    assertState(bulk);
  });
  it('imports paid legacy 1000-vehicle orders and preserves original delivery/refund snapshots', async () => {
    let s = state(20, 0, 0);
    for (const facility of ['factory', 'factory2'] as const) {
      s = act(s, { type: 'produce', facility, unitId: 'tank_t1', count: 100 });
      const key = facility === 'factory' ? 'production' : 'production:factory2';
      const j = s.jobs[key]!;
      j.total = 1000;
      j.duration = 5000;
      j.startedAt = T;
      j.dueAt = T + 5000;
      j.unitCost = { iron: 20, oil: 10, lead: 5 };
    }
    const jobs = structuredClone(s.jobs);
    s = await parseSave(await exportSave(s));
    expect(s.jobs).toEqual(jobs);
    const partial = advance(s, T + 35000);
    expect(partial.available.tank_t1).toBe(34);
    const iron = partial.wallet.iron;
    const cancelled = act(partial, {
      type: 'cancel',
      kind: 'production',
      seq: partial.jobs.production!.seq,
    });
    expect(cancelled.wallet.iron - iron).toBe(993 * 20);
    const done = advance(s, T + 5000000);
    expect(done.available.tank_t1).toBe(2020);
    expect(done.jobs).toEqual({});
    assertState(done);
  });
  it('defers v18 resource point migration until its last expedition returns', async () => {
    let s = state(20, 0, 0);
    s.formation = [{ unitId: 'tank_t1', count: 20 }, null, null, null, null, null];
    s = act(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    s.worldRules = 'renewable-v2';
    s.world[0].economyVersion = 2;
    s.world[0].reserve = 230400;
    s.marches[0].gatherRate = 57600;
    const snapshot = structuredClone(s.marches[0]);
    s = await parseSave(await exportSave(s));
    s = advance(s, s.now);
    expect(s.world[0].economyVersion).toBe(2);
    expect(mineCapacity(s.world[0])).toBe(230400);
    expect(gatheringRate(s, s.world[0])).toBe(57600);
    expect(s.marches[0]).toEqual(snapshot);
    s = advance(s, T + H);
    expect(s.counters.cargo).toBe(8000);
    expect(s.world[0].economyVersion).toBe(3);
    expect(mineCapacity(s.world[0])).toBe(19200);
    assertState(s);
  });
  it('redesigns early income too and retains overcapacity legacy balances without truncation', () => {
    for (const level of [1, 2, 6, 20, 60, 120]) {
      const s = state(level, 0, 0);
      expect(rate(s, 'iron')).toBe(
        Math.floor(
          (rules.economy.baseRatePerHour.iron * Math.round(10000 * level ** 1.35)) / 10000,
        ),
      );
      expect(capacity(s)).toBeGreaterThanOrEqual(rate(s, 'iron') * 48);
      s.wallet.iron = capacity(s) + 12345;
      expect(advance(s, s.now + 5 * 24 * H).wallet.iron).toBe(s.wallet.iron);
    }
  });
});
