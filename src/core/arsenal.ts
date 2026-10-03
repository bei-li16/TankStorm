import { facilitySpeedBps, MAX_PRODUCTION_BATCH, workDuration } from './growth';
import { materialCost, techLevel } from './research';
import { classNames, unitList, units } from './content';
import type { Cost, Formation, GameState, UnitClass, ProductionFacility } from './types';
import { facilityBlock, facilityLevel, facilityNames } from './industry';
import { allJobs, queueStatus, queueWait, vipBenefits } from './vip';
import { army } from './battle';

export const coreList = (Object.keys(classNames) as UnitClass[]).flatMap((classId) =>
  [6, 7].map((tier) => ({
    id: `${classId}_core${tier}`,
    classId,
    tier,
    name: `${classNames[classId]}${tier === 6 ? '改装' : '精密'}核心`,
  })),
);
export const coreNames = Object.fromEntries(coreList.map((c) => [c.id, c.name]));
export const CORE_STAGES_PER_CHAPTER = 16;
export const coreChapters = ['外围回收', '军械基地', '精密防线', '钢铁要塞', '终极试验场'];
// Four supply checkpoints per family per chapter. Gates follow the 36/48/60 vehicle unlocks,
// then extend to the existing level-120 economy without changing vehicle costs or combat rules.
export const coreCurves = [
  { gate: [36, 47], count: [12, 27], tech: [0, 4], vi: [2, 4], vii: [0, 1], theme: 'industrial' },
  { gate: [48, 59], count: [28, 43], tech: [5, 12], vi: [6, 9], vii: [2, 4], theme: 'oilfield' },
  { gate: [60, 79], count: [46, 70], tech: [14, 28], vi: [10, 14], vii: [8, 12], theme: 'proving' },
  {
    gate: [80, 99],
    count: [74, 100],
    tech: [30, 48],
    vi: [16, 22],
    vii: [14, 20],
    theme: 'fortress',
  },
  {
    gate: [100, 120],
    count: [104, 135],
    tech: [50, 70],
    vi: [24, 32],
    vii: [22, 30],
    theme: 'proving',
  },
];
export const dungeons = Array.from(
  { length: coreChapters.length * CORE_STAGES_PER_CHAPTER },
  (_, index) => {
    const band = Math.floor(index / CORE_STAGES_PER_CHAPTER),
      step = index % CORE_STAGES_PER_CHAPTER,
      block = Math.floor(step / 4),
      cls = index % 4;
    const curve = coreCurves[band];
    const interpolate = (range: number[], ratio: number) =>
      Math.round(range[0] + (range[1] - range[0]) * ratio);
    const classId = (Object.keys(classNames) as UnitClass[])[cls];
    // Keep all 16 historic IDs at the first four checkpoints of chapters 1–4.
    // No save mutation or retroactive first-clear grant: newly inserted stages stay unclaimed.
    const legacy = band < 4 && step < 4;
    const id = legacy
      ? `core-${band < 2 ? cls * 2 + band : band * 4 + cls}`
      : `core-c${band + 1}-s${step + 1}`;
    const legacyName = legacy
      ? `${['装甲试验场', '猎手要塞', '重炮工事', '导弹基地'][cls]} · ${['普通', '精英', '纵深', '决战'][band]}`
      : '';
    const name = `${coreChapters[band]} ${band + 1}-${String(step + 1).padStart(2, '0')} · ${['回收站', '补给线', '核心库', '指挥所'][block]}`;
    const drops = [6, 7].map((tier, i) => {
      const range = i === 0 ? curve.vi : curve.vii;
      const min = range[0] + (band === 0 && i === 1 ? Math.min(1, Math.max(0, block - 1)) : block);
      const max = range[1] + (band === 0 && i === 1 ? Math.ceil(block / 2) : block);
      const legacyFirst =
        [
          [10, 2],
          [12, 10],
          [18, 14],
          [26, 20],
        ][band]?.[i] ?? 0;
      return {
        id: `${classId}_core${tier}`,
        first: Math.max(legacyFirst, Math.ceil((min + max) * 1.5)),
        min,
        max,
      };
    });
    const primary = drops[band === 0 ? 0 : 1];
    return {
      id,
      index,
      band,
      chapter: band,
      number: step + 1,
      classId,
      name,
      legacyName,
      theme: curve.theme,
      guardTech: interpolate(curve.tech, step / 15),
      growth: { xp: 300 + index * 45, books: 1 + band, prestige: 150 + index * 20, skillPoints: 0 },
      coreId: primary.id,
      factoryLevel: interpolate(curve.gate, block / 3),
      firstReward: primary.first,
      repeatReward: (primary.min + primary.max) / 2,
      drops,
      formation: Array.from({ length: 6 }, (_, slot) =>
        slot < (band === 0 && step < 4 ? 4 : 6)
          ? {
              unitId: `${classId}_t${band < 2 ? 5 + band + (block === 3 && slot < 2 ? 1 : 0) : 7}`,
              count: interpolate(curve.count, step / 15),
            }
          : null,
      ) as Formation,
    };
  },
);
export function dungeonArmy(d: (typeof dungeons)[number]) {
  const level = d.guardTech;
  return army(d.formation, {
    attack: level,
    hp: level,
    ballistics: level,
    armorPlating: level,
    march: level,
  } as GameState['tech']);
}
export function dungeonBlock(s: GameState, d: (typeof dungeons)[number]) {
  // Raising gates must not revoke an earned supply line or its repeat rewards.
  if (s.arsenal?.cleared.includes(d.id)) return '';
  if (Math.max(s.buildings.factory, s.industry?.factory2 ?? 0) < d.factoryLevel)
    return `核心副本需要制造工厂 ${d.factoryLevel} 级`;
  if (d.index > 0 && !s.arsenal?.cleared.includes(dungeons[d.index - 1].id))
    return `先通过 ${dungeons[d.index - 1].band + 1}-${String(dungeons[d.index - 1].number).padStart(2, '0')}：${dungeons[d.index - 1].name.split(' · ')[1]}`;
  return '';
}

export function repairAllQuote(s: GameState) {
  const cost: Cost = {};
  const repairs = allJobs(s).filter((j) => j.kind === 'repair');
  const rows = unitList.flatMap((u) => {
    const damaged = s.damaged[u.unitId];
    const repairing = repairs
      .filter((j) => j.target === u.unitId)
      .reduce((n, j) => n + j.total - j.completed, 0);
    for (const [r, n] of Object.entries(materialCost(s, u.repairCost)))
      cost[r as keyof Cost] = (cost[r as keyof Cost] ?? 0) + n * damaged;
    return damaged + repairing
      ? [{ unitId: u.unitId, damaged, repairing, count: damaged + repairing }]
      : [];
  });
  const shortage = Object.entries(cost)
    .filter(([r, n]) => s.wallet[r as keyof Cost] < n)
    .map(([id, n]) => ({ id, amount: n - s.wallet[id as keyof Cost] }));
  return {
    rows,
    cost,
    shortage,
    count: rows.reduce((n, r) => n + r.count, 0),
    prepaid: rows.reduce((n, r) => n + r.repairing, 0),
    token: JSON.stringify([rows, cost, repairs.map((j) => j.seq)]),
  };
}

// Called only on trusted in-memory state or AFTER validating a legacy save.
// Never reset an existing extension: missing fields in modern saves are corruption.
export function enableArsenal(s: GameState) {
  if (s.arsenal !== undefined) return;
  for (const stock of [s.available, s.damaged, s.createdUnits, s.destroyedUnits])
    for (const u of unitList) if (u.tier > 3 && stock[u.unitId] === undefined) stock[u.unitId] = 0;
  s.arsenal = {
    version: 1,
    cores: Object.fromEntries(coreList.map((c) => [c.id, 0])),
    converted: Object.fromEntries(unitList.map((u) => [u.unitId, 0])),
    cleared: [],
  };
}

export function productionQuote(
  s: GameState,
  unitId: string,
  mode: 'produce' | 'refit' | 'repair' = 'produce',
  facility: ProductionFacility = mode === 'refit' ? 'refit' : 'factory',
) {
  const u = units[unitId];
  if (!u) throw Error('未知战车');
  const sourceUnitId = mode === 'refit' && u.tier > 1 ? `${u.classId}_t${u.tier - 1}` : '';
  const baseCost: Cost =
    mode === 'repair'
      ? u.repairCost
      : mode === 'refit' && sourceUnitId
        ? Object.fromEntries(
            Object.entries(u.cost).map(([r, n]) => [
              r,
              Math.max(0, n - (units[sourceUnitId].cost as Cost)[r as keyof Cost]!),
            ]),
          )
        : u.cost;
  const unitCost = materialCost(s, baseCost);
  const duration = workDuration(
    (mode === 'repair' ? u.repairSeconds : u.productionSeconds * (mode === 'refit' ? 0.6 : 1)) *
      1000,
    (s.tech.production * 500 +
      (mode === 'repair' ? 0 : facilitySpeedBps(facilityLevel(s, facility))) +
      techLevel(s, mode === 'repair' ? 'repairSpeed' : 'refitSpeed') *
        (mode === 'produce' ? 0 : 800) +
      (mode === 'repair'
        ? 0
        : mode === 'refit'
          ? vipBenefits(s).refit
          : vipBenefits(s).production) *
        100) /
      100,
    mode === 'produce' ? 0.7 : mode === 'refit' ? 0.5 : 0.25,
  );
  const coreId = u.tier >= 6 && mode !== 'repair' ? `${u.classId}_core${u.tier}` : '';
  const coreCost = coreId ? { id: coreId, count: 1 } : undefined;
  let max = mode === 'repair' ? 10000 : MAX_PRODUCTION_BATCH;
  for (const [r, n] of Object.entries(unitCost))
    if (n > 0) max = Math.min(max, Math.floor(s.wallet[r as keyof Cost] / n));
  if (coreId) max = Math.min(max, s.arsenal?.cores[coreId] ?? 0);
  if (sourceUnitId) max = Math.min(max, s.available[sourceUnitId] ?? 0);
  if (mode === 'repair') max = Math.min(max, s.damaged[unitId] ?? 0);
  const level = facilityLevel(s, facility);
  const manufactureLevel = Math.max(s.buildings.factory, facilityLevel(s, 'factory2'));
  const block =
    (mode !== 'repair' &&
    ((mode === 'produce' && !['factory', 'factory2'].includes(facility)) ||
      (mode === 'refit' && facility !== 'refit'))
      ? '请选择对应的制造或改装工厂'
      : '') ||
    (mode !== 'repair' ? facilityBlock(s, facility) : '') ||
    (mode === 'refit' && !sourceUnitId
      ? '轻型战车无需改装'
      : mode !== 'repair' && level < u.unlock.factoryLevel
        ? `需要${facilityNames[facility]} ${u.unlock.factoryLevel} 级（当前 ${level} 级）`
        : mode === 'refit' && manufactureLevel < u.unlock.factoryLevel
          ? `需要任一坦克工厂 ${u.unlock.factoryLevel} 级制造能力（当前最高 ${manufactureLevel} 级）`
          : '');
  const kind = mode === 'repair' ? 'repair' : 'production';
  const busy = queueStatus(s, kind, kind === 'production' ? facility : undefined).full;
  return {
    unitCost,
    duration,
    coreCost,
    sourceUnitId,
    facility,
    max: block ? 0 : max,
    block,
    busy,
    waitMs: queueWait(s, kind, kind === 'production' ? facility : undefined),
  };
}
