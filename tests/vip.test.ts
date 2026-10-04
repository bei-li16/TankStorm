import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newGame, execute, advance, assertState, capacity } from '../src/core/engine';
import { productionQuote } from '../src/core/arsenal';
import {
  vipBenefits,
  vipLevels,
  queueStatus,
  queueView,
  buildingDuration,
  researchDuration,
  marchQuote,
  allJobs,
  effectiveTime,
} from '../src/core/vip';
import { exportSave, parseSave } from '../src/core/storage';
import { NativeStore } from '../native/rules/bridge';
import type { GameState, Command } from '../src/core/types';

let serial = 0;
function run(s: GameState, c: Command) {
  return execute(s, c, s.now, `v06-${++serial}`).state;
}
function base(gold = 0) {
  let s = newGame('test', '测试基地', 1760000000000);
  s.buildings.hq = 20;
  s.buildings.lab = 20;
  s.buildings.factory = 20;
  for (const r of Object.keys(s.wallet)) s.wallet[r as keyof typeof s.wallet] = 10000000;
  if (gold) s = run(s, { type: 'vipRecharge', gold });
  return s;
}
afterEach(() => vi.restoreAllMocks());
describe('offline VIP and queued work', () => {
  it('allows eight independent VIP10 marches and enforces the ninth, preserving troops on recall', () => {
    let s = base(1000000);
    s = run(s, {
      type: 'formation',
      slots: [{ unitId: 'tank_t1', count: 1 }, null, null, null, null, null],
    });
    for (let i = 0; i < 8; i++)
      s = run(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    expect(s.marches).toHaveLength(8);
    expect(() => run(s, { type: 'march', targetId: 'site-0', mission: 'gather' })).toThrow(
      '队列已满',
    );
    for (const m of [...s.marches]) s = run(s, { type: 'recall', marchId: m.id });
    s = advance(s, s.now + 1000);
    expect(s.available.tank_t1).toBe(20);
    expect(s.marches).toHaveLength(0);
    assertState(s);
  });
  it('derives exact tier boundaries from cumulative recharge, independently of wallet and rewards', () => {
    for (const v of vipLevels) {
      const s = base(v.threshold);
      s.wallet.gold = 0;
      expect(vipBenefits(s).level).toBe(v.level);
      if (v.level > 0)
        expect(
          vipBenefits({ ...s, vip: { version: 1, paidGold: v.threshold - 1, lastDaily: -1 } })
            .level,
        ).toBe(v.level - 1);
      assertState(s);
    }
    expect(vipBenefits(base()).level).toBe(0);
  });
  it('runs seven buildings concurrently and finishes/cancels only the chosen sequence', () => {
    let s = base(1000000);
    for (const b of Object.keys(s.buildings))
      s.buildings[b as keyof typeof s.buildings] = b === 'hq' ? 20 : 18;
    for (const building of ['iron', 'oil', 'lead', 'titanium', 'crystal', 'warehouse'] as const)
      s = run(s, { type: 'upgrade', building });
    s.buildings.lab = 18;
    s = run(s, { type: 'upgrade', building: 'lab' });
    expect(queueStatus(s, 'building').active).toHaveLength(7);
    expect(() => run(s, { type: 'upgrade', building: 'factory' })).toThrow();
    const originalGold = s.wallet.gold;
    const jobs = queueStatus(s, 'building').active;
    s = run(s, { type: 'accelerate', kind: 'building', seq: jobs[3].seq });
    expect(s.buildings.titanium).toBe(19);
    expect(s.wallet.gold).toBeLessThan(originalGold);
    s = run(s, { type: 'cancel', kind: 'building', seq: jobs[2].seq });
    expect(s.buildings.lead).toBe(18);
    s = advance(s, Math.max(...queueView(s).map((j) => s.now + j.remainingMs)));
    expect(s.jobs).toEqual({});
    expect(s.buildings.iron).toBe(19);
    expect(s.buildings.lab).toBe(19);
    assertState(s);
  });
  it('serializes three waiting batches; acceleration never completes the following batch for free', () => {
    let s = base(1000000);
    for (let i = 0; i < 4; i++) s = run(s, { type: 'produce', unitId: 'tank_t1', count: 100 });
    expect(s.jobBacklog).toHaveLength(3);
    expect(() => run(s, { type: 'produce', unitId: 'tank_t1', count: 1 })).toThrow('等待位已满');
    const jobs = queueView(s);
    expect(jobs[1].waitMs).toBe(jobs[0].remainingMs);
    expect(jobs[3].remainingMs).toBe((productionQuote(s, 'tank_t1').duration * 100 - 900000) * 4);
    expect(() =>
      run(s, { type: 'accelerate', kind: 'production', seq: s.jobBacklog![0].seq }),
    ).toThrow('开工');
    s = run(s, { type: 'accelerate', kind: 'production' });
    expect(s.available.tank_t1).toBe(120);
    expect(s.jobBacklog).toHaveLength(2);
    expect(s.jobs.production!.completed).toBe(0);
    s = advance(s, Math.max(...queueView(s).map((j) => s.now + j.remainingMs)));
    expect(s.available.tank_t1).toBe(420);
    expect(s.jobs).toEqual({});
    assertState(s);
  });
  it('refunds queued core/refit reservations and conserves stock across offline save import', async () => {
    let s = base(7200);
    s.buildings.hq = s.buildings.factory = 60;
    s.industry = { version: 1, factory2: 60, refit: 60 };
    s.available.tank_t5 = s.createdUnits.tank_t5 = 90;
    s.arsenal!.cores.tank_core6 = 90;
    s = run(s, { type: 'produce', unitId: 'rocket_t1', count: 10 });
    s = run(s, { type: 'refit', unitId: 'tank_t6', count: 40 });
    s = run(s, { type: 'refit', unitId: 'tank_t6', count: 50 });
    s = await parseSave(await exportSave(s));
    expect(s.vip!.paidGold).toBe(7200);
    expect(s.available.tank_t5).toBe(0);
    s = run(s, { type: 'cancel', kind: 'production', seq: s.jobBacklog![0].seq });
    expect(s.available.tank_t5).toBe(50);
    expect(s.arsenal!.cores.tank_core6).toBe(50);
    s = advance(s, Math.max(...queueView(s).map((j) => s.now + j.remainingMs)));
    expect(s.available.tank_t6).toBe(40);
    expect(s.arsenal!.converted.tank_t5).toBe(40);
    assertState(s);
  });
  it('starts research in FIFO order and never lets duplicate tech levels book twice', () => {
    let s = base(960);
    s.tech.attack = s.tech.construction = s.tech.resourceOutput = 15;
    for (const tech of ['attack', 'construction', 'resourceOutput'] as const)
      s = run(s, { type: 'research', tech });
    expect(s.jobBacklog).toHaveLength(2);
    expect(() => run(s, { type: 'research', tech: 'gather' })).not.toThrow();
    s = run(s, { type: 'cancel', kind: 'research', seq: s.jobBacklog![1].seq });
    expect(() => run(s, { type: 'research', tech: 'construction' })).toThrow('已在队列');
    s = advance(s, s.now + queueView(s)[0].remainingMs);
    expect(s.tech.attack).toBe(16);
    expect(s.tech.construction).toBe(15);
    expect(s.jobs.research!.target).toBe('construction');
    s = advance(s, s.now + queueView(s)[0].remainingMs);
    expect(s.tech.construction).toBe(16);
    assertState(s);
  });
  it('quotes actual durations, VIP rates and a complete uncontested mine trip', () => {
    let s = base(1000000);
    const build = buildingDuration(s, 'iron');
    s = run(s, { type: 'upgrade', building: 'iron' });
    expect(build).toBeLessThanOrEqual(900000);
    expect(s.jobs.building).toBeUndefined();
    expect(s.buildings.iron).toBe(2);
    const research = researchDuration(s, 'attack');
    s = run(s, { type: 'research', tech: 'attack' });
    expect(research).toBeLessThanOrEqual(900000);
    expect(s.jobs.research).toBeUndefined();
    expect(s.tech.attack).toBe(1);
    expect(productionQuote(s, 'tank_t1').duration).toBeLessThan(
      productionQuote(base(), 'tank_t1').duration,
    );
    const q = marchQuote(s, s.world[0], s.formation);
    const start = s.now;
    s = run(s, { type: 'march', targetId: s.world[0].id, mission: 'gather' });
    expect(s.marches[0].dueAt - start).toBe(q.outboundMs);
    s = advance(s, start + q.outboundMs);
    expect(q.gatherMs).toBe(effectiveTime(s, q.rawGatherMs));
    s = advance(s, start + q.outboundMs + q.gatherMs);
    expect(s.marches[0].phase).toBe('returning');
    s = advance(s, start + q.totalMs - 1);
    expect(s.marches).toHaveLength(1);
    s = advance(s, start + q.totalMs);
    expect(s.marches).toHaveLength(0);
    expect(capacity(s)).toBe(31680);
  });
  it('keeps VIP0 one worker with three waiting positions; rejects duplicate sequence saves', () => {
    let s = base();
    s = run(s, { type: 'produce', unitId: 'tank_t1', count: 100 });
    expect(() => run(s, { type: 'produce', unitId: 'tank_t1', count: 100 })).not.toThrow();
    s.jobBacklog = [structuredClone(s.jobs.production!)];
    expect(() => assertState(s)).toThrow();
    s = base(40);
    s = run(s, { type: 'produce', unitId: 'tank_t1', count: 100 });
    s.jobBacklog = [structuredClone(s.jobs.production!)];
    expect(() => assertState(s)).toThrow('序号重复');
  });
  it('persists once-per-day VIP supply and applies campaign XP bonus', async () => {
    let s = base(180000);
    s = run(s, { type: 'vipDaily' });
    s = await parseSave(await exportSave(s));
    expect(() => run(s, { type: 'vipDaily' })).toThrow('已领取');
    s = run(s, { type: 'battle', stage: 0 });
    expect(s.reports[0].growth!.xp).toBe(100);
    s = advance(s, s.now + 86400000);
    expect(() => run(s, { type: 'vipDaily' })).not.toThrow();
  });
});
describe('root authentication and native campaign status', () => {
  it('authenticates at the rule boundary, expires access, changes password, saves recharge once', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1760000000000);
    const root = mkdtempSync(join(tmpdir(), 'tankstorm-vip-'));
    const store = new NativeStore(root);
    try {
      store.boot();
      const command = { type: 'vipRecharge', gold: 960 };
      await expect(store.handle({ op: 'command', command })).rejects.toThrow('密码');
      await expect(store.handle({ op: 'rootLogin', password: 'wrong' })).rejects.toThrow('错误');
      await store.handle({ op: 'rootLogin', password: 'TankStorm2026!' });
      const before = store.state.wallet.gold;
      await store.handle({ op: 'command', command, id: 'recharge-once' });
      await store.handle({ op: 'command', command, id: 'recharge-once' });
      expect(store.state.wallet.gold).toBe(before + 960);
      expect(store.view().info.vip.level).toBe(3);
      const text = (await store.handle({ op: 'export' })).text;
      expect(text).not.toContain('TankStorm2026');
      await store.handle({ op: 'rootPassword', password: 'Changed2026!' });
      expect(readFileSync(join(root, 'root-access.cfg'), 'utf8')).not.toContain('Changed2026!');
      await expect(store.handle({ op: 'rootLogin', password: 'TankStorm2026!' })).rejects.toThrow(
        '错误',
      );
      await store.handle({ op: 'rootLogin', password: 'Changed2026!' });
      vi.setSystemTime(1760000000000 + 21 * 60000);
      await expect(store.handle({ op: 'command', command })).rejects.toThrow('密码');
      await store.handle({ op: 'import', text });
      expect(store.view().info.vip.level).toBe(3);
      assertState(store.state);
    } finally {
      store.close();
      rmSync(root, { recursive: true, force: true });
      vi.useRealTimers();
    }
  });
  it('returns unambiguous booleans after first victory, survives reload, and permits stage two', async () => {
    const root = mkdtempSync(join(tmpdir(), 'tankstorm-stage-'));
    const store = new NativeStore(root);
    try {
      store.boot();
      await store.handle({ op: 'command', command: { type: 'battle', stage: 0, training: true } });
      expect(store.view().info.stageStatus[1].unlocked).toBe(false);
      await store.handle({ op: 'command', command: { type: 'battle', stage: 0 } });
      const status = JSON.parse(JSON.stringify(store.view())).info.stageStatus;
      expect(status[0]).toEqual({ cleared: true, unlocked: true });
      expect(status[1].unlocked).toBe(true);
      await store.handle({ op: 'load', id: store.state.id });
      await expect(
        store.handle({ op: 'command', command: { type: 'battle', stage: 1 } }),
      ).resolves.toMatchObject({ ok: true });
      expect(allJobs(store.state)).toEqual([]);
    } finally {
      store.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
