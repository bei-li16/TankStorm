import { describe, it, expect } from 'vitest';
import {
  newGame,
  execute,
  advance,
  leadershipCap,
  usableFormation,
  assertState,
} from '../src/core/engine';
import { army, simulate, rng32, BATTLE_RULESET } from '../src/core/battle';
import {
  chapters,
  stageNames,
  stageFormation,
  stageReward,
  unitList,
  units,
} from '../src/core/content';
import {
  leadershipChance,
  leadershipQuote,
  prestigeLevel,
  prestigeRequired,
} from '../src/core/commander';
import {
  powerOverview,
  powerUnits,
  unitPower,
  arrangedFormation,
  armyPower,
} from '../src/core/power';
import { exportSave, parseSave } from '../src/core/storage';
import type { Command, GameState } from '../src/core/types';

let sequence = 0;
const act = (s: GameState, c: Command) => execute(s, c, s.now, 'v14-' + ++sequence).state;
const game = () => newGame('v14', '十四版验收', 1790985600000, 0x9e3779b9);
const grant = (s: GameState, id: string, count: number) => {
  s.available[id] += count;
  s.createdUnits[id] += count;
};

describe('major round fairness', () => {
  it.each([
    [1, 6],
    [6, 1],
    [2, 4],
    [4, 2],
    [5, 6],
  ])('each group acts once with %i versus %i groups', (a, b) => {
    const durable = (n: number) =>
      army(Array.from({ length: n }, () => ({ unitId: 'tank_destroyer_t1', count: 100 }))).map(
        (st) => ({ ...st, attack: 1, hp: 1000000, totalHp: 100000000 }),
      );
    const report = simulate(durable(a), durable(b), 917);
    for (let round = 1; round <= 40; round++) {
      const regular = report.actions!.filter((v) => v.round === round && !v.extra);
      expect(regular.filter((v) => v.side === 0)).toHaveLength(a);
      expect(regular.filter((v) => v.side === 1)).toHaveLength(b);
      expect(new Set(regular.map((v) => v.side + ':' + v.from)).size).toBe(a + b);
      const pairs = regular.slice(0, Math.min(a, b) * 2);
      expect(pairs.every((v, i) => v.side === i % 2)).toBe(true);
    }
    for (let i = 0; i < report.actions!.length; i++) {
      const v = report.actions![i];
      if (!v.extra) continue;
      const p = report.actions![i - 1];
      expect([v.round, v.exchange, v.side, v.from]).toEqual([p.round, p.exchange, p.side, p.from]);
      expect(p.extra).toBe(false);
    }
    const s = game();
    s.reports = [report];
    report.id = 'long';
    assertState(s);
  });
});

describe('normalized power and stock-limited arrangement', () => {
  it('all four baseline classes at each of seven tiers have exactly equal power', () => {
    const s = game(),
      powers = powerUnits(s);
    for (let tier = 1; tier <= 7; tier++)
      expect(
        new Set(unitList.filter((u) => u.tier === tier).map((u) => powers[u.unitId])).size,
      ).toBe(1);
    for (let t = 2; t <= 7; t++)
      expect(powers['tank_t' + t]).toBeGreaterThan(powers['tank_t' + (t - 1)]);
  });
  it('attack, health, armor, accuracy, commander tactics and combat research contribute', () => {
    const baseline = army([{ unitId: 'tank_t1', count: 1 }])[0],
      p = unitPower(baseline);
    for (const [key, value] of Object.entries({
      attack: 40,
      hp: 320,
      armor: 1000,
      accuracy: 500,
      evasion: 500,
      crit: 1000,
      initiative: 130,
      extraFire: 140,
    }))
      expect(unitPower({ ...baseline, [key]: value }), key).toBeGreaterThan(p);
    const s = game();
    for (const key of ['attack', 'hp', 'armorPlating', 'ballistics', 'march'] as const) {
      const changed = structuredClone(s);
      changed.tech[key] = 1;
      expect(powerUnits(changed).tank_t1, key).toBeGreaterThan(p);
    }
    for (const key of ['attackSkill', 'initiativeSkill', 'extraFireSkill'] as const) {
      const changed = structuredClone(s);
      changed.commander[key] = 1;
      expect(powerUnits(changed).tank_t1, key).toBeGreaterThan(p);
    }
    s.tech.production = s.tech.gather = s.tech.storage = 20;
    expect(powerUnits(s).tank_t1).toBe(p);
  });
  it('maximum power differs from highest tier and never spends or double-counts stock', () => {
    const s = game();
    for (const u of unitList) {
      s.available[u.unitId] = 0;
      s.createdUnits[u.unitId] = 0;
    }
    grant(s, 'tank_t6', 120);
    grant(s, 'tank_t7', 1);
    const before = structuredClone(s),
      high = arrangedFormation(s, 'tier'),
      power = arrangedFormation(s, 'power');
    expect(high.some((st) => st?.unitId === 'tank_t7')).toBe(true);
    expect(power.some((st) => st?.unitId === 'tank_t7')).toBe(false);
    const points = powerUnits(s),
      score = (f: typeof power) =>
        f.reduce((n, st) => n + (st ? points[st.unitId] * st.count : 0), 0);
    expect(score(power)).toBeGreaterThan(score(high));
    expect(s).toEqual(before);
    expect(power.reduce((n, st) => n + (st?.count ?? 0), 0)).toBe(120);
    const overview = powerOverview(s, usableFormation(s));
    expect(overview.ceiling).toBe(points.tank_t7 * leadershipCap(s) * 6);
    expect(overview.ceiling).toBeGreaterThanOrEqual(overview.readyMax);
    expect(armyPower(army(power, s.tech, s.commander.attackSkill, s.commander))).toBe(score(power));
  });
});

describe('twelve chapter campaign and persistent rewards', () => {
  it('has 576 deterministic mixed-tier stages with ordered chapter difficulty', () => {
    expect(chapters).toHaveLength(36);
    expect(stageNames).toHaveLength(576);
    expect(stageNames[0]).toBe('边境哨卡');
    expect(stageNames[11]).toBe('黎明行动');
    expect(stageFormation(0)[0]).toEqual({ unitId: 'tank_t1', count: 3 });
    expect(stageReward(0, true)).toMatchObject({ gold: 5, iron: 250 });
    for (let i = 1; i < stageNames.length; i++) {
      expect(armyPower(army(stageFormation(i))), `stage ${i}`).toBeGreaterThanOrEqual(
        armyPower(army(stageFormation(i - 1))),
      );
    }
    for (let c = 1; c < 6; c++)
      expect(
        new Set(stageFormation(c * 16 + 15).flatMap((st) => (st ? [units[st.unitId].tier] : [])))
          .size,
      ).toBe(2);
  });
  it('gates chapter transitions, preserves first rewards and limits repeat growth, saves final target', async () => {
    let s = game();
    s.commander.prestige = prestigeRequired(120);
    s.commander.leadership = 120;
    s.buildings.hq = s.buildings.factory = 20;
    grant(s, 'tank_t7', 6000);
    s.formation = Array.from({ length: 6 }, () => ({ unitId: 'tank_t7', count: 615 }));
    expect(() => act(s, { type: 'battle', stage: 16 })).toThrow('上一');
    s.cleared = Array.from({ length: 15 }, (_, i) => i);
    s = act(s, { type: 'battle', stage: 15 });
    expect(s.cleared).toContain(15);
    s = act(s, { type: 'battle', stage: 16 });
    expect(s.cleared).toContain(16);
    const first = s.reports[0];
    expect(first.growth!.books).toBe(1);
    s = act(s, { type: 'battle', stage: 16 });
    expect(s.reports[0].growth!.skillPoints).toBe(0);
    expect(s.reports[0].growth!.books).toBe(0);
    expect(s.reports[0].growth!.prestige).toBe(Math.floor(first.growth!.prestige / 2));
    expect(s.reports[0].growth!.xp).toBe(first.growth!.xp);
    expect(s.reports[0].rewards.gold).toBe(stageReward(16, false).gold);
    s.cleared = Array.from({ length: 111 }, (_, i) => i);
    s = act(s, { type: 'battle', stage: 111 });
    expect(s.cleared).toHaveLength(112);
    expect(s.reports[0].target).toEqual({ type: 'battle', stage: 111, training: false });
    expect((await parseSave(await exportSave(s))).reports[0]).toEqual(s.reports[0]);
    const old = structuredClone(first);
    old.ruleset = 'classic-combat-v0.10';
    delete old.target;
    s.reports.push(old);
    expect(advance(s, s.now + 1000).reports.at(-1)).toEqual(old);
    assertState(s);
  });
});

describe('leadership and independent upgrade rolls', () => {
  it('decreases from 100% through 90% to 0.1%, never reaches zero', () => {
    let last = 10000;
    for (let target = 2; target <= 120; target++) {
      const p = leadershipChance(target);
      expect(p).toBeLessThanOrEqual(last);
      expect(p).toBeGreaterThanOrEqual(10);
      last = p;
    }
    expect(leadershipChance(10)).toBe(10000);
    expect(leadershipChance(11)).toBe(9000);
    expect(leadershipChance(120)).toBe(10);
    expect(leadershipChance(121)).toBe(10);
  });
  it('enforces prestige cap and validates costs before drawing a roll', () => {
    const s = game(),
      before = structuredClone(s);
    expect(() => act(s, { type: 'leadership' })).toThrow('声望');
    expect(s).toEqual(before);
    s.commander.prestige = 40;
    s.commander.books = 1;
    const next = act(s, { type: 'leadership' });
    expect(next.commander.leadership).toBe(2);
    expect(next.commander.books).toBe(0);
    expect(next.seed).not.toBe(s.seed);
    expect(leadershipQuote(next).block).toContain('声望');
  });
  it('books cost exactly 19, gold attempts do not consume books, duplicate receipts do not reroll', () => {
    let s = game();
    s.wallet.gold = 500;
    s.commander.prestige = prestigeRequired(120);
    const oldBooks = s.commander.books;
    s = act(s, { type: 'buyBooks', count: 10 });
    expect(s.wallet.gold).toBe(310);
    expect(s.commander.books).toBe(oldBooks + 10);
    const result = execute(
      s,
      { type: 'leadership', payment: 'gold', attempts: 10 },
      s.now,
      'batch',
    );
    expect(result.state.lastLeadership!.attempts).toBe(1);
    expect(result.state.wallet.gold).toBe(291);
    expect(result.state.commander.books).toBe(oldBooks + 10);
    expect(
      execute(result.state, { type: 'leadership', payment: 'gold', attempts: 10 }, s.now, 'batch')
        .state,
    ).toBe(result.state);
    expect(() => act(s, { type: 'buyBooks', count: -1 })).toThrow();
  });
  it('allows a first-attempt success and over 200 failures at the same 0.1% probability', async () => {
    const s = game();
    s.commander.prestige = prestigeRequired(120);
    s.commander.leadership = 119;
    s.commander.books = 5000;
    s.seed = 1;
    expect(act(s, { type: 'leadership' }).commander.leadership).toBe(120);
    let failing = structuredClone(s),
      found = false;
    for (let seed = 500; seed < 2000; seed++) {
      const random = rng32(seed);
      let allFail = true;
      for (let i = 0; i < 300; i++)
        if (Math.floor((random() * 10000) / 4294967296) < 10) {
          allFail = false;
          break;
        }
      if (allFail) {
        failing.seed = seed;
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
    for (let i = 0; i < 3; i++) failing = act(failing, { type: 'leadership', attempts: 100 });
    expect(failing.commander.leadership).toBe(119);
    expect(failing.commander.books).toBe(4700);
    expect(failing.lastLeadership!.chance).toBe(10);
    expect(failing.lastLeadership!.success).toBe(false);
    const loaded = await parseSave(await exportSave(failing));
    expect(loaded.lastLeadership).toEqual(failing.lastLeadership);
    const max = act(s, { type: 'leadership' });
    expect(() => act(max, { type: 'leadership' })).toThrow('需要声望等级 121');
  });
  it('migrates old earned leadership without losing troops or minting prestige', async () => {
    const s = game();
    delete s.commandVersion;
    delete s.prestigeFloor;
    s.commander.leadership = 20;
    s.cleared = Array.from({ length: 12 }, (_, i) => i);
    const loaded = await parseSave(await exportSave(s));
    expect(loaded.commander.prestige).toBe(0);
    expect(prestigeLevel(loaded)).toBe(20);
    expect(loaded.cleared).toEqual(s.cleared);
    expect(loaded.available).toEqual(s.available);
    expect(leadershipQuote(loaded).block).toContain('21');
    expect(advance(loaded, loaded.now).prestigeFloor).toBe(20);
  });
  it('persists commander tactics and captures them in battles and expeditions', () => {
    let s = game();
    s.commander.skillPoints = 3;
    s = act(s, { type: 'initiativeSkill' });
    s = act(s, { type: 'extraFireSkill' });
    s = act(s, { type: 'battle', stage: 0, training: true });
    expect(s.reports[0].ruleset).toBe(BATTLE_RULESET);
    expect(s.reports[0].tactics!.teams[0]).toEqual({ initiative: 103, extraFire: 104 });
    s = act(s, { type: 'march', targetId: s.world[0].id, mission: 'gather' });
    expect(s.marches[0].commanderStats!.initiative).toBe(103);
    s = act(s, { type: 'initiativeSkill' });
    expect(s.marches[0].commanderStats!.initiative).toBe(103);
  });
});
