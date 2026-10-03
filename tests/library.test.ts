import { describe, expect, it } from 'vitest';
import {
  fieldLibrary,
  libraryEntries,
  libraryCategories,
  searchLibrary,
} from '../src/core/library';
import { army, combatStats, extraFireChance, simulate } from '../src/core/battle';
import { rules } from '../src/core/content';
import { dungeons } from '../src/core/arsenal';
import { leadershipChance } from '../src/core/commander';

const article = (id: string) =>
  libraryEntries
    .find((e) => e.id === id)!
    .sections.map((s) => s.text)
    .join('\n');
describe('classified player library', () => {
  it('has unique, complete and connected articles with valid native destinations', () => {
    expect(libraryCategories).toHaveLength(7);
    expect(libraryEntries).toHaveLength(26);
    const ids = new Set(libraryEntries.map((e) => e.id));
    expect(ids.size).toBe(libraryEntries.length);
    for (const entry of libraryEntries) {
      expect(libraryCategories.some((c) => c.id === entry.category)).toBe(true);
      expect(entry.sections.length).toBeGreaterThanOrEqual(3);
      for (const related of entry.related) expect(ids.has(related)).toBe(true);
      expect([
        'army',
        'doctrine',
        'attributes',
        'reports',
        'factory',
        'industry',
        'repair',
        'research',
        'commandTraining',
        'campaign',
        'inventory',
        'queues',
        'settings',
        'world',
      ]).toContain(entry.destination.page);
      expect(entry.sources.length).toBeGreaterThan(0);
      expect(article(entry.id)).not.toMatch(/\$[A-Z_]+|undefined|NaN/);
    }
    expect(fieldLibrary.ruleset).toBe('classic-combat-v0.22');
  });
  it('searches Chinese terms and aliases across article text without changing the catalog', () => {
    const before = JSON.stringify(fieldLibrary);
    expect(searchLibrary('battle', ' 闪避 命中 ').map((e) => e.id)).toContain('hit-evasion');
    expect(searchLibrary('all', 'MAX').map((e) => e.id)).toContain('production');
    expect(searchLibrary('all', 'max')).toEqual(searchLibrary('all', 'MAX'));
    expect(searchLibrary('growth', '声望')[0].id).toBe('commander');
    expect(searchLibrary('growth', '不存在的条目')).toHaveLength(0);
    expect(searchLibrary('battle', ' \t ')).toHaveLength(8);
    expect(JSON.stringify(fieldLibrary)).toBe(before);
  });
  it('matches the stated unweighted initiative, tie break and extra-fire examples', () => {
    const team = army([
      { unitId: 'tank_t1', count: 100 },
      { unitId: 'tank_t7', count: 1 },
    ]);
    expect(combatStats(team).initiative).toBe(118);
    expect(article('initiative')).toContain('118');
    const report = simulate(
      army([{ unitId: 'tank_t1', count: 20 }]),
      army([{ unitId: 'tank_t1', count: 20 }]),
      17,
    );
    expect(report.actions![0].side).toBe(0);
    expect([
      extraFireChance(100, 100),
      extraFireChance(150, 100),
      extraFireChance(100, 150),
    ]).toEqual([1000, 1500, 500]);
    expect(article('extra-fire')).toContain('高50点为 15%');
  });
  it('does not invent available evasion or armor upgrades', () => {
    const st = army([{ unitId: 'tank_t7', count: 1 }])[0];
    expect([st.accuracy, st.evasion, st.crit, st.armor]).toEqual([0, 0, 0, 0]);
    expect(article('hit-evasion')).toContain('没有常驻命中或闪避加成来源');
    expect(article('critical')).toContain('减少敌方暴击率');
    expect(article('hit-evasion')).toContain(String(rules.battle.baseHitBps / 100) + '%');
  });
  it('publishes current reward intervals and probability table from the actual rules', () => {
    for (const d of dungeons.filter((d) => d.classId === 'tank')) {
      for (const drop of d.drops) expect(article('cores')).toContain(`${drop.min}—${drop.max}`);
    }
    for (const target of [11, 20, 40, 60, 80, 100, 120])
      expect(article('commander')).toContain(`升至${target}级：${leadershipChance(target) / 100}%`);
    expect(article('time')).toContain('出发和返程行军不适用');
  });
});
