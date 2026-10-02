import { classNames, unitList, units } from './content';
import type { Cost, Formation, GameState, UnitClass } from './types';
import { queueStatus, queueWait, vipBenefits } from './vip';

export const coreList = (Object.keys(classNames) as UnitClass[]).flatMap((classId) =>
  [6, 7].map((tier) => ({
    id: `${classId}_core${tier}`,
    classId,
    tier,
    name: `${classNames[classId]}${tier === 6 ? '改装' : '精密'}核心`,
  })),
);
export const coreNames = Object.fromEntries(coreList.map((c) => [c.id, c.name]));
export const dungeons = coreList.map((core, index) => ({
  id: `core-${index}`,
  name: `${['装甲试验场', '猎手要塞', '重炮工事', '导弹基地'][Math.floor(index / 2)]} · ${core.tier === 6 ? '普通' : '精英'}`,
  coreId: core.id,
  factoryLevel: core.tier === 6 ? 16 : 18,
  firstReward: 10,
  repeatReward: 3,
  formation: Array.from({ length: 6 }, (_, slot) =>
    slot < (core.tier === 6 ? 4 : 6)
      ? { unitId: `${core.classId}_t${core.tier - 1}`, count: core.tier === 6 ? 12 : 16 }
      : null,
  ) as Formation,
}));

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
) {
  const u = units[unitId];
  if (!u) throw Error('未知战车');
  const sourceUnitId = mode === 'refit' && u.tier > 1 ? `${u.classId}_t${u.tier - 1}` : '';
  const unitCost: Cost =
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
  const duration = Math.ceil(
    ((mode === 'repair' ? u.repairSeconds : u.productionSeconds * (mode === 'refit' ? 0.6 : 1)) *
      1000 *
      10000) /
      (10000 +
        s.tech.production * 500 +
        (mode === 'repair'
          ? 0
          : mode === 'refit'
            ? vipBenefits(s).refit
            : vipBenefits(s).production) *
          100),
  );
  const coreId = u.tier >= 6 && mode !== 'repair' ? `${u.classId}_core${u.tier}` : '';
  const coreCost = coreId ? { id: coreId, count: 1 } : undefined;
  let max = 10000;
  for (const [r, n] of Object.entries(unitCost))
    if (n > 0) max = Math.min(max, Math.floor(s.wallet[r as keyof Cost] / n));
  if (coreId) max = Math.min(max, s.arsenal?.cores[coreId] ?? 0);
  if (sourceUnitId) max = Math.min(max, s.available[sourceUnitId] ?? 0);
  if (mode === 'repair') max = Math.min(max, s.damaged[unitId] ?? 0);
  const block =
    mode === 'refit' && !sourceUnitId
      ? '轻型战车无需改装'
      : mode !== 'repair' && s.buildings.factory < u.unlock.factoryLevel
        ? `需要工厂 ${u.unlock.factoryLevel} 级`
        : '';
  const kind = mode === 'repair' ? 'repair' : 'production';
  const busy = queueStatus(s, kind).full;
  return {
    unitCost,
    duration,
    coreCost,
    sourceUnitId,
    max: block ? 0 : max,
    block,
    busy,
    waitMs: queueWait(s, kind),
  };
}
