import { describe, it, expect } from 'vitest';
import { advance, assertState, capacity, execute, newGame, rate } from '../src/core/engine';
import { army, commanderStats, simulate } from '../src/core/battle';
import { archiveRows, trimArchive, REPORT_LIMIT } from '../src/core/archive';
import { transportStatus } from '../src/core/overview';
import { exportSave, parseSave } from '../src/core/storage';
import type { Command, GameState } from '../src/core/types';

let seq = 0;
const act = (s: GameState, c: Command) => execute(s, c, s.now, 'v31-' + ++seq).state;
function gathering(guards = false) {
  let s = newGame('gather31', '归队验证', 1700000000000, 31);
  s.buildings.hq = s.buildings.warehouse = 40;
  // Expanded mines can fill this fleet; gathering research keeps the complete trip within 8h.
  s.tech.gather = 120;
  s.available.tank_t7 = s.createdUnits.tank_t7 = 20;
  s.formation = [{ unitId: 'tank_t7', count: 20 }, null, null, null, null, null];
  s.world[0].guards = guards
    ? [{ unitId: 'tank_t1', count: 1 }, null, null, null, null, null]
    : Array(6).fill(null);
  s = act(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
  return advance(s, s.marches[0].dueAt);
}

describe('v31 commander attributes and immutable deployment', () => {
  it('does not bind commander stats to vehicle tier, count, number or position', () => {
    const s = newGame('t', 'test', 10000);
    s.tech.march = 11;
    s.tech.ballistics = 9;
    s.commander.initiativeSkill = 4;
    s.commander.extraFireSkill = 3;
    const stats = commanderStats(s.tech, s.commander);
    expect(stats).toEqual({ initiative: 145, extraFire: 148 });
    for (const f of [
      [],
      [{ unitId: 'tank_t1', count: 1 }],
      Array(6).fill({ unitId: 'rocket_t7', count: 200 }),
    ]) {
      const stacks = army(f, s.tech, s.commander.attackSkill, s.commander);
      expect(stacks.every((st) => !('initiative' in st) && !('extraFire' in st))).toBe(true);
      expect(
        simulate(stacks, army([{ unitId: 'tank_t1', count: 10 }]), 1, 'training', [
          stats,
          commanderStats(),
        ]).tactics!.teams[0],
      ).toEqual(stats);
    }
  });
  it('snapshots the commander at dispatch, not after a later skill upgrade', () => {
    let s = gathering();
    expect(s.marches[0].commanderStats).toEqual(commanderStats());
    s.commander.initiativeSkill = 120;
    expect(s.marches[0].commanderStats!.initiative).toBe(100);
    expect(commanderStats(s.tech, s.commander).initiative).toBe(460);
  });
});

describe('v31 gathering receipts and eight-hour rest', () => {
  it.each([false, true])(
    'credits gathered cargo with/without a preceding battle: guards=%s',
    (guards) => {
      const s = gathering(guards),
        before = s.wallet.iron;
      expect(s.marches[0].phase).toBe('gathering');
      const after = act(s, { type: 'rest', minutes: 480 });
      const receipt = after.expeditionLog![0];
      expect(after.marches).toHaveLength(0);
      expect(receipt.stored!.iron).toBeGreaterThan(0);
      expect(receipt.stored!.iron).toBe(receipt.cargo.iron);
      expect(after.wallet.iron).toBe(
        before +
          Math.floor((rate(s, 'iron') * 8 * 3600000 + s.remainders.iron) / 3600000) +
          receipt.stored!.iron,
      );
      expect(archiveRows(after).filter((r) => r.category === 'gather-return')).toHaveLength(1);
      expect(after.available.tank_t7).toBe(20);
      assertState(after);
    },
  );
  it('matches minute-by-minute simulation over the same eight hours', () => {
    const s = gathering(true),
      end = s.now + 8 * 3600000;
    const bulk = advance(s, end);
    let step = structuredClone(s);
    while (step.now < end) step = advance(step, Math.min(end, step.now + 60000));
    expect(bulk.wallet).toEqual(step.wallet);
    expect(bulk.expeditionLog).toEqual(step.expeditionLog);
    expect(bulk.available).toEqual(step.available);
  });
  it.each(['partial', 'full', 'above'] as const)(
    'discards overflow without deleting already-owned stock: %s',
    (kind) => {
      let s = gathering();
      s = advance(s, s.marches[0].dueAt);
      expect(s.marches[0].phase).toBe('returning');
      const cap = capacity(s);
      s.wallet.iron = kind === 'partial' ? cap - 300 : kind === 'full' ? cap : cap + 100;
      const before = s.wallet.iron,
        cargo = s.marches[0].cargo.iron;
      const after = advance(s, s.marches[0].dueAt),
        receipt = after.expeditionLog![0];
      expect(receipt.stored!.iron + receipt.discarded!.iron).toBe(cargo);
      expect(receipt.discarded!.iron).toBeGreaterThan(0);
      expect(after.wallet.iron).toBe(Math.max(cap, before));
      expect(receipt.stored!.iron).toBeLessThanOrEqual(Math.max(0, cap - before));
      expect(after.counters.cargo).toBe(receipt.stored!.iron);
    },
  );
  it('rest/save/reload/archive/replay cannot deliver the same cargo twice', async () => {
    const s = act(gathering(true), { type: 'rest', minutes: 480 });
    const restored = await parseSave(await exportSave(s));
    const wallet = { ...restored.wallet },
      receipt = structuredClone(restored.expeditionLog);
    for (let i = 0; i < 5; i++) {
      archiveRows(restored);
      expect(transportStatus(restored, restored.reports[0]).cargo).toEqual(
        restored.expeditionLog![0].stored,
      );
    }
    expect(advance(restored, restored.now).wallet).toEqual(wallet);
    expect(advance(restored, restored.now).expeditionLog).toEqual(receipt);
    expect(restored.reports).toEqual(s.reports);
  });
  it('recall returns the partially collected amount; no free fill on recall', () => {
    let s = gathering();
    s = advance(s, s.now + 60000);
    const cargo = s.marches[0].cargo.iron;
    s = act(s, { type: 'recall', marchId: s.marches[0].id });
    s = act(s, { type: 'rest', minutes: 480 });
    expect(s.expeditionLog![0].stored!.iron).toBe(cargo);
  });
  it('records failure separately from the attack and gives no invented cargo', () => {
    let s = newGame('loss31', '失败验证', 1700000000000, 31);
    s.world[0].guards = [{ unitId: 'tank_t7', count: 600 }, null, null, null, null, null];
    s = act(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    s = act(s, { type: 'rest', minutes: 480 });
    const rows = archiveRows(s);
    expect(rows.map((r) => r.category).sort()).toEqual(['gather-return', 'mine']);
    expect(rows.every((r) => r.outcome === 'failure')).toBe(true);
    expect(s.expeditionLog![0].stored!.iron).toBe(0);
  });
  it('reads old return receipts and old in-flight snapshots without changing history', async () => {
    let s = gathering(true);
    delete s.marches[0].commanderStats;
    s = act(s, { type: 'rest', minutes: 480 });
    const receipt = s.expeditionLog![0];
    for (const key of [
      'mission',
      'title',
      'stored',
      'discarded',
      'battleId',
      'casualties',
    ] as const)
      delete receipt[key];
    const loaded = await parseSave(await exportSave(s));
    expect(loaded.reports).toEqual(s.reports);
    expect(archiveRows(loaded).find((r) => r.receipt)).toMatchObject({
      confirmed: false,
      rewards: receipt.cargo,
    });
  });
});

describe('v31 shared archive retention', () => {
  it('retains the newest 400 mixed records, exports and reloads them', async () => {
    const s = act(gathering(true), { type: 'rest', minutes: 480 });
    const battle = s.reports[0],
      receipt = s.expeditionLog![0];
    s.reports = Array.from({ length: 250 }, (_, i) => ({
      ...structuredClone(battle),
      id: 'battle-' + i,
      at: s.now - 500 + i * 2,
    }));
    s.expeditionLog = Array.from({ length: 250 }, (_, i) => ({
      ...structuredClone(receipt),
      marchId: 'march-' + i,
      at: s.now - 499 + i * 2,
    }));
    trimArchive(s);
    expect(s.reports.length + s.expeditionLog.length).toBe(REPORT_LIMIT);
    expect(archiveRows(s)).toHaveLength(400);
    expect(archiveRows(s)[0].at).toBe(s.now - 1);
    const loaded = await parseSave(await exportSave(s));
    expect(archiveRows(loaded)).toEqual(archiveRows(s));
  });
});
