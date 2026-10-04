import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  advance,
  assertState,
  execute,
  formationAvailability,
  newGame,
  validateFormation,
} from '../src/core/engine';
import { exportSave, parseSave } from '../src/core/storage';
import { NativeStore } from '../native/rules/bridge';
import type { Command, Formation, GameState } from '../src/core/types';
const T = 1760000000000;
const act = (s: GameState, c: Command) => execute(s, c, s.now, crypto.randomUUID());
function fixture() {
  const s = newGame('preset-loading', '预设验收', T);
  const f: Formation = [
    { unitId: 'tank_t7', count: 20 },
    { unitId: 'rocket_t5', count: 20 },
    { unitId: 'rocket_t5', count: 20 },
    { unitId: 'spg_t7', count: 20 },
    null,
    { unitId: 'tank_t7', count: 20 },
  ];
  for (const [id, n] of [
    ['tank_t7', 7],
    ['rocket_t5', 31],
  ] as const) {
    s.available[id] = n;
    s.createdUnits[id] = n;
  }
  s.damaged.spg_t7 = 8;
  s.createdUnits.spg_t7 = 8;
  s.presets = [{ name: '满编计划', formation: f }];
  assertState(s);
  return s;
}
const roots: string[] = [];
const stores: NativeStore[] = [];
afterEach(() => {
  for (const s of stores.splice(0)) s.close();
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});
describe('saved templates load the maximum available force', () => {
  it('allocates duplicate types once, in slot order, preserving types and empty positions', () => {
    const s = fixture(),
      before = structuredClone(s),
      q = formationAvailability(s, s.presets[0].formation);
    expect(q.formation).toEqual([
      { unitId: 'tank_t7', count: 7 },
      { unitId: 'rocket_t5', count: 20 },
      { unitId: 'rocket_t5', count: 11 },
      null,
      null,
      null,
    ]);
    expect([q.requested, q.loaded, q.shortage]).toEqual([100, 38, 62]);
    expect(q.reductions.map((r) => [r.slot, r.stockShortage])).toEqual([
      [1, 13],
      [3, 9],
      [4, 20],
      [6, 20],
    ]);
    validateFormation(s, q.formation, true);
    expect(s).toEqual(before);
  });
  it('regular load changes the active formation only, without spending inventory', () => {
    const s = fixture(),
      r = act(s, { type: 'presetLoad', index: 0 });
    expect(r.result).toContain('可用38辆');
    expect(r.state.formation).toEqual(formationAvailability(s, s.presets[0].formation).formation);
    expect(r.state.presets).toEqual(s.presets);
    expect(r.state.available).toEqual(s.available);
    expect(r.state.damaged).toEqual(s.damaged);
    assertState(r.state);
  });
  it('reloading after replenishment restores the requested counts; surplus is not added', () => {
    let s = act(fixture(), { type: 'presetLoad', index: 0 }).state;
    for (const id of ['tank_t7', 'rocket_t5', 'spg_t7']) {
      s.createdUnits[id] += 100 - s.available[id];
      s.available[id] = 100;
    }
    const q = formationAvailability(s, s.presets[0].formation);
    expect(q.formation).toEqual(s.presets[0].formation);
    expect(q.shortage).toBe(0);
    s = act(s, { type: 'presetLoad', index: 0 }).state;
    expect(s.formation).toEqual(s.presets[0].formation);
    assertState(s);
  });
  it('reports leadership reduction separately and leaves the requested 100 intact', () => {
    const s = fixture();
    s.available.tank_t7 = 500;
    s.createdUnits.tank_t7 = 500;
    s.presets[0].formation = [{ unitId: 'tank_t7', count: 100 }, null, null, null, null, null];
    const q = formationAvailability(s, s.presets[0].formation);
    expect(q.loaded).toBe(20);
    expect(q.reductions[0]).toMatchObject({ stockShortage: 0, capShortage: 80 });
    expect(s.presets[0].formation[0]!.count).toBe(100);
  });
  it('all unavailable loads empty, keeps the template and prevents an empty battle', () => {
    let s = fixture();
    s.available.tank_t7 = 0;
    s.createdUnits.tank_t7 = 0;
    s.available.rocket_t5 = 0;
    s.createdUnits.rocket_t5 = 0;
    const preset = structuredClone(s.presets);
    s = act(s, { type: 'presetLoad', index: 0 }).state;
    expect(s.formation).toEqual(Array(6).fill(null));
    expect(s.presets).toEqual(preset);
    expect(() => act(s, { type: 'battle', stage: 0, formation: s.formation })).toThrow('部署战车');
  });
  it('outgoing, damaged and repairing vehicles stay excluded until available again', () => {
    let s = newGame('reserved', '预留', T);
    s = act(s, { type: 'presetSave', name: '出征模板' }).state;
    const requested = formationAvailability(s).loaded;
    s = act(s, { type: 'march', targetId: 'site-0', mission: 'gather' }).state;
    expect(formationAvailability(s, s.presets[0].formation).loaded).toBe(0);
    s = act(s, { type: 'presetLoad', index: 0 }).state;
    expect(s.marches).toHaveLength(1);
    s = advance(s, s.now + 24 * 3600000);
    const q = formationAvailability(s, s.presets[0].formation);
    expect(q.loaded).toBeGreaterThan(0);
    expect(q.loaded).toBeLessThanOrEqual(requested);
    assertState(s);
  });
  it('battle and save roundtrip retain the original template and use only loaded troops', async () => {
    const s = fixture(),
      q = formationAvailability(s, s.presets[0].formation);
    const r = act(s, { type: 'battle', stage: 0, formation: q.formation }).state;
    expect(r.reports[0].initial[0].reduce((n, u) => n + u.count, 0)).toBe(38);
    expect(r.presets).toEqual(s.presets);
    const loaded = await parseSave(await exportSave(r));
    expect(loaded.presets).toEqual(s.presets);
    assertState(loaded);
  });
  it('repair orders become available only as individual vehicles complete', () => {
    let s = fixture();
    s.wallet.crystal = 10000000;
    s = act(s, { type: 'repair', unitId: 'spg_t7', count: 8 }).state;
    expect(formationAvailability(s, s.presets[0].formation).formation[3]).toBeNull();
    s = advance(s, s.jobs.repair!.dueAt);
    expect(formationAvailability(s, s.presets[0].formation).formation[3]).toEqual({
      unitId: 'spg_t7',
      count: 1,
    });
    expect(s.presets[0].formation[3]!.count).toBe(20);
    assertState(s);
  });
  it.each([-1, 0.5, 9])('rejects invalid index %s without altering the input', (index) => {
    const s = fixture(),
      before = structuredClone(s);
    expect(() => act(s, { type: 'presetLoad', index })).toThrow('预设不存在');
    expect(s).toEqual(before);
  });
  it('native preview, load response, persisted template and repeated request agree', async () => {
    const root = mkdtempSync(join(tmpdir(), 'tankstorm-preset-'));
    roots.push(root);
    const store = new NativeStore(root);
    stores.push(store);
    store.boot();
    await store.handle({ op: 'import', text: await exportSave(fixture()) });
    const data = await store.handle({ op: 'tick' });
    expect(data.info.presetLoads[0].loaded).toBe(38);
    const source = structuredClone(store.state.presets),
      stock = structuredClone(store.state.available);
    const request = {
      op: 'command',
      id: 'load-preset-once',
      command: { type: 'presetLoad', index: 0 },
    };
    const result = await store.handle(request);
    expect(result.presetLoad.formation).toEqual(data.info.presetLoads[0].formation);
    expect(result.presetLoad.shortage).toBe(62);
    await store.handle(request);
    expect(store.state.presets).toEqual(source);
    expect(store.state.available).toEqual(stock);
    expect((await parseSave(await exportSave(store.state))).presets).toEqual(source);
  });
});
