import { describe, it, expect } from 'vitest';
import { newGame, execute, advance, assertState, rate, capacity } from '../src/core/engine';
import { productionQuote } from '../src/core/arsenal';
import { researchTree, researchRequirements, materialCost, legacyTech } from '../src/core/research';
import {
  buildingDuration,
  researchDuration,
  marchQuote,
  queueView,
  effectiveTime,
} from '../src/core/vip';
import { unitList, upgradeCost } from '../src/core/content';
import { army } from '../src/core/battle';
import { exportSave, parseSave } from '../src/core/storage';
import { resources, type Command, type GameState, type Technology } from '../src/core/types';
let seq = 0;
const T = 1760000000000;
const act = (s: GameState, c: Command) => execute(s, c, s.now, `v09-${++seq}`).state;
function rich(vip = 0) {
  const s = newGame('v09', '经济科研验证', T);
  for (const b of Object.keys(s.buildings)) s.buildings[b as keyof typeof s.buildings] = 20;
  for (const r of resources) s.wallet[r] = 10000000000;
  s.industry = { version: 1, factory2: 20, refit: 20 };
  return vip ? act(s, { type: 'vipRecharge', gold: vip }) : s;
}
const stable = (s: GameState) => ({ ...s, revision: 0 });
describe('v09 economy budgets', () => {
  it.each(unitList.map((u) => [u.unitId, u] as const))(
    '%s can fund a 100-unit batch within 2.5 production cycles and store it',
    (_, u) => {
      const s = newGame('budget', '预算', T);
      for (const b of Object.keys(s.buildings))
        s.buildings[b as keyof typeof s.buildings] = u.unlock.factoryLevel;
      const funding = Math.max(
        ...resources.map((r) => (((u.cost[r] ?? 0) * 100) / Math.max(1, rate(s, r))) * 3600000),
      );
      expect(funding).toBeLessThanOrEqual(u.productionSeconds * 100000 * 2.5);
      expect(capacity(s)).toBeGreaterThanOrEqual(Math.max(...Object.values(u.cost)) * 100);
      for (const r of resources) if (u.cost[r]) expect(rate(s, r)).toBeGreaterThan(0);
    },
  );
  it('storage holds four hours of iron and repair crystal fits storage within a manufacture cycle', () => {
    for (let level = 1; level <= 20; level++) {
      const s = rich();
      s.buildings.warehouse = s.buildings.iron = level;
      expect(capacity(s) / rate(s, 'iron')).toBeGreaterThanOrEqual(4);
    }
    const s = rich();
    for (const u of unitList) {
      expect(((u.repairCost.crystal * 100) / rate(s, 'crystal')) * 3600).toBeLessThan(
        u.productionSeconds * 100,
      );
      expect(u.repairCost.crystal * 100).toBeLessThan(capacity(s));
    }
  });
});
describe('v09 research tree and migration', () => {
  it('has 27 unique acyclic nodes; all 540 levels reachable via real research commands', () => {
    let s = rich();
    const done = new Set<string>();
    function learn(id: Technology, level: number) {
      while (s.tech[id] < level) {
        const q = researchRequirements(s, id);
        for (const p of q.prerequisites) learn(p.id, p.level);
        expect(researchRequirements(s, id).block).toBe('');
        s = act(s, { type: 'research', tech: id });
        s = advance(s, s.jobs.research!.dueAt);
      }
    }
    function visit(id: Technology, path: string[] = []) {
      expect(path).not.toContain(id);
      if (done.has(id)) return;
      for (const p of researchTree.find((t) => t.id === id)!.prerequisites)
        visit(p.id, [...path, id]);
      done.add(id);
    }
    for (const n of researchTree) visit(n.id);
    expect(done.size).toBe(27);
    for (const n of researchTree) learn(n.id, 20);
    expect(s.counters.research).toBe(540);
    assertState(s);
  }, 15000);
  it('enforces completed prerequisite levels and lab requirements atomically', () => {
    let s = rich(960);
    s.buildings.lab = 2;
    const before = structuredClone(s);
    expect(() => act(s, { type: 'research', tech: 'production' })).toThrow('工程管理 2');
    expect(s).toEqual(before);
    s.tech.construction = 2;
    expect(() => act(s, { type: 'research', tech: 'researchSpeed' })).toThrow('科研中心 3');
    s.buildings.lab = 20;
    s.tech.production = 10;
    expect(researchRequirements(s, 'production').prerequisites[0].level).toBe(6);
    expect(() => act(s, { type: 'research', tech: 'production' })).toThrow('工程管理 6');
  });
  it('every economic, industrial, logistics and combat node has a measurable effect', () => {
    const s = rich(),
      old = structuredClone(s),
      site = s.world[0];
    for (const n of researchTree) s.tech[n.id] = 1;
    for (const r of resources) {
      expect(rate(s, r)).toBeGreaterThan(rate(old, r));
      const isolated = structuredClone(old);
      isolated.tech[`${r}Output` as Technology] = 1;
      expect(rate(isolated, r)).toBeGreaterThan(rate(old, r));
    }
    expect(capacity(s)).toBeGreaterThan(capacity(old));
    expect(buildingDuration(s, 'factory')).toBeLessThan(buildingDuration(old, 'factory'));
    expect(researchDuration(s, 'hp')).toBeLessThan(
      researchDuration({ ...s, tech: { ...s.tech, researchSpeed: 0 } }, 'hp'),
    );
    for (const mode of ['produce', 'refit', 'repair'] as const)
      expect(productionQuote(s, 'tank_t2', mode).duration).toBeLessThan(
        productionQuote(old, 'tank_t2', mode).duration,
      );
    for (const id of ['repairSpeed', 'refitSpeed', 'production'] as const) {
      const isolated = structuredClone(old);
      isolated.tech[id] = 1;
      const mode = id === 'repairSpeed' ? 'repair' : id === 'refitSpeed' ? 'refit' : 'produce';
      expect(productionQuote(isolated, 'tank_t2', mode).duration).toBeLessThan(
        productionQuote(old, 'tank_t2', mode).duration,
      );
    }
    expect(materialCost(s, upgradeCost('hq', 19)).iron).toBeLessThan(upgradeCost('hq', 19).iron!);
    const before = marchQuote(old, site, old.formation),
      after = marchQuote(s, site, s.formation);
    expect(after.outboundMs).toBeLessThan(before.outboundMs);
    expect(after.load).toBeGreaterThan(before.load);
    expect(after.gatherRate).toBeGreaterThan(before.gatherRate);
    const survey = structuredClone(old);
    survey.tech.survey = 1;
    expect(marchQuote(survey, site, s.formation).gatherRate).toBeGreaterThan(before.gatherRate);
    const a = army(s.formation, s.tech)[0],
      b = army(old.formation, old.tech)[0];
    expect(a.hp).toBeGreaterThan(b.hp);
    expect(a.attackBonus).toBeGreaterThan(b.attackBonus!);
    const advanced = structuredClone(old);
    advanced.tech.armorPlating = advanced.tech.ballistics = 1;
    expect(army(s.formation, advanced.tech)[0].hp).toBeGreaterThan(b.hp);
    expect(army(s.formation, advanced.tech)[0].attackBonus).toBeGreaterThan(b.attackBonus!);
  });
  it('migrates legacy five-tech saves, preserving earned levels, jobs and refunds', async () => {
    let s = rich();
    s.tech.production = 15;
    s = act(s, { type: 'research', tech: 'attack' });
    delete s.researchVersion;
    for (const n of researchTree)
      if (!legacyTech.includes(n.id as (typeof legacyTech)[number])) delete s.tech[n.id];
    const jobs = structuredClone(s.jobs),
      wallet = structuredClone(s.wallet);
    s = await parseSave(await exportSave(s));
    expect(s.researchVersion).toBe(2);
    expect(s.tech.production).toBe(15);
    expect(s.tech.resourceOutput).toBe(0);
    expect(s.jobs).toEqual(jobs);
    expect(s.wallet).toEqual(wallet);
    s = advance(s, s.jobs.research!.dueAt);
    expect(s.tech.attack).toBe(1);
    assertState(s);
    delete (s.tech as Partial<GameState['tech']>).survey;
    expect(() => assertState(s)).toThrow('科技等级');
  });
  it('snapshots manufacturing discounts and outgoing travel/load through later research', () => {
    let s = rich();
    s.tech.materials = 10;
    s = act(s, { type: 'produce', unitId: 'tank_t1', count: 100 });
    const paid = s.jobs.production!.unitCost.iron!;
    s.tech.materials = 20;
    const wallet = s.wallet.iron;
    s = act(s, { type: 'cancel', kind: 'production' });
    expect(s.wallet.iron - wallet).toBe(paid * 100);
    s = act(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    const m = structuredClone(s.marches[0]);
    s.tech.cargo = s.tech.march = 20;
    s = advance(s, m.dueAt);
    expect(s.marches[0].capacity).toBe(m.capacity);
    expect(s.marches[0].travelMs).toBe(m.travelMs);
    // A pre-v09 expedition retains its original (unmultiplied) load on arrival.
    let old = rich();
    old = act(old, { type: 'march', targetId: 'site-0', mission: 'gather' });
    delete old.marches[0].loadBps;
    delete old.marches[0].unitLoads;
    old.marches[0].capacity = old.formation.reduce(
      (n, t) => n + (t ? unitList.find((u) => u.unitId === t.unitId)!.load * t.count : 0),
      0,
    );
    const load = old.marches[0].capacity;
    old = advance(old, old.marches[0].dueAt);
    expect(old.marches[0].capacity).toBe(load);
  });
});
describe('v09 automatic VIP completion', () => {
  it('instantly completes short building, research, production, refit and repair with exact charges', () => {
    let s = rich(40);
    s.buildings.iron = 1;
    const gold = s.wallet.gold;
    s = act(s, { type: 'upgrade', building: 'iron' });
    expect(s.buildings.iron).toBe(2);
    s = act(s, { type: 'research', tech: 'attack' });
    expect(s.tech.attack).toBe(1);
    s = act(s, { type: 'produce', unitId: 'tank_t1', count: 1 });
    expect(s.available.tank_t1).toBe(21);
    s.tech.refitSpeed = 1;
    s = act(s, { type: 'refit', unitId: 'tank_t2', count: 1 });
    expect(s.available.tank_t1).toBe(20);
    expect(s.available.tank_t2).toBe(1);
    expect(s.arsenal!.converted.tank_t1).toBe(1);
    s.damaged.tank_t1 = 2;
    s.available.tank_t1 -= 2;
    s = act(s, { type: 'repair', unitId: 'tank_t1', count: 2 });
    expect(s.available.tank_t1).toBe(20);
    expect(s.damaged.tank_t1).toBe(0);
    expect(s.jobs).toEqual({});
    expect(s.wallet.gold).toBe(gold);
    assertState(s);
  });
  it('uses whole batches and activates waiting orders at the exact free boundary', () => {
    let s = rich(40);
    s = act(s, { type: 'produce', unitId: 'tank_t1', count: 2 });
    const boundary = effectiveTime(s, s.jobs.production!.duration * 2);
    s = act(s, { type: 'produce', unitId: 'tank_t1', count: 1 });
    expect(s.available.tank_t1).toBe(20);
    expect(queueView(s).map((j) => j.remainingMs)).toEqual([boundary, boundary]);
    const before = advance(s, T + boundary - 1);
    expect(before.available.tank_t1).toBe(20);
    const done = advance(before, T + boundary);
    expect(done.available.tank_t1).toBe(23);
    expect(done.jobs).toEqual({});
    assertState(done);
  });
  it('discounts scheduled building completion before passive growth and agrees offline vs small ticks', () => {
    let s = rich(40);
    s.wallet.iron = 0;
    s.buildings.iron = 8;
    s.wallet.iron = upgradeCost('iron', 8).iron! + 10000;
    s = act(s, { type: 'upgrade', building: 'iron' });
    const end = s.now + effectiveTime(s, s.jobs.building!.duration);
    const early = advance(s, end - 1);
    expect(early.buildings.iron).toBe(8);
    expect(advance(s, end).buildings.iron).toBe(9);
    const target = s.now + 3600000;
    let stepped = s;
    while (stepped.now < target) stepped = advance(stepped, Math.min(target, stepped.now + 13701));
    expect(stable(advance(s, target))).toEqual(stable(stepped));
  });
  it('recharge immediately completes eligible existing jobs once and preserves idempotency', () => {
    let s = rich();
    s = act(s, { type: 'produce', unitId: 'tank_t1', count: 1 });
    const id = 'recharge-auto';
    const command = { type: 'vipRecharge' as const, gold: 40 };
    s = execute(s, command, s.now, id).state;
    expect(s.available.tank_t1).toBe(21);
    expect(s.jobs).toEqual({});
    expect(execute(s, command, s.now, id).state).toEqual(s);
    assertState(s);
  });
  it('deducts core and source before instantaneous high-tier refit; insufficient costs never finish', () => {
    let s = rich(1000000);
    s.buildings.hq = s.buildings.factory = s.industry!.refit = 60;
    s.tech.production = s.tech.refitSpeed = 120;
    s.available.tank_t5 = s.createdUnits.tank_t5 = 2;
    s.arsenal!.cores.tank_core6 = 1;
    const old = structuredClone(s);
    expect(() => act(s, { type: 'refit', unitId: 'tank_t6', count: 2 })).toThrow('核心');
    expect(s).toEqual(old);
    s = act(s, { type: 'refit', unitId: 'tank_t6', count: 1 });
    expect(s.arsenal!.cores.tank_core6).toBe(0);
    expect(s.available.tank_t5).toBe(1);
    expect(s.available.tank_t6).toBe(1);
    assertState(s);
  });
  it('free gathering deducts finite reserve, never skips either travel leg and credits only at home', () => {
    let s = rich(40);
    s.wallet.iron = 0;
    s.world[0].reserve = 17;
    const q = marchQuote(s, s.world[0], s.formation);
    expect(q.gatherMs).toBe(0);
    s = act(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    expect(s.marches[0].phase).toBe('outbound');
    s = advance(s, T + q.outboundMs - 1);
    expect(s.marches[0].cargo.iron).toBe(0);
    s = advance(s, T + q.outboundMs);
    expect(s.marches[0].phase).toBe('returning');
    expect(s.marches[0].cargo.iron).toBe(17);
    expect(s.world[0].reserve).toBe(0);
    expect(s.counters.cargo).toBeUndefined();
    s = advance(s, T + q.totalMs - 1);
    expect(s.marches).toHaveLength(1);
    s = advance(s, T + q.totalMs);
    expect(s.counters.cargo).toBe(17);
    expect(s.marches).toHaveLength(0);
    assertState(s);
  });
  it('free gathering boundaries and simultaneous arrivals agree after save import and offline catch-up', async () => {
    let s = newGame('gather', '采矿', T);
    s = act(s, { type: 'vipRecharge', gold: 40 });
    s = act(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    s = await parseSave(await exportSave(s));
    let stepped = s;
    const end = T + 2000000;
    while (stepped.now < end) stepped = advance(stepped, Math.min(end, stepped.now + 13107));
    expect(stable(advance(s, end))).toEqual(stable(stepped));
    assertState(stepped);
  });
});
