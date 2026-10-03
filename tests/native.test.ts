import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NativeStore, serve } from '../native/rules/bridge';
import { assertState, newGame } from '../src/core/engine';
import { unitList } from '../src/core/content';
import { exportSave, parseSave } from '../src/core/storage';

const roots: string[] = [];
const stores: NativeStore[] = [];
function make() {
  const root = mkdtempSync(join(tmpdir(), 'tankstorm-native-'));
  roots.push(root);
  const store = new NativeStore(root);
  stores.push(store);
  return store;
}
afterEach(() => {
  for (const s of stores.splice(0)) s.close();
  vi.restoreAllMocks();
  for (const p of roots.splice(0)) rmSync(p, { recursive: true, force: true });
});
describe('native filesystem runtime', () => {
  it('commits a battle with its deployment atomically and replays its receipt without a second battle', async () => {
    const store = make();
    store.boot();
    const before = readFileSync(store.path(store.state.id), 'utf8');
    await expect(
      store.handle({
        op: 'command',
        id: 'invalid-deployment',
        command: { type: 'battle', stage: 0, formation: Array(6).fill(null) },
      }),
    ).rejects.toThrow('部署战车');
    expect(readFileSync(store.path(store.state.id), 'utf8')).toBe(before);
    const request = {
      op: 'command',
      id: 'confirmed-deployment',
      command: {
        type: 'battle',
        stage: 0,
        formation: [{ unitId: 'tank_t1', count: 10 }, null, null, null, null, null],
      },
    };
    const first = await store.handle(request),
      state = structuredClone(store.state);
    expect(first.report.initial[0][0].count).toBe(10);
    expect(store.read(store.state.id).formation).toEqual(request.command.formation);
    const second = await store.handle(request);
    expect(second.report).toEqual(first.report);
    expect(store.state).toEqual(state);
    expect(store.state.reports).toHaveLength(1);
    assertState(store.state);
  });
  it('reads a legacy twelve-unit file and preserves modern core and refit data across copy, switch and import', async () => {
    const store = make();
    const old = newGame('legacy', '旧指挥部', Date.now());
    delete old.arsenal;
    for (const stock of [old.available, old.damaged, old.createdUnits, old.destroyedUnits])
      for (const u of unitList.filter((u) => u.tier > 3)) delete stock[u.unitId];
    writeFileSync(store.path(old.id), JSON.stringify(old));
    store.load(old.id);
    expect(Object.keys(store.state.available)).toHaveLength(28);
    expect(store.state.arsenal!.cores.tank_core6).toBe(0);
    store.state.buildings.hq = store.state.buildings.factory = 60;
    store.state.industry = { version: 1, factory2: 0, refit: 60 };
    for (const r of Object.keys(store.state.wallet))
      store.state.wallet[r as keyof typeof store.state.wallet] = 1000000;
    store.state.arsenal!.cores.tank_core6 = 4;
    store.state.available.tank_t5 = store.state.createdUnits.tank_t5 = 4;
    await store.handle({ op: 'command', command: { type: 'refit', unitId: 'tank_t6', count: 4 } });
    const originalId = store.state.id;
    await store.handle({ op: 'copy', nickname: '核心副本档' });
    const copiedId = store.state.id;
    expect(store.state.jobs['production:refit']!.sourceUnitId).toBe('tank_t5');
    const exported = await exportSave(store.state);
    await store.handle({ op: 'command', command: { type: 'cancel', kind: 'production' } });
    expect(store.state.arsenal!.cores.tank_core6).toBe(4);
    await store.handle({ op: 'load', id: originalId });
    expect(store.state.arsenal!.cores.tank_core6).toBe(0);
    expect(store.state.jobs['production:refit']!.total).toBe(4);
    await store.handle({ op: 'import', text: exported });
    expect(store.state.id).not.toBe(copiedId);
    expect(store.state.jobs['production:refit']!.sourceUnitId).toBe('tank_t5');
    await store.handle({ op: 'command', command: { type: 'cancel', kind: 'production' } });
    expect(store.state.available.tank_t5).toBe(4);
    expect(store.state.arsenal!.cores.tank_core6).toBe(4);
    assertState(store.state);
  });
  it('switches independent bases, saves on F5, and remembers the selected slot after restart', async () => {
    const store = make();
    store.boot();
    const first = store.state.id;
    await store.handle({ op: 'command', command: { type: 'rename', nickname: '北方基地' } });
    await store.handle({
      op: 'command',
      command: { type: 'produce', unitId: 'tank_t1', count: 5 },
    });
    await store.handle({ op: 'command', command: { type: 'accelerate', kind: 'production' } });
    await store.handle({ op: 'new', nickname: '南方基地', seed: 123 });
    const second = store.state.id;
    expect(store.state.available.tank_t1).toBe(20);
    await store.handle({ op: 'save' });
    await store.handle({ op: 'load', id: first });
    expect(store.state.nickname).toBe('北方基地');
    expect(store.state.available.tank_t1).toBe(25);
    const metadata = store.list().find((x) => x.id === first)!;
    expect(metadata.savedAt).toBeGreaterThan(0);
    expect(metadata.hq).toBe(1);
    await store.handle({ op: 'load', id: second });
    store.close();
    const reopened = new NativeStore(store.root);
    stores.push(reopened);
    reopened.boot();
    expect(reopened.state.id).toBe(second);
    expect(reopened.state.nickname).toBe('南方基地');
    expect(reopened.state.available.tank_t1).toBe(20);
  });
  it('manual save includes formation edits and rejects invalid edits without altering disk', async () => {
    const s = make();
    s.boot();
    const formation = [{ unitId: 'tank_t1', count: 5 }, null, null, null, null, null];
    const saved = await s.handle({ op: 'save', formation });
    expect(saved.formationSaved).toBe(true);
    expect(s.read(s.state.id).formation).toEqual(formation);
    const original = readFileSync(s.path(s.state.id), 'utf8');
    await expect(
      s.handle({
        op: 'save',
        formation: [{ unitId: 'tank_t1', count: 999 }, null, null, null, null, null],
      }),
    ).rejects.toThrow();
    expect(readFileSync(s.path(s.state.id), 'utf8')).toBe(original);
    expect(s.state.formation).toEqual(formation);
  });
  it('inactive slots continue their own queues and settle once when switched back', async () => {
    let now = 1700000000000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const s = make();
    s.boot();
    const first = s.state.id;
    await s.handle({ op: 'command', command: { type: 'produce', unitId: 'tank_t1', count: 5 } });
    const duration = s.state.jobs.production!.duration;
    await s.handle({ op: 'new', nickname: '第二基地' });
    const second = s.state.id;
    now += duration * 3;
    await s.handle({ op: 'load', id: first });
    expect(s.state.available.tank_t1).toBe(23);
    expect(s.state.jobs.production?.completed).toBe(3);
    await s.handle({ op: 'load', id: second });
    expect(s.state.available.tank_t1).toBe(20);
    now += duration * 2;
    await s.handle({ op: 'load', id: first });
    expect(s.state.available.tank_t1).toBe(25);
    expect(s.state.jobs.production).toBeUndefined();
    await s.handle({ op: 'load', id: first });
    expect(s.state.available.tank_t1).toBe(25);
  });
  it('save-as copies progress and edits into an independent slot with its own recovery backup', async () => {
    const s = make();
    s.boot();
    await s.handle({ op: 'command', command: { type: 'rest', minutes: 480 } });
    const first = s.state.id;
    const originalFormation = structuredClone(s.state.formation);
    const formation = [{ unitId: 'tank_t1', count: 5 }, null, null, null, null, null];
    await s.handle({ op: 'copy', nickname: '决战前备份', formation });
    const copy = s.state.id;
    expect(copy).not.toBe(first);
    expect(s.state.nickname).toBe('决战前备份');
    expect(s.state.timeOffset).toBe(28800000);
    expect(s.state.formation).toEqual(formation);
    expect(s.read(first).formation).toEqual(originalFormation);
    expect(s.read(copy, true).formation).toEqual(formation);
    await s.handle({ op: 'command', command: { type: 'produce', unitId: 'tank_t1', count: 5 } });
    await s.handle({ op: 'command', command: { type: 'accelerate', kind: 'production' } });
    await s.handle({ op: 'load', id: first });
    expect(s.state.available.tank_t1).toBe(20);
    await s.handle({ op: 'load', id: copy });
    expect(s.state.available.tank_t1).toBe(25);
  });
  it('finds and recovers a new base even when its primary file is missing', async () => {
    const s = make();
    s.boot();
    const id = s.state.id;
    s.close();
    unlinkSync(s.path(id));
    const reopened = new NativeStore(s.root);
    stores.push(reopened);
    expect(reopened.list()[0]).toMatchObject({ id, recoverable: true });
    const booted = await reopened.handle({ op: 'boot' });
    expect(booted.recovered).toContain('备份');
    expect(reopened.state.id).toBe(id);
    expect(existsSync(reopened.path(id))).toBe(true);
    expect((await reopened.handle({ op: 'tick' })).recovered).toBe('');
  });
  it('a failed save switch keeps the active slot in memory and on disk', async () => {
    const s = make();
    s.boot();
    const first = s.state.id;
    await s.handle({ op: 'new', nickname: '另一个基地' });
    const second = s.state.id;
    const atomic = s.atomic.bind(s);
    const spy = vi.spyOn(s, 'atomic').mockImplementation((path, text) => {
      if (path === join(s.root, 'active.json')) throw Error('模拟磁盘拒绝写入');
      atomic(path, text);
    });
    await expect(s.handle({ op: 'load', id: first })).rejects.toThrow('拒绝');
    expect(s.state.id).toBe(second);
    expect(JSON.parse(readFileSync(join(s.root, 'active.json'), 'utf8')).id).toBe(second);
    spy.mockRestore();
  });
  it('failed imported-slot activation removes only the new files and preserves existing bases', async () => {
    const s = make();
    s.boot();
    const id = s.state.id;
    const exported = await s.handle({ op: 'export' });
    const oldFile = readFileSync(s.path(id), 'utf8');
    const atomic = s.atomic.bind(s);
    const spy = vi.spyOn(s, 'atomic').mockImplementation((path, text) => {
      if (path === join(s.root, 'active.json')) throw Error('模拟切换失败');
      atomic(path, text);
    });
    await expect(s.handle({ op: 'import', text: exported.text })).rejects.toThrow('切换失败');
    expect(s.list()).toHaveLength(1);
    expect(s.state.id).toBe(id);
    expect(readFileSync(s.path(id), 'utf8')).toBe(oldFile);
    spy.mockRestore();
  });
  it('an unadvanceable import creates no slot, and an unadvanceable backup cannot overwrite the primary', async () => {
    const s = make();
    s.boot();
    const old = newGame(s.state.id, '过期档案', Date.now() - 12 * 365 * 86400000);
    const primary = readFileSync(s.path(s.state.id), 'utf8');
    await expect(s.handle({ op: 'import', text: await exportSave(old) })).rejects.toThrow(
      '时间跨度',
    );
    expect(s.list()).toHaveLength(1);
    expect(readFileSync(s.path(s.state.id), 'utf8')).toBe(primary);
    writeFileSync(s.path(s.state.id, '.backup'), JSON.stringify(old));
    await expect(s.handle({ op: 'restore' })).rejects.toThrow('时间跨度');
    expect(readFileSync(s.path(s.state.id), 'utf8')).toBe(primary);
    expect(s.state.nickname).not.toBe('过期档案');
  });
  it('boots a new base and reloads the exact saved commander after restart', async () => {
    const a = make();
    await a.handle({ op: 'boot' });
    const id = a.state.id;
    await a.handle({
      op: 'command',
      id: 'rename',
      command: { type: 'rename', nickname: '装甲测试' },
    });
    a.close();
    const b = new NativeStore(a.root);
    stores.push(b);
    await b.handle({ op: 'boot' });
    expect(b.state.id).toBe(id);
    expect(b.state.nickname).toBe('装甲测试');
    assertState(b.state);
  });
  it('commits production atomically, and cannot duplicate a retried command', async () => {
    const s = make();
    s.boot();
    const cmd = {
      op: 'command',
      id: 'produce-once',
      command: { type: 'produce', unitId: 'tank_t1', count: 5 },
    };
    await s.handle(cmd);
    const wallet = { ...s.state.wallet };
    await s.handle(cmd);
    expect(s.state.wallet).toEqual(wallet);
    expect(s.state.jobs.production!.total).toBe(5);
    await s.handle({ op: 'command', command: { type: 'accelerate', kind: 'production' } });
    expect(s.state.available.tank_t1).toBe(25);
    assertState(s.read(s.state.id));
  });
  it('rejects failed commands without damaging the save or backup', async () => {
    const s = make();
    s.boot();
    const text = readFileSync(s.path(s.state.id), 'utf8');
    const backup = readFileSync(s.path(s.state.id, '.backup'), 'utf8');
    await expect(
      s.handle({ op: 'command', command: { type: 'produce', unitId: 'tank_t1', count: 10000 } }),
    ).rejects.toThrow();
    expect(readFileSync(s.path(s.state.id), 'utf8')).toBe(text);
    expect(readFileSync(s.path(s.state.id, '.backup'), 'utf8')).toBe(backup);
  });
  it('restores the previous committed operation when the primary save is corrupt', async () => {
    const a = make();
    a.boot();
    const id = a.state.id,
      old = a.state.nickname;
    await a.handle({ op: 'command', command: { type: 'rename', nickname: '即将损坏' } });
    a.close();
    writeFileSync(a.path(id), '{broken');
    const b = new NativeStore(a.root);
    stores.push(b);
    b.boot();
    expect(b.state.nickname).toBe(old);
    expect(b.recovered).toContain('备份');
    assertState(b.read(id));
  });
  it('exports compatible checksummed saves and imports into a new slot', async () => {
    const s = make();
    s.boot();
    const old = s.state.id;
    const exported = await s.handle({ op: 'export' });
    const parsed = await parseSave(exported.text);
    expect(parsed.id).toBe(old);
    await s.handle({ op: 'import', text: exported.text });
    expect(s.state.id).not.toBe(old);
    expect(s.list()).toHaveLength(2);
    expect(s.state.available).toEqual(parsed.available);
  });
  it('refuses tampered imports before changing the active state', async () => {
    const s = make();
    s.boot();
    const id = s.state.id;
    const exported = JSON.parse((await s.handle({ op: 'export' })).text);
    exported.state.wallet.gold += 999;
    await expect(s.handle({ op: 'import', text: JSON.stringify(exported) })).rejects.toThrow(
      '校验失败',
    );
    expect(s.state.id).toBe(id);
    expect(s.list()).toHaveLength(1);
  });
  it('settles production across offline restart', async () => {
    const a = make();
    a.boot();
    await a.handle({ op: 'command', command: { type: 'produce', unitId: 'tank_t1', count: 5 } });
    const s = structuredClone(a.state);
    const elapsed = s.jobs.production!.duration * s.jobs.production!.total + 1000;
    s.now -= elapsed;
    s.jobs.production!.startedAt -= elapsed;
    s.jobs.production!.dueAt -= elapsed;
    for (const site of s.world) site.lastGrowth -= elapsed;
    a.commit(s);
    a.close();
    const b = new NativeStore(a.root);
    stores.push(b);
    b.boot();
    expect(b.state.jobs.production).toBeUndefined();
    expect(b.state.available.tank_t1).toBe(25);
  });
  it('rest clock survives restart and still counts real offline time without freezing', async () => {
    const a = make();
    a.boot();
    await a.handle({ op: 'command', id: 'rest-clock', command: { type: 'rest', minutes: 480 } });
    const offset = a.state.timeOffset!;
    const originalId = a.state.id;
    expect(offset).toBe(28800000);
    await a.handle({ op: 'command', command: { type: 'produce', unitId: 'tank_t1', count: 5 } });
    const then = structuredClone(a.state);
    const elapsed = then.jobs.production!.duration * then.jobs.production!.total + 1000;
    then.now -= elapsed;
    then.jobs.production!.startedAt -= elapsed;
    then.jobs.production!.dueAt -= elapsed;
    for (const site of then.world) site.lastGrowth -= elapsed;
    a.commit(then);
    a.close();
    const b = new NativeStore(a.root);
    stores.push(b);
    b.boot();
    expect(b.state.id).toBe(originalId);
    expect(b.state.timeOffset).toBe(offset);
    expect(b.state.jobs.production).toBeUndefined();
    expect(b.state.available.tank_t1).toBe(25);
    const now = b.state.now;
    b.tick(Date.now() + 1000);
    expect(b.state.now).toBeGreaterThan(now);
    const doc = await b.handle({ op: 'export' });
    await b.handle({ op: 'import', text: doc.text });
    expect(b.state.timeOffset).toBe(offset);
    assertState(b.state);
  });
  it('prevents two live game instances from opening the same save directory', () => {
    const a = make();
    expect(() => new NativeStore(a.root)).toThrow('已在运行');
    a.close();
    const b = new NativeStore(a.root);
    stores.push(b);
    expect(b).toBeDefined();
  });
  it('rejects path traversal identifiers', () => {
    const s = make();
    expect(() => s.path('../outside')).toThrow('编号无效');
    expect(() => s.path('C:\\test')).toThrow();
  });
  it('plays battles with the existing deterministic rules and keeps replay streams out of polling', async () => {
    const s = make();
    s.boot();
    const before = { ...s.state.available };
    const result = await s.handle({
      op: 'command',
      command: { type: 'battle', stage: 2, training: true },
    });
    expect(result.report.events.length).toBeGreaterThan(3);
    expect(s.state.available).toEqual(before);
    expect(result.state.reports[0]).not.toHaveProperty('events');
    const replay = await s.handle({ op: 'report', id: result.report.id });
    expect(replay.report.events).toEqual(result.report.events);
  });
  it('authenticates local requests and rejects browser-origin calls', async () => {
    const root = mkdtempSync(join(tmpdir(), 'tankstorm-native-http-'));
    roots.push(root);
    const ready = join(root, 'ready');
    const { server, shutdown, store } = await serve(root, ready, 'test-token', process.pid);
    stores.push(store);
    try {
      const { port } = JSON.parse(readFileSync(ready, 'utf8'));
      const url = `http://127.0.0.1:${port}/rpc`;
      const denied = await fetch(url, { method: 'POST', body: '{}' });
      expect(denied.status).toBe(403);
      const origin = await fetch(url, {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token', Origin: 'https://example.org' },
        body: '{}',
      });
      expect(origin.status).toBe(403);
      const ok = await fetch(url, {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
        body: JSON.stringify({ op: 'boot' }),
      });
      const data = await ok.json();
      expect(data.ok).toBe(true);
      expect(data.catalog.unitList).toHaveLength(28);
    } finally {
      shutdown();
      server.closeAllConnections();
    }
  });
});
