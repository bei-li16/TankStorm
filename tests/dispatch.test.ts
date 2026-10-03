import { describe, expect, it } from 'vitest';
import { advance, assertState, execute, newGame } from '../src/core/engine';
import { dispatchOverview, expeditionStatus } from '../src/core/dispatch';
import { effectiveTime, queueView } from '../src/core/vip';
import { exportSave, parseSave } from '../src/core/storage';
import { researchTree } from '../src/core/research';
import type { Command, GameState, March } from '../src/core/types';

let serial = 0;
const act = (s: GameState, command: Command) =>
  execute(s, command, s.now, `dispatch-${++serial}`).state;
function ready() {
  const s = newGame('dispatch', '调度验收', 1791000000000);
  for (const id of Object.keys(s.buildings) as (keyof typeof s.buildings)[]) s.buildings[id] = 60;
  for (const node of researchTree) s.tech[node.id] = 30;
  s.buildings.hq = 61;
  for (const r of Object.keys(s.wallet) as (keyof typeof s.wallet)[]) s.wallet[r] = 1e11;
  s.industry = { version: 1, factory2: 60, refit: 60 };
  s.vip = { version: 1, paidGold: 500000, lastDaily: -1 };
  s.available.tank_t4 = 600;
  s.createdUnits.tank_t4 = 600;
  s.damaged.tank_t7 = 1000;
  s.createdUnits.tank_t7 = 1000;
  return s;
}
function busy() {
  let s = ready();
  for (const building of ['iron', 'oil'] as const) s = act(s, { type: 'upgrade', building });
  for (const facility of ['factory', 'factory2'] as const)
    for (let i = 0; i < 3; i++)
      s = act(s, { type: 'produce', unitId: 'tank_t5', count: 100, facility });
  for (let i = 0; i < 3; i++) s = act(s, { type: 'refit', unitId: 'tank_t5', count: 100 });
  for (const tech of ['attack', 'construction', 'hp'] as const)
    s = act(s, { type: 'research', tech });
  s = act(s, { type: 'repair', unitId: 'tank_t7', count: 1000 });
  assertState(s);
  return s;
}
const station = (s: GameState, id: string) =>
  dispatchOverview(s).stations.find((v) => v.id === id)!;

describe('base dispatch projection', () => {
  it('lists all seven workstations, distinguishing locked, unbuilt, idle and damaged', () => {
    const s = newGame('new', '新基地', 1791000000000);
    const d = dispatchOverview(s);
    expect([...d.stations.map((v) => v.id), d.expeditions.id]).toEqual([
      'building',
      'factory',
      'factory2',
      'refit',
      'research',
      'repair',
      'expeditions',
    ]);
    expect(d.active).toBe(0);
    expect(d.waiting).toBe(0);
    expect(station(s, 'factory2')).toMatchObject({ status: '未开放', slots: 0, nextMs: null });
    s.buildings.hq = 13;
    expect(station(s, 'factory2').block).toContain('请先建设');
    s.damaged.tank_t1 = 7;
    expect(station(s, 'repair')).toMatchObject({ damaged: 7, status: '待修车辆', waiting: 0 });
  });
  it('keeps parallel builders, two manufacturers, refit and research FIFO separate', () => {
    const s = busy(),
      d = dispatchOverview(s);
    expect(d.active).toBe(7);
    expect(d.waiting).toBe(8);
    expect(station(s, 'building')).toMatchObject({
      active: 2,
      waiting: 0,
      slots: 7,
      waitingSlots: 0,
    });
    for (const id of ['factory', 'factory2', 'refit', 'research']) {
      const q = station(s, id);
      expect(q).toMatchObject({ active: 1, waiting: 2, slots: 1, waitingSlots: 5 });
      expect(q.rows[1].waitMs).toBe(q.rows[0].remainingMs);
      expect(q.rows[2].waitMs).toBe(q.rows[1].remainingMs);
      expect(q.finishMs).toBe(q.rows[2].remainingMs);
    }
    const b = station(s, 'building');
    expect(b.finishMs).toBe(Math.max(...b.rows.map((v) => v.remainingMs)));
    expect(b.nextMs).toBe(Math.min(...b.rows.map((v) => v.remainingMs)));
    expect(station(s, 'repair')).toMatchObject({ active: 1, damaged: 0, waitingSlots: 0 });
    expect(d.stations.flatMap((v) => v.rows).map((v) => v.seq)).toEqual(
      queueView(s).map((v) => v.seq),
    );
  });
  it('is read-only, retains paid timings through save reload, including legacy production', async () => {
    const s = busy(),
      before = structuredClone(s);
    const d = dispatchOverview(s);
    expect(s).toEqual(before);
    const restored = await parseSave(await exportSave(s));
    expect(dispatchOverview(restored)).toEqual(d);
    delete restored.jobs.production!.facility;
    expect(station(restored, 'factory').active).toBe(1);
    expect(station(restored, 'factory2').active).toBe(1);
  });
  it('updates delivered quantities, countdown and cancellation without duplicate deduction', () => {
    let s = busy();
    const initial = station(s, 'factory');
    s = advance(s, s.jobs.production!.dueAt);
    expect(station(s, 'factory').rows[0].completed).toBe(1);
    expect(station(s, 'factory').nextMs).toBeLessThan(initial.nextMs!);
    const cancel = station(s, 'factory').rows[1];
    const balance = s.wallet.iron;
    s = act(s, { type: 'cancel', kind: 'production', seq: cancel.seq });
    expect(station(s, 'factory').waiting).toBe(1);
    expect(station(s, 'factory2').waiting).toBe(2);
    expect(s.wallet.iron).toBe(balance + (cancel.unitCost.iron ?? 0) * cancel.total);
    const after = structuredClone(s);
    dispatchOverview(s);
    dispatchOverview(s);
    expect(s).toEqual(after);
  });
  it('finishes multiple backlogs after a long rest and immediately reflects delivered inventory', () => {
    let s = busy();
    s = advance(s, s.now + 20 * 86400000);
    assertState(s);
    expect(dispatchOverview(s)).toMatchObject({ active: 0, waiting: 0 });
    expect(station(s, 'factory').nextMs).toBeNull();
    expect(s.available.tank_t5).toBe(900);
    expect(s.available.tank_t7).toBe(1000);
    expect(s.available.tank_t4).toBe(300);
  });
  it('VIP instantaneous jobs never remain as phantom work', () => {
    let s = ready();
    s.buildings.iron = 1;
    s = act(s, { type: 'upgrade', building: 'iron' });
    expect(s.buildings.iron).toBe(2);
    expect(station(s, 'building').rows).toEqual([]);
  });
});

describe('expedition station', () => {
  const march = (
    s: GameState,
    phase: March['phase'],
    mission: March['mission'] = 'gather',
  ): March => ({
    id: 'march-99',
    seq: 99,
    targetId: s.world[0].id,
    phase,
    mission,
    troops: [{ unitId: 'tank_t1', count: 4 }, null, null, null, null, null],
    capacity: 10000,
    gatherRate: 1000,
    travelMs: 90000,
    startedAt: s.now - 10000,
    dueAt: s.now + 80000,
    cargo: { iron: 100, oil: 0, lead: 0, titanium: 0, crystal: 0, gold: 0 },
    remainder: 0,
  });
  it.each(['outbound', 'gathering', 'returning'] as const)(
    'shows %s from this army snapshot and preserves march timing',
    (phase) => {
      const s = ready(),
        m = march(s, phase);
      s.marches = [m];
      const before = structuredClone(s),
        row = expeditionStatus(s, m);
      expect(row.held).toBe(100);
      expect(row.count).toBe(4);
      expect(row.phaseMs).toBe(phase === 'gathering' ? 0 : 80000);
      expect(row.returnMs).toBe(
        phase === 'returning'
          ? 80000
          : phase === 'gathering'
            ? 90000
            : 170000 + effectiveTime(s, 36000000),
      );
      expect(row.estimated).toBe(phase === 'outbound');
      expect(dispatchOverview(s).expeditions.active).toBe(1);
      expect(s).toEqual(before);
      s.tech.cargo = s.tech.march = s.tech.gather = 120;
      expect(expeditionStatus(s, m)).toEqual(row);
    },
  );
  it('raid ETA has no gathering segment and gathering estimate does not read hidden guards or reserves', () => {
    const s = ready(),
      m = march(s, 'outbound');
    expect(expeditionStatus(s, { ...m, mission: 'raid' }).returnMs).toBe(170000);
    const predicted = expeditionStatus(s, m).returnMs;
    s.world[0].reserve = 0;
    s.world[0].guards.fill(null);
    expect(expeditionStatus(s, m).returnMs).toBe(predicted);
  });
  it('a real expedition releases its workstation once, with actual cargo credited on return', () => {
    let s = ready();
    const mine = s.world.find((v) => v.kind === 'mine')!;
    mine.guards.fill(null);
    mine.reserve = 10000;
    s = act(s, { type: 'march', targetId: mine.id, mission: 'gather' });
    expect(dispatchOverview(s).expeditions.active).toBe(1);
    const available = s.available.tank_t1;
    s = advance(s, s.now + 86400000);
    expect(dispatchOverview(s).expeditions.active).toBe(0);
    expect(s.expeditionLog).toHaveLength(1);
    expect(s.expeditionLog![0].cargo[mine.resource]).toBeGreaterThan(0);
    expect(s.available.tank_t1).toBeGreaterThan(available);
    const returned = structuredClone(s);
    dispatchOverview(s);
    dispatchOverview(s);
    expect(s).toEqual(returned);
    assertState(s);
  });
});
