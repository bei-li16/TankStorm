import { describe, expect, it } from 'vitest';
import { advance, assertState, execute, newGame } from '../src/core/engine';
import { dungeonGrowth, dungeons } from '../src/core/arsenal';
import { enableCommander, prestigeRequired } from '../src/core/commander';
import { expeditionLoad, gatheringRate } from '../src/core/vip';
import { configureSite, mineCapacity, referenceMineLoad, WORLD_INTERVAL } from '../src/core/world';
import { exportSave, parseSave } from '../src/core/storage';
import { rng32 } from '../src/core/battle';
import type { Command, GameState } from '../src/core/types';

let seq = 0;
const fresh = () => newGame('v33', '统率与矿储验收', 1790985600000, 33);
const act = (s: GameState, c: Command) => execute(s, c, s.now, 'v33-' + ++seq).state;
const prepared = () => {
  const s = fresh();
  s.buildings.hq = s.buildings.factory = s.buildings.warehouse = 120;
  s.commander.prestige = prestigeRequired(120);
  s.commander.books = 100000;
  s.wallet.gold = 100000;
  s.available.tank_t7 = s.createdUnits.tank_t7 = 10000;
  return s;
};

describe('v33 core first/repeat growth', () => {
  it('halves repeat prestige, keeps XP and random cores, and only gives first-clear books', async () => {
    let s = prepared();
    s.commander.leadership = 120;
    s.formation = Array.from({ length: 6 }, () => ({ unitId: 'tank_t7', count: 615 }));
    const d = dungeons[0],
      command: Command = { type: 'dungeon', dungeonId: d.id };
    const before = structuredClone(s.commander);
    s = act(s, command);
    expect(s.reports[0].winner).toBe(0);
    expect(s.reports[0].growth).toEqual(d.growth);
    expect(s.commander.books - before.books).toBe(d.growth.books);
    const snapshot = structuredClone(s.reports[0]);
    const first = structuredClone(s.commander);
    s = execute(s, command, s.now, 'repeat').state;
    expect(s.reports[0].growth).toEqual(dungeonGrowth(d, false));
    expect(s.commander.books).toBe(first.books);
    expect(s.commander.prestige - first.prestige).toBe(d.growth.prestige / 2);
    expect(s.commander.xp - first.xp).toBe(d.growth.xp);
    for (const drop of d.drops) {
      expect(s.reports[0].coreRewards![drop.id]).toBeGreaterThanOrEqual(drop.min);
      expect(s.reports[0].coreRewards![drop.id]).toBeLessThanOrEqual(drop.max);
    }
    expect(s.reports[1]).toEqual(snapshot);
    s = await parseSave(await exportSave(s));
    expect(execute(s, command, s.now, 'repeat').state).toBe(s);
    expect(s.reports[1]).toEqual(snapshot);
  });
  it('applies to every chapter while preserving first-clear definitions', () => {
    for (const d of dungeons) {
      expect(dungeonGrowth(d, true)).toEqual(d.growth);
      expect(dungeonGrowth(d, false)).toEqual({
        ...d.growth,
        books: 0,
        prestige: Math.floor(d.growth.prestige / 2),
      });
    }
  });
});

describe('v33 mine supply', () => {
  it('covers two regional full fleets, grows monotonically, and does not change rate/guards', () => {
    const s = prepared();
    for (const resource of ['iron', 'oil', 'lead', 'titanium', 'crystal'] as const) {
      const site = s.world.find((v) => v.kind === 'mine' && v.resource === resource)!;
      let previous = 0;
      for (const level of [1, 3, 6, 12, 20, 40, 60, 75, 90, 105, 120]) {
        configureSite(site, level, s.now);
        expect(mineCapacity(site)).toBeGreaterThan(previous);
        expect(mineCapacity(site)).toBeGreaterThanOrEqual(referenceMineLoad(level) * 2);
        expect(mineCapacity(site) % 4).toBe(0);
        previous = mineCapacity(site);
        const legacy = structuredClone(site);
        delete legacy.reserveVersion;
        expect(gatheringRate(s, site)).toBe(gatheringRate(s, legacy));
        expect(site.guards).toEqual(legacy.guards);
      }
    }
  });
  it('preserves depleted proportion, empty sites and NPC wallets on old-save migration', async () => {
    const s = prepared(),
      site = s.world.find((v) => v.kind === 'mine' && v.resource === 'titanium')!;
    configureSite(site, 75, s.now);
    delete site.reserveVersion;
    site.reserve = mineCapacity(site) / 4;
    const guards = structuredClone(site.guards),
      wallets = s.world.map((v) => ({ ...v.wallet }));
    delete s.world[0].reserveVersion;
    s.world[0].reserve = 0;
    const loaded = advance(await parseSave(await exportSave(s)), s.now);
    const migrated = loaded.world.find((v) => v.id === site.id)!;
    expect(migrated.reserve).toBe(mineCapacity(migrated) / 4);
    expect(migrated.guards).toEqual(guards);
    expect(loaded.world[0].reserve).toBe(0);
    expect(loaded.world.map((v) => v.wallet)).toEqual(wallets);
    expect(advance(loaded, loaded.now).world).toEqual(loaded.world);
  });
  it('keeps an old in-flight plan and stock until return, then migrates without paying twice', async () => {
    let s = prepared();
    s.formation = [{ unitId: 'tank_t7', count: 20 }, null, null, null, null, null];
    s = act(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    delete s.world[0].reserveVersion;
    s.world[0].reserve = mineCapacity(s.world[0]);
    const plan = structuredClone(s.marches[0]),
      cap = mineCapacity(s.world[0]);
    s = advance(await parseSave(await exportSave(s)), s.now);
    expect(s.marches[0]).toEqual(plan);
    expect(mineCapacity(s.world[0])).toBe(cap);
    s = act(s, { type: 'rest', minutes: 480 });
    expect(s.marches).toHaveLength(0);
    expect(s.world[0].reserveVersion).toBe(1);
    expect(s.expeditionLog![0].cargo.iron).toBe(cap);
    expect(advance(s, s.now).expeditionLog).toEqual(s.expeditionLog);
  });
  it('fills a 75-level fleet instead of prematurely returning at the old reserve limit', () => {
    let s = prepared();
    s.commander.leadership = 75;
    s.tech.cargo = 75;
    s.formation = Array.from({ length: 6 }, () => ({ unitId: 'tank_t7', count: 390 }));
    const site = s.world.find((v) => v.kind === 'mine' && v.resource === 'titanium')!;
    configureSite(site, 75, s.now);
    site.guards = Array(6).fill(null);
    site.conquered = true;
    const expected = expeditionLoad(s, s.formation);
    expect(site.reserve).toBeGreaterThan(expected);
    s = act(s, { type: 'march', targetId: site.id, mission: 'gather' });
    s = act(s, { type: 'rest', minutes: 720 * 60 });
    expect(s.marches).toHaveLength(0);
    expect(s.expeditionLog![0].cargo.titanium).toBe(expected);
    expect(s.expeditionLog![0].stored!.titanium + s.expeditionLog![0].discarded!.titanium).toBe(
      expected,
    );
    expect(s.world.find((v) => v.id === site.id)!.reserve).toBeLessThanOrEqual(mineCapacity(site));
    assertState(s);
  });
  it('still suspends replenishment while occupied and replenishes in four hourly steps', () => {
    let s = prepared();
    s.world[0].reserve = 0;
    s = advance(s, s.now + WORLD_INTERVAL);
    expect(s.world[0].reserve).toBe(mineCapacity(s.world[0]) / 4);
    s = advance(s, s.now + 3 * WORLD_INTERVAL);
    expect(s.world[0].reserve).toBe(mineCapacity(s.world[0]));
  });
});

describe('v33 persistent leadership history', () => {
  it.each([1, 10, 100] as const)(
    'records actual rolls and stops a %d batch on success',
    async (attempts) => {
      const s = prepared();
      const command: Command = { type: 'leadership', payment: 'gold', attempts };
      let result = execute(s, command, s.now, 'train').state;
      expect(result.leadershipHistory).toHaveLength(1);
      expect(result.leadershipHistory![0]).toMatchObject({
        requested: attempts,
        attempts: 1,
        target: 2,
        success: true,
        payment: 'gold',
      });
      expect(result.leadershipHistory![0].rolls).toHaveLength(1);
      expect(result.wallet.gold).toBe(s.wallet.gold - 19);
      expect(result.commander.books).toBe(s.commander.books);
      result = await parseSave(await exportSave(result));
      expect(execute(result, command, result.now, 'train').state).toBe(result);
      expect(result.leadershipHistory).toHaveLength(1);
    },
  );
  it('stores all failed attempts, does not silently cap history at the battle-report limit', async () => {
    let s = prepared();
    s.commander.leadership = 119;
    // Find a deterministic stream with 503 failures at 0.1%; no mocked random source.
    for (let seed = 500; seed < 3000; seed++) {
      const rand = rng32(seed);
      if (
        Array.from({ length: 503 }, () => Math.floor((rand() * 10000) / 4294967296)).every(
          (v) => v >= 10,
        )
      ) {
        s.seed = seed;
        break;
      }
    }
    s = act(s, { type: 'leadership', attempts: 100 });
    expect(s.leadershipHistory![0].rolls).toHaveLength(100);
    expect(s.leadershipHistory![0].success).toBe(false);
    for (let i = 0; i < 403; i++) s = act(s, { type: 'leadership', attempts: 1 });
    expect(s.commander.leadership).toBe(119);
    expect(s.commander.books).toBe(100000 - 503);
    expect(s.leadershipHistory).toHaveLength(404);
    expect((await parseSave(await exportSave(s))).leadershipHistory).toEqual(s.leadershipHistory);
    const invalid = structuredClone(s);
    invalid.leadershipHistory![0].rolls![0] = 0;
    expect(() => assertState(invalid)).toThrow('leadershipHistory');
  });
  it('migrates only the old last batch once, and rejection cannot create a history entry', async () => {
    let s = act(prepared(), { type: 'leadership', attempts: 10 });
    delete s.leadershipHistory;
    s = await parseSave(await exportSave(s));
    expect(s.leadershipHistory).toEqual([{ ...s.lastLeadership, legacy: true }]);
    enableCommander(s);
    expect(s.leadershipHistory).toHaveLength(1);
    s = act(s, { type: 'leadership', attempts: 100 });
    expect(s.leadershipHistory).toHaveLength(2);
    const before = structuredClone(s.leadershipHistory);
    s.commander.books = 0;
    expect(() => act(s, { type: 'leadership', attempts: 10 })).toThrow('还缺');
    expect(s.leadershipHistory).toEqual(before);
  });
});
