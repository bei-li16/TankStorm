import { facilitySpeedBps, MAX_PRODUCTION_BATCH, workDuration } from './growth';
import { materialCost, techLevel } from './research';
import { classNames, unitList, units, vehicleUnlockLevels } from './content';
import type { Cost, Formation, GameState, UnitClass, ProductionFacility } from './types';
import { facilityBlock, facilityLevel, facilityNames } from './industry';
import { allJobs, queueStatus, queueWait, vipBenefits } from './vip';

export const coreList = (Object.keys(classNames) as UnitClass[]).flatMap((classId) =>
  [6, 7].map((tier) => ({
    id: `${classId}_core${tier}`,
    classId,
    tier,
    name: `${classNames[classId]}${tier === 6 ? '改装' : '精密'}核心`,
  })),
);
export const coreNames = Object.fromEntries(coreList.map((c) => [c.id, c.name]));
export const coreChapters = ['外围回收', '核心阵地', '精密防线', '终极要塞'];
export const dungeons = Array.from({ length: 16 }, (_, index) => {
  const band = Math.floor(index / 4),
    cls = index % 4;
  const classId = (Object.keys(classNames) as UnitClass[])[cls];
  // Original eight IDs and names remain valid for saves and historical rematches.
  const id = `core-${band < 2 ? cls * 2 + band : index}`;
  const name = `${['装甲试验场', '猎手要塞', '重炮工事', '导弹基地'][cls]} · ${['普通', '精英', '纵深', '决战'][band]}`;
  const first = [
    [10, 2],
    [12, 10],
    [18, 14],
    [26, 20],
  ][band];
  const range = [
    [
      [2, 4],
      [0, 1],
    ],
    [
      [3, 6],
      [1, 3],
    ],
    [
      [5, 9],
      [2, 5],
    ],
    [
      [8, 14],
      [4, 8],
    ],
  ][band];
  const drops = [6, 7].map((tier, i) => ({
    id: `${classId}_core${tier}`,
    first: first[i],
    min: range[i][0],
    max: range[i][1],
  }));
  const primary = drops[band === 0 ? 0 : 1];
  return {
    id,
    index,
    band,
    classId,
    name,
    coreId: primary.id,
    factoryLevel: [
      vehicleUnlockLevels[5],
      vehicleUnlockLevels[6],
      Math.ceil((vehicleUnlockLevels[6] + vehicleUnlockLevels[7]) / 2),
      vehicleUnlockLevels[7],
    ][band],
    firstReward: primary.first,
    repeatReward: (primary.min + primary.max) / 2,
    drops,
    formation: Array.from({ length: 6 }, (_, slot) =>
      slot < (band === 0 ? 4 : 6)
        ? {
            unitId: `${classId}_t${band === 0 ? 5 : band === 1 ? 6 : band === 2 ? (slot < 2 ? 7 : 6) : 7}`,
            count: [12 + cls * 2, 16 + cls * 2, 28 + cls * 4, 50 + cls * 8][band],
          }
        : null,
    ) as Formation,
  };
});
export function dungeonBlock(s: GameState, d: (typeof dungeons)[number]) {
  // Raising gates must not revoke an earned supply line or its repeat rewards.
  if (s.arsenal?.cleared.includes(d.id)) return '';
  if (Math.max(s.buildings.factory, s.industry?.factory2 ?? 0) < d.factoryLevel)
    return `核心副本需要制造工厂 ${d.factoryLevel} 级`;
  if (d.index > 0 && !s.arsenal?.cleared.includes(dungeons[d.index - 1].id))
    return `先通过第 ${d.index} 关：${dungeons[d.index - 1].name}`;
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
