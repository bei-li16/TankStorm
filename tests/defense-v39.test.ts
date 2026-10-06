import { describe, expect, it } from 'vitest';
import { army, simulate, BATTLE_RULESET } from '../src/core/battle';
import { units, unitList } from '../src/core/content';
import { defenseStats } from '../src/core/combat_research';
import { newGame, execute, assertState } from '../src/core/engine';
import { unitAttributes, attributeSheet } from '../src/core/attributes';
import { exportSave, parseSave } from '../src/core/storage';
import type { ArmyStack } from '../src/core/types';

const target = (count = 1): ArmyStack => ({
  ...army([{ unitId: 'tank_destroyer_t1', count }])[0],
  attack: 1,
  hp: 1000000,
  totalHp: 1000000 * count,
  defense: 20,
  damageReduction: 0,
  crit: -10000,
  accuracy: 10000,
});
const shooter = (): ArmyStack => ({ ...target(), attack: 100, defense: 0 });
const hit = (a: ArmyStack, b: ArmyStack, seed = 1) => simulate([a], [b], seed).events[0];

describe('v39 subtractive vehicle defense', () => {
  it('gives all 28 models tier-scaled inherent defense before research', () => {
    expect(unitList).toHaveLength(28);
    for (let tier = 1; tier <= 7; tier++) {
      const peers = ['tank', 'tank_destroyer', 'spg', 'rocket'].map((c) => units[`${c}_t${tier}`]);
      expect(peers.map((u) => u.defense)).toEqual(
        [0.24, 0.16, 0.12, 0.1].map((r) => Math.round(peers[0].attack * r)),
      );
      for (const u of peers) {
        const st = army([{ unitId: u.unitId, count: 100 }])[0];
        expect(defenseStats(st)).toEqual({ base: u.defense, flat: u.defense, rating: 0 });
        if (tier > 1)
          expect(u.defense).toBeGreaterThanOrEqual(units[`${u.classId}_t${tier - 1}`].defense);
      }
    }
    expect(
      ['tank', 'tank_destroyer', 'spg', 'rocket'].map((c) => units[c + '_t7'].defense),
    ).toEqual([92, 61, 46, 38]);
  });
  it('subtracts current target count before critical damage, reduction and single final rounding', () => {
    const a = { ...shooter(), attack: 101 },
      b = { ...target(2), damageReduction: 3000 };
    expect(hit(a, b).damage).toBe(Math.floor(((101 - 40) * 10000) / 13000));
    let seed = 1;
    while (!hit({ ...a, crit: 10000, critMultiplierBps: 21000 }, b, seed).critical) seed++;
    expect(hit({ ...a, crit: 10000, critMultiplierBps: 21000 }, b, seed).damage).toBe(
      Math.floor(((101 - 40) * 2.1 * 10000) / 13000),
    );
    expect(hit(a, { ...b, totalHp: b.hp + 1 }).damage).toBe(hit(a, b).damage);
    expect(hit(a, { ...b, totalHp: b.hp }).damage).toBe(Math.floor(((101 - 20) * 10000) / 13000));
  });
  it('applies half attack before full defense for immediate follow-up', () => {
    let report;
    for (let seed = 1; seed <= 100; seed++) {
      report = simulate([shooter()], [target()], seed, 'training', [
        { initiative: 200, extraFire: 1000 },
        { initiative: 100, extraFire: 0 },
      ]);
      if (report.actions![1]?.extra) break;
    }
    expect(report!.events[0].damage).toBe(80);
    expect(report!.events[1].extra).toBe(true);
    expect(report!.events[1].damage).toBe(30);
    expect(report!.events[1].damage).not.toBe(report!.events[0].damage / 2);
  });
  it('allows zero penetrating damage, including criticals, and retains stalemate handling', () => {
    const b = { ...target(5), attack: 1 };
    expect(hit({ ...shooter(), crit: 10000 }, b).damage).toBe(0);
    expect(hit(shooter(), b).miss).toBe(false);
    const r = simulate([{ ...shooter(), defense: 100 }], [b], 1);
    expect(r.events.every((e) => e.damage === 0)).toBe(true);
    expect(r.rounds).toBe(50);
    expect(r.winner).toBe(1);
    expect(r.endReason).toBe('round-limit');
  });
  it('deducts each group independently across columns and leaves rocket empty slots untouched', () => {
    const a = { ...shooter(), classId: 'tank' as const };
    const enemies = [
      { ...target(), slot: 1 },
      { ...target(2), slot: 2 },
      { ...target(3), slot: 6 },
    ];
    const events = simulate([a], enemies, 1).events.filter((e) => e.action === 1);
    expect(events.map((e) => [e.to, e.damage])).toEqual([
      [1, 84],
      [2, 63],
      [6, 42],
    ]);
    const rockets = simulate(
      [{ ...shooter(), classId: 'rocket' }],
      [{ ...target(), classId: 'rocket' }],
      1,
    ).events.filter((e) => e.action === 1);
    expect(rockets).toHaveLength(6);
    expect(rockets[0].damage).toBe(72);
    expect(rockets.slice(1).every((e) => e.ground && e.damage === 0)).toBe(true);
  });
  it('preserves old reduction ratings without treating them as huge vehicle defenses', () => {
    const old = { ...target(), defense: 3000 };
    delete old.baseDefense;
    delete old.damageReduction;
    expect(defenseStats(old)).toEqual({ base: 0, flat: 0, rating: 3000 });
    expect(hit(shooter(), old).damage).toBe(Math.floor((100 * 10000) / 13000));
  });
  it('keeps equal-tier, equal-count attacks viable across all classes and research growth', () => {
    for (const level of [0, 30, 120]) {
      const s = newGame('matrix', '数值校验', 1791158400000);
      for (const id of Object.keys(s.tech)) s.tech[id as keyof typeof s.tech] = level;
      for (let tier = 1; tier <= 7; tier++)
        for (const a of unitList.filter((u) => u.tier === tier))
          for (const b of unitList.filter((u) => u.tier === tier)) {
            const from = {
              ...army([{ unitId: a.unitId, count: 100 }], s.tech)[0],
              accuracy: 10000,
              crit: -10000,
            };
            const to = army([{ unitId: b.unitId, count: 100 }], s.tech)[0];
            const e = hit(from, to);
            expect(e.damage, `${a.unitId} vs ${b.unitId} research ${level}`).toBeGreaterThan(0);
            expect(e.damage).toBeLessThan(to.totalHp);
          }
    }
  });
  it('separates defense and reduction in research, power, reports and saved snapshots', async () => {
    let s = newGame('v39', '防御校验', 1791158400000);
    s.tech.armorPlating = 30;
    s.tech.defense = 30;
    const st = army([{ unitId: 'tank_t7', count: 1 }], s.tech)[0];
    expect(st.defense).toBe(147);
    expect(st.baseDefense).toBe(92);
    expect(st.damageReduction).toBe(750);
    const sheet = unitAttributes(s, 'tank_t7');
    expect(sheet.rows.find((r) => r.id === 'defense')).toMatchObject({
      base: 92,
      value: 147,
      percent: false,
    });
    expect(sheet.rows.find((r) => r.id === 'damageReduction')!.value).toBeCloseTo(
      (100 * 750) / 10750,
    );
    for (const row of Object.values(attributeSheet(s, s.formation).byUnit)) {
      expect(row.rows).toHaveLength(11);
      expect(row.rows.reduce((n, r) => n + r.delta, row.base)).toBe(row.power);
    }
    s = execute(s, { type: 'battle', stage: 0, training: true }, s.now, 'defense-report').state;
    expect(s.reports[0].ruleset).toBe(BATTLE_RULESET);
    assertState(s);
    expect((await parseSave(await exportSave(s))).reports).toEqual(s.reports);
  });
});
