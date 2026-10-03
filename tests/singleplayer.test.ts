import { describe, expect, it } from 'vitest';
import { leadershipQuote } from '../src/core/commander';
import { dungeons, productionQuote } from '../src/core/arsenal';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  advance,
  assertState,
  capacity,
  execute,
  leadershipCap,
  maxFormation,
  newGame,
  rate,
  scaleCost,
} from '../src/core/engine';
import {
  buildingNames,
  quests,
  rateCurve,
  researchCost,
  rules,
  unitList,
  units,
  upgradeCost,
  vehicleUnlockLevels,
} from '../src/core/content';
import { exportSave, parseSave } from '../src/core/storage';
import {
  guardTemplate,
  mineCapacity,
  npcCapacity,
  npcRate,
  WORLD_INTERVAL,
} from '../src/core/world';
import {
  resources,
  type Building,
  type Command,
  type Cost,
  type GameState,
} from '../src/core/types';

const T = 1700000000000;
let sequence = 0;
const act = (s: GameState, command: Command) =>
  execute(s, command, s.now, `sp-${++sequence}`).state;
const normalize = (s: GameState) => ({ ...s, revision: 0 });

describe('sustainable single-player world', () => {
  it('rest equals waiting, consumes no gold, and a retried rest never advances twice', () => {
    let s = newGame('rest', '休整', T);
    s = act(s, { type: 'produce', unitId: 'tank_t1', count: 10 });
    s = act(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    const expected = advance(s, T + 480 * 60000);
    const actual = execute(s, { type: 'rest', minutes: 480 }, T, 'rest-once').state;
    expect(actual.timeOffset).toBe(480 * 60000);
    expect(actual.wallet).toEqual(expected.wallet);
    expect(actual.available).toEqual(expected.available);
    expect(actual.world).toEqual(expected.world);
    expect(actual.marches).toEqual(expected.marches);
    expect(execute(actual, { type: 'rest', minutes: 480 }, actual.now, 'rest-once').state).toEqual(
      actual,
    );
    expect(() => act(s, { type: 'rest', minutes: -1 } as unknown as Command)).toThrow();
  });
  it('empty mines replenish on schedule, stay capped, and do not resurrect cleared guards', () => {
    let s = newGame('world', '地图', T);
    s.world[0].reserve = 0;
    s = advance(s, T + WORLD_INTERVAL - 1);
    expect(s.world[0].reserve).toBe(0);
    s = advance(s, T + WORLD_INTERVAL);
    expect(s.world[0].reserve).toBe(mineCapacity(s.world[0]) / 4);
    s = advance(s, T + WORLD_INTERVAL * 24);
    expect(s.world[0].reserve).toBe(mineCapacity(s.world[0]));
    expect(s.world[0].guards.every((g) => g === null)).toBe(true);
    assertState(s);
  });
  it('occupied mines do not replenish or overfill cargo at an hourly boundary', () => {
    let s = newGame('occupied', '采运', T);
    s = advance(s, T + WORLD_INTERVAL - 16000);
    s = act(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    s = advance(s, T + WORLD_INTERVAL);
    expect(s.marches[0].phase).toBe('gathering');
    expect(s.world[0].reserve + s.marches[0].cargo.iron).toBe(19200);
    s = advance(s, s.marches[0].dueAt);
    const cargo = s.marches[0].cargo.iron;
    expect(cargo).toBeLessThanOrEqual(s.marches[0].capacity);
    s = advance(s, s.marches[0].dueAt);
    expect(s.counters.cargo).toBe(cargo);
    assertState(s);
  });
  it('NPC rebuilding consumes its own stock, is capped, and never attacks the offline player', () => {
    let s = newGame('npc', '据点', T);
    const npc = s.world.find((t) => t.kind === 'npc')!;
    npc.guards = Array(6).fill(null);
    const before = { ...npc.wallet };
    const template = guardTemplate(npc.level, 'npc');
    s = advance(s, T + WORLD_INTERVAL);
    const rebuilt = s.world.find((t) => t.id === npc.id)!;
    for (const r of resources) {
      const income = npcRate(npc, r);
      const spend = rebuilt.guards.reduce(
        (n, g) => n + (g ? (units[g.unitId].cost[r] ?? 0) * g.count : 0),
        0,
      );
      expect(rebuilt.wallet[r]).toBe(Math.min(npcCapacity(npc, r), before[r] + income) - spend);
    }
    expect(
      rebuilt.guards
        .filter(Boolean)
        .every(
          (g) =>
            g!.count > 0 &&
            g!.count <= Math.ceil(template.find((t) => t?.unitId === g!.unitId)!.count / 4),
        ),
    ).toBe(true);
    s = advance(s, T + WORLD_INTERVAL * 48);
    expect(s.world.find((t) => t.id === npc.id)!.guards).toEqual(template);
    expect(s.reports).toHaveLength(0);
    expect(s.available).toEqual(newGame('npc', '据点', T).available);
    assertState(s);
  });
  it('24-hour jump and frequent updates agree across arrivals and resupply at the same time', () => {
    let s = newGame('offline', '离线', T);
    s = advance(s, T + WORLD_INTERVAL - 8000);
    s = act(s, { type: 'march', targetId: 'site-0', mission: 'gather' });
    const end = T + WORLD_INTERVAL * 24;
    const offline = advance(s, end);
    let stepped = s;
    while (stepped.now < end) stepped = advance(stepped, Math.min(end, stepped.now + 61000));
    expect(normalize(offline)).toEqual(normalize(stepped));
    assertState(offline);
    // This compares 1,400+ simulated updates; allow CPU contention during native builds.
  }, 15000);
  it('legacy regions preserve player balances/history and invalidate old garrison intelligence', async () => {
    let s = newGame('legacy', '老基地', T);
    s = act(s, { type: 'scout', targetId: 'site-0' });
    s = act(s, { type: 'battle', stage: 0, training: true });
    delete s.worldRules;
    for (const site of s.world) {
      delete site.economyVersion;
      site.level = Math.min(20, site.level);
    }
    s.world[0].reserve = 13;
    for (const t of s.world) t.lastGrowth = T - 30 * 86400000;
    const old = await parseSave(await exportSave(s));
    const migrated = advance(old, T);
    expect(migrated.worldRules).toBe('renewable-v3');
    expect(migrated.world[0].reserve).toBe(20);
    expect(migrated.wallet).toEqual(old.wallet);
    expect(migrated.reports).toEqual(old.reports);
    expect(migrated.intel['site-0']).toBeUndefined();
    expect(advance(migrated, T + WORLD_INTERVAL).world[0].reserve).toBe(4820);
  });
});

describe('fresh-save single-player acceptance', () => {
  it('earns every upgrade and unit, clears 12 stages, repairs, raids, gathers and round-trips its save', async () => {
    // This driver NEVER grants resources, levels, troops, wins or quest counters.
    // Only the real clock is advanced, just as when a player closes the game.
    let s = newGame('journey', '单机验收', T);
    let commands = 0;
    const milestones: object[] = [];
    function run(c: Command) {
      s = act(s, c);
      commands++;
      assertState(s);
    }
    function tick(time: number) {
      s = advance(s, time);
      assertState(s);
    }
    function finish(kind: keyof GameState['jobs']) {
      const j = s.jobs[kind]!;
      tick(j.dueAt + (j.total - j.completed - 1) * j.duration);
    }
    function afford(cost: Cost) {
      let wait = 0;
      for (const r of resources) {
        const missing = (cost[r] ?? 0) - s.wallet[r];
        if (missing <= 0) continue;
        expect(rate(s, r), `${r} must have a source`).toBeGreaterThan(0);
        expect(cost[r], `${r} cost must fit storage`).toBeLessThanOrEqual(capacity(s));
        wait = Math.max(wait, Math.ceil((missing * 3600000) / rate(s, r)) + 1);
      }
      if (wait) tick(s.now + wait);
    }
    function upgrade(b: Building) {
      afford(upgradeCost(b, s.buildings[b]));
      run({ type: 'upgrade', building: b });
      finish('building');
    }
    function claimReady() {
      for (const q of quests)
        if (!s.claimed.includes(q.id) && (s.counters[q.counter] ?? 0) >= q.target)
          run({ type: 'claim', questId: q.id });
      const day = Math.floor((s.now + 28800000) / 86400000);
      if (day > s.lastDaily) run({ type: 'daily' });
      while (s.commander.books > 0 && s.commander.leadership < 20 && !leadershipQuote(s).block)
        run({ type: 'leadership' });
      while (s.commander.skillPoints > 0 && s.commander.attackSkill < 20) run({ type: 'skill' });
    }
    function produce(id: string, n: number) {
      if (n <= 0) return;
      while (n > 0) {
        const count = Math.min(100, n);
        afford(scaleCost(units[id].cost, count));
        run({ type: 'produce', unitId: id, count });
        finish('production');
        n -= count;
      }
    }
    function repairAll() {
      for (const u of unitList) {
        const n = s.damaged[u.unitId];
        if (!n) continue;
        afford(scaleCost(u.repairCost, n));
        run({ type: 'repair', unitId: u.unitId, count: n });
        finish('repair');
      }
    }
    claimReady();
    produce('tank_t1', 10);
    run({ type: 'formation', slots: maxFormation(s) });
    run({ type: 'battle', stage: 0 });
    expect(s.cleared).toContain(0);
    // A genuine risky battle exercises loss and rebuilding, without pre-setting casualties.
    run({
      type: 'formation',
      slots: [{ unitId: 'tank_t1', count: 5 }, null, null, null, null, null],
    });
    run({ type: 'battle', stage: 1 });
    expect(Object.values(s.damaged).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    repairAll();
    run({ type: 'formation', slots: maxFormation(s) });
    run({ type: 'scout', targetId: 'site-0' });
    run({ type: 'march', targetId: 'site-0', mission: 'gather' });
    while (s.marches.length) tick(s.marches[0].dueAt);
    expect(s.counters.cargo).toBeGreaterThanOrEqual(100);
    claimReady();
    milestones.push({ milestone: 'first-loop', hours: (s.now - T) / 3600000 });

    // Build a normal economy alongside the HQ, never skipping prerequisites.
    for (let level = 2; level <= vehicleUnlockLevels[3]; level++) {
      upgrade('hq');
      for (const b of [
        'warehouse',
        'iron',
        'oil',
        'lead',
        'crystal',
        'lab',
        'factory',
      ] as Building[])
        upgrade(b);
      if (level >= 8) while (s.buildings.titanium < level) upgrade('titanium');
      for (const tech of ['attack', 'hp'] as const) {
        afford(researchCost(s.tech[tech]));
        run({ type: 'research', tech });
        finish('research');
      }
      claimReady();
    }
    milestones.push({ milestone: 'tier-three-unlocked', days: (s.now - T) / 86400000 });
    for (const u of unitList.filter((u) => u.tier <= 3)) produce(u.unitId, 1);
    for (let stage = 1; stage < 12; stage++) {
      const cap = leadershipCap(s);
      for (const [id, n] of Object.entries({
        tank_t3: cap * 2,
        tank_destroyer_t3: cap,
        spg_t3: cap * 2,
        rocket_t3: cap,
      }))
        produce(id, Math.max(0, n - s.available[id]));
      run({ type: 'formation', slots: maxFormation(s) });
      run({ type: 'battle', stage });
      expect(s.reports[0].winner, `stage ${stage + 1}`).toBe(0);
      repairAll();
      claimReady();
    }
    const npc = s.world.filter((t) => t.kind === 'npc').sort((a, b) => a.level - b.level)[0];
    run({ type: 'formation', slots: maxFormation(s) });
    run({ type: 'scout', targetId: npc.id });
    const beforeCargo = s.counters.cargo;
    run({ type: 'march', targetId: npc.id, mission: 'raid' });
    while (s.marches.length) tick(s.marches[0].dueAt);
    expect(s.counters.cargo).toBeGreaterThan(beforeCargo);
    repairAll();
    claimReady();
    expect(s.cleared).toHaveLength(12);
    expect(s.claimed).toHaveLength(quests.length);
    milestones.push({ milestone: 'campaign-complete', days: (s.now - T) / 86400000 });
    for (let level = s.buildings.hq + 1; level <= vehicleUnlockLevels[7]; level++) {
      upgrade('hq');
      for (const b of Object.keys(buildingNames) as Building[]) if (b !== 'hq') upgrade(b);
    }
    expect(Object.values(s.buildings).every((v) => v === vehicleUnlockLevels[7])).toBe(true);
    for (const facility of ['factory2', 'refit'] as const) {
      while (s.industry![facility] < vehicleUnlockLevels[7]) {
        afford(upgradeCost('factory', Math.max(1, s.industry![facility])));
        run({ type: 'facilityUpgrade', facility });
        finish('building');
      }
    }
    for (const u of unitList.filter((u) => u.tier === 4)) produce(u.unitId, 1);
    const finalCap = leadershipCap(s);
    for (const cls of ['tank', 'tank_destroyer', 'spg', 'rocket'])
      produce(`${cls}_t5`, finalCap * 2);
    run({ type: 'formation', slots: maxFormation(s) });
    for (const d of dungeons.filter((v) => v.band < 2)) {
      const beforeCores = { ...s.arsenal!.cores };
      run({ type: 'dungeon', dungeonId: d.id });
      expect(s.reports[0].winner, d.name).toBe(0);
      for (const drop of d.drops)
        expect(s.arsenal!.cores[drop.id]).toBe(beforeCores[drop.id] + drop.first);
      repairAll();
      run({ type: 'formation', slots: maxFormation(s) });
    }
    for (const u of unitList.filter((u) => u.tier >= 6)) {
      produce(u.unitId, 3);
      const q = productionQuote(s, u.unitId, 'refit');
      afford(q.unitCost);
      run({ type: 'refit', unitId: u.unitId, count: 1 });
      finish('production:refit');
      expect(s.available[u.unitId]).toBeGreaterThanOrEqual(1);
    }
    milestones.push({
      milestone: 'all-28-units-and-8-core-dungeons',
      days: (s.now - T) / 86400000,
    });
    const roundTrip = await parseSave(await exportSave(s));
    expect(roundTrip).toEqual(s);
    milestones.push({ milestone: 'all-buildings-level-60', days: (s.now - T) / 86400000 });
    mkdirSync('artifacts', { recursive: true });
    writeFileSync('artifacts/arsenal-journey-save.json', await exportSave(s));
    writeFileSync(
      'artifacts/singleplayer-journey.json',
      JSON.stringify(
        {
          commands,
          milestones,
          cleared: s.cleared.length,
          quests: s.claimed.length,
          buildings: s.buildings,
          produced: s.counters.produce,
          repaired: s.counters.repair,
          cargo: s.counters.cargo,
          stockGrants: 0,
          goldAcceleration: false,
          explanation: 'Deterministic simulated waiting, not real-time human playtesting.',
        },
        null,
        2,
      ),
    );
  }, 90000);
});
