import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NativeStore } from '../native/rules/bridge';
import { stageGrowth, stageNames } from '../src/core/content';
import { dungeons, dungeonGrowth, dungeonArmy } from '../src/core/arsenal';
import { execute, newGame } from '../src/core/engine';
import { commanderStats, army } from '../src/core/battle';
import { guardArmy } from '../src/core/world';
import { prestigeRequired } from '../src/core/commander';
import { exportSave, parseSave } from '../src/core/storage';

const roots: string[] = [],
  stores: NativeStore[] = [];
afterEach(() => {
  stores.splice(0).forEach((s) => s.close());
  roots.splice(0).forEach((p) => rmSync(p, { recursive: true, force: true }));
});
function ready() {
  const s = newGame('v38', '战前属性', 1790985600000, 38);
  s.buildings.factory = 120;
  s.commander.prestige = prestigeRequired(120);
  s.commander.leadership = 120;
  s.available.tank_t7 = s.createdUnits.tank_t7 = 20000;
  s.formation = Array.from({ length: 6 }, () => ({ unitId: 'tank_t7', count: 1000 }));
  return s;
}
describe('v38 campaign growth and enemy intelligence', () => {
  it('multiplies every original first and repeat prestige payout exactly by five', () => {
    for (let i = 0; i < stageNames.length; i++) {
      const old = i < 12 ? 10 + i * 5 : 50 + Math.floor(i / 16) * 150 + (i % 16) * 10;
      expect(stageGrowth(i, true).prestige).toBe(old * 5);
      expect(stageGrowth(i, false).prestige).toBe(Math.floor(old / 2) * 5);
    }
    for (const d of dungeons) {
      expect(dungeonGrowth(d, true).prestige).toBe((150 + d.index * 20) * 5);
      expect(dungeonGrowth(d, false).prestige).toBe((75 + d.index * 10) * 5);
      expect(dungeonGrowth(d, false).books).toBe(0);
    }
  });
  it.each(['main', 'core'])(
    'settles %s preview rewards once and keeps historical payouts on reload',
    async (mode) => {
      const c =
        mode === 'main'
          ? { type: 'battle' as const, stage: 0 }
          : { type: 'dungeon' as const, dungeonId: dungeons[0].id };
      let s = ready();
      const old = execute(s, { type: 'battle', stage: 0, training: true }, s.now, 'historical')
        .state.reports[0];
      old.id = 'historical-v36-unchanged';
      old.growth = { xp: 1, prestige: 17, books: 0, skillPoints: 0 };
      s.reports.push(old);
      const before = s.commander.prestige;
      s = execute(s, c, s.now, 'first').state;
      expect(s.reports[0].winner).toBe(0);
      expect(s.commander.prestige - before).toBe(mode === 'main' ? 50 : 750);
      const books = s.commander.books;
      const first = structuredClone(s.reports[0]);
      s = execute(s, c, s.now, 'repeat').state;
      expect(s.reports[0].growth!.prestige).toBe(mode === 'main' ? 25 : 375);
      expect(s.commander.books).toBe(books);
      expect(s.reports[1]).toEqual(first);
      const prestige = s.commander.prestige;
      s = execute(s, c, s.now, 'repeat').state;
      expect(s.commander.prestige).toBe(prestige);
      const loaded = await parseSave(await exportSave(s));
      expect(loaded.reports.find((r) => r.id === old.id)?.growth!.prestige).toBe(17);
    },
  );
  it('publishes campaign snapshots matching combat and only exposes scouted world attributes', async () => {
    const root = mkdtempSync(join(tmpdir(), 'tankstorm-intel38-'));
    roots.push(root);
    const store = new NativeStore(root);
    stores.push(store);
    const boot = await store.handle({ op: 'boot' });
    store.state = ready();
    const reply = await store.handle({ op: 'tick' });
    expect(reply.info.knownGuardStats).toEqual({});
    expect(reply.info.knownGuardCommanders).toEqual({});
    for (const i of [0, 97, 319]) {
      expect(boot.catalog.dungeons[i].enemy).toEqual({
        army: dungeonArmy(dungeons[i]),
        commander: commanderStats({
          march: dungeons[i].guardTech,
          ballistics: dungeons[i].guardTech,
        }),
      });
    }
    const main = execute(
      store.state,
      { type: 'battle', stage: 0, training: true },
      store.state.now,
      'main',
    ).state.reports[0];
    expect(boot.catalog.stages[0].enemy).toEqual({
      army: main.initial[1],
      commander: main.tactics!.teams[1],
    });
    const core = execute(
      store.state,
      { type: 'dungeon', dungeonId: dungeons[0].id, training: true },
      store.state.now,
      'core',
    ).state.reports[0];
    expect(boot.catalog.dungeons[0].enemy).toEqual({
      army: core.initial[1],
      commander: core.tactics!.teams[1],
    });
    store.state.wallet.crystal = 100000;
    const site = store.state.world.find((s) => s.level > 30)!;
    const scanned = await store.handle({
      op: 'command',
      command: { type: 'scout', targetId: site.id },
    });
    expect(scanned.info.knownGuardStats[site.id]).toEqual(
      guardArmy(site, scanned.state.intel[site.id].guards),
    );
    const level = Math.floor(site.level / 2);
    expect(scanned.info.knownGuardCommanders[site.id]).toEqual(
      commanderStats({ march: level, ballistics: level }),
    );
    // Live hidden changes must not replace the obtained intelligence formation.
    store.state.world.find((s) => s.id === site.id)!.guards = Array(6).fill(null);
    const changed = await store.handle({ op: 'tick' });
    expect(changed.info.knownGuardStats[site.id]).toEqual(scanned.info.knownGuardStats[site.id]);
    expect(army(Array(6).fill(null))).toEqual([]);
  });
});
