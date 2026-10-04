import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { newGame, execute, assertState } from '../src/core/engine';
import { stageNames, stageFormation, stageReward, stageGrowth } from '../src/core/content';
import { dungeons } from '../src/core/arsenal';
import { exportSave, parseSave } from '../src/core/storage';
import { progressSummary } from '../src/core/overview';
import { prestigeRequired } from '../src/core/commander';
import { restPreview } from '../src/core/planning';
const fresh = () => newGame('base32', '休整验收', 1700000000000, 32);
const hash = (data: unknown) => createHash('sha256').update(JSON.stringify(data)).digest('hex');
describe('v32 continuous chapters and editable rest', () => {
  it('preserves every pre-v32 stage definition and reward exactly', () => {
    // Recorded from v0.31.0 / 35d451a, not generated from the implementation under test.
    expect(
      hash(
        stageNames
          .slice(0, 192)
          .map((name, i) => [
            name,
            stageFormation(i),
            stageReward(i, true),
            stageReward(i, false),
            stageGrowth(i, true),
            stageGrowth(i, false),
          ]),
      ),
    ).toBe('03ae59a98b6fcfa567df7426d0e7ac8d2a60028a17b179d1daa46a1274f73c9f');
    expect(hash(dungeons.slice(0, 80))).toBe(
      'ffe405f871ca1800b40f5fc3df2a6fef0d87caad23900f1598a3ae050425a900',
    );
  });
  it.each([1, 3, 12, 120, 720])('settles %i hours and ignores duplicate request IDs', (hours) => {
    const original = fresh();
    const after = execute(original, { type: 'rest', minutes: hours * 60 }, original.now, 'rest');
    expect(after.state.now - original.now).toBe(hours * 3600000);
    expect(after.state.timeOffset).toBe(hours * 3600000);
    expect(
      execute(after.state, { type: 'rest', minutes: hours * 60 }, after.state.now, 'rest').state,
    ).toBe(after.state);
    expect(progressSummary(original, after.state).elapsed).toBe(hours * 3600000);
    assertState(after.state);
  });
  it.each([0, -60, 1, 90, 720 * 60 + 60, NaN, Infinity])(
    'rejects invalid duration %s atomically',
    (minutes) => {
      const s = fresh(),
        before = structuredClone(s);
      expect(() => execute(s, { type: 'rest', minutes }, s.now, 'invalid')).toThrow('整数小时');
      expect(() => restPreview(s, minutes)).toThrow('整数小时');
      expect(s).toEqual(before);
    },
  );
  it('continues paid queue backlogs during custom rest, without changing old progress', async () => {
    let s = fresh();
    s.buildings.hq = s.buildings.factory = 60;
    for (const k of Object.keys(s.wallet) as (keyof typeof s.wallet)[]) s.wallet[k] = 100000000;
    const start = s.available.tank_t1;
    for (let i = 0; i < 4; i++)
      s = execute(s, { type: 'produce', unitId: 'tank_t1', count: 500 }, s.now, `prod${i}`).state;
    s.cleared = Array.from({ length: 192 }, (_, i) => i);
    s.arsenal!.cleared = dungeons.slice(0, 80).map((d) => d.id);
    const before = await parseSave(await exportSave(s));
    const after = execute(before, { type: 'rest', minutes: 120 * 60 }, before.now, 'custom').state;
    expect(after.available.tank_t1).toBe(start + 2000);
    expect(progressSummary(before, after).produced).toBe(2000);
    expect(after.cleared).toEqual(before.cleared);
    expect(after.arsenal!.cleared).toEqual(before.arsenal!.cleared);
    expect(after.reports).toEqual(before.reports);
    expect((await parseSave(await exportSave(after))).available).toEqual(after.available);
    assertState(after);
  });
  it('makes chapter 18 clearable and preserves its reward snapshot and request idempotence', async () => {
    const s = fresh();
    s.commander.prestige = prestigeRequired(120);
    s.commander.leadership = 120;
    s.commander.attackSkill = 120;
    s.available.tank_t7 = s.createdUnits.tank_t7 = 3690;
    s.formation = Array.from({ length: 6 }, () => ({ unitId: 'tank_t7', count: 615 }));
    s.cleared = Array.from({ length: 287 }, (_, i) => i);
    const after = execute(s, { type: 'battle', stage: 287 }, s.now, 'last').state;
    expect(after.reports[0].winner).toBe(0);
    expect(after.cleared).toHaveLength(288);
    expect(after.reports[0].rewards).toEqual(stageReward(287, true));
    const loaded = await parseSave(await exportSave(after));
    expect(loaded.reports).toEqual(after.reports);
    expect(execute(loaded, { type: 'battle', stage: 287 }, loaded.now, 'last').state).toBe(loaded);
  });
});
