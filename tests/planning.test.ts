import { describe, it, expect } from 'vitest';
import {
  newGame,
  execute,
  advance,
  assertState,
  leadershipCap,
  capacity,
} from '../src/core/engine';
import { restPreview, coreBudget, progression } from '../src/core/planning';
import { dungeons, productionQuote } from '../src/core/arsenal';
import { quests } from '../src/core/content';
import { exportSave, parseSave } from '../src/core/storage';
import type { Command, GameState } from '../src/core/types';

let serial = 0;
const act = (s: GameState, c: Command) => execute(s, c, s.now, `plan-${++serial}`).state;
function rich() {
  const s = newGame('planning', '体验复核', 1700000000000, 1677);
  s.buildings.hq = s.buildings.factory = 60;
  s.industry = { version: 1, factory2: 60, refit: 60 };
  s.vip = { version: 1, paidGold: 40, lastDaily: -1 };
  for (const key of Object.keys(s.wallet)) s.wallet[key as keyof typeof s.wallet] = 1000000;
  return s;
}
function stock(s: GameState, id: string, n: number) {
  s.available[id] = n;
  s.createdUnits[id] = n + s.damaged[id];
}

describe('v0.13 reviewed player journeys', () => {
  it('instant production is 159 to 160, then two independent hundred batches reach 360', () => {
    let s = rich();
    stock(s, 'tank_t1', 159);
    s = act(s, { type: 'produce', unitId: 'tank_t1', count: 1 });
    expect(s.available.tank_t1).toBe(160);
    s = advance(s, s.now + 60000);
    expect(s.available.tank_t1).toBe(160);
    s = act(s, { type: 'produce', facility: 'factory', unitId: 'tank_t1', count: 100 });
    s = act(s, { type: 'produce', facility: 'factory2', unitId: 'tank_t1', count: 100 });
    const preview = restPreview(s, 480),
      before = structuredClone(s);
    expect(preview.produced).toBe(200);
    expect(s).toEqual(before);
    s = act(s, { type: 'rest', minutes: 480 });
    expect(s.available.tank_t1).toBe(360);
    assertState(s);
  });
  it('MAX includes three cores: stock 16 to 19, cores 3 to 0', () => {
    let s = rich();
    stock(s, 'tank_t7', 16);
    s.arsenal!.cores.tank_core7 = 3;
    const q = productionQuote(s, 'tank_t7');
    expect(q.max).toBe(3);
    s = act(s, { type: 'produce', unitId: 'tank_t7', count: q.max });
    s = act(s, { type: 'rest', minutes: 480 });
    expect(s.available.tank_t7).toBe(19);
    expect(s.arsenal!.cores.tank_core7).toBe(0);
    assertState(s);
  });
  it.each([7, 6])('repairs all %i damaged vehicles without leaving phantom stock', (n) => {
    let s = rich();
    s.damaged.tank_t1 = n;
    s.createdUnits.tank_t1 += n;
    const before = s.available.tank_t1;
    expect(productionQuote(s, 'tank_t1', 'repair').max).toBe(n);
    s = act(s, { type: 'repair', unitId: 'tank_t1', count: n });
    s = act(s, { type: 'rest', minutes: 60 });
    expect(s.available.tank_t1).toBe(before + n);
    expect(s.damaged.tank_t1).toBe(0);
    assertState(s);
  });
  it('preview never executes unknown expeditions, advances the real seed, or changes receipts', () => {
    let s = rich();
    const site = s.world.find((x) => x.kind === 'mine')!;
    s = act(s, { type: 'march', targetId: site.id, mission: 'gather' });
    const before = structuredClone(s),
      p = restPreview(s, 60);
    expect(p.expeditions.length).toBe(1);
    expect(p.battles).toEqual([]);
    expect(p.returns).toEqual([]);
    expect(s).toEqual(before);
  });
  it('rest accounting counts only actual generated resources and exposes capacity limits', () => {
    const s = rich();
    s.wallet.iron = capacity(s) - 100;
    s.wallet.oil = capacity(s) + 500;
    const result = execute(s, { type: 'rest', minutes: 60 }, s.now, 'accounting');
    expect(result.accounting!.generated.iron).toBe(100);
    expect(result.accounting!.generated.oil ?? 0).toBe(0);
    expect(result.state.wallet.oil).toBe(s.wallet.oil);
    expect(result.accounting!.capacityLimited).toContain('iron');
    expect(result.accounting!.capacityLimited).toContain('oil');
    const replay = execute(
      result.state,
      { type: 'rest', minutes: 60 },
      result.state.now,
      'accounting',
    );
    expect(replay.state).toBe(result.state);
    assertState(result.state);
  });
  it('budget uses first/repeat boundaries, owned cores and actual refit materials', () => {
    const s = rich();
    s.arsenal!.cores.tank_core7 = 3;
    const p = coreBudget(s, 'tank', 7, 16);
    expect(p.needed).toBe(13);
    expect(p.victories).toBe(23);
    expect(p.victoriesMin).toBe(12);
    expect(p.victoriesMax).toBeNull();
    expect(p.refit.sourceCount).toBe(16);
    expect(p.refit.cost.iron).toBe(productionQuote(s, 'tank_t7', 'refit').unitCost.iron! * 16);
    s.arsenal!.cleared.push(p.dungeonId);
    expect(coreBudget(s, 'tank', 7, 16).victories).toBe(26);
    s.industry!.factory2 = 18;
    expect(coreBudget(s, 'tank', 7, 16, 'factory2').manufacture.block).toContain('第二坦克工厂');
    expect(coreBudget(s, 'tank', 7, 16).manufacture.block).toBe('');
  });
  it('presets rename/overwrite/delete independently, with command receipts preventing duplicate deletes', () => {
    let s = rich();
    s = act(s, { type: 'presetSave', name: '采集' });
    s = act(s, { type: 'presetSave', name: '作战' });
    const original = structuredClone(s.presets[1]);
    const inventory = structuredClone(s.available);
    s = act(s, { type: 'presetRename', index: 0, name: '重装队' });
    s = act(s, {
      type: 'formation',
      slots: [{ unitId: 'tank_t1', count: 1 }, null, null, null, null, null],
    });
    s = act(s, { type: 'presetReplace', index: 0 });
    expect(s.presets[0].formation[0]!.count).toBe(1);
    expect(s.presets[1]).toEqual(original);
    const result = execute(s, { type: 'presetDelete', index: 0 }, s.now, 'remove');
    expect(
      execute(result.state, { type: 'presetDelete', index: 0 }, s.now, 'remove').state.presets,
    ).toHaveLength(1);
    expect(result.state.available).toEqual(inventory);
    assertState(result.state);
  });
  it('elite honors persist once; training and replay never award them or extra cores', async () => {
    let s = rich();
    s.commander.leadership = 20;
    stock(s, 'tank_t7', 1000);
    s.arsenal!.cleared = dungeons.slice(0, 16).map((d) => d.id);
    Object.assign(s.tech, { attack: 40, hp: 40, ballistics: 40, armorPlating: 40, march: 40 });
    s.formation = Array.from({ length: 6 }, () => ({ unitId: 'tank_t7', count: leadershipCap(s) }));
    s = act(s, { type: 'dungeon', dungeonId: 'core-1', training: true });
    expect(s.honors).toBeUndefined();
    const result = execute(s, { type: 'dungeon', dungeonId: 'core-1' }, s.now, 'elite');
    s = result.state;
    expect(s.honors?.map((h) => h.id)).toEqual(['tank', 'low-loss']);
    expect(s.arsenal!.cores.tank_core7).toBe(10);
    const replay = execute(s, { type: 'dungeon', dungeonId: 'core-1' }, s.now, 'elite');
    expect(replay.state).toBe(s);
    s = act(s, { type: 'dungeon', dungeonId: 'core-1' });
    expect(s.honors).toHaveLength(2);
    expect(s.arsenal!.cores.tank_core7).toBeGreaterThanOrEqual(11);
    expect(s.arsenal!.cores.tank_core7).toBeLessThanOrEqual(14);
    const loaded = await parseSave(await exportSave(s));
    expect(loaded.honors).toEqual(s.honors);
    assertState(loaded);
  });
  it('objectives follow actual progress and old saves need no honor migration', () => {
    const s = rich();
    s.claimed = quests.map((q) => q.id);
    s.cleared = Array.from({ length: 192 }, (_, i) => i);
    expect(progression(s).next.title).toBe('四车系核心补给线');
    expect(s.honors).toBeUndefined();
    s.arsenal!.cleared = ['core-0', 'core-2', 'core-4', 'core-6'];
    expect(progression(s).next.title).toBe('六格高阶部队成型');
    stock(s, 'tank_t7', leadershipCap(s) * 2);
    s.formation = Array.from({ length: 6 }, () => ({ unitId: 'tank_t7', count: leadershipCap(s) }));
    expect(progression(s).cards.find((c) => c.id === 'army')!.current).toBe(2);
    assertState(s);
  });
});
