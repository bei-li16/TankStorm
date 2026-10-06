import { describe, it, expect } from 'vitest';
import { advance, assertState, execute, newGame, usableFormation } from '../src/core/engine';
import { coreList, dungeons, dungeonBlock, repairAllQuote } from '../src/core/arsenal';
import { attributeSheet, unitAttributes } from '../src/core/attributes';
import { army } from '../src/core/battle';
import { armyPower, tierPower } from '../src/core/power';
import { coreBudget } from '../src/core/planning';
import { allJobs } from '../src/core/vip';
import { unitList } from '../src/core/content';
import { exportSave, parseSave } from '../src/core/storage';
import type { Command, GameState } from '../src/core/types';

let serial = 0;
const act = (s: GameState, c: Command) => execute(s, c, s.now, `v15-${++serial}`).state;
function fixture() {
  const s = newGame('v15-isolated', '后勤验收', 1700000000000, 3719);
  s.buildings.hq = s.buildings.factory = 60;
  s.industry = { version: 1, factory2: 60, refit: 60 };
  s.commander.leadership = 120;
  s.commander.prestige = 566440;
  for (const k of Object.keys(s.wallet)) s.wallet[k as keyof typeof s.wallet] = 1000000;
  s.available.tank_t7 = s.createdUnits.tank_t7 = 10000;
  s.formation = Array.from({ length: 6 }, () => ({ unitId: 'tank_t7', count: 615 }));
  return s;
}
function damage(s: GameState, id: string, n: number) {
  s.damaged[id] += n;
  s.createdUnits[id] += n;
}
describe('batch repair compatibility after v0.26', () => {
  it('repairs mixed pending and prepaid remaining units once, preserving other queues and losses', async () => {
    let s = fixture();
    damage(s, 'tank_t1', 7);
    damage(s, 'spg_t7', 6);
    s.destroyedUnits.tank_t1 = 2;
    s.createdUnits.tank_t1 += 2;
    s = act(s, { type: 'produce', unitId: 'tank_t1', count: 100 });
    s = act(s, { type: 'repair', unitId: 'tank_t1', count: 5 });
    s = advance(s, s.jobs.repair!.dueAt);
    const before = structuredClone(s),
      q = repairAllQuote(s);
    expect(q.count).toBe(8);
    expect(q.prepaid).toBe(4);
    const command = { type: 'repairAll' as const, quote: q.token };
    s = execute(s, command, s.now, 'instant-recovery').state;
    expect(s.wallet.crystal).toBe(before.wallet.crystal - q.cost.crystal!);
    expect(s.available.tank_t1).toBe(before.available.tank_t1);
    expect(s.available.spg_t7).toBe(0);
    expect(s.createdUnits).toEqual(before.createdUnits);
    expect(s.destroyedUnits).toEqual(before.destroyedUnits);
    expect(s.jobs.production).toEqual(before.jobs.production);
    expect(allJobs(s).filter((j) => j.kind === 'repair')).toHaveLength(3);
    expect(s.now).toBe(before.now);
    expect(execute(s, command, s.now, 'instant-recovery').state).toBe(s);
    const loaded = await parseSave(await exportSave(s));
    expect(loaded).toEqual(s);
    expect(execute(loaded, command, loaded.now, 'instant-recovery').state).toBe(loaded);
    const later = advance(s, s.now + 86400000);
    expect(later.available.tank_t1).toBe(
      s.available.tank_t1 + 6 + 100 - before.jobs.production!.completed,
    );
    expect(later.available.spg_t7).toBe(6);
    assertState(later);
  });
  it('never repeats prepaid material charges even when no new material is available', () => {
    let s = fixture();
    damage(s, 'tank_t7', 3);
    s = act(s, { type: 'repair', unitId: 'tank_t7', count: 3 });
    s.wallet.crystal = 0;
    const q = repairAllQuote(s);
    expect(q.cost.crystal ?? 0).toBe(0);
    expect(q.shortage).toEqual([]);
    expect(q.count).toBe(0);
    expect(q.prepaid).toBe(3);
    expect(() => act(s, { type: 'repairAll', quote: q.token })).toThrow('已送修');
    s = advance(s, s.now + 86400000);
    expect(s.available.tank_t7).toBe(10003);
    expect(s.wallet.crystal).toBeGreaterThanOrEqual(0);
    assertState(s);
  });
  it('rejects insufficient material or stale confirmation atomically, including natural completion', () => {
    let s = fixture();
    damage(s, 'tank_t1', 7);
    const q = repairAllQuote(s);
    s.wallet.crystal = q.cost.crystal! - 1;
    const before = structuredClone(s);
    expect(repairAllQuote(s).shortage).toEqual([{ id: 'crystal', amount: 1 }]);
    expect(() => act(s, { type: 'repairAll', quote: q.token })).toThrow('缺 1');
    expect(s).toEqual(before);
    s.wallet.crystal += 100;
    s = act(s, { type: 'repair', unitId: 'tank_t1', count: 3 });
    expect(() => act(s, { type: 'repairAll', quote: q.token })).toThrow('清单已变化');
    const activeQuote = repairAllQuote(s);
    expect(() =>
      execute(s, { type: 'repairAll', quote: activeQuote.token }, s.jobs.repair!.dueAt, 'stale'),
    ).toThrow('清单已变化');
    const fresh = advance(s, s.jobs.repair!.dueAt);
    const fixed = act(fresh, { type: 'repairAll', quote: repairAllQuote(fresh).token });
    expect(() => act(fixed, { type: 'repairAll', quote: repairAllQuote(fixed).token })).toThrow(
      '没有可以修复',
    );
  });
});
describe('v0.15 core operation mainline', () => {
  it('keeps the historical nine-chapter mainline sequential with strictly increasing enemy power', () => {
    expect(dungeons).toHaveLength(320);
    let s = fixture(),
      previousPower = 0;
    s.buildings.hq = s.buildings.factory = 120;
    Object.assign(s.tech, { attack: 120, hp: 120, ballistics: 120, armorPlating: 120, march: 120 });
    s.commander.attackSkill = 120;
    for (const d of dungeons.slice(0, 144)) {
      // Replenish between supply battles; this verifies unlocks and rewards, not attrition.
      s.available.tank_t7 += 3690;
      s.createdUnits.tank_t7 += 3690;
      s.formation = Array.from({ length: 6 }, () => ({ unitId: 'tank_t7', count: 615 }));
      const power = armyPower(army(d.formation));
      expect(power).toBeGreaterThan(previousPower);
      previousPower = power;
      expect(dungeonBlock(s, d)).toBe('');
      if (d.index < dungeons.length - 1)
        expect(dungeonBlock(s, dungeons[d.index + 1])).toContain('先通过');
      const before = { ...s.arsenal!.cores };
      s = act(s, { type: 'dungeon', dungeonId: d.id });
      expect(s.reports[0].winner).toBe(0);
      expect(Object.keys(s.reports[0].coreRewards!)).toEqual(d.drops.map((v) => v.id));
      for (const drop of d.drops)
        expect(s.arsenal!.cores[drop.id]).toBe(before[drop.id] + drop.first);
      assertState(s);
    }
    expect(s.arsenal!.cleared).toHaveLength(144);
  }, 20000);
  it('retains old cleared IDs, stocks and report rewards, while allowing a next-stage unlock', async () => {
    const s = fixture();
    s.arsenal!.cleared = ['core-1', 'core-7'];
    for (const [i, c] of coreList.entries()) s.arsenal!.cores[c.id] = i + 13;
    const loaded = await parseSave(await exportSave(s));
    expect(loaded.arsenal).toEqual(s.arsenal);
    expect(
      dungeonBlock(
        loaded,
        dungeons.find((d) => d.id === 'core-1')!,
      ),
    ).toBe('');
    expect(dungeonBlock(loaded, dungeons[20])).toBe('');
    expect(dungeonBlock(loaded, dungeons[2])).toContain('先通过');
  });
  it('repeat ranges vary, remain single-family, reproduce from a save and cannot reroll a receipt', async () => {
    const outcomes = new Set<string>();
    for (let seed = 1001; seed < 1041; seed++) {
      const s = fixture();
      s.seed = seed;
      s.arsenal!.cleared = ['core-0'];
      const command = { type: 'dungeon' as const, dungeonId: 'core-0' };
      const r = execute(s, command, s.now, 'once');
      const reward = r.state.reports[0].coreRewards!;
      expect(Object.keys(reward)).toEqual(['tank_core6', 'tank_core7']);
      expect(reward.tank_core6).toBeGreaterThanOrEqual(2);
      expect(reward.tank_core6).toBeLessThanOrEqual(4);
      expect(reward.tank_core7).toBeGreaterThanOrEqual(0);
      expect(reward.tank_core7).toBeLessThanOrEqual(1);
      expect(execute(r.state, command, s.now, 'once').state).toBe(r.state);
      const loaded = await parseSave(await exportSave(s));
      expect(execute(loaded, command, loaded.now, 'once').state).toEqual(r.state);
      outcomes.add(JSON.stringify(reward));
    }
    expect(outcomes.size).toBe(6);
  });
  it('budgets use the highest accessible stage and expose stochastic zero-yield uncertainty', () => {
    const s = fixture();
    const early = coreBudget(s, 'tank', 7, 100);
    expect(early.victoriesMax).toBeNull();
    s.arsenal!.cleared = dungeons.slice(0, 12).map((d) => d.id);
    const late = coreBudget(s, 'tank', 7, 100);
    expect(late.dungeonId).toBe('core-c1-s13');
    expect(late.victoriesMin).toBe(33);
    expect(late.victories).toBe(48);
    expect(late.victoriesMax).toBe(95);
  });
});
describe('v0.15 attribute power ledger', () => {
  it('preserves equal whiteboard scores for all four classes and keeps all base attributes visible', () => {
    const s = fixture();
    s.commander.prestige = 0;
    for (const u of unitList) {
      const row = unitAttributes(s, u.unitId);
      expect(row.base).toBe(tierPower[u.tier - 1]);
      expect(row.power).toBe(row.base);
      expect(row.rows.map((v) => v.delta)).toEqual(Array(11).fill(0));
    }
  });
  it('adds to exact total for every vehicle, mixed formation and leadership ceiling without mutation', () => {
    const s = fixture();
    s.tech.attack = 13;
    s.tech.hp = 7;
    s.tech.armorPlating = 5;
    s.tech.march = 11;
    s.tech.ballistics = 9;
    s.commander.attackSkill = 6;
    s.commander.initiativeSkill = 4;
    s.commander.extraFireSkill = 3;
    s.formation[1] = { unitId: 'tank_t1', count: 17 };
    s.formation[4] = null;
    const before = structuredClone(s),
      sheet = attributeSheet(s, usableFormation(s));
    for (const u of Object.values(sheet.byUnit)) {
      expect(u.base + u.rows.reduce((n, r) => n + r.delta, 0)).toBe(u.power);
      for (const id of ['attack', 'hp', 'initiative', 'extraFire'])
        expect(u.rows.find((r) => r.id === id)!.delta).toBeGreaterThan(0);
    }
    for (const scope of [sheet.formation, sheet.ceiling])
      expect(scope.base + scope.capacity + scope.rows.reduce((n, r) => n + r.delta, 0)).toBe(
        scope.power,
      );
    expect(sheet.ceiling.capacity).toBeGreaterThan(0);
    expect(s).toEqual(before);
    s.tech.resourceOutput = s.tech.construction = s.tech.gather = s.tech.production = 20;
    expect(attributeSheet(s, usableFormation(s))).toEqual(sheet);
  });
});
