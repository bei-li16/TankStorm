import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  chapters,
  stageNames,
  stageHints,
  stageFormation,
  stageReward,
  stageGrowth,
} from '../src/core/content';
import {
  coreChapters,
  coreCurves,
  dungeons,
  dungeonBlock,
  dungeonArmy,
  dungeonGrowth,
} from '../src/core/arsenal';
import { newGame, execute, assertState } from '../src/core/engine';
import { prestigeRequired } from '../src/core/commander';
import { exportSave, parseSave } from '../src/core/storage';
import { queueView } from '../src/core/vip';
import { armyPower } from '../src/core/power';
import { commanderStats } from '../src/core/battle';
import type { Command, GameState } from '../src/core/types';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ready = () => {
  const s = newGame('v35', '科研与远征章节', 1790985600000, 35);
  s.buildings.hq = s.buildings.factory = s.buildings.lab = 120;
  for (const key of Object.keys(s.tech)) s.tech[key as keyof typeof s.tech] = 30;
  for (const key of Object.keys(s.wallet)) s.wallet[key as keyof typeof s.wallet] = 100000000;
  return s;
};
let seq = 0;
const act = (s: GameState, c: Command) => execute(s, c, s.now, 'v35-' + ++seq).state;

describe('v35 campaign extension', () => {
  it('preserves pre-v35 definitions except the v38 prestige multiplier', () => {
    expect(
      hash(
        stageNames.slice(0, 288).map((name, i) => ({
          name,
          hint: stageHints[i],
          formation: stageFormation(i),
          reward: stageReward(i, true),
          repeat: stageReward(i, false),
          growth: { ...stageGrowth(i, true), prestige: stageGrowth(i, true).prestige / 5 },
        })),
      ),
    ).toBe('dde6039f353723e986922dbae24a17e44e075175cc49aa21f034b5f3769d34cf');
    expect(
      hash(
        dungeons
          .slice(0, 144)
          .map((d) => ({ ...d, growth: { ...d.growth, prestige: d.growth.prestige / 5 } })),
      ),
    ).toBe('933744c3d63d848235bb13b5c000db50e4b7dbc12dd95fcaf5241454f6c939f0');
  });
  it('extends the original troop, technology and drop slopes without a strength ceiling', () => {
    expect(chapters).toHaveLength(36);
    expect(stageNames).toHaveLength(576);
    expect(coreChapters).toHaveLength(20);
    expect(dungeons).toHaveLength(320);
    for (let i = 288; i < stageNames.length; i++) {
      expect(stageFormation(i)[0]!.count - stageFormation(i - 16)[0]!.count).toBe(25);
      expect(stageReward(i, true).iron).toBeGreaterThan(stageReward(i - 1, true).iron!);
      expect(stageGrowth(i, false)).toMatchObject({
        books: 0,
        skillPoints: 0,
        prestige: Math.floor(stageGrowth(i, true).prestige / 2),
      });
    }
    for (let c = 9; c < coreChapters.length; c++) {
      const prev = coreCurves[c - 1],
        next = coreCurves[c];
      expect(next.tech).toEqual([prev.tech[1] + 2, prev.tech[1] + 24]);
      expect(next.count).toEqual([prev.count[1] + 5, prev.count[1] + 5 + 31 + (c - 4) * 5]);
      expect(next.vi).toEqual([prev.vi[0] + 8, prev.vi[1] + 10]);
      expect(next.vii).toEqual([prev.vii[0] + 8, prev.vii[1] + 10]);
      expect(next.gate).toEqual([120, 120]);
      expect(next.theme).toBeTruthy();
    }
    for (let i = 144; i < dungeons.length; i++) {
      expect(armyPower(dungeonArmy(dungeons[i]))).toBeGreaterThan(
        armyPower(dungeonArmy(dungeons[i - 1])),
      );
      expect(dungeonGrowth(dungeons[i], false)).toMatchObject({
        books: 0,
        prestige: Math.floor(dungeons[i].growth.prestige / 2),
      });
    }
    expect(stageFormation(575)[0]!.count).toBe(885);
    expect(dungeons.at(-1)!.guardTech).toBe(384);
    expect(() => stageFormation(576)).toThrow('战役不存在');
  });
  it('loads old endpoint progress and unlocks only the next new node', async () => {
    let s = ready();
    s.cleared = Array.from({ length: 288 }, (_, i) => i);
    s.arsenal!.cleared = dungeons.slice(0, 144).map((d) => d.id);
    s = await parseSave(await exportSave(s));
    expect(s.cleared).toHaveLength(288);
    expect(s.arsenal!.cleared).toHaveLength(144);
    expect(dungeonBlock(s, dungeons[144])).toBe('');
    expect(dungeonBlock(s, dungeons[145])).toContain('先通过');
    expect(() => act(s, { type: 'battle', stage: 289 })).toThrow('上一');
    expect(s.commander.books).toBe(ready().commander.books);
  });
  it.each(['main', 'core'])(
    'settles the new %s endpoint, repeats and reloads without duplicate awards',
    async (kind) => {
      let s = ready();
      // High leadership is attainable independently of the fixed 120 tech cap.
      s.commander.leadership = 2000;
      s.commander.prestige = prestigeRequired(2000);
      s.commander.attackSkill = 120;
      s.available.tank_t7 = s.createdUnits.tank_t7 = 100000;
      s.formation = Array.from({ length: 6 }, () => ({ unitId: 'tank_t7', count: 10000 }));
      s.cleared = Array.from({ length: 575 }, (_, i) => i);
      s.arsenal!.cleared = dungeons.slice(0, -1).map((d) => d.id);
      const d = dungeons.at(-1)!;
      const c: Command =
        kind === 'main' ? { type: 'battle', stage: 575 } : { type: 'dungeon', dungeonId: d.id };
      s = act(s, c);
      const report = structuredClone(s.reports[0]);
      expect(report.winner).toBe(0);
      if (kind === 'main') expect(s.cleared).toHaveLength(576);
      else {
        expect(s.arsenal!.cleared).toHaveLength(320);
        expect(report.initial[1]).toEqual(dungeonArmy(d));
        expect(report.tactics!.teams[1]).toEqual(
          commanderStats({ march: d.guardTech, ballistics: d.guardTech }),
        );
      }
      const books = s.commander.books;
      s = execute(s, c, s.now, 'repeat-v35').state;
      expect(s.reports[0].winner).toBe(0);
      expect(s.commander.books).toBe(books);
      expect(s.reports[0].growth!.prestige).toBe(Math.floor(report.growth!.prestige / 2));
      const loaded = await parseSave(await exportSave(s));
      expect(loaded.reports[1]).toEqual(report);
      expect(execute(loaded, c, loaded.now, 'repeat-v35').state).toBe(loaded);
      assertState(loaded);
    },
  );
});

describe('v35 research inline acceleration transactions', () => {
  it('pays once, accelerates only the active research and promotes the waiting project', async () => {
    let s = ready();
    for (const tech of ['attack', 'hp', 'ballistics', 'survey'] as const)
      s = act(s, { type: 'research', tech });
    const jobs = queueView(s).filter((j) => j.kind === 'research');
    expect(jobs.map((j) => j.waiting)).toEqual([false, true, true, true]);
    const before = structuredClone(s);
    expect(() => act(s, { type: 'accelerate', kind: 'research', seq: jobs[1].seq })).toThrow(
      '开工',
    );
    expect(() => act(s, { type: 'research', tech: 'armorPlating' })).toThrow('满');
    expect(s).toEqual(before);
    const c: Command = { type: 'accelerate', kind: 'research', seq: jobs[0].seq };
    s = execute(s, c, s.now, 'speed-v35').state;
    expect(s.tech.attack).toBe(31);
    expect(s.tech.hp).toBe(30);
    expect(s.wallet.gold).toBe(before.wallet.gold - jobs[0].acceleration);
    for (const key of ['iron', 'oil', 'lead', 'titanium', 'crystal'] as const)
      expect(s.wallet[key]).toBe(before.wallet[key]);
    const promoted = queueView(s).find((j) => j.kind === 'research')!;
    expect(promoted).toMatchObject({ target: 'hp', waiting: false, seq: jobs[1].seq });
    expect(promoted.acceleration).toBeGreaterThan(0);
    s = await parseSave(await exportSave(s));
    expect(execute(s, c, s.now, 'speed-v35').state).toBe(s);
    expect(() => act(s, c)).toThrow();
    s.wallet.gold = 0;
    const poor = structuredClone(s);
    expect(() => act(s, { type: 'accelerate', kind: 'research', seq: promoted.seq })).toThrow(
      '金币',
    );
    expect(s).toEqual(poor);
  });
});
