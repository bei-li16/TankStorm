import { describe, it, expect } from 'vitest';
import { advance, assertState, execute, newGame } from '../src/core/engine';
import { coreList, dungeons, productionQuote } from '../src/core/arsenal';
import { unitList, units } from '../src/core/content';
import { exportSave, parseSave } from '../src/core/storage';
import type { Command, GameState } from '../src/core/types';

let serial = 0;
const act = (s: GameState, c: Command) => execute(s, c, s.now, `arsenal-${++serial}`).state;
function rich() {
  const s = newGame('arsenal-test', '机械师', 1700000000000);
  s.buildings.hq = s.buildings.factory = 60;
  s.industry = { version: 1, factory2: 60, refit: 60 };
  for (const r of Object.keys(s.wallet)) s.wallet[r as keyof typeof s.wallet] = 1000000;
  return s;
}
const grant = (s: GameState, id: string, n: number) => {
  s.available[id] += n;
  s.createdUnits[id] += n;
};
function finish(s: GameState) {
  const j = s.jobs.production!;
  return advance(s, j.dueAt + (j.total - j.completed - 1) * j.duration);
}

describe('seven-tier arsenal and core operations', () => {
  it('provides seven unique units in every class with a reachable unlock curve', () => {
    expect(unitList).toHaveLength(28);
    expect(new Set(unitList.map((u) => u.name)).size).toBe(28);
    for (const cls of ['tank', 'tank_destroyer', 'spg', 'rocket']) {
      expect(unitList.filter((u) => u.classId === cls).map((u) => u.tier)).toEqual([
        1, 2, 3, 4, 5, 6, 7,
      ]);
      expect(units[`${cls}_t7`].unlock.factoryLevel).toBe(60);
    }
  });
  it('MAX floors the limiting resource, allows zero and respects unlocks and cores', () => {
    const s = newGame('max', '最大生产', 1700000000000);
    s.wallet.iron = units.tank_t1.cost.iron! * 5 + 1;
    expect(productionQuote(s, 'tank_t1').max).toBe(5);
    s.wallet.oil = 9;
    expect(productionQuote(s, 'tank_t1').max).toBe(0);
    expect(productionQuote(s, 'tank_t4').max).toBe(0);
    const full = rich();
    expect(productionQuote(full, 'tank_t6').max).toBe(0);
    full.arsenal!.cores.tank_core6 = 7;
    expect(productionQuote(full, 'tank_t6').max).toBe(7);
    full.arsenal!.cores.tank_core6 = 100000;
    for (const r of Object.keys(full.wallet))
      full.wallet[r as keyof typeof full.wallet] = 100000000;
    expect(productionQuote(full, 'tank_t6').max).toBe(100);
  });
  it('quotes the same per-unit duration that production snapshots after speed research', () => {
    let s = rich();
    s.tech.production = 7;
    const quote = productionQuote(s, 'tank_t5');
    s = act(s, { type: 'produce', unitId: 'tank_t5', count: 20 });
    expect(s.jobs.production!.duration).toBe(quote.duration);
    s.tech.production = 20;
    s = finish(s);
    expect(s.available.tank_t5).toBe(20);
    assertState(s);
  });
  it.each([0, -1, 1.5, 10001, NaN])(
    'rejects invalid manually entered quantity %s atomically',
    (n) => {
      const s = rich(),
        before = structuredClone(s);
      expect(() => act(s, { type: 'produce', unitId: 'tank_t5', count: n })).toThrow();
      expect(s).toEqual(before);
    },
  );
  it('requires cores for both direct production and refit; repair needs no new cores', () => {
    let s = rich();
    grant(s, 'tank_t5', 3);
    expect(() => act(s, { type: 'produce', unitId: 'tank_t6', count: 1 })).toThrow('核心不足');
    expect(() => act(s, { type: 'refit', unitId: 'tank_t6', count: 1 })).toThrow('核心不足');
    s.damaged.tank_t6 = s.createdUnits.tank_t6 = 2;
    s = act(s, { type: 'repair', unitId: 'tank_t6', count: 2 });
    s = advance(s, s.jobs.repair!.dueAt + s.jobs.repair!.duration);
    expect(s.available.tank_t6).toBe(2);
    assertState(s);
  });
  it('refit reserves originals, credits per unit and refunds remaining cores, originals and snapshot cost', async () => {
    let s = rich();
    grant(s, 'tank_t5', 5);
    s.arsenal!.cores.tank_core6 = 4;
    const q = productionQuote(s, 'tank_t6', 'refit');
    expect(q.max).toBe(4);
    s = act(s, { type: 'refit', unitId: 'tank_t6', count: 4 });
    expect(s.available.tank_t5).toBe(1);
    expect(s.arsenal!.cores.tank_core6).toBe(0);
    assertState(s);
    s = await parseSave(await exportSave(s));
    s = advance(s, s.jobs['production:refit']!.dueAt);
    expect(s.available.tank_t6).toBe(1);
    expect(s.arsenal!.converted.tank_t5).toBe(1);
    const beforeCancelIron = s.wallet.iron;
    s = act(s, { type: 'cancel', kind: 'production' });
    expect(s.available.tank_t5).toBe(4);
    expect(s.arsenal!.cores.tank_core6).toBe(3);
    expect(s.wallet.iron).toBe(beforeCancelIron + q.unitCost.iron! * 3);
    expect(s.destroyedUnits.tank_t5).toBe(0);
    assertState(s);
  });
  it('full refit, zero-progress cancellation and acceleration preserve unit conservation', () => {
    let s = rich();
    grant(s, 'rocket_t6', 10);
    s.arsenal!.cores.rocket_core7 = 10;
    s = act(s, { type: 'refit', unitId: 'rocket_t7', count: 10 });
    s = act(s, { type: 'cancel', kind: 'production' });
    expect(s.available.rocket_t6).toBe(10);
    expect(s.arsenal!.cores.rocket_core7).toBe(10);
    s = act(s, { type: 'refit', unitId: 'rocket_t7', count: 10 });
    s = act(s, { type: 'accelerate', kind: 'production' });
    expect(s.available.rocket_t7).toBe(10);
    expect(s.arsenal!.converted.rocket_t6).toBe(10);
    assertState(s);
  });
  it.each(dungeons)(
    '$name drops first and repeat rewards once, while training grants nothing',
    (d) => {
      let s = rich();
      s.buildings.hq = s.buildings.factory = 120;
      Object.assign(s.tech, {
        attack: 120,
        hp: 120,
        ballistics: 120,
        armorPlating: 120,
        march: 120,
      });
      s.commander.leadership = 120;
      s.commander.prestige = 566440;
      grant(s, 'tank_t7', 4000);
      s.formation = Array.from({ length: 6 }, () => ({ unitId: 'tank_t7', count: 615 }));
      s.arsenal!.cleared = dungeons.slice(0, d.index).map((v) => v.id);
      const before = structuredClone(s.arsenal);
      s = act(s, { type: 'dungeon', dungeonId: d.id, training: true });
      expect(s.arsenal).toEqual(before);
      const command = { type: 'dungeon' as const, dungeonId: d.id };
      const key = 'one-drop-' + d.id;
      s = execute(s, command, s.now, key).state;
      expect(s.reports[0].winner).toBe(0);
      expect(s.reports[0].coreRewards).toEqual(
        Object.fromEntries(d.drops.map((v) => [v.id, v.first])),
      );
      const credited = structuredClone(s.arsenal!.cores);
      s = execute(s, command, s.now, key).state;
      expect(s.arsenal!.cores).toEqual(credited);
      s = act(s, command);
      for (const drop of d.drops) {
        const reward = s.reports[0].coreRewards![drop.id];
        expect(reward).toBeGreaterThanOrEqual(drop.min);
        expect(reward).toBeLessThanOrEqual(drop.max);
        expect(s.arsenal!.cores[drop.id]).toBe(drop.first + reward);
      }
      assertState(s);
    },
  );
  it('locked and failed dungeons give no cores', () => {
    let s = newGame('locked', '试炼', 1700000000000);
    expect(() => act(s, { type: 'dungeon', dungeonId: 'core-0' })).toThrow('工厂');
    s.buildings.factory = s.buildings.hq = 36;
    s.formation = [{ unitId: 'tank_t1', count: 1 }, null, null, null, null, null];
    s = act(s, { type: 'dungeon', dungeonId: 'core-0' });
    expect(s.reports[0].winner).toBe(1);
    expect(Object.values(s.arsenal!.cores).reduce((a, b) => a + b, 0)).toBe(0);
    assertState(s);
  });
  it('migrates valid v0.3 stocks after checksum verification without changing history or queued costs', async () => {
    const old = act(newGame('old', '旧档', 1700000000000), {
      type: 'produce',
      unitId: 'tank_t1',
      count: 3,
    });
    delete old.arsenal;
    for (const stock of [old.available, old.damaged, old.createdUnits, old.destroyedUnits])
      for (const u of unitList.filter((u) => u.tier > 3)) delete stock[u.unitId];
    const text = await exportSave(old);
    const migrated = await parseSave(text);
    expect(migrated.jobs).toEqual(old.jobs);
    expect(migrated.now).toBe(old.now);
    expect(migrated.available.tank_t1).toBe(old.available.tank_t1);
    expect(migrated.arsenal!.cores).toEqual(Object.fromEntries(coreList.map((c) => [c.id, 0])));
    expect(Object.keys(migrated.available)).toHaveLength(28);
    expect((await parseSave(await exportSave(migrated))).arsenal).toEqual(migrated.arsenal);
    expect(() =>
      assertState({ ...migrated, arsenal: { ...migrated.arsenal!, cores: { bad: 5 } } }),
    ).toThrow();
    delete migrated.available.tank_t7;
    expect(() => assertState(migrated)).toThrow();
  });
});
