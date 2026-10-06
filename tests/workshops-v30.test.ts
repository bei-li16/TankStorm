import { describe, it, expect } from 'vitest';
import { newGame, execute, advance, assertState } from '../src/core/engine';
import { productionQuote } from '../src/core/arsenal';
import { units, stageNames, stageReward, stageGrowth } from '../src/core/content';
import { MAX_PRODUCTION_BATCH } from '../src/core/growth';
import { prestigeRequired } from '../src/core/commander';
import { queueView, allJobs } from '../src/core/vip';
import { exportSave, parseSave } from '../src/core/storage';
import type { Command, GameState } from '../src/core/types';

const act = (s: GameState, command: Command, id: string = crypto.randomUUID()) =>
  execute(s, command, s.now, id).state;
function ready() {
  const s = newGame('workshops30', '车间验收', 1791000000000, 30);
  s.buildings.hq = 120;
  s.buildings.factory = 60;
  s.industry = { version: 1, factory2: 90, refit: 60 };
  for (const r of Object.keys(s.wallet)) s.wallet[r as keyof typeof s.wallet] = 1e10;
  s.available.tank_t6 = s.createdUnits.tank_t6 = 1000;
  s.arsenal!.cores.tank_core7 = 3000;
  s.commander.prestige = prestigeRequired(120);
  s.commander.leadership = 120;
  return s;
}

describe('v30 workshop batch and snapshots', () => {
  it('quotes 500, charges exactly once and delivers two factories plus refit independently', async () => {
    let s = ready();
    expect(MAX_PRODUCTION_BATCH).toBe(500);
    const oldAvailable = s.available.tank_t7;
    const facilities = ['factory', 'factory2', 'refit'] as const;
    for (const facility of facilities) {
      const type = facility === 'refit' ? 'refit' : 'produce';
      const q = productionQuote(s, 'tank_t7', type, facility);
      expect(q.max).toBe(500);
      const before = structuredClone(s);
      expect(() => act(s, { type, facility, unitId: 'tank_t7', count: 501 })).toThrow('500');
      expect(s).toEqual(before);
      const command = { type, facility, unitId: 'tank_t7', count: 500 } as const;
      const request = 'v30-' + facility;
      s = act(s, command, request);
      for (const [r, cost] of Object.entries(q.unitCost))
        expect(s.wallet[r as keyof typeof s.wallet]).toBe(
          before.wallet[r as keyof typeof s.wallet] - cost * 500,
        );
      expect(s.arsenal!.cores.tank_core7).toBe(before.arsenal!.cores.tank_core7 - 500);
      expect(act(s, command, request)).toEqual(s);
    }
    const jobs = allJobs(s).filter((j) => j.kind === 'production');
    expect(jobs).toHaveLength(3);
    expect(jobs.find((j) => j.facility === 'factory2')!.duration).toBeLessThan(
      jobs.find((j) => j.facility === 'factory')!.duration,
    );
    const savedJobs = structuredClone(jobs);
    s = await parseSave(await exportSave(s));
    expect(allJobs(s).filter((j) => j.kind === 'production')).toEqual(savedJobs);
    const end = s.now + Math.max(...queueView(s).map((j) => j.remainingMs));
    const done = advance(s, end);
    expect(done.available.tank_t7).toBe(oldAvailable + 1500);
    expect(done.available.tank_t6).toBe(500);
    expect(advance(done, end + 1000).available).toEqual(done.available);
    assertState(done);
  });
  it('MAX still honors core, prototype and material shortages', () => {
    const s = ready();
    s.arsenal!.cores.tank_core7 = 3;
    expect(productionQuote(s, 'tank_t7').max).toBe(3);
    expect(productionQuote(s, 'tank_t7', 'refit').max).toBe(3);
    s.arsenal!.cores.tank_core7 = 900;
    s.available.tank_t6 = 2;
    expect(productionQuote(s, 'tank_t7', 'refit').max).toBe(2);
    s.wallet.titanium = units.tank_t7.cost.titanium! - 1;
    expect(productionQuote(s, 'tank_t7').max).toBe(0);
  });
});

describe('v30 classic campaign first/repeat rewards', () => {
  it('applies first-only currencies and half prestige across all authored stages', () => {
    expect(stageNames).toHaveLength(576);
    for (let i = 0; i < stageNames.length; i++) {
      const first = stageGrowth(i, true),
        repeat = stageGrowth(i, false);
      expect(first.books).toBe(1);
      expect(first.skillPoints).toBe(1);
      expect(stageReward(i, true).gold).toBeGreaterThan(0);
      expect(repeat).toEqual({
        xp: first.xp,
        books: 0,
        skillPoints: 0,
        prestige: Math.floor(first.prestige / 10) * 5,
      });
      expect(stageReward(i, false).gold).toBe(0);
      expect(stageReward(i, false).iron).toBeGreaterThan(0);
    }
  });
  it('matches actual ledger changes, is idempotent and preserves paid historical rewards on reload', async () => {
    let s = ready();
    s.available.tank_t7 = s.createdUnits.tank_t7 = 3000;
    s.formation = Array.from({ length: 6 }, () => ({ unitId: 'tank_t7', count: 300 }));
    s.cleared = Array.from({ length: 16 }, (_, i) => i);
    s = act(s, { type: 'battle', stage: 16 }, 'first30');
    const first = structuredClone(s.reports[0]);
    const before = structuredClone(s);
    s = act(s, { type: 'battle', stage: 16 }, 'repeat30');
    expect(s.reports[0].winner).toBe(0);
    expect(s.commander.books).toBe(before.commander.books);
    expect(s.commander.skillPoints).toBe(before.commander.skillPoints);
    expect(s.commander.prestige - before.commander.prestige).toBe(
      Math.floor(first.growth!.prestige / 2),
    );
    expect(s.commander.xp - before.commander.xp).toBe(first.growth!.xp);
    expect(s.wallet.gold).toBe(before.wallet.gold);
    expect(act(s, { type: 'battle', stage: 16 }, 'repeat30')).toEqual(s);
    const old = structuredClone(s.reports[0]);
    old.growth!.books = 1;
    old.growth!.prestige = first.growth!.prestige;
    old.rewards.gold = 3;
    s.reports[0] = old;
    const restored = await parseSave(await exportSave(s));
    expect(restored.reports[0]).toEqual(old);
    expect(restored.wallet).toEqual(s.wallet);
    expect(advance(restored, restored.now + 1).reports[0]).toEqual(old);
    assertState(restored);
  });
});
