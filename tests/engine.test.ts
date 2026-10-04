import { mineCapacity } from '../src/core/world';
import { describe, it, expect } from 'vitest';
import {
  advance,
  assertState,
  capacity,
  emptyWallet,
  execute,
  leadershipCap,
  maxFormation,
  newGame,
  rate,
  usableFormation,
  validateFormation,
} from '../src/core/engine';
import { army, casualtySummary, rng32, simulate, survivors } from '../src/core/battle';
import { stageFormation, unitList, units, upgradeCost } from '../src/core/content';
import { npcProtected } from '../src/core/world';
import { accelerationCost } from '../src/core/vip';
import type { Command, Formation, GameState } from '../src/core/types';
let id = 0;
const T = 1700000000000;
const game = () => newGame('test', '测试指挥官', T);
const command = (s: GameState, c: Command, time = s.now) =>
  execute(s, c, time, `test-${++id}`).state;
const grant = (s: GameState, u: string, n: number) => {
  s.available[u] += n;
  s.createdUnits[u] += n;
};
const normalized = (s: GameState) => ({ ...s, revision: 0 });
function configure(s: GameState, f: Formation) {
  s.formation = f;
  for (const t of f) if (t) grant(s, t.unitId, t.count);
  return s;
}
describe('atomic economy and production', () => {
  it('A01 new saves are deterministic and self consistent', () => {
    expect(game()).toEqual(game());
    assertState(game());
    expect(game().world).toHaveLength(100);
    expect(new Set(game().world.map((t) => `${t.x},${t.y}`)).size).toBe(100);
  });
  it('A02 failed commands never deduct or advance the input state', () => {
    const s = game();
    s.wallet.iron = 0;
    const before = structuredClone(s);
    expect(() => command(s, { type: 'produce', unitId: 'tank_t1', count: 2 }, T + 10000)).toThrow(
      '资源不足',
    );
    expect(s).toEqual(before);
  });
  it('A03 rate splits exactly at a building completion', () => {
    let s = game();
    s.buildings.hq = 2;
    s = command(s, { type: 'upgrade', building: 'iron' });
    const before = s.wallet.iron,
      elapsed = s.jobs.building!.dueAt - T,
      oldRate = rate(s, 'iron');
    s = advance(s, T + 3600000);
    expect(s.wallet.iron - before).toBe(
      Math.floor((oldRate * elapsed + rate(s, 'iron') * (3600000 - elapsed)) / 3600000),
    );
    expect(s.buildings.iron).toBe(2);
    assertState(s);
  });
  it('A05 20 ordered, 7 done, cancelling refunds exactly 13', () => {
    let s = command(game(), { type: 'produce', unitId: 'tank_t1', count: 20 });
    const cost = s.jobs.production!.unitCost.iron!;
    s = advance(s, T + s.jobs.production!.duration * 7);
    expect(s.available.tank_t1).toBe(27);
    const iron = s.wallet.iron;
    s = command(s, { type: 'cancel', kind: 'production' });
    expect(s.wallet.iron).toBe(iron + 13 * cost);
    expect(s.jobs.production).toBeUndefined();
    expect(() => command(s, { type: 'cancel', kind: 'production' })).toThrow();
    assertState(s);
  });
  it('refund uses the original unit cost after technology changes', () => {
    let s = command(game(), { type: 'produce', unitId: 'tank_t1', count: 10 });
    const paid = s.jobs.production!.unitCost.iron! * 10;
    s.tech.production = 5;
    const before = s.wallet.iron;
    s = command(s, { type: 'cancel', kind: 'production' });
    expect(s.wallet.iron - before).toBe(paid);
  });
  it('orders complete per unit rather than all at the end', () => {
    let s = command(game(), { type: 'produce', unitId: 'rocket_t1', count: 3 });
    const duration = s.jobs.production!.duration;
    s = advance(s, T + duration);
    expect(s.available.rocket_t1).toBe(7);
    expect(s.jobs.production?.completed).toBe(1);
    s = advance(s, T + duration * 3);
    expect(s.available.rocket_t1).toBe(9);
    expect(s.jobs.production).toBeUndefined();
    assertState(s);
  });
  it('a busy production queue rejects an order without payment', () => {
    let s = game();
    for (let i = 0; i < 4; i++) s = command(s, { type: 'produce', unitId: 'tank_t1', count: 2 });
    const before = structuredClone(s);
    expect(() => command(s, { type: 'produce', unitId: 'spg_t1', count: 1 })).toThrow('队列');
    expect(s).toEqual(before);
  });
  it('locked advanced units cannot be produced', () => {
    expect(() => command(game(), { type: 'produce', unitId: 'tank_t3', count: 1 })).toThrow('14');
  });
  it.each([0, -1, 1.1, NaN, Infinity, 10001])('rejects invalid quantity %s', (n) => {
    expect(() => command(game(), { type: 'produce', unitId: 'tank_t1', count: n })).toThrow();
  });
  it('titanium starts only at HQ 6', () => {
    const s = game();
    expect(rate(s, 'titanium')).toBe(0);
    s.buildings.hq = 6;
    expect(rate(s, 'titanium')).toBe(150);
  });
  it('passive production caps but external quest reward does not', () => {
    let s = game();
    s.wallet.iron = capacity(s) - 1;
    s = advance(s, T + 3600000);
    expect(s.wallet.iron).toBe(capacity(s));
    expect(s.remainders.iron).toBe(0);
    s = command(s, { type: 'claim', questId: 'welcome' });
    expect(s.wallet.iron).toBe(capacity(s) + 300);
    s = advance(s, T + 7200000);
    expect(s.wallet.iron).toBe(capacity(s) + 300);
  });
  it('backward clock never removes time or resources', () => {
    const s = game();
    expect(normalized(advance(s, T - 100000))).toEqual(normalized(s));
  });
  it('A16 partial repair cancellation returns remaining damaged units', () => {
    let s = game();
    s.available.tank_t1 -= 10;
    s.damaged.tank_t1 = 10;
    s = command(s, { type: 'repair', unitId: 'tank_t1', count: 10 });
    const cost = s.jobs.repair!.unitCost.crystal!;
    s = advance(s, T + s.jobs.repair!.duration * 4);
    expect(s.available.tank_t1).toBe(14);
    const crystal = s.wallet.crystal;
    s = command(s, { type: 'cancel', kind: 'repair' });
    expect(s.damaged.tank_t1).toBe(6);
    expect(s.wallet.crystal - crystal).toBe(6 * cost);
    assertState(s);
  });
  it('accelerating completes remaining jobs once and consumes exact gold', () => {
    let s = command(game(), { type: 'produce', unitId: 'tank_t1', count: 20 });
    s = advance(s, T + 35000);
    const gold = s.wallet.gold - accelerationCost(s, s.jobs.production!);
    s = command(s, { type: 'accelerate', kind: 'production' });
    expect(s.wallet.gold).toBe(gold);
    expect(s.available.tank_t1).toBe(40);
    expect(s.jobs.production).toBeUndefined();
    assertState(s);
  });
  it('building and technology prerequisites are enforced', () => {
    expect(() => command(game(), { type: 'upgrade', building: 'factory' })).toThrow('指挥中心');
    const s = game();
    s.tech.attack = 1;
    expect(() => command(s, { type: 'research', tech: 'attack' })).toThrow('科研中心');
  });
  it('A17 a 24h offline jump equals small event-stepped updates', () => {
    let s = game();
    s.buildings.hq = 2;
    s = command(s, { type: 'upgrade', building: 'iron' });
    s = command(s, { type: 'research', tech: 'attack' });
    s = command(s, { type: 'produce', unitId: 'tank_t1', count: 10 });
    s = command(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    const single = advance(s, T + 86400000);
    let stepped = s;
    for (let t = T + 300000; t <= T + 86400000; t += 300000) stepped = advance(stepped, t);
    expect(normalized(single)).toEqual(normalized(stepped));
    assertState(single);
  });
  it('job speed snapshots survive later research changes', () => {
    let s = game();
    for (let i = 0; i < 4; i++) s = command(s, { type: 'produce', unitId: 'tank_t1', count: 2 });
    const duration = s.jobs.production!.duration;
    s.tech.production = 20;
    expect(advance(s, T + duration).available.tank_t1).toBe(21);
    expect(advance(s, T + duration * 2 - 1).available.tank_t1).toBe(21);
  });
});
describe('formation, battle and progression', () => {
  it('A06 duplicate stock across slots is rejected atomically', () => {
    const s = game();
    expect(() =>
      command(s, {
        type: 'formation',
        slots: [
          { unitId: 'tank_t1', count: 20 },
          { unitId: 'tank_t1', count: 20 },
          null,
          null,
          null,
          null,
        ],
      }),
    ).toThrow('库存不足');
  });
  it('A07 leadership applies per slot, not per formation', () => {
    const s = game();
    grant(s, 'tank_t1', 100);
    const f = Array.from({ length: 6 }, () => ({ unitId: 'tank_t1', count: 20 }));
    validateFormation(s, f);
    f[0].count = 21;
    expect(() => validateFormation(s, f)).toThrow('每格');
  });
  it('max formation uses only existing units and does not mutate inventory', () => {
    const s = game(),
      before = structuredClone(s);
    const f = maxFormation(s);
    validateFormation(s, f);
    expect(s).toEqual(before);
  });
  it('saved presets do not reserve troops', () => {
    let s = command(game(), { type: 'presetSave', name: '混编' });
    expect(s.available.tank_t1).toBe(20);
    expect(s.presets).toHaveLength(1);
    s = command(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    const template = structuredClone(s.presets[0]);
    s = command(s, { type: 'presetLoad', index: 0 });
    expect(s.formation).toEqual(Array(6).fill(null));
    expect(s.presets[0]).toEqual(template);
  });
  it('xorshift32 matches the reference seed vector', () => {
    const rng = rng32(1);
    expect([rng(), rng(), rng()]).toEqual([270369, 67634689, 2647435461]);
  });
  it('A08 deterministic battle independent of caller and immutable inputs', () => {
    const a = army(game().formation),
      d = army(stageFormation(5)),
      before = structuredClone(a);
    expect(simulate(a, d, 123)).toEqual(simulate(a, d, 123));
    expect(a).toEqual(before);
  });
  it('tank events prioritize the front of each column independently', () => {
    const a = army([{ unitId: 'tank_t1', count: 20 }, null, null, null, null, null]),
      d = army([
        null,
        { unitId: 'tank_t1', count: 20 },
        null,
        { unitId: 'tank_t1', count: 20 },
        null,
        null,
      ]);
    const r = simulate(a, d, 1);
    expect(r.events[0].to).toBe(4);
    expect(r.events.some((e) => e.ground)).toBe(false);
    expect(r.events[1].to).toBe(2);
  });
  it('artillery hits only its anchored column', () => {
    const a = army([{ unitId: 'spg_t1', count: 5 }, null, null, null, null, null]),
      d = army(Array.from({ length: 6 }, () => ({ unitId: 'tank_t1', count: 10 })));
    const r = simulate(a, d, 1);
    expect(r.events.slice(0, 2).map((e) => e.to)).toEqual([1, 4]);
  });
  it('rockets hit every living slot in ascending order', () => {
    const a = army([{ unitId: 'rocket_t1', count: 5 }, null, null, null, null, null]),
      d = army(Array.from({ length: 6 }, () => ({ unitId: 'tank_t1', count: 10 })));
    expect(
      simulate(a, d, 1)
        .events.slice(0, 6)
        .map((e) => e.to),
    ).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('damage floors only after the complete multiplier product', () => {
    const a = army([{ unitId: 'tank_t1', count: 1 }, null, null, null, null, null]),
      d = army([{ unitId: 'rocket_t1', count: 100 }, null, null, null, null, null]);
    const r = simulate(a, d, 1);
    expect(r.events[0].critical).toBe(true);
    expect(r.events[0].damage).toBe(Math.floor(20 * 1.05 * 1.25 * 1.5));
  });
  it('A15 casualties aggregate across equal units before repair rounding', () => {
    const a = army([
      { unitId: 'tank_t1', count: 1 },
      { unitId: 'tank_t1', count: 1 },
      { unitId: 'tank_t1', count: 1 },
      null,
      null,
      null,
    ]);
    const final = a.map((s) => ({ ...s, totalHp: 0 }));
    expect(casualtySummary(a, final)[0]).toMatchObject({ lost: 3, repairable: 3, destroyed: 0 });
  });
  it('A04 past reports preserve original stats after research', () => {
    let s = command(game(), { type: 'battle', stage: 0, training: true });
    const old = structuredClone(s.reports[0]);
    s.tech.attack = 4;
    s.tech.hp = 4;
    s = command(s, { type: 'battle', stage: 0, training: true });
    expect(s.reports[1]).toEqual(old);
    expect(s.reports[0].initial[0][0].hp).toBeGreaterThan(old.initial[0][0].hp);
  });
  it('training does not change inventories or rewards', () => {
    const s = game(),
      r = command(s, { type: 'battle', stage: 0, training: true });
    expect(r.wallet).toEqual(s.wallet);
    expect(r.available).toEqual(s.available);
    expect(r.damaged).toEqual(s.damaged);
    expect(r.cleared).toEqual([]);
    assertState(r);
  });
  it('A09 first clear reward and repeated command are idempotent', () => {
    const s = game();
    const first = execute(s, { type: 'battle', stage: 0 }, T, 'same');
    expect(first.state.cleared).toEqual([0]);
    const twice = execute(first.state, { type: 'battle', stage: 0 }, T + 10000, 'same', 0);
    expect(twice.state).toBe(first.state);
    const repeat = command(first.state, { type: 'battle', stage: 0 });
    expect(repeat.reports[0].rewards.iron).toBe(50);
    expect(repeat.cleared).toEqual([0]);
    assertState(repeat);
  });
  it('idempotency key cannot be reused for a different payload', () => {
    const s = execute(game(), { type: 'daily' }, T, 'one').state;
    expect(() => execute(s, { type: 'leadership' }, T, 'one')).toThrow('编号冲突');
  });
  it('CAS stale revisions do not commit', () => {
    expect(() => execute(game(), { type: 'daily' }, T, 'one', 99)).toThrow('存档已更新');
  });
  it('initial army can win the opening mission and progress naturally', () => {
    let s = game();
    s = command(s, { type: 'claim', questId: 'welcome' });
    s = command(s, { type: 'formation', slots: maxFormation(s) });
    s = command(s, { type: 'battle', stage: 0 });
    expect(s.reports[0].winner).toBe(0);
    expect(s.commander.books).toBe(4);
    assertState(s);
  });
  it('all twelve stages are winnable with a developed classic army', () => {
    let s = game();
    s.commander.leadership = 20;
    s.tech.attack = 20;
    s.tech.hp = 20;
    const f: Formation = ['tank', 'tank_destroyer', 'tank', 'spg', 'rocket', 'spg'].map((c) => ({
      unitId: `${c}_t3`,
      count: 115,
    }));
    configure(s, f);
    for (let i = 0; i < 12; i++) {
      s = command(s, { type: 'battle', stage: i });
      expect(s.reports[0].winner, `stage ${i + 1}`).toBe(0);
      assertState(s);
    }
    expect(s.cleared).toHaveLength(12);
  });
  it('quest reward is issued once', () => {
    const s = command(game(), { type: 'claim', questId: 'welcome' });
    expect(() => command(s, { type: 'claim', questId: 'welcome' })).toThrow('已领取');
    expect(() => command(game(), { type: 'claim', questId: 'campaign' })).toThrow('尚未完成');
  });
  it('A24 daily reset follows Shanghai midnight', () => {
    let s = newGame('daily', '测试', Date.UTC(2026, 9, 1, 15, 59, 59));
    s = command(s, { type: 'daily' });
    expect(() => command(s, { type: 'daily' })).toThrow('已领取');
    s = command(s, { type: 'daily' }, Date.UTC(2026, 9, 1, 16));
    expect(s.commander.prestige).toBe(40);
  });
  it('level-up books cannot go negative', () => {
    const ready = game();
    ready.commander.prestige = 160;
    ready.commander.books = 1;
    let s = command(ready, { type: 'leadership' });
    expect(leadershipCap(s)).toBe(25);
    expect(() => command(s, { type: 'leadership' })).toThrow('还缺');
  });
});
describe('world expeditions and conservation', () => {
  it('A12 gathers only surviving load and credits only upon arriving home', () => {
    let s = game();
    s.formation = [{ unitId: 'tank_t1', count: 20 }, null, null, null, null, null];
    s = command(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    s = advance(s, T + 8000);
    expect(s.marches[0].phase).toBe('gathering');
    s = advance(s, s.marches[0].dueAt);
    expect(s.marches[0].cargo.iron).toBe(8000);
    expect(s.world[0].reserve).toBe(mineCapacity(s.world[0]) - s.marches[0].cargo.iron);
    expect(s.marches[0].phase).toBe('returning');
    const before = s.wallet.iron,
      remainder = s.remainders.iron;
    s = advance(s, s.marches[0].dueAt);
    expect(s.marches).toHaveLength(0);
    expect(s.wallet.iron - before).toBe(8000 + Math.floor((600 * 8000 + remainder) / 3600000));
    expect(s.available.tank_t1).toBe(20);
    assertState(s);
  });
  it('A13 recall partial cargo returns once at the current extraction rate', () => {
    let s = game();
    s.formation = [{ unitId: 'tank_t1', count: 20 }, null, null, null, null, null];
    s = command(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    s = advance(s, T + 8000 + 60000);
    expect(s.marches[0].cargo.iron).toBe(80);
    s = command(s, { type: 'recall', marchId: s.marches[0].id });
    s = advance(s, s.now + 8000);
    expect(s.counters.cargo).toBe(80);
    s = advance(s, s.now + 86400000);
    expect(s.counters.cargo).toBe(80);
    assertState(s);
  });
  it('early outgoing recall uses traversed travel time', () => {
    let s = command(game(), { type: 'march', targetId: 'site-0', mission: 'gather' });
    s = command(s, { type: 'recall', marchId: s.marches[0].id }, T + 3000);
    expect(s.marches[0].dueAt).toBe(T + 6000);
    s = advance(s, T + 6000);
    expect(s.marches).toHaveLength(0);
    assertState(s);
  });
  it('A11 stale scout does not replace actual arrival guards', () => {
    let s = game();
    s = command(s, { type: 'scout', targetId: 'site-0' });
    s.world[0].guards = [{ unitId: 'tank_t3', count: 1000 }, null, null, null, null, null];
    s = command(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    s = advance(s, T + 8000);
    expect(s.intel['site-0'].guards.filter(Boolean)).toHaveLength(0);
    expect(s.reports[0].initial[1][0].count).toBe(1000);
    expect(s.reports[0].winner).toBe(1);
    assertState(s);
  });
  it('A14 raid respects protected balances and cargo capacity', () => {
    let s = game();
    const target = s.world.find((t) => t.kind === 'npc')!;
    target.guards = Array(6).fill(null);
    const protectedStock = {
      iron: npcProtected(target, 'iron'),
      oil: npcProtected(target, 'oil'),
      lead: npcProtected(target, 'lead'),
    };
    target.wallet = {
      iron: protectedStock.iron + 100,
      oil: protectedStock.oil + 200,
      lead: protectedStock.lead + 300,
      titanium: 0,
      crystal: 0,
      gold: 0,
    };
    s.formation = [{ unitId: 'tank_t1', count: 20 }, null, null, null, null, null];
    s = command(s, { type: 'march', targetId: target.id, mission: 'raid' });
    s = advance(s, s.marches[0].dueAt);
    expect(s.marches[0].cargo).toMatchObject({ iron: 100, oil: 200, lead: 300 });
    const changed = s.world.find((t) => t.id === target.id)!;
    expect(changed.wallet).toMatchObject(protectedStock);
    assertState(s);
  });
  it('no troops can be sent twice', () => {
    let s = command(game(), { type: 'march', targetId: 'site-0', mission: 'gather' });
    expect(usableFormation(s).every((x) => !x)).toBe(true);
    expect(() => command(s, { type: 'march', targetId: 'site-1', mission: 'gather' })).toThrow(
      '部署战车',
    );
  });
  it('simultaneous same mine arrivals resolve deterministically without overgather', () => {
    let s = game();
    s.formation = [{ unitId: 'tank_t1', count: 10 }, null, null, null, null, null];
    s = command(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    s = command(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    s = advance(s, T + 8000);
    expect(s.marches.map((m) => m.phase)).toEqual(['gathering', 'returning']);
    assertState(s);
  });
  it('depleted deposit returns exactly what remained', () => {
    let s = game();
    s.world[0].reserve = 2;
    s = command(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    s = advance(s, T + 8000 + 1500);
    expect(s.marches[0].cargo.iron).toBe(2);
    expect(s.world[0].reserve).toBe(0);
    s = advance(s, s.now + 8000);
    expect(s.counters.cargo).toBe(2);
    assertState(s);
  });
  it('formal battle transfers casualties to repair and destroyed containers', () => {
    let s = game();
    s.cleared = [0, 1, 2, 3];
    s = command(s, { type: 'battle', stage: 4 });
    assertState(s);
    const losses = s.reports[0].casualties.reduce((n, c) => n + c.lost, 0);
    expect(losses).toBeGreaterThan(0);
    expect(
      Object.values(s.damaged).reduce((a, b) => a + b, 0) +
        Object.values(s.destroyedUnits).reduce((a, b) => a + b, 0),
    ).toBe(losses);
  });
  it('many deterministic combat seeds never create or destroy unexplained troops', () => {
    for (let i = 1; i <= 100; i++) {
      let s = game();
      s.seed = i;
      s = command(s, { type: 'battle', stage: 0 });
      assertState(s);
      for (const r of s.reports[0].final)
        for (const t of r) expect(t.totalHp).toBeGreaterThanOrEqual(0);
    }
  });
});
