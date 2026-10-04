import { describe, it, expect } from 'vitest';
import {
  newGame,
  rate,
  capacity,
  execute,
  advance,
  assertState,
  facilityUpgradeQuote,
} from '../src/core/engine';
import { unitList, upgradeCost, researchCost, units, buildingNames } from '../src/core/content';
import { researchTree, materialCost, researchEffect } from '../src/core/research';
import { productionQuote, repairAllQuote } from '../src/core/arsenal';
import { marchQuote, expeditionLoad, unitLoad, troopLoad } from '../src/core/vip';
import {
  guardArmy,
  configureSite,
  mineCapacity,
  guardTemplate,
  npcCapacity,
} from '../src/core/world';
import { army, simulate, survivors } from '../src/core/battle';
import { exportSave, parseSave } from '../src/core/storage';
import {
  resources,
  type GameState,
  type Formation,
  type Command,
  type Building,
} from '../src/core/types';
const T = 1791000000000;
let seq = 0;
const act = (s: GameState, c: Command) => execute(s, c, s.now, 'v18-' + ++seq).state;
function state(l: number, tech = Math.floor(l / 2)) {
  const s = newGame('v18', '经济验收', T, 180018);
  for (const b of Object.keys(s.buildings)) s.buildings[b as keyof typeof s.buildings] = l;
  for (const t of researchTree) s.tech[t.id] = tech;
  s.commander.leadership = 1 + Math.floor((l - 1) / 2);
  s.commander.prestige = 40 * (s.commander.leadership - 1) ** 2;
  s.industry = { version: 1, factory2: l, refit: l };
  for (const r of Object.keys(s.wallet)) s.wallet[r as keyof typeof s.wallet] = 1e9;
  return s;
}
const hrs = (s: GameState, c: Record<string, number>) =>
  Math.max(...resources.map((r) => (c[r] ?? 0) / Math.max(1, rate(s, r))));
const economicValue = (c: Record<string, number>) =>
  Object.entries(c).reduce(
    (n, [r, v]) =>
      n + v / ({ iron: 7200, oil: 4800, lead: 4000, titanium: 1800, crystal: 1200 }[r] ?? 1),
    0,
  );
const squad = (s: GameState, tier = 7): Formation =>
  ['tank', 'tank_destroyer', 'tank', 'spg', 'rocket', 'spg'].map((c) => ({
    unitId: c + '_t' + tier,
    count: 20 + (s.commander.leadership - 1) * 5,
  }));
function stock(s: GameState, f: Formation) {
  for (const t of f)
    if (t) {
      s.available[t.unitId] += t.count;
      s.createdUnits[t.unitId] += t.count;
    }
  s.formation = f;
}
describe('economy-v18 progression budgets', () => {
  it.each([1, 6, 12, 20, 40, 60, 80, 100, 120])(
    'L%i storage, expenses and research have reachable budgets',
    (l) => {
      const s = state(l),
        r = rate(s, 'iron');
      expect(capacity(s) / r).toBeGreaterThan(8);
      expect(capacity(s) / r).toBeLessThan(300);
      const upgrade = materialCost(s, upgradeCost('hq', Math.min(l, 119)));
      expect(hrs(s, upgrade)).toBeLessThan(48);
      expect(Math.max(...Object.values(upgrade))).toBeLessThan(capacity(s));
      const research = researchCost(Math.min(l, 119));
      // v29 deliberately raises only research titanium 50%; preserve the old
      // 72-hour bound for every other material and apply the same factor to Ti.
      for (const resource of resources)
        expect((research[resource] ?? 0) / Math.max(1, rate(s, resource))).toBeLessThan(
          resource === 'titanium' ? 72 * 1.5 : 72,
        );
      expect(Math.max(...Object.values(research))).toBeLessThan(capacity(s));
      const u = unitList.filter((u) => u.classId === 'tank' && u.unlock.factoryLevel <= l).at(-1)!;
      const q = productionQuote(s, u.unitId);
      if (l >= 20) {
        const two = (q.unitCost.iron! * 7200000) / q.duration / r;
        expect(two).toBeGreaterThan(0);
        expect(two).toBeLessThan(2);
        // Late income must support research/buildings as well as two long-running lines.
        expect(
          hrs(s, Object.fromEntries(Object.entries(q.unitCost).map(([r, n]) => [r, n * 100]))),
        ).toBeLessThan(((q.duration * 100) / 3600000) * 2.5);
      }
    },
  );
  it('keeps every research level beneficial with explicit diminishing economic increments', () => {
    for (const t of researchTree.filter(
      (t) => t.branch === 'economy' || ['gather', 'survey', 'cargo'].includes(t.id),
    )) {
      expect(researchEffect(t.id, 120) - researchEffect(t.id, 119)).toBeLessThan(
        researchEffect(t.id, 2) - researchEffect(t.id, 1),
      );
      for (let l = 1; l <= 120; l++)
        expect(researchEffect(t.id, l)).toBeGreaterThan(researchEffect(t.id, l - 1));
    }
    expect(researchEffect('resourceOutput', 120)).toBe(200);
    expect(researchEffect('ironOutput', 120)).toBe(320);
  });
  it('all building, separate factory and research costs fit a same-level warehouse through 120', () => {
    for (let l = 1; l < 120; l++) {
      const s = state(l, 0),
        cap = capacity(s);
      for (const b of Object.keys(buildingNames) as Building[])
        expect(Math.max(...Object.values(upgradeCost(b, l)))).toBeLessThan(cap);
      for (const facility of ['factory2', 'refit'] as const)
        expect(Math.max(...Object.values(facilityUpgradeQuote(s, facility).unitCost))).toBeLessThan(
          cap,
        );
      expect(Math.max(...Object.values(researchCost(l)))).toBeLessThan(cap);
      for (const r of resources) {
        const next = structuredClone(s);
        next.buildings[r] = l + 1;
        if (r === 'titanium' && l < 6) expect(rate(next, r)).toBe(0);
        else expect(rate(next, r)).toBeGreaterThan(rate(s, r));
      }
    }
  });
  it('all 28 units have affordable positive manufacture/refit/repair costs with cheaper recovery', () => {
    for (const u of unitList) {
      const s = state(120, 120),
        p = productionQuote(s, u.unitId),
        r = productionQuote(s, u.unitId, 'repair');
      expect(economicValue(r.unitCost)).toBeLessThan(economicValue(p.unitCost));
      for (const mode of ['produce', 'refit', 'repair'] as const) {
        const q = productionQuote(s, u.unitId, mode);
        for (const n of Object.values(q.unitCost)) expect(n).toBeGreaterThanOrEqual(0);
      }
      if (u.tier > 1) {
        const q = productionQuote(s, u.unitId, 'refit');
        expect(economicValue(q.unitCost)).toBeLessThan(economicValue(p.unitCost));
      }
    }
  });
  it('keeps prepaid legacy manufacture/refit/repair inputs and refunds exact', () => {
    let s = state(60);
    s.arsenal!.cores.tank_core7 = 5;
    s = act(s, { type: 'produce', unitId: 'tank_t7', count: 2 });
    s.jobs.production!.unitCost = { iron: 1037, oil: 519, lead: 260, titanium: 167 };
    const paid = { ...s.jobs.production!.unitCost },
      before = { ...s.wallet };
    s = act(s, { type: 'cancel', kind: 'production' });
    for (const r of resources) expect(s.wallet[r] - before[r]).toBe((paid[r] ?? 0) * 2);
    s.damaged.tank_t7 = 4;
    s.createdUnits.tank_t7 += 4;
    s = act(s, { type: 'repair', unitId: 'tank_t7', count: 2 });
    s.jobs.repair!.unitCost = { crystal: 70 };
    expect(repairAllQuote(s).cost.crystal).toBe(
      productionQuote(s, 'tank_t7', 'repair').unitCost.crystal! * 2,
    );
    const crystal = s.wallet.crystal;
    s = act(s, { type: 'cancel', kind: 'repair' });
    expect(s.wallet.crystal - crystal).toBe(140);
    assertState(s);
  });
});
describe('world-v18 yield, danger and snapshot safety', () => {
  it('provides all five resources through level 120 and progressively stronger garrisons', () => {
    const s = state(1);
    for (const r of resources) {
      const rows = s.world.filter((v) => v.kind === 'mine' && v.resource === r);
      expect(Math.max(...rows.map((v) => v.level))).toBe(120);
      expect(Math.min(...rows.map((v) => v.level))).toBe(1);
    }
    for (const l of [1, 12, 30, 60, 120]) {
      const site = { ...s.world[3], id: 'guarded' };
      configureSite(site, l, T);
      expect(site.guards).toEqual(guardTemplate(l));
      expect(site.reserve).toBe(mineCapacity(site));
    }
    const site = { ...s.world[3], id: 'guarded' };
    configureSite(site, 120, T);
    expect(guardArmy(site)[0].hp).toBeGreaterThan(units.tank_t7.hp * 5);
    const weak = state(20, 10);
    expect(simulate(army(squad(weak), weak.tech), guardArmy(site), 987).winner).toBe(1);
  });
  it.each([1, 6, 12, 20, 40, 60, 80, 100, 120])(
    'L%i matching mineral trips outperform local income including travel',
    (l) => {
      const s = state(l),
        tier = unitList
          .filter((u) => u.classId === 'tank' && u.unlock.factoryLevel <= l)
          .at(-1)!.tier;
      for (const r of resources) {
        if (r === 'titanium' && l < 6) continue;
        const site = { ...s.world[0], id: 'guarded', resource: r, x: 28, y: 27 };
        configureSite(site, l, T);
        const q = marchQuote(s, site, squad(s, tier));
        expect(q.amount / ((rate(s, r) * q.totalMs) / 3600000)).toBeGreaterThan(5);
        expect(q.amount).toBeLessThanOrEqual(q.load);
        expect(q.amount).toBeLessThanOrEqual(site.reserve);
      }
    },
  );
  it('high HQ does not turn a safe low-level deposit into a high-level mine', () => {
    const a = state(1, 0),
      b = state(120, 0);
    expect(marchQuote(a, a.world[0], a.formation).gatherRate).toBe(
      marchQuote(b, b.world[0], b.formation).gatherRate,
    );
  });
  it('new cargo snapshots agree with the UI quote and remain fixed through research and battle losses', () => {
    let s = state(120, 60);
    stock(s, squad(s));
    const site = s.world.find(
      (v) => v.resource === 'iron' && v.kind === 'mine' && v.level === 120,
    )!;
    const quote = marchQuote(s, site, s.formation);
    s = act(s, { type: 'march', targetId: site.id, mission: 'gather' });
    const m = structuredClone(s.marches[0]);
    expect(m.capacity).toBe(quote.load);
    expect(Object.values(m.unitLoads!)).toContain(unitLoad(s, 'tank_t7'));
    s.tech.cargo = 120;
    s = advance(s, m.dueAt);
    const live = s.marches[0];
    expect(live.phase).toBe('gathering');
    expect(live.capacity).toBe(
      live.troops.reduce((n, t) => n + (t ? m.unitLoads![t.unitId] * t.count : 0), 0),
    );
    expect(live.capacity).toBeLessThan(m.capacity);
    const beforeReserve = s.world.find((v) => v.id === site.id)!.reserve;
    s = advance(s, live.dueAt);
    const cargo = s.marches[0].cargo.iron;
    expect(beforeReserve - s.world.find((v) => v.id === site.id)!.reserve).toBe(cargo);
    s = advance(s, s.marches[0].dueAt);
    expect(s.expeditionLog![0].cargo.iron).toBe(cargo);
    const total = s.counters.cargo;
    s = advance(s, s.now + 1);
    expect(s.counters.cargo).toBe(total);
    assertState(s);
  });
  it('legacy in-flight travel/cargo/guards stay unchanged until return; stepped and bulk migration agree', async () => {
    let s = state(20, 0);
    s.wallet.iron = 0;
    s.formation = [{ unitId: 'tank_t1', count: 20 }, null, null, null, null, null];
    s = act(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    const m = s.marches[0],
      site = s.world[0];
    delete site.economyVersion;
    site.reserve = 12000;
    site.guards = Array(6).fill(null);
    delete m.unitLoads;
    m.capacity = troopLoad(m.troops, m.loadBps!);
    m.gatherRate = 4800;
    s.worldRules = 'renewable-v1';
    const old = structuredClone(m),
      guards = structuredClone(site.guards);
    s = await parseSave(await exportSave(s));
    s = advance(s, s.now);
    expect(s.marches[0]).toEqual(old);
    expect(s.world[0].economyVersion).toBeUndefined();
    expect(s.world[0].guards).toEqual(guards);
    const end = T + 4 * 3600000,
      bulk = advance(s, end);
    let step = s;
    while (step.now < end) step = advance(step, Math.min(end, step.now + 61000));
    expect({ ...bulk, revision: 0 }).toEqual({ ...step, revision: 0 });
    expect(bulk.counters.cargo).toBe(1000);
    expect(bulk.world[0].economyVersion).toBe(3);
  });
  it('guard respawn waits for complete replenishment and never occurs under an expedition', () => {
    let s = state(20),
      site = s.world.find((v) => v.kind === 'mine' && v.id !== 'site-0' && v.id !== 'site-1')!;
    site.guards = Array(6).fill(null);
    site.conquered = true;
    site.reserve = 0;
    s = advance(s, T + 3 * 3600000);
    site = s.world.find((v) => v.id === site.id)!;
    expect(site.guards.some(Boolean)).toBe(false);
    s = advance(s, T + 4 * 3600000);
    site = s.world.find((v) => v.id === site.id)!;
    expect(site.guards.some(Boolean)).toBe(true);
    expect(site.reserve).toBe(mineCapacity(site));
  });
  it('validates high-level world/intelligence and rejects missing snapshot unit loads', async () => {
    let s = state(120, 120);
    stock(s, squad(s));
    s = act(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    expect(await parseSave(await exportSave(s))).toEqual(s);
    delete s.marches[0].unitLoads!.tank_t7;
    expect(() => assertState(s)).toThrow('载重快照');
  });
});
