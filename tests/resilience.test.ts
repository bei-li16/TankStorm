import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { advance, assertState, execute, maxFormation, newGame } from '../src/core/engine';
import { army, rng32 } from '../src/core/battle';
import { exportSave, parseSave, canonical } from '../src/core/storage';
import type { Command, GameState } from '../src/core/types';
const base = () => newGame('robust', '坚守者', 1700000000000);
let id = 0;
const apply = (s: GameState, c: Command) => execute(s, c, s.now, `r-${++id}`).state;
async function recheck(text: string, edit: (s: any) => void) {
  const doc = JSON.parse(text);
  edit(doc.state);
  const { checksum, ...body } = doc;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(body)));
  doc.checksum = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
  return JSON.stringify(doc);
}
describe('save resilience, campaign coverage and long sessions', () => {
  it('original world seed survives combat RNG progression', async () => {
    const s = apply(base(), { type: 'battle', stage: 0, training: true });
    expect(s.seed).not.toBe(s.worldSeed);
    expect((await parseSave(await exportSave(s))).worldSeed).toBe(2601001);
  });
  it.each(['iron', 'oil', 'lead', 'titanium', 'crystal'])(
    'world includes an accessible resource type %s',
    (r) => {
      expect(base().world.some((s) => s.kind === 'mine' && s.resource === r)).toBe(true);
    },
  );
  it('arrival uses technology snapshotted at departure', () => {
    let s = base();
    const t = s.world.find((x) => x.kind === 'npc')!;
    t.guards = [{ unitId: 'tank_t1', count: 3 }, null, null, null, null, null];
    s = apply(s, { type: 'march', targetId: t.id, mission: 'raid' });
    const sentHp = s.marches[0].combatArmy![0].hp;
    s.tech.hp = 20;
    s.tech.attack = 20;
    s = advance(s, s.marches[0].dueAt);
    expect(s.reports[0].initial[0][0].hp).toBe(sentHp);
  });
  it('all 20 headquarters levels can be reached with legitimate queue completions', () => {
    let s = base();
    s.wallet.iron = s.wallet.oil = s.wallet.lead = 1e7;
    for (let level = 1; level < 20; level++) {
      s = apply(s, { type: 'upgrade', building: 'hq' });
      s = advance(s, s.jobs.building!.dueAt);
      expect(s.buildings.hq).toBe(level + 1);
      assertState(s);
    }
    expect(() => apply(s, { type: 'upgrade', building: 'hq' })).toThrow('最高等级');
  });
  it('all 12 unit variants can be produced and conserved', () => {
    let s = base();
    s.buildings.factory = s.buildings.hq = 20;
    for (const r of ['iron', 'oil', 'lead', 'titanium'] as const) s.wallet[r] = 1e7;
    for (const c of ['tank', 'tank_destroyer', 'spg', 'rocket'])
      for (const t of [1, 2, 3]) {
        const u = `${c}_t${t}`,
          before = s.available[u];
        s = apply(s, { type: 'produce', unitId: u, count: 3 });
        s = advance(s, s.now + s.jobs.production!.duration * 3);
        expect(s.available[u]).toBe(before + 3);
        assertState(s);
      }
  });
  it.each([
    (s: any) => s.reports.push(null),
    (s: any) => (s.notices = [{ id: 1, at: s.now, text: { bad: true } }]),
    (s: any) => (s.commander = null),
    (s: any) => s.available.tank_t1++,
    (s: any) => (s.formation = [{ unitId: 'constructor', count: 1 }, null, null, null, null, null]),
    (s: any) => (s.home.x = 999),
    (s: any) => (s.counters = null),
    (s: any) => (s.presets = [{ name: 'bad', formation: [] }]),
    (s: any) =>
      (s.jobs.production = {
        kind: 'production',
        target: 'tank_t1',
        total: 5,
        completed: 0,
        unitCost: { gold: -2 },
        duration: 5000,
        startedAt: s.now,
        dueAt: s.now + 5000,
        seq: 1,
      }),
    (s: any) => (s.marches = [{ id: 'x', targetId: 'missing', phase: 'invalid' }]),
  ])('A18 structurally invalid saves fail even with a correct checksum %#', async (mutate) => {
    const s = base();
    const text = await recheck(await exportSave(s), mutate);
    await expect(parseSave(text)).rejects.toThrow();
  });
  it('a simulated 30-day command sequence keeps invariants after every commit', () => {
    let s = base();
    const random = rng32(81237);
    for (let i = 0; i < 400; i++) {
      s = advance(s, s.now + (random() % 7200000));
      const before = structuredClone(s);
      let c: Command;
      switch (random() % 8) {
        case 0:
          c = {
            type: 'produce',
            unitId: ['tank_t1', 'spg_t1', 'rocket_t1', 'tank_destroyer_t1'][random() % 4],
            count: 1 + (random() % 10),
          };
          break;
        case 1:
          c = { type: 'upgrade', building: 'hq' };
          break;
        case 2:
          c = { type: 'formation', slots: maxFormation(s) };
          break;
        case 3:
          c = {
            type: 'battle',
            stage: Math.min(s.cleared.length, 11),
            training: random() % 3 === 0,
          };
          break;
        case 4: {
          const target = s.world[random() % 100];
          c = {
            type: 'march',
            targetId: target.id,
            mission: target.kind === 'mine' ? 'gather' : 'raid',
          };
          break;
        }
        case 5:
          c = { type: 'daily' };
          break;
        case 6:
          c = { type: 'research', tech: 'attack' };
          break;
        default:
          c = { type: 'repair', unitId: 'tank_t1', count: 1 };
      }
      try {
        s = apply(s, c);
      } catch {
        expect(s).toEqual(before);
      }
      assertState(s);
    }
    expect(s.now - base().now).toBeGreaterThan(10 * 86400000);
  }, 15000);
  it('command calculation remains below the 100ms p95 target on a populated save', () => {
    let s = base();
    for (let i = 0; i < 100; i++) s = apply(s, { type: 'battle', stage: i % 12, training: true });
    const samples: number[] = [];
    for (let i = 0; i < 40; i++) {
      const started = performance.now();
      s = apply(s, { type: 'formation', slots: s.formation });
      samples.push(performance.now() - started);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95)];
    mkdirSync('artifacts', { recursive: true });
    writeFileSync(
      'artifacts/core-benchmark.json',
      JSON.stringify(
        {
          at: new Date().toISOString(),
          runtime: process.version,
          platform: process.platform,
          reports: 100,
          commands: samples.length,
          p95Ms: p95,
          maxMs: samples.at(-1),
          scope:
            'Pure core computation with validation; excludes browser rendering and IndexedDB I/O',
        },
        null,
        2,
      ),
    );
    expect(p95).toBeLessThan(100);
  });
});
