import { describe, expect, it } from 'vitest';
import { newGame, execute, advance, assertState } from '../src/core/engine';
import { unitList, vehicleUnlockLevels } from '../src/core/content';
import { dungeonBlock, dungeons, productionQuote } from '../src/core/arsenal';
import { exportSave, parseSave } from '../src/core/storage';
import { progression } from '../src/core/planning';
import { queueView } from '../src/core/vip';
import type { Command, GameState, ProductionFacility } from '../src/core/types';

let seq = 0;
const act = (s: GameState, c: Command) => execute(s, c, s.now, `unlock-${++seq}`).state;
function ready() {
  const s = newGame('unlocks', '解锁验收', 1791000000000);
  s.buildings.hq = s.buildings.factory = 60;
  s.industry = { version: 1, factory2: 60, refit: 60 };
  for (const r of Object.keys(s.wallet)) s.wallet[r as keyof typeof s.wallet] = 1e10;
  for (const u of unitList) {
    s.available[u.unitId] += 10;
    s.createdUnits[u.unitId] += 10;
    if (u.tier >= 6) s.arsenal!.cores[`${u.classId}_core${u.tier}`] = 100;
  }
  return s;
}
function level(s: GameState, f: ProductionFacility, n: number) {
  if (f === 'factory') s.buildings.factory = n;
  else s.industry![f] = n;
}

describe('v21 industrial unlocks and save continuity', () => {
  it('uses one increasing curve in all four families', () => {
    expect(Object.values(vehicleUnlockLevels)).toEqual([1, 6, 14, 24, 36, 48, 60]);
    for (const u of unitList) expect(u.unlock.factoryLevel).toBe(vehicleUnlockLevels[u.tier]);
  });
  it.each(unitList.map((u) => [u.unitId, u.tier, u.unlock.factoryLevel] as const))(
    '%s checks the exact boundary independently on both plants and refit',
    (id, tier, gate) => {
      for (const facility of ['factory', 'factory2', 'refit'] as const) {
        if (facility === 'refit' && tier === 1) continue;
        const mode = facility === 'refit' ? 'refit' : 'produce';
        const s = ready();
        if (gate > 1 || facility !== 'factory') {
          level(s, facility, gate - 1);
          const before = structuredClone(s);
          expect(productionQuote(s, id, mode, facility).max).toBe(0);
          expect(() => act(s, { type: mode, unitId: id, count: 1, facility })).toThrow();
          expect(s).toEqual(before); // No deductions or source/core reservations.
        }
        level(s, facility, gate);
        expect(productionQuote(s, id, mode, facility).block).toBe('');
        const result = act(s, { type: mode, unitId: id, count: 1, facility });
        expect(queueView(result).some((j) => j.target === id)).toBe(true);
        assertState(result);
      }
    },
  );
  it('refit requires its own level and either manufacturing plant, never the sum of levels', () => {
    const s = ready();
    s.buildings.factory = s.industry!.factory2 = 59;
    expect(productionQuote(s, 'tank_t7', 'refit').block).toContain('当前最高 59');
    s.industry!.factory2 = 60;
    expect(productionQuote(s, 'tank_t7', 'refit').block).toBe('');
    expect(productionQuote(s, 'tank_t7').block).toContain('当前 59');
    s.industry!.refit = 59;
    expect(productionQuote(s, 'tank_t7', 'refit').block).toContain('改装工厂 60');
  });
  it.each(['factory', 'factory2', 'refit'] as const)(
    '%s unlocks VII immediately on real 59→60 upgrade completion',
    (facility) => {
      let s = ready();
      level(s, facility, 59);
      const mode = facility === 'refit' ? 'refit' : 'produce';
      expect(productionQuote(s, 'tank_t7', mode, facility).block).not.toBe('');
      s = act(
        s,
        facility === 'factory'
          ? { type: 'upgrade', building: facility }
          : { type: 'facilityUpgrade', facility },
      );
      const due = s.jobs.building!.dueAt;
      expect(productionQuote(advance(s, due - 1), 'tank_t7', mode, facility).block).not.toBe('');
      s = advance(s, due);
      expect(productionQuote(s, 'tank_t7', mode, facility).block).toBe('');
      assertState(act(s, { type: mode, unitId: 'tank_t7', count: 1, facility }));
    },
  );
  it('keeps paid active/backlog orders, existing vehicles and repair below the new gate', async () => {
    let s = ready();
    s.vip = { version: 1, paidGold: 40, lastDaily: -1 };
    for (const facility of ['factory', 'factory2', 'refit'] as const)
      for (let i = 0; i < 2; i++)
        s = act(s, {
          type: facility === 'refit' ? 'refit' : 'produce',
          unitId: 'tank_t7',
          count: 2,
          facility,
        });
    // A valid prepaid snapshot from the former unlock era; jobs carry their own costs/time.
    s.buildings.factory = s.industry!.factory2 = s.industry!.refit = 20;
    const saved = await parseSave(await exportSave(s));
    expect(saved).toEqual(s);
    const stock = saved.available.tank_t7;
    const reserved = saved.available.tank_t6;
    const cores = saved.arsenal!.cores.tank_core7;
    expect(productionQuote(saved, 'tank_t7').block).toContain('60');
    const completed = advance(saved, saved.now + 3 * 86400000);
    expect(completed.available.tank_t7).toBe(stock + 12);
    expect(completed.available.tank_t6).toBe(reserved);
    expect(completed.arsenal!.cores.tank_core7).toBe(cores);
    expect(queueView(completed)).toHaveLength(0);
    completed.available.tank_t7 -= 1;
    completed.damaged.tank_t7 += 1;
    expect(productionQuote(completed, 'tank_t7', 'repair').block).toBe('');
    assertState(act(completed, { type: 'repair', unitId: 'tank_t7', count: 1 }));
  });
  it('keeps core supply gates aligned and preserves old cleared stages without unlocking new ones', () => {
    const s = ready();
    expect(dungeons.filter((d) => d.index % 16 === 0).map((d) => d.factoryLevel)).toEqual([
      36, 48, 60, 80, 100,
    ]);
    for (const d of dungeons) {
      s.arsenal!.cleared = dungeons.slice(0, d.index).map((v) => v.id);
      s.buildings.factory = s.industry!.factory2 = d.factoryLevel - 1;
      expect(dungeonBlock(s, d)).toContain(String(d.factoryLevel));
      s.industry!.factory2 = d.factoryLevel;
      expect(dungeonBlock(s, d)).toBe('');
    }
    s.buildings.factory = s.industry!.factory2 = 20;
    s.arsenal!.cleared = ['core-0'];
    expect(dungeonBlock(s, dungeons[0])).toBe('');
    expect(dungeonBlock(s, dungeons[1])).toContain('36');
    expect(progression(s).cards.find((c) => c.id === 'factory')).toMatchObject({
      current: 20,
      total: 60,
    });
  });
});
