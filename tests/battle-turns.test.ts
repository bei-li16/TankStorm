import { describe, expect, it } from 'vitest';
import { army, combatStats, extraFireChance, simulate } from '../src/core/battle';
import { assertState, newGame } from '../src/core/engine';
import { exportSave, parseSave } from '../src/core/storage';
import type { ArmyStack, BattleReport } from '../src/core/types';

const troops = (slots: number[], cls = 'tank_destroyer'): ArmyStack[] =>
  army(
    Array.from({ length: 6 }, (_, i) =>
      slots.includes(i + 1) ? { unitId: cls + '_t1', count: 100 } : null,
    ),
  );
const regular = (r: BattleReport) => r.actions!.filter((a) => !a.extra);
const durable = (slots: number[]) =>
  troops(slots).map((s) => ({ ...s, attack: 1, hp: 1000000, totalHp: 100000000 }));

describe('v0.14 major rounds and alternating exchanges', () => {
  it('alternates living groups and waits rather than wrapping the shorter side early', () => {
    const r = simulate(durable([1, 3, 6]), durable([2, 5]), 51);
    expect(
      regular(r)
        .slice(0, 12)
        .map((a) => [a.side, a.from]),
    ).toEqual([
      [0, 1],
      [1, 2],
      [0, 3],
      [1, 5],
      [0, 6],
      [0, 1],
      [1, 2],
      [0, 3],
      [1, 5],
      [0, 6],
      [0, 1],
      [1, 2],
    ]);
    expect(r.rounds).toBe(40);
    expect(regular(r)).toHaveLength(200);
    expect(r.winner).toBe(1);
  });
  it('hands over after a kill to the opponent’s next living slot', () => {
    const a = troops([1]);
    a[0].attack = 100000;
    a[0].accuracy = 10000;
    const b = durable([1, 4]);
    b[0].hp = 1;
    b[0].totalHp = 1;
    const r = simulate(a, b, 1);
    expect(r.events[0].remaining).toBe(0);
    expect(
      regular(r)
        .slice(0, 3)
        .map((a) => [a.side, a.from]),
    ).toEqual([
      [0, 1],
      [1, 4],
      [0, 1],
    ]);
    expect(r.actions!.filter((a) => a.side === 1).every((a) => a.from === 4)).toBe(true);
  });
  it('higher initiative acts first; ties consistently favor the attacker', () => {
    const a = durable([4]),
      b = durable([6]);
    b[0].initiative = 101;
    const r = simulate(a, b, 71);
    expect(r.tactics!.firstSide).toBe(1);
    expect(
      regular(r)
        .slice(0, 4)
        .map((a) => a.side),
    ).toEqual([1, 0, 1, 0]);
    b[0].initiative = 100;
    expect(simulate(a, b, 71).tactics!.firstSide).toBe(0);
  });
  it('computes occupied-slot averages, not a troop-count multiplier, with tech bonuses', () => {
    const s = newGame('tactics', 'tactics', 100000);
    s.tech.march = 3;
    s.tech.ballistics = 4;
    const a = army(
      [
        { unitId: 'tank_t1', count: 1 },
        { unitId: 'spg_t7', count: 999 },
      ],
      s.tech,
    );
    expect(combatStats(a)).toEqual({ initiative: 127, extraFire: 131 });
    a[1].count = 1;
    expect(combatStats(a)).toEqual({ initiative: 127, extraFire: 131 });
    expect(combatStats([])).toEqual({ initiative: 0, extraFire: 0 });
  });
  it('opponent values suppress repeat probability and enforce 0–35% bounds', () => {
    expect(extraFireChance(100, 100)).toBe(1000);
    expect(extraFireChance(150, 100)).toBe(1500);
    expect(extraFireChance(100, 150)).toBe(500);
    expect(extraFireChance(0, 1000)).toBe(0);
    expect(extraFireChance(1000, 0)).toBe(3500);
  });
  it('records deterministic extra rolls, repeats the same stack once and then switches sides', () => {
    let extras = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const r = simulate(durable([1, 4]), durable([2, 6]), seed);
      expect(r).toEqual(simulate(durable([1, 4]), durable([2, 6]), seed));
      for (const [i, a] of r.actions!.entries()) {
        if (a.extra) {
          extras++;
          const prev = r.actions![i - 1];
          expect(prev.extra).toBe(false);
          expect(prev.extraTriggered).toBe(true);
          expect([a.side, a.from, a.round]).toEqual([prev.side, prev.from, prev.round]);
          expect(a.extraRoll).toBeUndefined();
          if (i + 1 < r.actions!.length) expect(r.actions![i + 1].side).not.toBe(a.side);
        } else {
          expect(a.extraTriggered).toBe(a.extraRoll! < r.tactics!.chances[a.side]);
        }
      }
    }
    expect(extras).toBeGreaterThan(0);
  });
  it.each([
    ['tank', [1, 2, 3], [1, 2, 3]],
    ['spg', [1, 4], [1, 2]],
    ['rocket', [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]],
  ])(
    '%s records separate projectiles or a rocket salvo without multiplying damage',
    (cls, targets, shots) => {
      const r = simulate(troops([1], cls as string), durable([1, 2, 3, 4, 5, 6]), 1);
      const first = r.events.filter((e) => e.action === 1);
      expect(first.map((e) => e.to)).toEqual(targets);
      expect(first.map((e) => e.shot)).toEqual(shots);
      expect(new Set(first.map((e) => e.shots))).toEqual(
        new Set([Math.max(...(shots as number[]))]),
      );
    },
  );
  it('does not reroll or append an extra attack after annihilating the enemy', () => {
    const a = troops([1]);
    a[0].attack = 1000000;
    a[0].accuracy = 10000;
    const r = simulate(a, troops([6]), 1);
    expect(r.actions).toHaveLength(1);
    expect(r.actions![0].extraRoll).toBeUndefined();
    expect(r.winner).toBe(0);
  });
  it('preserves both legacy and new report snapshots through save import/export', async () => {
    const s = newGame('compat-tactics', 'compat', 100000);
    const current = simulate(troops([1]), troops([2]), 21);
    current.id = 'new';
    current.title = 'new';
    const old = structuredClone(current);
    old.id = 'old';
    old.ruleset = 'classic-combat-v0.9';
    delete old.tactics;
    delete old.actions;
    for (const e of old.events) {
      delete e.action;
      delete e.shot;
      delete e.shots;
      delete e.extra;
    }
    for (const st of [...old.initial.flat(), ...old.final.flat()]) {
      delete st.initiative;
      delete st.extraFire;
    }
    s.reports = [current, old];
    assertState(s);
    const restored = await parseSave(await exportSave(s));
    expect(restored.reports).toEqual(s.reports);
    s.reports[0].events[0].shot = -1;
    expect(() => assertState(s)).toThrow();
  });
});
