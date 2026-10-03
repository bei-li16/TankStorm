import { describe, expect, it } from 'vitest';
import { army, simulate } from '../src/core/battle';
import { newGame, execute, advance } from '../src/core/engine';
import { battleSummary, progressSummary } from '../src/core/overview';

describe('v0.25 outcome and rest feedback', () => {
  it('does not recommend repairing a lossless victory and distinguishes practice', () => {
    const a = army([{ unitId: 'tank_t7', count: 100 }]);
    a[0].accuracy = 10000;
    const r = simulate(a, army([{ unitId: 'tank_t1', count: 2 }]), 1, 'stage');
    const original = structuredClone(r);
    expect(battleSummary(r).feedback[0]).toContain('无战损');
    expect(r).toEqual(original);
    r.mode = 'training';
    expect(battleSummary(r).feedback[0]).toContain('演习无损');
    r.final[0][0].count -= 1;
    r.final[0][0].totalHp -= r.final[0][0].hp;
    expect(battleSummary(r).feedback[0]).toContain('实际未扣兵');
  });

  it('joins a returning expedition to its earlier battle without counting the battle twice', () => {
    let s = newGame('rest-feedback', '验收', 1000000);
    const site = s.world.find((v) => v.kind === 'mine')!;
    site.guards = [{ unitId: 'tank_t1', count: 1 }, null, null, null, null, null];
    site.reserve = 100;
    s = execute(
      s,
      {
        type: 'march',
        targetId: site.id,
        mission: 'gather',
        formation: [{ unitId: 'tank_t1', count: 20 }, null, null, null, null, null],
      },
      s.now,
      'march',
    ).state;
    s = advance(s, s.marches[0].dueAt);
    expect(s.reports).toHaveLength(1);
    const before = structuredClone(s);
    const after = advance(s, s.now + 3600000);
    const original = structuredClone(after);
    const summary = progressSummary(before, after);
    expect(summary.battles).toHaveLength(0);
    expect(summary.returns).toHaveLength(1);
    expect(summary.returns[0]).toMatchObject({
      title: `${site.name} [${site.x},${site.y}]`,
      cargo: after.expeditionLog![0].cargo,
      losses: {
        repairable: after.reports[0].casualties.reduce((n, v) => n + v.repairable, 0),
        destroyed: after.reports[0].casualties.reduce((n, v) => n + v.destroyed, 0),
      },
    });
    expect(after).toEqual(original);
    expect(progressSummary(after, advance(after, after.now + 1000)).returns).toEqual([]);
    after.reports = [];
    expect(progressSummary(before, after).returns[0].losses).toBeNull();
  });
});
