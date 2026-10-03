import type { GameState, Job, ProductionFacility } from './types';

export const facilityNames = {
  factory: '第一坦克工厂',
  factory2: '第二坦克工厂',
  refit: '改装工厂',
  repair: '维修车间',
};
// Two manufacturing plants + one refit plant are documented on Rayjoy's site.
// HQ 13 is reported by the early base-building guide; the 120-level progression,
// build costs and repair shop available from the start are offline adaptations.
export const INDUSTRY_UNLOCK = 13;
export const productionFacilities: ProductionFacility[] = ['factory', 'factory2', 'refit'];
export function enableIndustry(s: GameState) {
  // Existing mixed production/refit jobs without a facility keep their old line,
  // sequence, timing and reserved materials. No historical losses are recalculated.
  s.industry ??= { version: 1, factory2: 0, refit: 0 };
}
export function facilityLevel(s: GameState, facility: ProductionFacility) {
  return facility === 'factory' ? s.buildings.factory : (s.industry?.[facility] ?? 0);
}
export function facilityBlock(s: GameState, facility: ProductionFacility) {
  if (facility === 'factory') return '';
  if (s.buildings.hq < INDUSTRY_UNLOCK) return `指挥中心 ${INDUSTRY_UNLOCK} 级解锁`;
  return facilityLevel(s, facility) === 0 ? `请先建设${facilityNames[facility]}` : '';
}
export function jobFacility(job: Job): ProductionFacility {
  return job.facility ?? 'factory';
}
export function productionKey(
  facility: ProductionFacility,
): 'production' | `production:${ProductionFacility}` {
  return facility === 'factory' ? 'production' : `production:${facility}`;
}
