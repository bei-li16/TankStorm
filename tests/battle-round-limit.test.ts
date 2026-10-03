import { describe, expect, it } from 'vitest';
import { army, simulate, BATTLE_RULESET } from '../src/core/battle';
import { assertState, newGame } from '../src/core/engine';
import { battleSummary } from '../src/core/overview';
import { exportSave, parseSave } from '../src/core/storage';
import legacy from '../native/tests/legacy-combat-v020.json';
import legacy22 from '../native/tests/legacy-rounds-v022.json';
import type { BattleReport } from '../src/core/types';

const durable = (slots: number[], initiative: number) =>
  army(
    Array.from({ length: 6 }, (_, i) =>
      slots.includes(i + 1) ? { unitId: 'tank_destroyer_t1', count: 1 } : null,
    ),
  ).map((st) => ({
    ...st,
    attack: 1,
    hp: 1000000,
    totalHp: 1000000,
    accuracy: 10000,
    crit: -10000,
    initiative,
  }));

describe('50 major rounds and first-moving side loses a stalemate', () => {
  it.each(['stage', 'dungeon', 'world', 'training'] as const)(
    '%s resolves both initiative orders, not attacker/defender identity',
    (mode) => {
      for (const first of [0, 1]) {
        const r = simulate(
          durable([1, 3, 6], first === 0 ? 200 : 100),
          durable([2, 5], first === 1 ? 200 : 100),
          5151,
          mode,
        );
        expect(r.ruleset).toBe(BATTLE_RULESET);
        expect(r.roundLimit).toBe(50);
        expect(r.rounds).toBe(50);
        expect(r.endReason).toBe('round-limit');
        expect(r.tactics!.firstSide).toBe(first);
        expect(r.winner).toBe(1 - first);
        expect(r.final.every((side) => side.every((st) => st.totalHp > 0))).toBe(true);
        for (let round = 1; round <= 50; round++) {
          expect(r.actions!.filter((a) => a.round === round && !a.extra)).toHaveLength(5);
        }
        expect(r.events.every((e) => e.round <= 50)).toBe(true);
        expect(battleSummary(r).feedback[0]).toContain(first === 0 ? '我方' : '敌方');
        expect(battleSummary(r).feedback[0]).toContain('先手方');
      }
    },
  );

  it('ties give the attacker first move and therefore the timeout loss', () => {
    const r = simulate(durable([1], 100), durable([1], 100), 77);
    expect([r.tactics!.firstSide, r.winner]).toEqual([0, 1]);
  });

  it.each([0, 1])('allows elimination in round 50 when first side is %i', (first) => {
    const a = durable([1], first === 0 ? 200 : 100),
      b = durable([1], first === 1 ? 200 : 100);
    a[0].extraFire = 0;
    b[0].extraFire = 1000;
    b[0].hp = b[0].totalHp = 50;
    const r = simulate(a, b, 66);
    expect(r.rounds).toBe(50);
    expect(r.winner).toBe(0);
    expect(r.endReason).toBe('elimination');
    expect(r.events.at(-1)!.hp).toBe(0);
    expect(r.events.at(-1)!.remaining).toBe(0);
  });

  it('finishes the last extra attack before applying the round cap', () => {
    const a = durable([1], 200),
      b = durable([1], 100);
    a[0].extraFire = 1000;
    b[0].extraFire = 0;
    let checked = false;
    for (let seed = 1; seed <= 50; seed++) {
      const base = simulate(a, b, seed);
      const last = base.actions!.filter((action) => action.side === 0).at(-1)!;
      if (!last.extra || last.round !== 50) continue;
      const target = structuredClone(b);
      target[0].hp = target[0].totalHp = base.events
        .filter((e) => e.side === 0)
        .reduce((n, e) => n + e.damage, 0);
      const r = simulate(a, target, seed);
      expect(r.events.at(-1)!.extra).toBe(true);
      expect(r.rounds).toBe(50);
      expect(r.endReason).toBe('elimination');
      expect(r.winner).toBe(0);
      checked = true;
      break;
    }
    expect(checked).toBe(true);
  });

  it('round-trips new 50-round snapshots and genuine old reports without rewriting history', async () => {
    const s = newGame('round-limit', '回合验收', 1791014400000);
    const r = simulate(durable([1, 3, 6], 100), durable([2, 5], 200), 19);
    r.id = 'new-50';
    r.title = '超时验收';
    s.reports = [
      r,
      structuredClone(legacy22) as unknown as BattleReport,
      ...(structuredClone(legacy) as unknown as BattleReport[]),
    ];
    assertState(s);
    expect((await parseSave(await exportSave(s))).reports).toEqual(s.reports);
    const invalid = structuredClone(s);
    invalid.reports[0].winner = invalid.reports[0].tactics!.firstSide;
    expect(() => assertState(invalid)).toThrow('超时判定');
    invalid.reports[0] = structuredClone(r);
    delete invalid.reports[0].roundLimit;
    expect(() => assertState(invalid)).toThrow('回合上限');
  });
});
