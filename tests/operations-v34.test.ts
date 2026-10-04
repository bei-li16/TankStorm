import { describe, expect, it } from 'vitest';
import { execute, newGame, leadershipCap, assertState } from '../src/core/engine';
import {
  earnedPrestigeLevel,
  leadershipChance,
  leadershipQuote,
  prestigeOverview,
  prestigeRequired,
  prestigeRank,
} from '../src/core/commander';
import { exportSave, parseSave } from '../src/core/storage';
import { rng32 } from '../src/core/battle';
import { army } from '../src/core/battle';
import type { Command, GameState } from '../src/core/types';

const ready = () => {
  const s = newGame('v34', '持续培养', 1790985600000, 1);
  s.commander.leadership = 120;
  s.commander.prestige = prestigeRequired(140);
  s.commander.books = 5000;
  s.wallet.gold = 100000;
  return s;
};
let sequence = 0;
const act = (s: GameState, c: Command) => execute(s, c, s.now, 'v34-' + ++sequence).state;

describe('v34 continuous commander progression', () => {
  it.each([120, 121, 150, 2500, 5000])(
    'keeps level %d attainable with unchanged rank/chance',
    (level) => {
      const s = ready();
      s.commander.prestige = prestigeRequired(level);
      s.commander.leadership = level;
      expect(earnedPrestigeLevel(s.commander.prestige)).toBe(level);
      expect(earnedPrestigeLevel(s.commander.prestige - 1)).toBe(level - 1);
      expect(prestigeRank(s.commander.prestige)).toBe('上将');
      expect(leadershipChance(level + 1)).toBe(10);
      expect(leadershipCap(s)).toBe(20 + 5 * (level - 1));
      const p = prestigeOverview(s, level, 10);
      expect(p.levels[9].level).toBe(level + 9);
      expect(p.levels.every((row) => row.rank === '上将')).toBe(true);
      expect(p.bonusBps).toBe((level - 1) * 10);
      expect(p.remaining).toBe(prestigeRequired(level + 1) - s.commander.prestige);
    },
  );
  it.each([1, 10, 100, 1000] as const)(
    'stops a %d batch on the first successful roll and retains unused funds',
    async (attempts) => {
      const s = ready();
      const c: Command = { type: 'leadership', payment: 'gold', attempts };
      let result = execute(s, c, s.now, 'stable').state;
      expect(result.commander.leadership).toBe(121);
      expect(result.wallet.gold).toBe(s.wallet.gold - 19);
      expect(result.leadershipHistory![0]).toMatchObject({
        requested: attempts,
        attempts: 1,
        target: 121,
        chance: 10,
        success: true,
      });
      result = await parseSave(await exportSave(result));
      expect(execute(result, c, result.now, 'stable').state).toBe(result);
      result.seed = 1;
      result = act(result, c);
      expect(result.commander.leadership).toBe(122);
      expect(result.leadershipHistory).toHaveLength(2);
    },
  );
  it('can fail all 1000 independent attempts and persist every roll without a hidden guarantee', async () => {
    const s = ready();
    let found = false;
    for (let seed = 500; seed < 3000; seed++) {
      const rand = rng32(seed);
      if (
        Array.from({ length: 1000 }, () => Math.floor((rand() * 10000) / 4294967296)).every(
          (v) => v >= 10,
        )
      ) {
        s.seed = seed;
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
    const result = act(s, { type: 'leadership', attempts: 1000 });
    expect(result.commander.leadership).toBe(120);
    expect(result.commander.books).toBe(4000);
    expect(result.leadershipHistory![0]).toMatchObject({
      attempts: 1000,
      requested: 1000,
      success: false,
    });
    expect(result.leadershipHistory![0].rolls).toHaveLength(1000);
    expect((await parseSave(await exportSave(result))).leadershipHistory).toEqual(
      result.leadershipHistory,
    );
  });
  it('rejects insufficient prestige or batch budget atomically', () => {
    const s = ready();
    s.commander.prestige = prestigeRequired(120);
    expect(leadershipQuote(s).block).toContain('需要声望等级 121');
    expect(() => act(s, { type: 'leadership', attempts: 1000 })).toThrow('需要声望等级 121');
    s.commander.prestige = prestigeRequired(121);
    s.commander.books = 999;
    const before = structuredClone(s);
    expect(() => act(s, { type: 'leadership', attempts: 1000 })).toThrow('还缺 1');
    expect(s).toEqual(before);
    s.wallet.gold = 18999;
    expect(() => act(s, { type: 'leadership', attempts: 1000, payment: 'gold' })).toThrow('还缺 1');
  });
  it('saves high-level formations, battle snapshots, casualties and expedition capacity', async () => {
    let s = ready();
    s.commander.leadership = 20000;
    s.commander.prestige = prestigeRequired(20000);
    s.available.tank_t7 = s.createdUnits.tank_t7 = 1000000;
    s.tech.cargo = 120;
    s.formation = Array.from({ length: 6 }, () => ({ unitId: 'tank_t7', count: leadershipCap(s) }));
    s = act(s, { type: 'battle', stage: 0 });
    expect(s.reports[0].initial[0][0].count).toBeGreaterThan(10000);
    expect(s.reports[0].casualties[0].sent).toBeGreaterThan(60000);
    const report = structuredClone(s.reports[0]);
    s = act(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    expect(s.marches[0].capacity).toBeGreaterThan(1e9);
    const loaded = await parseSave(await exportSave(s));
    expect(loaded.marches).toEqual(s.marches);
    expect(loaded.reports[0]).toEqual(report);
    assertState(loaded);
  });
  it('continues prestige combat bonuses while retaining building/research/skill limits', () => {
    const s = ready();
    s.commander.prestige = prestigeRequired(120);
    const old = army(s.formation, s.tech, 0, s.commander);
    s.commander.prestige = prestigeRequired(121);
    const next = army(s.formation, s.tech, 0, s.commander);
    expect(next[0].attackBonus! - old[0].attackBonus!).toBe(10);
    for (const key of ['buildings', 'tech'] as const) {
      const invalid = structuredClone(s);
      if (key === 'buildings') invalid.buildings.hq = 121;
      else invalid.tech.attack = 121;
      expect(() => assertState(invalid)).toThrow();
    }
    s.commander.attackSkill = 120;
    expect(() => act(s, { type: 'skill' })).toThrow('最高等级');
  });
});
