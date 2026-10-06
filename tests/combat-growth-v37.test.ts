import { describe, it, expect } from 'vitest';
import {
  newGame,
  execute,
  advance,
  assertState,
  leadershipCap,
  usableFormation,
} from '../src/core/engine';
import { leadershipCapacity, leadershipGain, prestigeRequired } from '../src/core/commander';
import { army, simulate, commanderStats } from '../src/core/battle';
import { combatResearch } from '../src/core/combat_research';
import { attributeSheet, unitAttributes } from '../src/core/attributes';
import { powerOverview } from '../src/core/power';
import { researchRequirements } from '../src/core/research';
import { researchCost } from '../src/core/content';
import { exportSave, parseSave } from '../src/core/storage';
import type { ArmyStack, Command, GameState, Technology } from '../src/core/types';

let seq = 0;
const act = (s: GameState, c: Command) => execute(s, c, s.now, 'v37-' + ++seq).state;
const fresh = () => newGame('v37', '战斗成长验收', 1791129600000, 917);
const techs = Object.keys(combatResearch) as Technology[];

describe('v37 growing command and skill capacity', () => {
  it('increases each ten-level band without changing level-one capacity or existing fleets', async () => {
    let expected = 20;
    expect(leadershipCapacity(1)).toBe(20);
    for (let level = 2; level <= 5000; level++) {
      expected += 5 + Math.floor((level - 1) / 10);
      expect(leadershipCapacity(level)).toBe(expected);
      expect(leadershipGain(level)).toBe(leadershipCapacity(level) - leadershipCapacity(level - 1));
    }
    expect([10, 20, 60, 120, 192, 200].map(leadershipCapacity)).toEqual([
      65, 125, 465, 1275, 2723, 2915,
    ]);
    const s = fresh();
    s.commander.leadership = 192;
    s.commander.prestige = prestigeRequired(193);
    const inventory = structuredClone(s.available),
      formation = structuredClone(s.formation);
    const loaded = await parseSave(await exportSave(s));
    expect(leadershipCap(loaded)).toBe(2723);
    expect(loaded.available).toEqual(inventory);
    expect(loaded.formation).toEqual(formation);
    expect(powerOverview(loaded, usableFormation(loaded)).cap).toBe(2723);
  });
  it('spends each skill point once above 120 and round-trips high commander snapshots', async () => {
    let s = fresh();
    s.commander.skillPoints = 3;
    s.commander.attackSkill = 120;
    s.commander.initiativeSkill = 400000;
    s.commander.extraFireSkill = 400000;
    for (const type of ['skill', 'initiativeSkill', 'extraFireSkill'] as const) {
      const id = 'skill-' + type;
      const first = execute(s, { type }, s.now, id).state;
      expect(execute(first, { type }, first.now, id).state).toEqual(first);
      s = first;
    }
    expect(s.commander.attackSkill).toBe(121);
    expect(s.commander.initiativeSkill).toBe(400001);
    expect(s.commander.skillPoints).toBe(0);
    expect(() => act(s, { type: 'skill' })).toThrow('技能点不足');
    s = act(s, { type: 'battle', stage: 0, training: true });
    expect(s.reports[0].tactics!.teams[0]).toEqual(commanderStats(s.tech, s.commander));
    expect((await parseSave(await exportSave(s))).reports).toEqual(s.reports);
  });
});

describe('v37 combat research, damage and historical compatibility', () => {
  it.each(techs)('%s has gates, real five-resource payment and completion-only effects', (id) => {
    let s = fresh();
    expect(researchRequirements(s, techs[0]).block).not.toBe('');
    s.buildings.lab = s.buildings.hq = 120;
    for (const id of Object.keys(s.tech) as Technology[]) s.tech[id] = 20;
    for (const key of Object.keys(s.wallet) as (keyof GameState['wallet'])[]) s.wallet[key] = 1e9;
    const price = researchCost(20),
      before = structuredClone(s.wallet);
    s = act(s, { type: 'research', tech: id });
    for (const [resource, cost] of Object.entries(price))
      expect(s.wallet[resource as keyof typeof before]).toBe(
        before[resource as keyof typeof before] - cost!,
      );
    expect(s.tech[id]).toBe(20);
    const job = s.jobs.research!;
    s = advance(s, job.dueAt);
    expect(s.tech[id]).toBe(21);
    assertState(s);
  });
  it('adds only zero-level research to a v36 save and never rewrites old reports or in-flight stacks', async () => {
    let s = fresh();
    s = act(s, { type: 'battle', stage: 0, training: true });
    s = act(s, {
      type: 'march',
      targetId: s.world.find((v) => v.kind === 'mine')!.id,
      mission: 'gather',
    });
    s.researchVersion = 1;
    for (const t of techs) delete (s.tech as Partial<GameState['tech']>)[t];
    for (const report of s.reports) {
      report.ruleset = 'classic-combat-v0.31';
      for (const st of [...report.initial.flat(), ...report.final.flat()]) {
        delete st.critMultiplierBps;
        delete st.defense;
        delete st.baseDefense;
        delete st.damageReduction;
      }
    }
    for (const st of s.marches[0].combatArmy!) {
      delete st.critMultiplierBps;
      delete st.defense;
      delete st.baseDefense;
      delete st.damageReduction;
    }
    const historical = structuredClone(s.reports),
      marching = structuredClone(s.marches);
    const loaded = await parseSave(await exportSave(s));
    expect(loaded.researchVersion).toBe(2);
    for (const t of techs) expect(loaded.tech[t]).toBe(0);
    expect(loaded.reports).toEqual(historical);
    expect(loaded.marches).toEqual(marching);
    for (const t of techs) loaded.tech[t] = 120;
    expect((await parseSave(await exportSave(loaded))).marches).toEqual(marching);
  });
  const firstHit = (source: ArmyStack, target: ArmyStack, seed = 1) =>
    simulate([source], [target], seed).events[0];
  const duelist = () => ({
    ...army([{ unitId: 'tank_destroyer_t1', count: 1 }])[0],
    attack: 10000,
    defense: 0,
    accuracy: 10000,
    hp: 1000000000,
    totalHp: 1000000000,
  });
  it('applies baseline +50% critical damage, research critical damage, defense and half-strength follow-up once', () => {
    const a = duelist(),
      b = duelist();
    let criticalSeed = 1,
      normalSeed = 1;
    while (!firstHit(a, b, criticalSeed).critical) criticalSeed++;
    while (firstHit(a, b, normalSeed).critical) normalSeed++;
    const normal = firstHit(a, b, normalSeed).damage;
    expect(firstHit(a, b, criticalSeed).damage).toBe(normal * 1.5);
    expect(firstHit({ ...a, critMultiplierBps: 21000 }, b, criticalSeed).damage).toBe(normal * 2.1);
    expect(firstHit(a, { ...b, damageReduction: 3000 }, normalSeed).damage).toBe(
      Math.floor((normal * 10000) / 13000),
    );
    expect(
      firstHit({ ...a, critMultiplierBps: 21000 }, { ...b, damageReduction: 3000 }, criticalSeed)
        .damage,
    ).toBe(Math.floor((normal * 2.1 * 10000) / 13000));
    let report;
    for (let seed = 1; seed < 100; seed++) {
      report = simulate([a], [{ ...b, damageReduction: 3000 }], seed, 'training', [
        { initiative: 200, extraFire: 1000 },
        { initiative: 100, extraFire: 0 },
      ]);
      if (report.events.some((e) => e.side === 0 && e.extra && !e.critical)) break;
    }
    const extra = report!.events.find((e) => e.side === 0 && e.extra && !e.critical)!;
    expect(extra.damage).toBe(Math.floor((normal * 0.5 * 10000) / 13000));
  });
  it('makes evasion, accuracy, critical chance and armor affect actual same-seed hits', () => {
    const a = { ...duelist(), accuracy: 0 },
      b = duelist();
    const tally = (source: ArmyStack, target: ArmyStack) =>
      Array.from({ length: 180 }, (_, i) => firstHit(source, target, 65791 + i * 917));
    const baseline = tally(a, b);
    const dodged = tally(a, { ...b, evasion: 2400 });
    const aimed = tally({ ...a, accuracy: 1800 }, { ...b, evasion: 2400 });
    expect(dodged.filter((e) => e.miss).length).toBeGreaterThan(
      baseline.filter((e) => e.miss).length,
    );
    expect(aimed.filter((e) => e.miss).length).toBeLessThan(dodged.filter((e) => e.miss).length);
    const critical = tally({ ...a, crit: 2400 }, b);
    expect(critical.filter((e) => e.critical).length).toBeGreaterThan(
      baseline.filter((e) => e.critical).length,
    );
    expect(
      tally({ ...a, crit: 2400 }, { ...b, armor: 1200 }).filter((e) => e.critical).length,
    ).toBeLessThan(critical.filter((e) => e.critical).length);
  });
  it('includes each technology in power and conserves the eleven-row ledger exactly', () => {
    const base = fresh();
    const before = unitAttributes(base, 'tank_t1').power;
    for (const tech of techs) {
      const s = structuredClone(base);
      s.tech[tech] = 20;
      expect(unitAttributes(s, 'tank_t1').power).toBeGreaterThan(before);
    }
    for (const tech of techs) base.tech[tech] = 120;
    base.commander.leadership = 192;
    const sheet = attributeSheet(base, usableFormation(base));
    for (const row of [...Object.values(sheet.byUnit), sheet.formation, sheet.ceiling]) {
      expect(row.rows).toHaveLength(11);
      expect(
        row.base +
          ('capacity' in row ? row.capacity : 0) +
          row.rows.reduce((n, r) => n + r.delta, 0),
      ).toBe(row.power);
    }
  });
});
