import { describe, expect, it } from 'vitest';
import { inventoryView, battleSummary } from '../src/core/overview';
import { army, simulate } from '../src/core/battle';
import { newGame, facilityUpgradeQuote, upgradeBlock, execute } from '../src/core/engine';
import { materialCost } from '../src/core/research';
import { upgradeCost } from '../src/core/content';
import { buildingDuration } from '../src/core/vip';
import type { Job, March } from '../src/core/types';

const game = () => newGame('overview', '后勤', 100000);
const job = (kind: Job['kind'], target: string, total: number, completed = 0): Job => ({
  kind,
  target,
  total,
  completed,
  unitCost: { iron: 10 },
  duration: 5000,
  startedAt: 100000,
  dueAt: 105000,
  seq: 1,
});
const find = (s: ReturnType<typeof game>, id: string) => inventoryView(s).find((i) => i.id === id)!;

describe('resource overview uses the existing inventory ledger', () => {
  it('includes every currency, eight cores, 28 vehicles and four commander resources, including zero stock', () => {
    const s = game(),
      before = structuredClone(s),
      rows = inventoryView(s);
    expect(rows).toHaveLength(46);
    expect(new Set(rows.map((i) => i.id)).size).toBe(46);
    expect(rows.filter((i) => i.category === 'cores')).toHaveLength(8);
    expect(rows.filter((i) => i.category === 'cores').every((i) => i.quantity === 0)).toBe(true);
    expect(s).toEqual(before);
  });
  it('keeps spendable, reserved and in-transit materials separate, including waiting batches', () => {
    const s = game();
    s.wallet.iron = 100;
    s.jobs.production = job('production', 'tank_t1', 10, 3);
    s.jobBacklog = [{ ...job('production', 'tank_t1', 4), seq: 2 }];
    s.marches = [{ cargo: { iron: 27 }, troops: [] } as unknown as March];
    expect(find(s, 'iron')).toMatchObject({ quantity: 100, reserved: 110, incoming: 27 });
  });
  it('counts existing vehicles exactly once and separates future output and permanent losses', () => {
    const s = game();
    s.available.tank_t5 = 10;
    s.damaged.tank_t5 = 3;
    s.destroyedUnits.tank_t5 = 9;
    s.marches = [{ troops: [{ unitId: 'tank_t5', count: 5 }], cargo: {} } as unknown as March];
    s.jobs.repair = job('repair', 'tank_t5', 4, 2);
    s.jobs['production:refit'] = {
      ...job('production', 'tank_t6', 7, 2),
      sourceUnitId: 'tank_t5',
      coreCost: { id: 'tank_core6', count: 1 },
    };
    s.jobs.production = job('production', 'tank_t5', 9, 1);
    expect(find(s, 'tank_t5')).toMatchObject({
      quantity: 25,
      available: 10,
      damaged: 3,
      marching: 5,
      repairing: 2,
      refitting: 5,
      producing: 8,
      destroyed: 9,
    });
    expect(find(s, 'tank_core6')).toMatchObject({ quantity: 0, reserved: 5 });
    expect(find(s, 'tank_core7')).toMatchObject({ quantity: 0, reserved: 0 });
  });
  it('reflects completed and cancelled orders without stale reservations', () => {
    const s = game();
    s.jobs.production = job('production', 'tank_t1', 8, 8);
    expect(find(s, 'iron')).toMatchObject({ reserved: 0 });
    delete s.jobs.production;
    expect(find(s, 'tank_t1')).toMatchObject({ quantity: s.available.tank_t1, producing: 0 });
    s.commander.books = 42;
    s.commander.skillPoints = 18;
    expect(find(s, 'books').quantity).toBe(42);
    expect(find(s, 'skillPoints').quantity).toBe(18);
  });
});

describe('battle settlement is read-only and excludes overkill', () => {
  it('separates nominal damage, actual damage, casualties and repairable losses', () => {
    const a = army([{ unitId: 'tank_t7', count: 100 }]);
    a[0].accuracy = 10000;
    const b = army([{ unitId: 'tank_t1', count: 2 }]);
    const r = simulate(a, b, 1, 'stage'),
      before = structuredClone(r),
      summary = battleSummary(r);
    expect(summary.teams[0].damage).toBe(b[0].totalHp);
    expect(summary.teams[0].nominal).toBeGreaterThan(summary.teams[0].damage);
    expect(summary.teams[1]).toMatchObject({ sent: 2, survived: 0, lost: 2, damage: 0 });
    expect(summary.teams[0].rows[0].damage).toBe(summary.teams[0].damage);
    expect(r).toEqual(before);
  });
  it('sums per-slot damage and HP deltas across mixed target patterns and partial vehicles', () => {
    const a = army(['tank', 'spg', 'rocket'].map((cls) => ({ unitId: cls + '_t1', count: 20 })));
    const b = army(Array.from({ length: 6 }, () => ({ unitId: 'tank_t2', count: 21 })));
    const r = simulate(a, b, 42, 'stage'),
      summary = battleSummary(r);
    for (const side of [0, 1]) {
      const before = r.initial[1 - side].reduce((n, st) => n + st.totalHp, 0);
      const after = r.final[1 - side].reduce((n, st) => n + st.totalHp, 0);
      expect(summary.teams[side].damage).toBe(before - after);
      expect(summary.teams[side].rows.reduce((n, st) => n + st.damage, 0)).toBe(before - after);
      expect(summary.teams[side].sent - summary.teams[side].survived).toBe(
        summary.teams[side].lost,
      );
    }
    expect(summary.repairable + summary.destroyed).toBe(summary.teams[0].lost);
  });
  it('shows simulated losses without repair or permanent deductions and supports legacy reports', () => {
    const r = simulate(
      army([{ unitId: 'tank_t1', count: 2 }]),
      army([{ unitId: 'tank_t7', count: 100 }]),
      1,
      'training',
    );
    delete r.actions;
    delete r.tactics;
    r.ruleset = 'classic-combat-v0.9';
    for (const e of r.events) {
      delete e.action;
      delete e.shot;
      delete e.shots;
      delete e.extra;
    }
    const summary = battleSummary(r);
    expect(summary.teams[0].lost).toBe(2);
    expect(summary.repairable).toBe(0);
    expect(summary.destroyed).toBe(0);
    expect(summary.teams[1].damage).toBe(r.initial[0][0].totalHp);
  });
});

describe('first factory uses the same direct-upgrade presentation as other plants', () => {
  it('quotes the actual cost and duration and starts the existing upgrade command', () => {
    const s = game();
    s.buildings.hq = 20;
    s.tech.materials = 4;
    const q = facilityUpgradeQuote(s, 'factory');
    expect(q).toMatchObject({
      level: s.buildings.factory,
      block: '',
      unitCost: materialCost(s, upgradeCost('factory', s.buildings.factory)),
      duration: buildingDuration(s, 'factory'),
    });
    const next = execute(
      s,
      { type: 'upgrade', building: 'factory' },
      s.now,
      'industry-first',
    ).state;
    expect(next.jobs.building?.target).toBe('factory');
    expect(facilityUpgradeQuote(next, 'factory').block).toBe(upgradeBlock(next, 'factory'));
  });
  it('blocks max level and HQ prerequisites instead of advertising another upgrade', () => {
    const s = game();
    expect(facilityUpgradeQuote(s, 'factory').block).toBe('请先升级指挥中心');
    s.buildings.hq = s.buildings.factory = 120;
    expect(facilityUpgradeQuote(s, 'factory').block).toBe('已达最高等级');
  });
});
