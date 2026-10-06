import { describe, expect, it } from 'vitest';
import { advance, assertState, execute, newGame } from '../src/core/engine';
import { allJobs, queueStatus, queueView, vipLevels } from '../src/core/vip';
import { productionQuote, repairAllQuote } from '../src/core/arsenal';
import { army, simulate, BATTLE_RULESET } from '../src/core/battle';
import { prestigeOverview, prestigeRequired } from '../src/core/commander';
import { researchTree } from '../src/core/research';
import { exportSave, parseSave } from '../src/core/storage';
import { attributeSheet } from '../src/core/attributes';
import type { Command, GameState } from '../src/core/types';

let serial = 0;
const act = (s: GameState, c: Command) => execute(s, c, s.now, `v26-${++serial}`).state;
function ready(vip = 0) {
  const s = newGame('v26', '工位验收', 1791000000000, 261);
  for (const k of Object.keys(s.buildings) as (keyof typeof s.buildings)[]) s.buildings[k] = 60;
  for (const n of researchTree) s.tech[n.id] = 30;
  s.industry = { version: 1, factory2: 60, refit: 60 };
  s.vip = { version: 1, paidGold: vip, lastDaily: -1 };
  for (const k of Object.keys(s.wallet) as (keyof typeof s.wallet)[]) s.wallet[k] = 1e10;
  s.available.tank_t4 = s.createdUnits.tank_t4 = 1000;
  s.damaged.tank_t7 = s.createdUnits.tank_t7 = 1000;
  return s;
}
describe('v0.26 fixed workstations', () => {
  it.each([0, 500000])(
    'keeps each line independent at recharge %d, with one active and three waiting',
    async (vip) => {
      let s = ready(vip);
      for (const facility of ['factory', 'factory2', 'refit'] as const) {
        for (let i = 0; i < 4; i++)
          s = act(s, {
            type: facility === 'refit' ? 'refit' : 'produce',
            facility,
            unitId: 'tank_t5',
            count: 100,
          });
        expect(queueStatus(s, 'production', facility)).toMatchObject({
          slots: 1,
          waitingSlots: 3,
          full: true,
        });
        const before = structuredClone(s);
        expect(() =>
          act(s, {
            type: facility === 'refit' ? 'refit' : 'produce',
            facility,
            unitId: 'tank_t5',
            count: 1,
          }),
        ).toThrow('等待位已满');
        expect(s).toEqual(before);
      }
      for (let i = 0; i < 4; i++) s = act(s, { type: 'repair', unitId: 'tank_t7', count: 100 });
      for (const tech of ['attack', 'hp', 'construction', 'resourceOutput'] as const)
        s = act(s, { type: 'research', tech });
      expect(() => act(s, { type: 'repair', unitId: 'tank_t7', count: 1 })).toThrow('等待位已满');
      expect(() => act(s, { type: 'research', tech: 'march' })).toThrow('等待位已满');
      const restored = await parseSave(await exportSave(s));
      expect(queueView(restored)).toEqual(queueView(s));
      s = advance(restored, s.now + 20 * 86400000);
      expect(s.available.tank_t5).toBe(1200);
      expect(s.available.tank_t7).toBe(400);
      expect(s.damaged.tank_t7).toBe(600);
      expect(s.available.tank_t4).toBe(600);
      expect(s.tech.attack).toBe(31);
      expect(allJobs(s)).toHaveLength(0);
      assertState(s);
      expect(vipLevels.every((v) => v.waiting === 3)).toBe(true);
    },
  );
  it('honors legacy paid five-order backlogs without recharging or accepting new orders', async () => {
    let s = ready(500000);
    for (let i = 0; i < 4; i++) s = act(s, { type: 'produce', unitId: 'tank_t5', count: 100 });
    // Reconstruct an actual old paid order: original stored cost and duration, unique sequence.
    for (let i = 0; i < 2; i++) {
      const j = structuredClone(s.jobBacklog![0]);
      j.seq = ++s.sequence;
      for (const [r, n] of Object.entries(j.unitCost))
        s.wallet[r as keyof typeof s.wallet] -= n * j.total;
      s.jobBacklog!.push(j);
    }
    assertState(s);
    const before = structuredClone(allJobs(s));
    s = await parseSave(await exportSave(s));
    expect(allJobs(s)).toEqual(before);
    expect(() => act(s, { type: 'produce', unitId: 'tank_t5', count: 1 })).toThrow('等待位已满');
    s = advance(s, s.now + 10 * 86400000);
    expect(s.available.tank_t5).toBe(600);
    assertState(s);
  });
  it('batch repair uses only free positions, charges only selected models and shares cancellation semantics', () => {
    let s = ready();
    s.damaged.tank_t7 = s.createdUnits.tank_t7 = 0;
    for (const id of ['tank_t1', 'tank_t2', 'tank_t3', 'spg_t1', 'spg_t2', 'rocket_t1']) {
      s.damaged[id] += 7;
      s.createdUnits[id] += 7;
    }
    const before = structuredClone(s),
      q = repairAllQuote(s);
    expect(q.rows).toHaveLength(4);
    expect(q.count).toBe(28);
    expect(q.remainingCount).toBe(14);
    s = act(s, { type: 'repairAll', quote: q.token });
    expect(s.available).toEqual(before.available);
    expect(s.wallet.crystal).toBe(before.wallet.crystal - q.cost.crystal!);
    expect(allJobs(s)).toHaveLength(4);
    expect(repairAllQuote(s)).toMatchObject({ count: 0, pendingCount: 14, prepaid: 28 });
    const queued = s.jobBacklog![1];
    s = act(s, { type: 'cancel', kind: 'repair', seq: queued.seq });
    expect(s.damaged[queued.target]).toBe(7);
    expect(s.wallet.crystal).toBe(
      before.wallet.crystal - q.cost.crystal! + queued.unitCost.crystal! * 7,
    );
    const q2 = repairAllQuote(s);
    expect(q2.rows).toHaveLength(1);
    s = act(s, { type: 'repairAll', quote: q2.token });
    expect(queueStatus(s, 'repair').full).toBe(true);
    const finish = s.now + Math.max(...queueView(s).map((j) => j.remainingMs));
    s = advance(s, finish);
    for (const row of q.rows)
      expect(s.available[row.unitId]).toBe(before.available[row.unitId] + 7);
    expect(Object.values(s.damaged).reduce((n, v) => n + v, 0)).toBe(14);
    assertState(s);
  });
  it('only VIP eligible short repair batches complete immediately, identically to manual repair', () => {
    const base = ready(500000);
    base.damaged.tank_t7 = base.createdUnits.tank_t7 = 0;
    base.damaged.tank_t1 = 1;
    base.createdUnits.tank_t1++;
    expect(productionQuote(base, 'tank_t1', 'repair').duration).toBeLessThan(720000);
    const manual = act(base, { type: 'repair', unitId: 'tank_t1', count: 1 });
    const batch = act(base, { type: 'repairAll', quote: repairAllQuote(base).token });
    expect(batch.available).toEqual(manual.available);
    expect(batch.wallet).toEqual(manual.wallet);
    expect(allJobs(batch)).toEqual([]);
  });
});
describe('v0.26 prestige and half-attack combo', () => {
  it('publishes all 120 rank thresholds, earned bonuses and separate grandfathered training eligibility', () => {
    const s = ready();
    for (let level = 1; level <= 120; level++) {
      s.commander.prestige = prestigeRequired(level);
      const p = prestigeOverview(s);
      expect(p.level).toBe(level);
      expect(p.bonusBps).toBe((level - 1) * 10);
      expect(p.remaining).toBe(prestigeRequired(level + 1) - prestigeRequired(level));
      expect(p.levels[level - 1].rank).toBe(p.rank);
    }
    s.commander.prestige = 0;
    s.prestigeFloor = 80;
    expect(prestigeOverview(s)).toMatchObject({
      level: 1,
      rank: '列兵',
      bonusBps: 0,
      trainingCap: 80,
    });
    const old = army([{ unitId: 'tank_t1', count: 1 }], s.tech, 0, s.commander);
    s.commander.prestige = prestigeRequired(120);
    const upgraded = army([{ unitId: 'tank_t1', count: 1 }], s.tech, 0, s.commander);
    expect(upgraded[0].attackBonus! - old[0].attackBonus!).toBe(1190);
    expect(upgraded[0].hp).toBeGreaterThan(old[0].hp);
    expect(attributeSheet(s, s.formation)).toBeDefined();
  });
  it.each(['tank', 'tank_destroyer', 'spg', 'rocket'] as const)(
    '%s halves extra-action attack, not ordinary second/third projectiles',
    (cls) => {
      // Stable count isolates the independent hit/critical rolls and the extra-action multiplier.
      const a = army([{ unitId: `${cls}_t1`, count: 10 }]);
      const b = army(Array.from({ length: 6 }, () => ({ unitId: 'tank_t1', count: 1 })));
      for (const st of [...a, ...b]) {
        st.hp = 1e9;
        st.totalHp = st.hp * st.count;
        st.armor = 0;
        st.defense = 0; // Isolate half attack; v39 covers full defense deducted after halving.
        st.accuracy = 10000;
      }
      a[0].extraFire = 1000;
      a[0].attack = 1000;
      a[0].crit = 4000;
      for (const st of b) {
        st.attack = 0;
        st.extraFire = 0;
      }
      const report = simulate(a, b, 1122);
      expect(report.ruleset).toBe(BATTLE_RULESET);
      const hits = report.events.filter((e) => e.side === 0 && !e.miss && !e.ground);
      expect(hits.some((e) => e.extra)).toBe(true);
      const first = hits.find((e) => !e.extra && !e.critical)!;
      expect(hits.some((e) => e.extra && e.critical)).toBe(true);
      expect(hits.some((e) => e.extra && !e.critical)).toBe(true);
      for (const h of hits)
        expect(h.damage).toBe(
          Math.floor(first.damage * (h.extra ? 0.5 : 1) * (h.critical ? 1.5 : 1)),
        );
      // Ensure arrays used to construct the report were not mutated.
      expect(a[0].totalHp).toBe(a[0].hp * 10);
    },
  );
});
