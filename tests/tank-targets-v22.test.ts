import { describe, expect, it } from 'vitest';
import { army, simulate, attackSlots, BATTLE_RULESET } from '../src/core/battle';
import { newGame, assertState, execute } from '../src/core/engine';
import { exportSave, parseSave } from '../src/core/storage';
import legacy from '../native/tests/legacy-combat-v020.json';
import type { BattleReport, Formation } from '../src/core/types';

const formation = (slots: number[], tier = 7): Formation =>
  Array.from({ length: 6 }, (_, i) =>
    slots.includes(i + 1) ? { unitId: `tank_t${tier}`, count: 20 } : null,
  );

describe('v22 tanks select one survivor per occupied column', () => {
  it.each([
    [
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3],
    ],
    [
      [1, 3, 5],
      [1, 5, 3],
    ],
    [
      [1, 3],
      [1, 3],
    ],
    [
      [2, 4, 6],
      [4, 2, 6],
    ],
    [[2, 5], [2]],
    [[5], [5]],
    [
      [4, 5, 6],
      [4, 5, 6],
    ],
  ])('enemy slots %j are hit as %j in all tiers and on both sides', (slots, targets) => {
    for (let tier = 1; tier <= 7; tier++)
      for (const side of [0, 1]) {
        const source = army(formation([6], tier));
        source[0].initiative = 1000;
        const enemy = army(formation(slots)).map((st) => ({
          ...st,
          hp: 1e6,
          totalHp: 2e7,
          attack: 1,
        }));
        const r = simulate(side ? enemy : source, side ? source : enemy, 2266);
        const first = r.events.filter((e) => e.action === 1);
        expect(first.map((e) => e.to)).toEqual(targets);
        expect(first.map((e) => e.shot)).toEqual(targets.map((_, i) => i + 1));
        expect(first.every((e) => e.shots === targets.length && e.side === side)).toBe(true);
        expect(r.events.some((e) => e.ground)).toBe(false);
      }
  });
  it('dead fronts expose their rear but dead columns do not receive a launch', () => {
    const enemy = army(formation([1, 2, 3, 4, 5, 6]));
    for (const st of enemy) if ([1, 2, 5].includes(st.slot)) st.totalHp = 0;
    expect(attackSlots('tank', enemy)).toEqual([4, 3]);
    for (const st of enemy) st.totalHp = 0;
    expect(attackSlots('tank', enemy)).toEqual([]);
  });
  it('killing a front does not add a rear shot; a triggered combo retargets the exposed rear', () => {
    const source = army(formation([1]));
    source[0].attack = 1e6;
    source[0].accuracy = 10000;
    source[0].initiative = source[0].extraFire = 1000;
    const enemy = army(formation([1, 2, 3, 4, 5, 6]));
    for (const st of enemy) st.attack = 1;
    let found = false;
    for (let seed = 1; seed <= 64; seed++) {
      const r = simulate(source, enemy, seed);
      expect(r.events.filter((e) => e.action === 1).map((e) => e.to)).toEqual([1, 2, 3]);
      if (!r.actions![1]?.extra) continue;
      expect(r.events.filter((e) => e.action === 2).map((e) => e.to)).toEqual([4, 5, 6]);
      expect(r.actions![1].exchange).toBe(r.actions![0].exchange);
      expect(r.events).toHaveLength(6);
      found = true;
      break;
    }
    expect(found).toBe(true);
  });
  it('round-trips genuine v20 ground-fire reports unchanged alongside new reports', async () => {
    let s = newGame('legacy-tank', '旧记录', 1791014400000);
    s.reports = structuredClone(legacy) as unknown as BattleReport[];
    expect(s.reports[0].events.some((e) => e.ground)).toBe(true);
    assertState(s);
    const historical = structuredClone(s.reports);
    s = execute(s, { type: 'battle', stage: 0, training: true }, s.now, 'new').state;
    expect(s.reports[0].ruleset).toBe(BATTLE_RULESET);
    expect(s.reports.slice(1)).toEqual(historical);
    const restored = await parseSave(await exportSave(s));
    expect(restored.reports).toEqual(s.reports);
    const counterfeit = structuredClone(restored);
    counterfeit.reports[1].ruleset = BATTLE_RULESET;
    expect(() => assertState(counterfeit)).toThrow('空位射击');
  });
});
