import { describe, it, expect } from 'vitest';
import { newGame, execute, advance, assertState } from '../src/core/engine';
import {
  inventoryView,
  progressSummary,
  transportStatus,
  battleSummary,
} from '../src/core/overview';
import { army, simulate } from '../src/core/battle';
import { NativeStore } from '../native/rules/bridge';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportSave, parseSave } from '../src/core/storage';
import type { Command, GameState, Formation } from '../src/core/types';

const game = () => newGame('experience', '体验验收', 1000000, 1938);
let serial = 0;
const act = (s: GameState, c: Command) => execute(s, c, s.now, `xp-${++serial}`).state;
const deployed: Formation = [{ unitId: 'tank_t1', count: 10 }, null, null, null, null, null];
function worldSave() {
  const s = game();
  const site = s.world.find((t) => t.kind === 'mine')!;
  site.guards = [null, null, null, null, null, null];
  site.x = 17;
  site.y = 16;
  site.reserve = 100;
  return { s, site };
}
describe('v0.12 experience ledger and snapshot integrity', () => {
  it('records actual collected cargo and return survival exactly once, after arrival', () => {
    let { s, site } = worldSave();
    const before = s.available.tank_t1;
    s = act(s, { type: 'march', targetId: site.id, mission: 'gather', formation: deployed });
    expect(s.available.tank_t1).toBe(before - 10);
    expect(s.expeditionLog).toBeUndefined();
    const m = s.marches[0];
    s = advance(s, m.dueAt);
    s = advance(s, s.marches[0].dueAt);
    expect(s.marches[0].phase).toBe('returning');
    const cargo = { ...s.marches[0].cargo };
    s = advance(s, s.marches[0].dueAt);
    expect(s.expeditionLog).toHaveLength(1);
    expect(s.expeditionLog![0]).toMatchObject({ outcome: 'returned', survivors: 10, cargo });
    expect(s.available.tank_t1).toBe(before);
    expect(advance(s, s.now + 100000).expeditionLog).toEqual(s.expeditionLog);
    assertState(s);
  });
  it('keeps historical rewards separate from actual return receipts and does not infer old delivery', () => {
    const s = game(),
      r = simulate(army(deployed), army(deployed), 9, 'world');
    r.marchId = 'march-demo';
    r.rewards = { iron: 90 };
    expect(transportStatus(s, r).status).toBe('historical');
    s.expeditionLog = [
      {
        marchId: r.marchId,
        targetId: 'site-0',
        at: s.now,
        outcome: 'returned',
        cargo: { ...s.wallet, iron: 72 },
        survivors: 3,
      },
    ];
    expect(transportStatus(s, r)).toMatchObject({ status: 'returned', cargo: { iron: 72 } });
    expect(r.rewards).toEqual({ iron: 90 });
  });
  it('records defeated expeditions as defeated, not delivered', () => {
    let { s, site } = worldSave();
    site.guards = [{ unitId: 'tank_t7', count: 100 }, null, null, null, null, null];
    s = act(s, { type: 'march', targetId: site.id, mission: 'gather', formation: deployed });
    s = advance(s, s.marches[0].dueAt);
    expect(s.expeditionLog![0].outcome).toBe('defeated');
    expect(transportStatus(s, s.reports[0]).status).toBe('defeated');
  });
  it('accepts pre-ledger saves and roundtrips new expedition records', async () => {
    let { s, site } = worldSave();
    expect((await parseSave(await exportSave(s))).expeditionLog).toBeUndefined();
    s = act(s, { type: 'march', targetId: site.id, mission: 'gather', formation: deployed });
    s = advance(s, s.now + 3600000);
    expect((await parseSave(await exportSave(s))).expeditionLog).toEqual(s.expeditionLog);
    const bad = structuredClone(s);
    bad.expeditionLog![0].cargo.iron = -1;
    expect(() => assertState(bad)).toThrow();
  });
  it('validates world deployment atomically and preserves original inventory on failure', () => {
    const { s, site } = worldSave(),
      before = structuredClone(s);
    expect(() =>
      act(s, {
        type: 'march',
        targetId: site.id,
        mission: 'gather',
        formation: [{ unitId: 'tank_t1', count: 999 }, null, null, null, null, null],
      }),
    ).toThrow();
    expect(s).toEqual(before);
  });
  it('rest summary counts completed FIFO work and includes refitting separately', () => {
    let s = game();
    s.wallet = {
      iron: 1000000,
      oil: 1000000,
      lead: 1000000,
      titanium: 1000000,
      crystal: 1000000,
      gold: 1000000,
    };
    s.buildings.hq = 20;
    s.buildings.hq = s.buildings.factory = 60;
    s.industry = { version: 1, factory2: 60, refit: 60 };
    s.vip = { version: 1, paidGold: 960, lastDaily: -1 };
    s.available.tank_t5 = 10;
    s.createdUnits.tank_t5 = 10;
    s.arsenal!.cores.tank_core6 = 10;
    s.damaged.tank_t1 = 2;
    s.createdUnits.tank_t1 += 2;
    s = act(s, { type: 'produce', unitId: 'tank_t1', count: 100 });
    s = act(s, { type: 'produce', unitId: 'tank_t2', count: 100 });
    s = act(s, { type: 'refit', unitId: 'tank_t6', count: 10 });
    s = act(s, { type: 'repair', unitId: 'tank_t1', count: 2 });
    const before = structuredClone(s);
    s = act(s, { type: 'rest', minutes: 480 });
    const summary = progressSummary(before, s);
    expect(summary.elapsed).toBe(480 * 60000);
    expect(summary.produced).toBe(200);
    expect(summary.produced + summary.refitted).toBe(
      (s.counters.produce ?? 0) - (before.counters.produce ?? 0),
    );
    expect(summary.repaired).toBe((s.counters.repair ?? 0) - (before.counters.repair ?? 0));
    assertState(s);
  });
  it('effective received damage balances the opposite team dealt damage and ignores overkill', () => {
    const r = simulate(army(deployed), army([{ unitId: 'tank_t1', count: 1 }]), 5);
    const before = structuredClone(r),
      summary = battleSummary(r);
    for (const side of [0, 1])
      expect(summary.teams[side].rows.reduce((n, v) => n + v.received, 0)).toBe(
        summary.teams[1 - side].damage,
      );
    expect(r).toEqual(before);
    expect(summary.feedback.length).toBeGreaterThan(0);
  });
  it('a bridge response updates inventory, quote and stock together after completion without navigation', async () => {
    const path = mkdtempSync(join(tmpdir(), 'tankstorm-experience-')),
      store = new NativeStore(path);
    try {
      await store.handle({ op: 'boot' });
      await store.handle({
        op: 'command',
        command: { type: 'produce', unitId: 'tank_t1', count: 2 },
        id: 'make',
      });
      const result = await store.handle({
        op: 'command',
        command: { type: 'rest', minutes: 60 },
        id: 'rest',
      });
      const row = result.info.inventory.find((v: any) => v.id === 'tank_t1') as any;
      expect(row.available).toBe(result.state.available.tank_t1);
      expect(row.producing).toBe(0);
      expect(result.progress.produced).toBe(2);
      expect(result.report).toBeUndefined();
      const before = JSON.stringify(store.state.available);
      const battle = await store.handle({
        op: 'command',
        command: { type: 'battle', stage: 0, training: true },
        id: 'battle',
      });
      const id = battle.report.id;
      for (let i = 0; i < 2; i++) await store.handle({ op: 'report', id });
      expect(JSON.stringify(store.state.available)).toBe(before);
    } finally {
      store.close();
      rmSync(path, { recursive: true, force: true });
    }
  });
  it('inventory sums each existing vehicle once while formations stay allocation plans', () => {
    let { s, site } = worldSave();
    s.formation = deployed;
    const count = (st: GameState) =>
      (inventoryView(st).find((v) => v.id === 'tank_t1') as any).quantity;
    const before = count(s);
    s = act(s, { type: 'march', targetId: site.id, mission: 'gather', formation: deployed });
    expect(count(s)).toBe(before);
    s = advance(s, s.now + 3600000);
    expect(count(s)).toBe(before);
  });
});
