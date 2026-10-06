import packageInfo from '../package.json';
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { researchCost, chapters, stageNames } from '../src/core/content';
import { libraryEntries, fieldLibrary, searchLibrary } from '../src/core/library';
import { researchTree } from '../src/core/research';
import { newGame, execute, advance, assertState } from '../src/core/engine';
import { exportSave, parseSave } from '../src/core/storage';
import { allJobs } from '../src/core/vip';
import { resources, type Command, type GameState } from '../src/core/types';
import { prestigeRequired, rankNames } from '../src/core/commander';
import { protectionBps } from '../src/core/protection';

const article = (id: string) =>
  libraryEntries
    .find((a) => a.id === id)!
    .sections.map((s) => s.text)
    .join('\n');
const act = (s: GameState, c: Command, id = crypto.randomUUID()) => execute(s, c, s.now, id).state;
const previousCost = (level: number) => {
  const scale = 1.2 * (level + 1) ** 2.65;
  return {
    iron: Math.ceil((level < 5 ? 80 : 60) * scale),
    oil: Math.ceil((level < 5 ? 55 : 39) * scale),
    lead: Math.ceil((level < 5 ? 65 : 46) * scale),
    titanium: level < 5 ? 0 : Math.ceil(Math.ceil(32 * scale) * 1.5),
    crystal: Math.ceil((level < 5 ? 26 : 17) * scale),
  };
};
function ready() {
  const s = newGame('library29', '机制验收', 1760000000000);
  s.buildings.hq = s.buildings.lab = 120;
  for (const key of Object.keys(s.tech)) s.tech[key as keyof typeof s.tech] = 60;
  for (const r of resources) s.wallet[r] = 1e11;
  return s;
}

describe('v29 research titanium', () => {
  it('increases only titanium by ceil(150% of the prior rounded cost), across all 120 targets', () => {
    for (let level = 0; level < 120; level++) {
      const old = previousCost(level);
      expect(researchCost(level)).toEqual({ ...old, titanium: Math.ceil(old.titanium * 1.5) });
    }
    expect(researchCost(120)).toEqual({});
  });
  it('uses the same quote and charge, leaves material saving inapplicable, and rejects shortages atomically', () => {
    let s = ready();
    s.tech.materials = 120;
    const price = researchCost(s.tech.attack);
    s.wallet.titanium = price.titanium! - 1;
    const before = structuredClone(s);
    expect(() => act(s, { type: 'research', tech: 'attack' })).toThrow('钛矿缺 1');
    expect(s).toEqual(before);
    s.wallet.titanium++;
    const paidFrom = structuredClone(s.wallet);
    const id = crypto.randomUUID();
    s = act(s, { type: 'research', tech: 'attack' }, id);
    expect(s.jobs.research!.unitCost).toEqual(price);
    for (const r of resources) expect(s.wallet[r]).toBe(paidFrom[r] - (price[r] ?? 0));
    expect(act(s, { type: 'research', tech: 'attack' }, id)).toEqual(s);
    s = act(s, { type: 'cancel', kind: 'research' });
    expect(s.wallet).toEqual(paidFrom);
  });
  it('keeps active and waiting old paid quotes on import, completion and refund', async () => {
    let s = act(ready(), { type: 'research', tech: 'attack' });
    s = act(s, { type: 'research', tech: 'hp' });
    for (const job of allJobs(s)) job.unitCost = previousCost(60);
    const wallet = structuredClone(s.wallet);
    s = await parseSave(await exportSave(s));
    expect(allJobs(s).every((j) => j.unitCost.titanium === previousCost(60).titanium)).toBe(true);
    const waiting = s.jobBacklog![0];
    s = act(s, { type: 'cancel', kind: 'research', seq: waiting.seq });
    expect(s.wallet.titanium).toBe(wallet.titanium + previousCost(60).titanium);
    const paid = s.wallet.titanium;
    s = advance(s, s.jobs.research!.dueAt);
    expect(s.tech.attack).toBe(61);
    // Already above storage cap; completion does not deduct or mint titanium.
    expect(s.wallet.titanium).toBe(paid);
    assertState(s);
  });
});

describe('v29 library audit', () => {
  it('covers current research dependencies, materials, chapters, ranks and protection from live rules', () => {
    expect(fieldLibrary.edition).toBe('v' + packageInfo.version);
    for (const tech of researchTree) {
      expect(article('research-paths')).toContain(tech.name + '：科研中心起始门槛' + tech.lab);
      for (const p of tech.prerequisites)
        expect(article('research-paths')).toContain(
          researchTree.find((t) => t.id === p.id)!.name + '≥' + p.level,
        );
    }
    for (const target of [1, 5, 6, 20, 60, 100, 120]) {
      const c = researchCost(target - 1);
      expect(article('research-cost')).toContain(
        `升至${target}级：铁 ${c.iron} / 油 ${c.oil} / 铅 ${c.lead} / 钛 ${c.titanium} / 水晶 ${c.crystal}`,
      );
    }
    for (const ch of chapters) expect(article('campaign')).toContain(ch.name);
    expect(libraryEntries.find((e) => e.id === 'campaign')!.summary).toContain(
      String(stageNames.length),
    );
    rankNames.forEach((r, i) => {
      expect(article('prestige')).toContain(r);
      expect(article('prestige')).toContain(String(prestigeRequired(i * 10 + 1)));
    });
    for (const l of [1, 20, 40, 60, 80, 100, 120])
      expect(article('warehouse-protection')).toContain(`${l}级 ${protectionBps(l) / 100}%`);
  });
  it('has resolvable maintenance sources and searchable newly introduced mechanisms', () => {
    for (const a of libraryEntries) {
      for (const source of a.sources) expect(existsSync(source.split(':')[0]), source).toBe(true);
      expect(JSON.stringify(a)).not.toMatch(/\$[A-Z_]+|undefined|NaN/);
    }
    for (const [term, id] of [
      ['连续部署', 'presets'],
      ['保护', 'warehouse-protection'],
      ['钛矿 50%', 'research-cost'],
      ['补给', 'daily-objectives'],
    ])
      expect(searchLibrary('all', term).map((a) => a.id)).toContain(id);
    expect(article('effective-stats')).toContain('声望');
    expect(article('research')).toContain('不享受材料利用折扣');
    expect(article('queues')).toContain('维修没有VIP专用速度加成');
  });
});
