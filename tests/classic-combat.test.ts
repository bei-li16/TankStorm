import { describe, expect, it } from 'vitest';
import { army, attackTargets, BATTLE_RULESET, simulate } from '../src/core/battle';
import { rules } from '../src/core/content';
import type { Command, Formation, GameState } from '../src/core/types';
import { newGame, assertState, execute } from '../src/core/engine';

let seq = 0;
const command = (s: GameState, c: Command) => execute(s, c, s.now, `v07-${++seq}`).state;
const classes = ['tank', 'tank_destroyer', 'spg', 'rocket'] as const;
const full = () => army(Array.from({ length: 6 }, () => ({ unitId: 'tank_t1', count: 100 })));
describe('classic class combat restored from official attack-pattern guide', () => {
  it.each(classes)(
    '%s selects the classic shape for all seven generations and all firing slots',
    (cls) => {
      for (let tier = 1; tier <= 7; tier++)
        for (let slot = 1; slot <= 6; slot++) {
          const f: Formation = Array.from({ length: 6 }, (_, i) =>
            i + 1 === slot ? { unitId: `${cls}_t${tier}`, count: 1 } : null,
          );
          const defenders = full().map((s) => ({ ...s, attack: 0 }));
          const report = simulate(army(f), defenders, 42);
          const column = ((slot - 1) % 3) + 1;
          const expected = {
            tank: [1, 2, 3],
            tank_destroyer: [column],
            spg: [column, column + 3],
            rocket: [1, 2, 3, 4, 5, 6],
          };
          expect(
            report.events.filter((e) => e.round === 1 && e.side === 0 && !e.extra).map((e) => e.to),
          ).toEqual(expected[cls]);
        }
    },
  );
  it('handles gaps, dead stacks, rear-only rows and empty armies without attacking wrecks', () => {
    const defenders = full();
    defenders[0].totalHp = 0;
    defenders[2].totalHp = 0;
    expect(attackTargets('tank', defenders).map((s) => s.slot)).toEqual([4, 2, 6]);
    expect(attackTargets('spg', defenders).map((s) => s.slot)).toEqual([4]);
    defenders[1].totalHp = 0;
    expect(attackTargets('tank', defenders).map((s) => s.slot)).toEqual([4, 5, 6]);
    expect(attackTargets('tank_destroyer', defenders).map((s) => s.slot)).toEqual([4]);
    expect(attackTargets('spg', defenders).map((s) => s.slot)).toEqual([4]);
    for (const cls of classes) expect(attackTargets(cls, [])).toEqual([]);
  });
  it('commits a volley target set before casualties so a kill does not spill into the rear', () => {
    const attackers = army([{ unitId: 'tank_t7', count: 1000 }]);
    const report = simulate(attackers, full(), 1);
    expect(
      report.events.filter((e) => e.round === 1 && e.side === 0 && !e.extra).map((e) => e.to),
    ).toEqual([1, 2, 3]);
    expect(report.events.find((e) => e.side === 0 && e.round === 2)?.to).toBe(4);
  });
  it('applies all sixteen documented/neutral class multipliers without a hidden rocket area discount', () => {
    const matrix = [
      [10000, 10000, 10000, 12500],
      [12500, 10000, 8000, 10000],
      [8000, 12500, 10000, 10000],
      [10000, 8000, 12500, 10000],
    ];
    for (const [i, source] of classes.entries())
      for (const [j, target] of classes.entries()) {
        const a = army([{ unitId: source + '_t1', count: 1 }])[0];
        const d = army([{ unitId: target + '_t1', count: 100 }])[0];
        a.attack = 10000;
        a.accuracy = 10000;
        a.crit = -10000;
        d.defense = 0; // Isolate the matchup multiplier; subtractive defense has separate tests.
        const event = simulate([a], [d], 1).events[0];
        const aura = source === 'tank' ? 1.05 : 1;
        const reduction =
          (source === 'tank_destroyer' && target === 'spg') ||
          (source === 'rocket' && target === 'rocket')
            ? 0.9
            : 1;
        expect(event.damage, source + ' -> ' + target).toBe(
          Math.round(matrix[i][j] * aura * reduction),
        );
      }
    expect(rules.battle.classProfiles.rocket.patternMultiplierBps).toBe(10000);
  });
  it('preserves historical event snapshots and labels only newly calculated reports with the new rules', () => {
    let state = newGame('compat', '兼容测试', 1_790_870_400_000);
    state = command(state, { type: 'battle', stage: 0, training: true });
    state.reports[0].ruleset = 'classic-prototype-v0.1';
    const old = structuredClone(state.reports[0]);
    state = command(state, { type: 'battle', stage: 0, training: true });
    assertState(state);
    expect(state.reports[0].ruleset).toBe(BATTLE_RULESET);
    expect(state.reports[1]).toEqual(old);
  });
});
