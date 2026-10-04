import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { newGame, execute, advance, assertState } from '../src/core/engine';
import { productionQuote } from '../src/core/arsenal';
import { researchCost, unitList, units } from '../src/core/content';
import { exportSave, parseSave } from '../src/core/storage';
import { allJobs } from '../src/core/vip';
import { resources, type Command, type GameState } from '../src/core/types';
const rates = { iron: 600, oil: 400, lead: 330, titanium: 150, crystal: 100 };
const act = (s: GameState, c: Command) => execute(s, c, s.now, crypto.randomUUID()).state;
function rich() {
  const s = newGame('materials27', '材料验收', 1760000000000);
  for (const k of Object.keys(s.buildings)) s.buildings[k as keyof typeof s.buildings] = 60;
  s.industry = { version: 1, factory2: 60, refit: 60 };
  for (const r of resources) s.wallet[r] = 1e10;
  for (const k of Object.keys(s.arsenal!.cores)) s.arsenal!.cores[k] = 100;
  return s;
}
describe('v27 material allocation', () => {
  it.each(unitList)(
    '$unitId has class-specific inputs, monotonic costs and reachable titanium',
    (u) => {
      const c = u.cost;
      if (u.classId === 'rocket') {
        expect(c.iron).toBeGreaterThan(c.oil);
        expect(c.oil).toBeGreaterThan(c.lead);
        if (u.tier > 1) {
          expect(c.titanium).toBeGreaterThan(c.iron);
          expect(c.titanium / c.iron).toBeCloseTo(1.32, 1);
        }
      } else {
        const primary = { tank: 'iron', tank_destroyer: 'oil', spg: 'lead' }[u.classId] as
          'iron' | 'oil' | 'lead';
        const secondary = (['iron', 'oil', 'lead'] as const).filter((r) => r !== primary);
        for (const r of secondary) {
          expect(c[r]).toBeGreaterThanOrEqual(c[primary] * 0.5 - 1);
          expect(c[r]).toBeLessThanOrEqual(c[primary] * 0.6 + 1);
        }
        expect(c[secondary[0]]).not.toBe(c[secondary[1]]);
        if (u.tier > 1)
          expect(c.titanium).toBe(Math.ceil(Math.round((c.iron + c.oil + c.lead) / 3) * 1.5));
      }
      if (u.tier === 1) expect(c.titanium).toBe(0);
      else
        for (const r of ['iron', 'oil', 'lead', 'titanium'] as const) {
          expect(c[r]).toBeGreaterThan(units[`${u.classId}_t${u.tier - 1}`].cost[r]);
        }
      const q = productionQuote(rich(), u.unitId, 'refit');
      for (const r of resources) expect(q.unitCost[r] ?? 0).toBeGreaterThanOrEqual(0);
    },
  );
  it('preserves research distribution with the explicit v28 and v29 titanium increases', () => {
    for (let level = 0; level < 120; level++) {
      const c = researchCost(level),
        scale = 1.2 * Math.pow(level + 1, 2.65);
      const old =
        Math.ceil(100 * scale) / 600 + Math.ceil(80 * scale) / 330 + Math.ceil(30 * scale) / 100;
      const hours = resources.reduce((n, r) => n + (c[r] ?? 0) / rates[r], 0);
      expect(hours / old).toBeGreaterThan(0.95);
      // v29 explicitly adds 50% to v28 Ti, rather than silently rebalancing other inputs.
      expect(hours / old).toBeLessThan(1.4);
      for (const r of resources)
        expect(c[r] ?? 0)[r === 'titanium' && level < 5 ? 'toBe' : 'toBeGreaterThan'](0);
    }
    expect(researchCost(120)).toEqual({});
  });
  it.each(['oil', 'titanium'] as const)(
    'charges research %s; shortage rejects atomically and cancellation refunds',
    (r) => {
      let s = rich();
      s.tech.attack = 5;
      const q = researchCost(5);
      s.wallet[r] = q[r]! - 1;
      const before = structuredClone(s);
      expect(() => act(s, { type: 'research', tech: 'attack' })).toThrow();
      expect(s).toEqual(before);
      s.wallet[r] = q[r]!;
      const wallet = structuredClone(s.wallet);
      s = act(s, { type: 'research', tech: 'attack' });
      for (const k of resources) expect(s.wallet[k]).toBe(wallet[k] - (q[k] ?? 0));
      s = act(s, { type: 'cancel', kind: 'research' });
      expect(s.wallet).toEqual(wallet);
      assertState(s);
    },
  );
  it('MAX and actual deduction agree for titanium-limited manufacture and refit', () => {
    for (const mode of ['produce', 'refit'] as const) {
      let s = rich();
      s.available.tank_t6 = 10;
      s.createdUnits.tank_t6 = 10;
      const cost = productionQuote(s, 'tank_t7', mode).unitCost;
      s.wallet.titanium = cost.titanium! * 3;
      expect(productionQuote(s, 'tank_t7', mode).max).toBe(3);
      const before = structuredClone(s);
      expect(() => act(s, { type: mode, unitId: 'tank_t7', count: 4 })).toThrow();
      expect(s).toEqual(before);
      s = act(s, { type: mode, unitId: 'tank_t7', count: 3 });
      expect(s.wallet.titanium).toBe(0);
      const job = allJobs(s).find((j) => j.kind === 'production')!;
      s = advance(s, job.dueAt + job.duration * 2);
      expect(s.available.tank_t7).toBe(3);
      assertState(s);
    }
  });
  it('old paid recipe survives save/load; refund never reprices it', async () => {
    let s = act(rich(), { type: 'produce', unitId: 'tank_t7', count: 3 });
    s.jobs.production!.unitCost = {
      iron: 12000,
      oil: 7200,
      lead: 4800,
      titanium: 3000,
      crystal: 0,
    };
    const wallet = structuredClone(s.wallet);
    s = await parseSave(await exportSave(s));
    s = act(s, { type: 'cancel', kind: 'production' });
    expect(s.wallet.iron - wallet.iron).toBe(36000);
    expect(s.wallet.titanium - wallet.titanium).toBe(9000);
    assertState(s);
  });
  it('ships distinct rocket impacts and separate destruction PCM assets', () => {
    const m = JSON.parse(readFileSync('native/assets/audio/manifest.json', 'utf8'));
    const hashes = new Set<string>();
    for (const key of [
      'tank_impact',
      'tank_destroyer_impact',
      'spg_impact',
      'rocket_impact',
      'vehicle_destroyed',
    ]) {
      const a = m.assets[key],
        bytes = readFileSync(`native/assets/audio/${a.file}`);
      expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(a.sha256);
      expect(a.rms).toBeGreaterThan(0.05);
      expect(a.peak).toBeLessThan(1);
      hashes.add(a.sha256);
    }
    expect(hashes.size).toBe(5);
  });
});
