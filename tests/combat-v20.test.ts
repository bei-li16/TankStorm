import { describe, expect, it } from 'vitest';
import { army, attackSlots, BATTLE_RULESET, simulate } from '../src/core/battle';
import { advance, assertState, execute, newGame, rate } from '../src/core/engine';
import { productionQuote, repairAllQuote } from '../src/core/arsenal';
import { unitList, units } from '../src/core/content';
import { battleSummary } from '../src/core/overview';
import { materialCost } from '../src/core/research';
import { exportSave, parseSave } from '../src/core/storage';
import type { UnitClass, Command, GameState } from '../src/core/types';

const troops = (slots: number[], cls: UnitClass = 'tank') =>
  army(
    Array.from({ length: 6 }, (_, i) =>
      slots.includes(i + 1) ? { unitId: cls + '_t1', count: 10 } : null,
    ),
  );
const durable = (slots: number[]) =>
  troops(slots).map((st) => ({ ...st, hp: 1000000, totalHp: 10000000, attack: 1 }));
const first = (cls: UnitClass, from: number, slots: number[]) =>
  simulate(troops([from], cls), durable(slots), 41).events.filter((e) => e.action === 1);
let serial = 0;
const act = (s: GameState, c: Command) => execute(s, c, s.now, 'v20-' + ++serial).state;

describe('class footprints and source-aligned columns', () => {
  it('tank fires once per nonempty column, selecting its front or exposed rear', () => {
    const events = first('tank', 5, [1, 3, 5]);
    expect(events.map((e) => e.to)).toEqual([1, 5, 3]);
    expect(events.map((e) => !!e.ground)).toEqual([false, false, false]);
    expect(events.map((e) => e.shot)).toEqual([1, 2, 3]);
    expect(first('tank', 1, [5]).map((e) => [e.to, !!e.ground])).toEqual([[5, false]]);
    expect(first('tank', 1, [1, 3]).map((e) => e.to)).toEqual([1, 3]);
  });
  it.each(['spg', 'tank_destroyer'] as const)(
    '%s searches the source column before adjacent columns',
    (cls) => {
      expect(attackSlots(cls, durable([1, 3, 5]), 2)).toEqual([5]);
      expect(attackSlots(cls, durable([1, 3, 4, 6]), 5)).toEqual(cls === 'spg' ? [1, 4] : [1]);
      expect(attackSlots(cls, durable([1, 2, 4, 5]), 6)).toEqual(cls === 'spg' ? [2, 5] : [2]);
      expect(attackSlots(cls, durable([6]), 1)).toEqual([6]);
      expect(first(cls, 2, [1, 5])).toHaveLength(1);
      expect(first(cls, 2, [2, 5])).toHaveLength(cls === 'spg' ? 2 : 1);
    },
  );
  it('covers every sparse army / firing slot without attacking empty cells for column weapons', () => {
    for (let mask = 1; mask < 64; mask++)
      for (let from = 1; from <= 6; from++) {
        const slots = [1, 2, 3, 4, 5, 6].filter((v) => (mask & (1 << (v - 1))) !== 0),
          d = durable(slots);
        expect(attackSlots('rocket', d, from)).toEqual([1, 2, 3, 4, 5, 6]);
        const tankTargets = attackSlots('tank', d, from);
        expect(tankTargets).toHaveLength(new Set(slots.map((v) => (v - 1) % 3)).size);
        expect(tankTargets.every((v) => slots.includes(v))).toBe(true);
        expect(tankTargets.every((v) => v <= 3 || !slots.includes(v - 3))).toBe(true);
        expect(new Set(tankTargets.map((v) => (v - 1) % 3)).size).toBe(tankTargets.length);
        for (const cls of ['spg', 'tank_destroyer'] as const) {
          const chosen = attackSlots(cls, d, from);
          expect(chosen.every((v) => slots.includes(v))).toBe(true);
          expect(new Set(chosen.map((v) => (v - 1) % 3)).size).toBe(1);
          if (cls === 'tank_destroyer') expect(chosen).toHaveLength(1);
          if (slots.some((v) => (v - 1) % 3 === (from - 1) % 3))
            expect((chosen[0] - 1) % 3).toBe((from - 1) % 3);
        }
      }
  });
  it('records six separate rocket launches even after killing the last living enemy', () => {
    const a = troops([3], 'rocket');
    a[0].attack = 1000000;
    a[0].accuracy = 10000;
    const r = simulate(a, troops([2]), 1, 'stage');
    expect(r.actions).toHaveLength(1);
    expect(r.events.map((e) => e.shot)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.events.every((e) => e.shots === 6)).toBe(true);
    expect(r.events.filter((e) => e.ground)).toHaveLength(5);
    expect(
      r.events
        .filter((e) => e.ground)
        .every((e) => e.damage === 0 && !e.miss && !e.critical && e.hp === 0),
    ).toBe(true);
    expect(r.winner).toBe(0);
    const summary = battleSummary(r);
    expect(summary.teams[0].damage).toBe(r.initial[1][0].totalHp);
    expect(summary.teams[0].miss).toBe(0);
    expect(summary.teams[1].lost).toBe(10);
  });
  it('keeps damage deterministic and symmetric for both firing sides, with no action change mid-salvo', () => {
    const a = durable([1, 3, 6]),
      b = troops([2], 'rocket');
    b[0].initiative = 1000;
    const r = simulate(a, b, 51);
    expect(r).toEqual(simulate(a, b, 51));
    const events = r.events.filter((e) => e.action === 1);
    expect(events.every((e) => e.side === 1 && e.from === 2)).toBe(true);
    expect(events.map((e) => e.to)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(events.filter((e) => e.ground).map((e) => e.to)).toEqual([2, 4, 5]);
  });
  it('persists new ground events and historical records, rejecting fake ground casualties', async () => {
    const s = newGame('ground', '地面弹坑', 1791000000000);
    const r = simulate(troops([1], 'rocket'), troops([4]), 31);
    r.id = 'new';
    const old = structuredClone(r);
    old.id = 'old';
    old.ruleset = 'classic-combat-v0.14';
    old.events = old.events.filter((e) => !e.ground).map((e) => ({ ...e, shot: 1, shots: 1 }));
    s.reports = [r, old];
    assertState(s);
    const restored = await parseSave(await exportSave(s));
    expect(restored.reports).toEqual(s.reports);
    expect(restored.reports[0].ruleset).toBe(BATTLE_RULESET);
    const bad = structuredClone(s);
    bad.reports[0].events.find((e) => e.ground)!.damage = 1;
    expect(() => assertState(bad)).toThrow('空位射击');
  });
});

describe('v20 crystal repair budgets and old paid jobs', () => {
  it('increases all 28 costs while staying near 40% of equivalent replacement materials', () => {
    const base = { iron: 600, oil: 400, lead: 330, titanium: 150, crystal: 100 };
    const s = newGame('cost', '维修预算', 1791000000000);
    for (const u of unitList) {
      const equivalent = Object.entries(u.cost).reduce(
        (sum, [id, n]) => sum + (n * 100) / base[id as keyof typeof base],
        0,
      );
      expect(u.repairCost.crystal).toBe(Math.ceil(equivalent * 0.4));
      expect(u.repairCost.crystal).toBeGreaterThan(Math.ceil(u.cost.iron / 30) * 2);
      for (const lv of [0, 60, 120]) {
        s.tech.materials = lv;
        const repair = productionQuote(s, u.unitId, 'repair').unitCost.crystal!;
        const replacement = Object.entries(productionQuote(s, u.unitId).unitCost).reduce(
          (sum, [id, n]) => sum + (n * 100) / base[id as keyof typeof base],
          0,
        );
        expect(repair / replacement).toBeLessThan(0.61); // Integer rounding matters for tier I.
        expect(repair).toBe(materialCost(s, u.repairCost).crystal);
      }
    }
    s.buildings.crystal = 20;
    const funding = (units.tank_t7.repairCost.crystal * 100) / rate(s, 'crystal');
    expect(funding).toBeGreaterThan(45);
    expect(funding).toBeLessThan(55);
  });
  it('quotes and charges the same discounted mixed repair total, with atomic shortages', () => {
    let s = newGame('repair', '维修', 1791000000000);
    s.tech.materials = 80;
    for (const id of ['tank_t7', 'spg_t5']) {
      s.damaged[id] = 7;
      s.createdUnits[id] += 7;
    }
    const quote = repairAllQuote(s);
    expect(quote.cost.crystal).toBe(
      ['tank_t7', 'spg_t5'].reduce(
        (n, id) => n + productionQuote(s, id, 'repair').unitCost.crystal! * 7,
        0,
      ),
    );
    s.wallet.crystal = quote.cost.crystal! - 1;
    const before = structuredClone(s);
    expect(() => act(s, { type: 'repairAll', quote: quote.token })).toThrow('缺 1');
    expect(s).toEqual(before);
    s.wallet.crystal++;
    s = act(s, { type: 'repairAll', quote: quote.token });
    expect(s.wallet.crystal).toBe(0);
    expect(s.damaged.tank_t7).toBe(0);
    expect(s.available.tank_t7).toBe(7);
    assertState(s);
  });
  it('retains old prepaid costs for completion, instant completion and cancellation', () => {
    let s = newGame('oldrepair', '旧维修', 1791000000000);
    s.damaged.tank_t7 = s.createdUnits.tank_t7 = 3;
    s.wallet.crystal = 100000;
    s = act(s, { type: 'repair', unitId: 'tank_t7', count: 3 });
    s.jobs.repair!.unitCost = { crystal: 400 };
    s.jobs.repair!.duration = 1000;
    s.jobs.repair!.dueAt = s.now + 1000;
    const wallet = s.wallet.crystal,
      job = s.jobs.repair!;
    const done = advance(s, s.now + 3000);
    expect(done.available.tank_t7).toBe(3);
    const all = act(s, { type: 'repairAll', quote: repairAllQuote(s).token });
    expect(all.wallet.crystal).toBe(wallet);
    expect(all.available.tank_t7).toBe(3);
    const cancelled = act(s, { type: 'cancel', kind: 'repair', seq: job.seq });
    expect(cancelled.wallet.crystal).toBe(wallet + 1200);
    expect(cancelled.damaged.tank_t7).toBe(3);
  });
});
