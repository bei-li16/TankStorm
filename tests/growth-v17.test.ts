import { describe, it, expect } from 'vitest';
import {
  newGame,
  execute,
  advance,
  rate,
  capacity,
  commanderLevel,
  facilityUpgradeQuote,
  upgradeBlock,
  assertState,
} from '../src/core/engine';
import {
  costCurve,
  rateCurve,
  durationCurve,
  storageCurve,
  upgradeCost,
  researchCost,
  unitList,
} from '../src/core/content';
import { researchTree, materialCost, researchRequirements } from '../src/core/research';
import { MAX_LEVEL, materialSavingBps } from '../src/core/growth';
import { compactAmount } from '../src/core/format';
import { productionQuote } from '../src/core/arsenal';
import { buildingDuration, researchDuration, loadBonus } from '../src/core/vip';
import { exportSave, parseSave } from '../src/core/storage';
import type { GameState, Command } from '../src/core/types';
let seq = 0;
const act = (s: GameState, c: Command) => execute(s, c, s.now, 'growth-' + ++seq).state;
function state(level = 120) {
  const s = newGame('growth', '一百二十级验收', 1790985600000, 17017);
  for (const key of Object.keys(s.buildings)) s.buildings[key as keyof typeof s.buildings] = level;
  for (const r of Object.keys(s.wallet)) s.wallet[r as keyof typeof s.wallet] = 1e11;
  for (const t of researchTree) s.tech[t.id] = level;
  s.industry = { version: 1, factory2: level, refit: level };
  s.commander.skillPoints = 500;
  return s;
}
describe('120-level growth', () => {
  it('redesigns the complete 1–120 curves monotonically with new anchors', () => {
    expect(MAX_LEVEL).toBe(120);
    expect([costCurve[19], durationCurve[19], rateCurve[20], storageCurve[20]]).toEqual([
      2754, 9081681, 570677, 4005291,
    ]);
    for (const curve of [costCurve, durationCurve, rateCurve, storageCurve]) {
      expect(curve).toHaveLength(121);
      expect(curve.every(Number.isSafeInteger)).toBe(true);
      for (let level = 2; level <= 120; level++)
        expect(curve[level]).toBeGreaterThan(curve[level - 1]);
    }
  });
  it('all post-20 upgrade costs fit previous-level storage without discounted materials', () => {
    for (let level = 20; level < 120; level++) {
      const s = state(level);
      for (const t of researchTree) s.tech[t.id] = 0;
      expect(Math.max(...Object.values(upgradeCost('hq', level)))).toBeLessThanOrEqual(capacity(s));
      for (const r of ['iron', 'oil', 'lead', 'titanium', 'crystal'] as const)
        expect(rate(s, r)).toBeGreaterThan(0);
      expect(capacity(s) / rate(s, 'iron')).toBeGreaterThan(4);
    }
  });
  it('keeps full-tech final upgrades in days and enough storage for the build cycle', () => {
    const s = state();
    s.buildings.hq = 119;
    expect(buildingDuration(s, 'hq')).toBeGreaterThanOrEqual(12 * 3600000);
    expect(buildingDuration(s, 'hq')).toBeLessThanOrEqual(120 * 3600000);
    expect(capacity(s) / rate(s, 'iron')).toBeGreaterThan(buildingDuration(s, 'hq') / 3600000);
    s.tech.attack = 119;
    expect(researchDuration(s, 'attack')).toBeGreaterThanOrEqual(12 * 3600000);
    expect(researchDuration(s, 'attack')).toBeLessThanOrEqual(120 * 3600000);
  });
  it('upgrades HQ through every level 20 to 120 with real settlement and stops at the cap', () => {
    let s = state(20);
    for (let level = 20; level < 120; level++) {
      s = act(s, { type: 'upgrade', building: 'hq' });
      s = advance(s, s.jobs.building!.dueAt);
      expect(s.buildings.hq).toBe(level + 1);
    }
    expect(upgradeBlock(s, 'hq')).toContain('最高');
    const before = structuredClone(s);
    expect(() => act(s, { type: 'upgrade', building: 'hq' })).toThrow('最高');
    expect(s).toEqual(before);
    assertState(s);
  }, 20000);
  it('finishes the last level of every research node, preserving dependencies and rejecting 121', () => {
    let s = state();
    for (const node of researchTree) s.tech[node.id] = 119;
    for (const node of researchTree) {
      expect(researchRequirements(s, node.id).block).toBe('');
      s = act(s, { type: 'research', tech: node.id });
      s = advance(s, s.jobs.research!.dueAt);
      expect(s.tech[node.id]).toBe(120);
      expect(() => act(s, { type: 'research', tech: node.id })).toThrow('最高');
    }
    expect(researchRequirements(s, 'attack').lab).toBe(120);
    assertState(s);
  }, 15000);
  it('uses completed HQ and lab levels for new high-level requirements', () => {
    let s = state(20);
    expect(() => act(s, { type: 'research', tech: 'attack' })).toThrow('科研中心 21');
    s = act(s, { type: 'upgrade', building: 'hq' });
    expect(() => act(s, { type: 'upgrade', building: 'lab' })).toThrow('指挥中心');
    s = advance(s, s.jobs.building!.dueAt);
    s = act(s, { type: 'upgrade', building: 'lab' });
    expect(() => act(s, { type: 'research', tech: 'attack' })).toThrow('科研中心 21');
    s = advance(s, s.jobs.building!.dueAt);
    expect(researchRequirements(s, 'attack').block).toBe('');
  });
  it('caps material discounts at sixty percent and never creates negative costs', () => {
    expect([materialSavingBps(20), materialSavingBps(21), materialSavingBps(120)]).toEqual([
      1000, 1050, 6000,
    ]);
    for (let level = 0; level <= 120; level++) {
      const s = state();
      s.tech.materials = level;
      expect(materialCost(s, { iron: 1, gold: 19 })).toEqual({ iron: 1, gold: 19 });
      for (const u of unitList) {
        for (const n of Object.values(productionQuote(s, u.unitId).unitCost))
          expect(n).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it('gives each factory independent speed and preserves prepaid job times and refunds', () => {
    let s = state(60);
    s.arsenal!.cores.tank_core7 = 2;
    const prior = productionQuote(s, 'tank_t7');
    s = act(s, { type: 'produce', unitId: 'tank_t7', count: 2 });
    const booked = structuredClone(s.jobs.production!);
    s.buildings.hq = s.buildings.factory = 120;
    s.industry!.factory2 = 120;
    expect(productionQuote(s, 'tank_t7').duration).toBeLessThan(prior.duration);
    expect(productionQuote(s, 'tank_t7', 'produce', 'factory2').duration).toBe(
      productionQuote(s, 'tank_t7').duration,
    );
    expect(productionQuote(s, 'tank_t7', 'refit').duration).toBe(
      productionQuote(state(60), 'tank_t7', 'refit').duration,
    );
    expect(s.jobs.production).toEqual(booked);
    const iron = s.wallet.iron;
    s = act(s, { type: 'cancel', kind: 'production' });
    expect(s.wallet.iron).toBe(iron + booked.unitCost.iron! * 2);
    expect(s.arsenal!.cores.tank_core7).toBe(2);
  }, 10000);
  it('round-trips level 120, high cargo multipliers and balances without precision loss', async () => {
    let s = state();
    s.tech.march = 119;
    s = act(s, {
      type: 'march',
      targetId: s.world[0].id,
      mission: s.world[0].kind === 'mine' ? 'gather' : 'raid',
    });
    expect(loadBonus(s)).toBe(350000);
    const parsed = await parseSave(await exportSave(s));
    expect(parsed).toEqual(s);
    const invalid = structuredClone(s);
    invalid.buildings.hq = 121;
    expect(() => assertState(invalid)).toThrow();
    await expect(exportSave(invalid)).rejects.toThrow();
  });
  it('commander skills and experience reach 120 and repeatable skill points require HQ21', () => {
    let s = state(20);
    const points = s.commander.skillPoints;
    s = act(s, { type: 'daily' });
    expect(s.commander.skillPoints).toBe(points);
    s.buildings.hq = 21;
    s.lastDaily = -1;
    s = act(s, { type: 'daily' });
    expect(s.commander.skillPoints).toBe(points + 1);
    expect(() => act(s, { type: 'daily' })).toThrow('领取');
    s.commander.attackSkill = s.commander.initiativeSkill = s.commander.extraFireSkill = 119;
    for (const type of ['skill', 'initiativeSkill', 'extraFireSkill'] as const) {
      s = act(s, { type });
      expect(() => act(s, { type })).toThrow(/最高|120/);
    }
    s.commander.xp = 50 * 119 ** 2;
    expect(commanderLevel(s)).toBe(120);
  });
  it('has empty costs and no false completion estimate at maximum facilities', () => {
    const s = state();
    for (const b of ['hq', 'lab', 'factory'] as const) {
      expect(upgradeCost(b, 120)).toEqual({});
      expect(buildingDuration(s, b)).toBe(0);
    }
    for (const f of ['factory', 'factory2', 'refit'] as const) {
      const q = facilityUpgradeQuote(s, f);
      expect(q.unitCost).toEqual({});
      expect(q.duration).toBe(0);
      expect(q.block).toContain('最高');
    }
    expect(researchCost(120)).toEqual({});
    expect(researchDuration(s, 'attack')).toBe(0);
  });
});
describe('compact resource display without rounding balances upwards', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1K'],
    [1001, '1K'],
    [1010, '1.01K'],
    [12345, '12.34K'],
    [999999, '999.99K'],
    [1000000, '1M'],
    [123456789, '123.45M'],
    [1e9, '1G'],
    [999999999999, '999.99G'],
    [1e12, '1T'],
    [-1234567, '-1.23M'],
  ] as const)('%i -> %s', (n, text) => expect(compactAmount(n)).toBe(text));
  it('rejects invalid values instead of disguising them as zero', () => {
    expect(() => compactAmount(NaN)).toThrow();
    expect(() => compactAmount(1.5)).toThrow();
  });
});
