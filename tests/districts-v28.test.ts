import { describe, expect, it } from 'vitest';
import {
  newGame,
  capacity,
  protectedAmount,
  execute,
  advance,
  assertState,
} from '../src/core/engine';
import { protectionBps, protectionLedger } from '../src/core/protection';
import { npcProtected, enableRenewableWorld } from '../src/core/world';
import { stageNames, stageFormation, stageReward, units, researchCost } from '../src/core/content';
import { exportSave, parseSave } from '../src/core/storage';
import { prestigeRequired } from '../src/core/commander';
import type { GameState, Command } from '../src/core/types';
const act = (s: GameState, c: Command) => execute(s, c, s.now, crypto.randomUUID()).state;

describe('v28 warehouse protection', () => {
  it('protects capacity-based reserves with monotonic level growth, including overflow', () => {
    expect(protectionBps(1)).toBe(2000);
    expect(protectionBps(120)).toBe(4000);
    for (let level = 2; level <= 120; level++)
      expect(protectionBps(level)).toBeGreaterThan(protectionBps(level - 1));
    expect(protectionLedger(100, 1000, 1)).toMatchObject({
      limit: 200,
      protectedStock: 100,
      lootable: 0,
    });
    expect(protectionLedger(200, 1000, 1).lootable).toBe(0);
    expect(protectionLedger(201, 1000, 1).lootable).toBe(1);
    expect(protectionLedger(2000, 1000, 1)).toMatchObject({ protectedStock: 200, lootable: 1800 });
    const s = newGame('protection', '保护测试', Date.now());
    expect(protectedAmount(s)).toBe(Math.floor(capacity(s) * 0.2));
    const before = protectedAmount(s);
    s.tech.storage = 10;
    expect(protectedAmount(s)).toBeGreaterThan(before);
  });
  it('raids only exposed stock, returns it once and never touches gold', () => {
    let s = newGame('raid28', '仓库突袭测试', Date.now());
    const site = s.world.find((v) => v.kind === 'npc')!;
    site.guards = Array(6).fill(null);
    for (const r of ['iron', 'oil', 'lead', 'titanium', 'crystal'] as const)
      site.wallet[r] = npcProtected(site, r);
    site.wallet.iron += 17;
    site.wallet.titanium += 23;
    site.wallet.gold = 93;
    const original = { ...site.wallet };
    s = act(s, { type: 'march', targetId: site.id, mission: 'raid' });
    s = advance(s, s.marches[0].dueAt);
    expect(s.marches[0].cargo).toMatchObject({ iron: 17, titanium: 23, gold: 0 });
    expect(s.world.find((v) => v.id === site.id)!.wallet).toEqual({
      ...original,
      iron: original.iron - 17,
      titanium: original.titanium - 23,
    });
    s = advance(s, s.marches[0].dueAt);
    const after = structuredClone(s);
    const repeated = advance(s, s.now);
    expect(repeated.wallet).toEqual(after.wallet);
    expect(repeated.available).toEqual(after.available);
    expect(repeated.expeditionLog).toEqual(after.expeditionLog);
    assertState(s);
  });
  it('preserves old in-flight target protection through save/load; migrates only after return', async () => {
    let s = newGame('legacy28', '旧远征', Date.now());
    const site = s.world.find((v) => v.kind === 'npc')!;
    site.guards = Array(6).fill(null);
    s = act(s, { type: 'march', targetId: site.id, mission: 'raid' });
    delete s.world.find((v) => v.id === site.id)!.protectionVersion;
    const old = npcProtected(s.world.find((v) => v.id === site.id)!);
    s = await parseSave(await exportSave(s));
    enableRenewableWorld(s);
    expect(npcProtected(s.world.find((v) => v.id === site.id)!)).toBe(old);
    s = advance(s, s.marches[0].dueAt);
    s = advance(s, s.marches[0].dueAt);
    enableRenewableWorld(s);
    expect(s.world.find((v) => v.id === site.id)!.protectionVersion).toBe(1);
    expect(npcProtected(s.world.find((v) => v.id === site.id)!)).toBeGreaterThan(old);
  });
});

describe('v28 appended campaign and materials', () => {
  it('keeps legacy stage 112 and opens 80 further stages with no difficulty reset', () => {
    expect(stageNames).toHaveLength(576);
    expect(stageFormation(111).every((v) => v?.count === 160)).toBe(true);
    expect(stageFormation(112).every((v) => v?.count === 161)).toBe(true);
    expect(stageFormation(191).every((v) => v?.count === 285)).toBe(true);
    for (let i = 112; i < stageNames.length; i++) {
      expect(stageFormation(i)[0]!.count).toBeGreaterThan(stageFormation(i - 1)[0]!.count);
      expect(stageReward(i, true).iron).toBe(250 + i * 150);
    }
  });
  it('accepts final-chapter saves and replay snapshots without paying rewards twice', async () => {
    let s = newGame('chapter28', '十二章验收', Date.now());
    s.commander.prestige = prestigeRequired(120);
    s.commander.leadership = 120;
    s.available.tank_t7 = s.createdUnits.tank_t7 = 3690;
    s.commander.attackSkill = 120;
    s.formation = Array.from({ length: 6 }, () => ({ unitId: 'tank_t7', count: 615 }));
    s.cleared = Array.from({ length: 191 }, (_, i) => i);
    s = act(s, { type: 'battle', stage: 191 });
    expect(s.cleared).toHaveLength(192);
    expect(s.reports[0].target).toMatchObject({ stage: 191 });
    const saved = await parseSave(await exportSave(s));
    expect(saved.wallet).toEqual(s.wallet);
    expect(saved.reports).toEqual(s.reports);
    expect(saved.cleared).toEqual(s.cleared);
    assertState(saved);
  });
  it('keeps v28 vehicle titanium recipes and includes the later research-only increase', () => {
    const previous = {
      tank: [7830, 4385, 4072, 5429],
      tank_destroyer: [3573, 6616, 3837, 4675],
      spg: [4646, 4165, 8010, 5607],
      rocket: [6843, 6570, 6296, 6022],
    };
    for (const [cls, c] of Object.entries(previous)) {
      expect(units[cls + '_t7'].cost).toMatchObject({
        iron: c[0],
        oil: c[1],
        lead: c[2],
        titanium: Math.ceil(c[3] * 1.5),
      });
    }
    for (let level = 5; level < 120; level++)
      expect(researchCost(level).titanium).toBe(
        Math.ceil(Math.ceil(Math.ceil(32 * 1.2 * (level + 1) ** 2.65) * 1.5) * 1.5),
      );
    expect(units.tank_t1.cost.titanium).toBe(0);
  });
});
