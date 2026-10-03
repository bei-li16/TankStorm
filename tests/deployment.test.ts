import { describe, it, expect } from 'vitest';
import { advance, assertState, execute, newGame } from '../src/core/engine';
import { dungeons } from '../src/core/arsenal';
import { unitList } from '../src/core/content';
import { exportSave, parseSave } from '../src/core/storage';
import type { Formation, GameState } from '../src/core/types';

const T = 1760000000000;
const formation: Formation = [
  { unitId: 'tank_t1', count: 5 },
  null,
  { unitId: 'tank_destroyer_t1', count: 4 },
  null,
  { unitId: 'spg_t1', count: 3 },
  { unitId: 'rocket_t1', count: 2 },
];
const fresh = () => newGame('deployment', '战前部署', T);
const snapshot = (s: GameState) => ({
  formation: s.formation,
  available: s.available,
  damaged: s.damaged,
  destroyed: s.destroyedUnits,
  cleared: s.cleared,
  wallet: s.wallet,
  commander: s.commander,
});

describe('battle deployment transaction', () => {
  it('fights with exactly the confirmed six slots, saves them and settles once', async () => {
    const s = fresh(),
      before = structuredClone(s);
    const command = { type: 'battle' as const, stage: 0, formation };
    const result = execute(s, command, T, 'deploy-once'),
      next = result.state;
    expect(s).toEqual(before);
    expect(next.formation).toEqual(formation);
    expect(
      next.reports[0].initial[0].map((t) => ({ slot: t.slot, unitId: t.unitId, count: t.count })),
    ).toEqual(formation.flatMap((t, i) => (t ? [{ slot: i + 1, ...t }] : [])));
    expect(next.cleared).toEqual([0]);
    expect(next.reports).toHaveLength(1);
    expect(execute(next, command, T + 1000, 'deploy-once').state).toEqual(next);
    const restored = await parseSave(await exportSave(next));
    expect(restored.formation).toEqual(formation);
    expect(restored.reports).toEqual(next.reports);
    assertState(restored);
  });
  it.each([
    Array(6).fill(null),
    [{ unitId: 'tank_t1', count: 21 }, null, null, null, null, null],
    [{ unitId: 'tank_t1', count: 11 }, { unitId: 'tank_t1', count: 10 }, null, null, null, null],
    [{ unitId: 'tank_t1', count: 0 }, null, null, null, null, null],
    [{ unitId: 'tank_t1', count: 1.5 }, null, null, null, null, null],
    [{ unitId: 'unknown', count: 1 }, null, null, null, null, null],
    [null],
  ])('rejects invalid/stale formation without saving edits or touching the input: %j', (slots) => {
    const s = fresh(),
      before = structuredClone(s);
    expect(() =>
      execute(s, { type: 'battle', stage: 0, formation: slots as Formation }, T + 1000, 'invalid'),
    ).toThrow();
    expect(s).toEqual(before);
  });
  it('rejects a deployment whose troops have since left on a march, instead of silently reducing it', () => {
    let s = fresh();
    const original = s.formation;
    s = execute(
      s,
      { type: 'march', targetId: 'site-0', mission: 'gather' },
      T,
      'march-first',
    ).state;
    const before = structuredClone(s);
    expect(() => execute(s, { type: 'battle', stage: 0, formation: original }, T, 'stale')).toThrow(
      '库存不足',
    );
    expect(s).toEqual(before);
  });
  it('locked campaigns and locked dungeons cannot save a proposed formation', () => {
    const s = fresh(),
      before = structuredClone(s);
    expect(() => execute(s, { type: 'battle', stage: 1, formation }, T, 'locked')).toThrow(
      '上一战役',
    );
    expect(() =>
      execute(s, { type: 'dungeon', dungeonId: dungeons[0].id, formation }, T, 'locked-core'),
    ).toThrow('工厂');
    expect(s).toEqual(before);
  });
  it('campaign and core training use the proposed slots and preserve troops and progress', () => {
    for (const command of [
      { type: 'battle' as const, stage: 4 },
      { type: 'dungeon' as const, dungeonId: dungeons[0].id },
    ]) {
      const s = fresh();
      const result = execute(s, { ...command, training: true, formation }, T, 'training').state;
      expect(snapshot(result)).toEqual({ ...snapshot(s), formation });
      expect(result.reports[0].mode).toBe('training');
      expect(result.reports[0].initial[0][0].count).toBe(5);
      assertState(result);
    }
  });
  it('core attacks use confirmed advanced troops and persist core rewards only once', () => {
    const s = fresh();
    s.buildings.hq = s.buildings.factory = 60;
    for (const u of unitList) {
      s.available[u.unitId] += 200;
      s.createdUnits[u.unitId] += 200;
    }
    const slots: Formation = Array.from({ length: 6 }, () => ({ unitId: 'tank_t7', count: 20 }));
    const command = { type: 'dungeon' as const, dungeonId: dungeons[0].id, formation: slots };
    const next = execute(s, command, T, 'core').state;
    expect(next.reports[0].winner).toBe(0);
    expect(next.reports[0].initial[0]).toHaveLength(6);
    expect(next.arsenal!.cores[dungeons[0].coreId]).toBe(10);
    expect(execute(next, command, T, 'core').state).toEqual(next);
    assertState(next);
  });
  it('legacy commands without a deployment remain compatible', () => {
    const s = advance(fresh(), T + 1000);
    const next = execute(s, { type: 'battle', stage: 0 }, s.now, 'legacy').state;
    expect(next.reports).toHaveLength(1);
    expect(next.formation).toEqual(s.formation);
    assertState(next);
  });
});
