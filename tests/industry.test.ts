import { describe, expect, it } from 'vitest';
import { army, casualtySummary, simulate } from '../src/core/battle';
import { newGame, execute, advance, assertState, facilityUpgradeQuote } from '../src/core/engine';
import { productionQuote } from '../src/core/arsenal';
import { queueStatus, queueView } from '../src/core/vip';
import { exportSave, parseSave } from '../src/core/storage';
import type { Command, GameState } from '../src/core/types';

let serial = 0;
const act = (s: GameState, c: Command) => execute(s, c, s.now, `industry-${++serial}`).state;
function base() {
  const s = newGame('industry', '工业验收', 1760000000000);
  for (const key of Object.keys(s.wallet)) s.wallet[key as keyof typeof s.wallet] = 10000000;
  return s;
}
function built() {
  const s = base();
  s.buildings.hq = s.buildings.factory = 60;
  s.industry = { version: 1, factory2: 60, refit: 60 };
  return s;
}

describe('80 percent recovery', () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [5, 4],
    [6, 5],
    [7, 6],
    [8, 7],
    [9, 8],
    [10, 8],
  ])('%i lost yields %i repairable, with no extra rounding per slot', (lost, repairable) => {
    const initial = army([
      { unitId: 'tank_t1', count: 5 },
      { unitId: 'tank_t1', count: 5 },
    ]);
    const final = initial.map((v, i) => ({
      ...v,
      totalHp: Math.max(0, 5 - Math.max(0, lost - i * 5)) * v.hp,
    }));
    expect(casualtySummary(initial, final)[0]).toMatchObject({
      lost,
      repairable,
      destroyed: lost - repairable,
    });
  });
  it.each(['stage', 'world', 'dungeon', 'training'] as const)(
    'settles %s with the documented rule',
    (mode) => {
      const r = simulate(
        army([{ unitId: 'tank_t1', count: 2 }]),
        army([{ unitId: 'tank_t7', count: 100 }]),
        1,
        mode,
      );
      expect(r.casualties[0]).toMatchObject({
        lost: 2,
        repairable: mode === 'training' ? 0 : 2,
        destroyed: 0,
      });
    },
  );
  it('keeps different models separate and repairs rather than recreating their stock', () => {
    const mixed = army([
      { unitId: 'tank_t1', count: 3 },
      { unitId: 'spg_t1', count: 2 },
    ]);
    expect(
      casualtySummary(
        mixed,
        mixed.map((v) => ({ ...v, totalHp: 0 })),
      ).map((c) => [c.unitId, c.repairable, c.destroyed]),
    ).toEqual([
      ['tank_t1', 3, 0],
      ['spg_t1', 2, 0],
    ]);
    let s = base();
    s.formation = [{ unitId: 'tank_t1', count: 2 }, null, null, null, null, null];
    s.cleared = Array.from({ length: 11 }, (_, i) => i);
    s = act(s, { type: 'battle', stage: 11 });
    expect(s.damaged.tank_t1).toBe(2);
    const created = s.createdUnits.tank_t1;
    s = act(s, { type: 'repair', unitId: 'tank_t1', count: 2 });
    expect(s.damaged.tank_t1).toBe(0);
    s = advance(s, s.jobs.repair!.dueAt);
    expect(s.available.tank_t1).toBe(19);
    s = act(s, { type: 'cancel', kind: 'repair' });
    expect(s.damaged.tank_t1).toBe(1);
    expect(s.createdUnits.tank_t1).toBe(created);
    assertState(s);
  });
});

describe('two manufacturing plants and a refit plant', () => {
  it('unlocks construction at HQ13, requires completion and independent plant upgrades', () => {
    let s = base();
    s.buildings.hq = 12;
    expect(() => act(s, { type: 'facilityUpgrade', facility: 'factory2' })).toThrow('13');
    s.buildings.hq = 13;
    expect(productionQuote(s, 'tank_t1', 'produce', 'factory2').block).toContain('建设');
    const q = facilityUpgradeQuote(s, 'factory2');
    s = act(s, { type: 'facilityUpgrade', facility: 'factory2' });
    expect(s.jobs.building!.duration).toBe(q.duration);
    expect(s.industry!.factory2).toBe(0);
    s = advance(s, s.jobs.building!.dueAt);
    expect(s.industry!.factory2).toBe(1);
    expect(productionQuote(s, 'tank_t1', 'produce', 'factory2').block).toBe('');
    expect(productionQuote(s, 'tank_t2', 'produce', 'factory2').block).toContain('6');
    s = act(s, { type: 'facilityUpgrade', facility: 'refit' });
    s = act(s, { type: 'cancel', kind: 'building' });
    expect(s.industry!.refit).toBe(0);
    assertState(s);
  });
  it('works on three lines plus repair and research simultaneously at VIP0', () => {
    let s = built();
    s.available.tank_t1 -= 2;
    s.damaged.tank_t1 = 2;
    s = act(s, { type: 'produce', unitId: 'tank_t1', count: 3, facility: 'factory' });
    s = act(s, { type: 'produce', unitId: 'rocket_t1', count: 3, facility: 'factory2' });
    s = act(s, { type: 'refit', unitId: 'tank_t2', count: 3 });
    s = act(s, { type: 'repair', unitId: 'tank_t1', count: 2 });
    s = act(s, { type: 'research', tech: 'attack' });
    expect(queueStatus(s, 'production').active).toHaveLength(3);
    expect(queueStatus(s, 'production').slots).toBe(3);
    const end = Math.max(...queueView(s).map((j) => s.now + j.remainingMs));
    s = advance(s, end);
    expect(s.jobs).toEqual({});
    expect(s.available.tank_t1).toBe(20);
    expect(s.available.tank_t2).toBe(3);
    expect(s.available.rocket_t1).toBe(9);
    expect(s.tech.attack).toBe(1);
    assertState(s);
  });
  it('keeps per-line FIFO, wait estimates and cancellation independent through export/import', async () => {
    let s = act(built(), { type: 'vipRecharge', gold: 40 });
    s.available.tank_t1 = s.createdUnits.tank_t1 = 1000;
    for (const facility of ['factory', 'factory2'] as const) {
      s = act(s, { type: 'produce', unitId: 'tank_t1', count: 100, facility });
      s = act(s, { type: 'produce', unitId: 'rocket_t1', count: 100, facility });
    }
    s = act(s, { type: 'refit', unitId: 'tank_t2', count: 100 });
    s = act(s, { type: 'refit', unitId: 'tank_t2', count: 100 });
    expect(() =>
      act(s, { type: 'produce', unitId: 'tank_t1', count: 1, facility: 'factory2' }),
    ).toThrow('等待位已满');
    const waiting = queueView(s).filter((j) => j.waiting);
    expect(waiting).toHaveLength(3);
    expect(waiting[0].waitMs).toBe(waiting[1].waitMs);
    const other = structuredClone(s.jobs.production);
    s = await parseSave(await exportSave(s));
    s = act(s, { type: 'cancel', kind: 'production', seq: s.jobs['production:factory2']!.seq });
    expect(s.jobs.production).toEqual(other);
    expect(s.jobs['production:factory2']!.target).toBe('rocket_t1');
    expect(s.jobBacklog).toHaveLength(2);
    s = act(s, { type: 'accelerate', kind: 'production', seq: s.jobs['production:refit']!.seq });
    expect(s.jobs.production).toEqual(other);
    expect(s.jobs['production:refit']!.completed).toBe(0);
    s = advance(s, Math.max(...queueView(s).map((j) => s.now + j.remainingMs)));
    assertState(s);
    expect(s.jobs).toEqual({});
  });
  it('preserves legacy mixed refit/manufacturing orders and reports without recharging or changing timing', async () => {
    let s = act(built(), { type: 'vipRecharge', gold: 40 });
    s.available.tank_t1 = s.createdUnits.tank_t1 = 1000;
    s = act(s, { type: 'refit', unitId: 'tank_t2', count: 100 });
    s.jobs.production = s.jobs['production:refit'];
    delete s.jobs['production:refit'];
    delete s.jobs.production!.facility;
    delete s.industry;
    const job = structuredClone(s.jobs.production);
    s = act(s, { type: 'produce', unitId: 'rocket_t1', count: 100 });
    delete s.industry;
    delete s.jobBacklog![0].facility;
    const historical = simulate(
      army([{ unitId: 'tank_t1', count: 100 }]),
      army([{ unitId: 'tank_t7', count: 100 }]),
      1,
    );
    historical.ruleset = 'classic-combat-v0.7';
    historical.casualties[0].repairable = 1;
    historical.casualties[0].destroyed = 1;
    s.reports = [historical];
    const originalWallet = structuredClone(s.wallet);
    const migrated = await parseSave(await exportSave(s));
    expect(migrated.industry).toEqual({ version: 1, factory2: 0, refit: 0 });
    expect(migrated.jobs.production).toEqual(job);
    expect(migrated.wallet).toEqual(originalWallet);
    expect(migrated.reports).toEqual([historical]);
    const done = advance(
      migrated,
      Math.max(...queueView(migrated).map((j) => migrated.now + j.remainingMs)),
    );
    expect(done.available.tank_t2).toBe(100);
    expect(done.available.rocket_t1).toBe(106);
    expect(done.reports).toEqual([historical]);
    assertState(done);
  });
  it('rejects mismatched facilities and damaged modern industry data', () => {
    const s = built();
    expect(() =>
      act(s, { type: 'produce', unitId: 'tank_t1', count: 1, facility: 'refit' }),
    ).toThrow('对应');
    expect(() =>
      act(s, { type: 'refit', unitId: 'tank_t2', count: 1, facility: 'factory2' }),
    ).toThrow('对应');
    expect(() => assertState({ ...s, industry: { ...s.industry!, refit: 121 } })).toThrow();
    const f = act(s, { type: 'produce', unitId: 'tank_t1', count: 1, facility: 'factory2' });
    f.industry!.factory2 = 0;
    expect(() => assertState(f)).toThrow('设施');
  });
});
