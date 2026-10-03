import { describe, expect, it } from 'vitest';
import { coreChapters, dungeons, dungeonArmy, dungeonBlock } from '../src/core/arsenal';
import { army, combatStats, simulate } from '../src/core/battle';
import { newGame, execute, assertState } from '../src/core/engine';
import { armyPower } from '../src/core/power';
import { progression } from '../src/core/planning';
import { units } from '../src/core/content';
import { exportSave, parseSave } from '../src/core/storage';
import type { Formation, GameState } from '../src/core/types';

const fresh = () => {
  const s = newGame('core24', '核心行动', 1700000000000);
  s.buildings.hq = s.buildings.factory = 120;
  Object.assign(s.tech, { attack: 120, hp: 120, ballistics: 120, armorPlating: 120, march: 120 });
  s.commander.leadership = 120;
  s.commander.prestige = 566440;
  s.available.tank_t7 = s.createdUnits.tank_t7 = 10000;
  s.formation = Array.from({ length: 6 }, () => ({ unitId: 'tank_t7', count: 615 }));
  return s;
};

describe('v24 five-chapter core campaign', () => {
  it('provides 5 × 16 unique stages, four supply nodes per family per chapter and increasing strength', () => {
    expect(coreChapters).toHaveLength(5);
    expect(dungeons).toHaveLength(80);
    expect(new Set(dungeons.map((d) => d.id)).size).toBe(80);
    let power = 0;
    for (const d of dungeons) {
      expect(d.number).toBe((d.index % 16) + 1);
      expect(d.band).toBe(Math.floor(d.index / 16));
      expect(armyPower(dungeonArmy(d)), d.name).toBeGreaterThan(power);
      power = armyPower(dungeonArmy(d));
      expect(d.drops.map((v) => v.id)).toEqual([`${d.classId}_core6`, `${d.classId}_core7`]);
      for (const drop of d.drops) {
        expect(drop.min).toBeGreaterThanOrEqual(0);
        expect(drop.first).toBeGreaterThan(drop.max);
        expect(drop.max).toBeGreaterThanOrEqual(drop.min);
      }
      if (d.index >= 4) {
        const previous = dungeons[d.index - 4];
        expect(previous.classId).toBe(d.classId);
        for (let i = 0; i < 2; i++) {
          expect(d.drops[i].min).toBeGreaterThanOrEqual(previous.drops[i].min);
          expect(d.drops[i].max).toBeGreaterThanOrEqual(previous.drops[i].max);
          expect(d.drops[i].min + d.drops[i].max).toBeGreaterThan(
            previous.drops[i].min + previous.drops[i].max,
          );
        }
      }
    }
    for (let c = 0; c < 5; c++)
      for (const family of ['tank', 'tank_destroyer', 'spg', 'rocket'])
        expect(dungeons.filter((d) => d.band === c && d.classId === family)).toHaveLength(4);
  });

  it('requires chapter-end completion at all four boundaries, and honors either manufacturing gate', () => {
    for (const index of [16, 32, 48, 64]) {
      const s = fresh();
      const d = dungeons[index];
      s.arsenal!.cleared = dungeons.slice(0, index - 1).map((v) => v.id);
      expect(dungeonBlock(s, d)).toContain(`${d.band}-16`);
      s.arsenal!.cleared.push(dungeons[index - 1].id);
      s.buildings.factory = d.factoryLevel - 1;
      expect(dungeonBlock(s, d)).toContain(`${d.factoryLevel} 级`);
      s.industry!.factory2 = d.factoryLevel;
      expect(dungeonBlock(s, d)).toBe('');
    }
  });

  it('preserves all historical IDs without inventing new clears or first-clear rewards', async () => {
    const s = fresh();
    s.buildings.factory = 20;
    s.arsenal!.cleared = Array.from({ length: 16 }, (_, i) => `core-${i}`);
    s.arsenal!.cores.tank_core7 = 123;
    const loaded = await parseSave(await exportSave(s));
    expect(loaded.arsenal).toEqual(s.arsenal);
    for (const id of s.arsenal!.cleared) {
      const d = dungeons.find((d) => d.id === id)!;
      expect(d.number).toBeLessThanOrEqual(4);
      expect(d.legacyName).not.toBe('');
      expect(dungeonBlock(loaded, d)).toBe('');
      const r = execute(loaded, { type: 'dungeon', dungeonId: id }, loaded.now, id).state
        .reports[0];
      expect(r.winner).toBe(0);
      for (const drop of d.drops) expect(r.coreRewards![drop.id]).toBeLessThanOrEqual(drop.max);
    }
    expect(progression(loaded).cards.find((c) => c.id === 'normal')!.current).toBe(4);
    expect(dungeonBlock(loaded, dungeons[4])).toContain('工厂');
    expect(dungeonBlock(loaded, dungeons[64])).toContain('工厂');
  });

  it('settles the last stage once, serializes all 80 clears and preserves historical snapshots', async () => {
    const s = fresh();
    const d = dungeons.at(-1)!;
    s.arsenal!.cleared = dungeons.slice(0, -1).map((v) => v.id);
    const command = { type: 'dungeon' as const, dungeonId: d.id };
    const after = execute(s, command, s.now, 'last').state;
    expect(after.reports[0].winner).toBe(0);
    expect(after.arsenal!.cleared).toHaveLength(80);
    expect(after.reports[0].growth).toEqual(d.growth);
    expect(after.reports[0].initial[1]).toEqual(dungeonArmy(d));
    expect(combatStats(after.reports[0].initial[1]).initiative).toBe(346);
    const snapshot = structuredClone(after.reports[0]);
    after.tech.attack = 1;
    const loaded = await parseSave(await exportSave(after));
    expect(loaded.reports[0]).toEqual(snapshot);
    expect(execute(loaded, command, loaded.now, 'last').state).toBe(loaded);
    expect(loaded.arsenal!.cores.rocket_core7).toBe(d.drops[1].first);
    assertState(loaded);
  });

  it('makes repeat supply viable against chapter-end guards with a developed mixed army', () => {
    // A replenishment benchmark, not a guaranteed win or a minimum entry recommendation.
    // No VIP combat benefit, no max-level leadership, no assumed pity on command training.
    for (let chapter = 0; chapter < 5; chapter++) {
      const level = [20, 40, 60, 85, 110][chapter];
      const lead = [20, 25, 35, 45, 55][chapter];
      const skill = [10, 15, 20, 25, 30][chapter];
      const tech = {
        attack: level,
        hp: level,
        ballistics: level,
        armorPlating: level,
        march: level,
      } as GameState['tech'];
      const formation = ['tank', 'tank_destroyer', 'tank', 'spg', 'rocket', 'spg'].map(
        (family) => ({
          unitId: `${family}_t${Math.min(7, 5 + chapter)}`,
          count: 20 + (lead - 1) * 5,
        }),
      ) as Formation;
      const own = army(formation, tech, skill, { initiativeSkill: skill, extraFireSkill: skill });
      for (const d of dungeons.slice(chapter * 16 + 12, chapter * 16 + 16)) {
        let wins = 0,
          permanent = 0;
        for (let seed = 1; seed <= 30; seed++) {
          const r = simulate(own, dungeonArmy(d), seed * 7919, 'dungeon');
          wins += r.winner === 0 ? 1 : 0;
          permanent += r.casualties.reduce((n, c) => n + c.destroyed, 0);
          expect(
            r.casualties.every((c) => units[c.unitId]),
            d.name,
          ).toBe(true);
        }
        expect(wins, d.name).toBe(30);
        // Even charging ALL families' permanent losses to just the appropriate tier reward,
        // the developed mixed baseline retains positive mean core income.
        if (chapter > 0) {
          const drop = d.drops[chapter === 1 ? 0 : 1];
          expect((drop.min + drop.max) / 2 - permanent / 30, d.name).toBeGreaterThan(3);
        }
      }
    }
  });
});
