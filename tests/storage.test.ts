import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { newGame, execute } from '../src/core/engine';
import {
  createSave,
  exportSave,
  parseSave,
  loadSave,
  updateSave,
  restoreBackup,
  canonical,
} from '../src/core/storage';
describe('durable saves', () => {
  it('A01 export and import roundtrip preserves complete state', async () => {
    const s = newGame('roundtrip', '指挥官', 1700000000000);
    const encoded = await exportSave(s);
    expect(await parseSave(encoded)).toEqual(s);
  });
  it('A18 corrupt and unknown rule files reject without touching current save', async () => {
    const s = newGame('safe', '旧存档', 1700000000000);
    await createSave(s);
    const doc = JSON.parse(await exportSave(s));
    doc.state.wallet.iron++;
    await expect(parseSave(JSON.stringify(doc))).rejects.toThrow('校验失败');
    doc.ruleset = 'unknown';
    await expect(parseSave(JSON.stringify(doc))).rejects.toThrow('不兼容');
    expect(await loadSave('safe')).toEqual(s);
    await expect(parseSave('{')).rejects.toThrow('JSON');
  });
  it('A20 two competing compare-and-swap transactions accept exactly one', async () => {
    const s = newGame('concurrent', '指挥官', 1700000000000);
    await createSave(s);
    const results = await Promise.allSettled([
      updateSave(
        s.id,
        (x) => execute(x, { type: 'produce', unitId: 'tank_t1', count: 5 }, x.now, 'a'),
        0,
      ),
      updateSave(
        s.id,
        (x) => execute(x, { type: 'produce', unitId: 'tank_t1', count: 5 }, x.now, 'b'),
        0,
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await loadSave(s.id))!.wallet.iron).toBe(1400);
  });
  it('duplicate id across serialized transactions does not duplicate rewards', async () => {
    const s = newGame('retry', '指挥官', 1700000000000);
    await createSave(s);
    await Promise.all([
      updateSave(s.id, (x) => execute(x, { type: 'daily' }, x.now, 'same')),
      updateSave(s.id, (x) => execute(x, { type: 'daily' }, x.now, 'same')),
    ]);
    expect((await loadSave(s.id))!.wallet.gold).toBe(55);
  });
  it('transaction failure rolls back and backup restores previous commit', async () => {
    const s = newGame('rollback', '指挥官', 1700000000000);
    await createSave(s);
    await expect(
      updateSave(s.id, (x) => {
        x.wallet.gold = -5;
        return { state: x, result: '' };
      }),
    ).rejects.toThrow();
    expect(await loadSave(s.id)).toEqual(s);
    await updateSave(s.id, (x) => execute(x, { type: 'daily' }, x.now, 'daily'));
    expect((await restoreBackup(s.id)).wallet.gold).toBe(50);
  });
  it('canonical checksum serialization ignores object key order', () => {
    expect(canonical({ z: 1, a: { q: 2, b: 3 } })).toBe(canonical({ a: { b: 3, q: 2 }, z: 1 }));
  });
});
