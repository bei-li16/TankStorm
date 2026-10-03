import { buildingNames, techNames, units } from './content';
import { facilityBlock, facilityNames, jobFacility, productionFacilities } from './industry';
import { effectiveTime, queueStatus, queueView, vipBenefits } from './vip';
import type { GameState, JobKind, March, ProductionFacility } from './types';

// Read-only projection: deadlines, FIFO and capacity come from the settlement rules.
// Nothing here is persisted or deducted; old paid orders retain their stored timing.
export function expeditionStatus(s: GameState, m: March) {
  const site = s.world.find((v) => v.id === m.targetId);
  const phaseMs =
    m.phase === 'gathering' ? effectiveTime(s, m.dueAt - s.now) : Math.max(0, m.dueAt - s.now);
  // Outbound gathering is only a full-load estimate. Never inspect hidden guards,
  // substitute the next army's quote, or assume that the mine remains available.
  const gatherMs =
    m.phase === 'outbound' && m.mission === 'gather'
      ? effectiveTime(s, Math.ceil((m.capacity * 3600000) / Math.max(1, m.gatherRate)))
      : 0;
  return {
    ...m,
    name: `${m.mission === 'gather' ? '采集' : '突袭'}队 #${m.seq}`,
    targetName: site?.name ?? m.targetId,
    x: site?.x ?? s.home.x,
    y: site?.y ?? s.home.y,
    phaseName: { outbound: '前往目标', gathering: '采集中', returning: '返回基地' }[m.phase],
    phaseMs,
    returnMs: phaseMs + (m.phase === 'returning' ? 0 : m.travelMs) + gatherMs,
    estimated: m.phase === 'outbound',
    held: Object.values(m.cargo).reduce((n, v) => n + v, 0),
    count: m.troops.reduce((n, v) => n + (v?.count ?? 0), 0),
    progress: Math.min(1, Math.max(0, (s.now - m.startedAt) / Math.max(1, m.dueAt - m.startedAt))),
  };
}

export function dispatchOverview(s: GameState) {
  const jobs = queueView(s);
  const definitions: {
    id: string;
    name: string;
    kind: JobKind;
    facility?: ProductionFacility;
    page: string;
  }[] = [
    { id: 'building', name: '基地建造', kind: 'building', page: 'base' },
    ...productionFacilities.map((facility) => ({
      id: facility,
      name: facilityNames[facility],
      kind: 'production' as const,
      facility,
      page: 'factory',
    })),
    { id: 'research', name: '科研中心', kind: 'research', page: 'research' },
    { id: 'repair', name: '维修车间', kind: 'repair', page: 'repair' },
  ];
  const stations = definitions.map((d) => {
    const q = queueStatus(s, d.kind, d.facility);
    const block = d.facility ? facilityBlock(s, d.facility) : '';
    const rows = jobs
      .filter((j) => j.kind === d.kind && (!d.facility || jobFacility(j) === d.facility))
      .map((j) => ({
        ...j,
        name:
          (units[j.target]?.name ??
            buildingNames[j.target as keyof typeof buildingNames] ??
            techNames[j.target as keyof typeof techNames] ??
            facilityNames[j.target as keyof typeof facilityNames] ??
            j.target) + (j.sourceUnitId ? ' · 改装' : ''),
        progress: j.waiting
          ? 0
          : Math.min(
              1,
              Math.max(
                0,
                (j.completed + Math.min(1, Math.max(0, 1 - (j.dueAt - s.now) / j.duration))) /
                  j.total,
              ),
            ),
      }));
    const active = rows.filter((j) => !j.waiting);
    const damaged = d.id === 'repair' ? Object.values(s.damaged).reduce((n, v) => n + v, 0) : 0;
    return {
      ...d,
      block,
      rows,
      status: active.length ? '工作中' : block ? '未开放' : damaged ? '待修车辆' : '待命',
      active: active.length,
      waiting: q.waiting.length,
      slots: block ? 0 : q.slots,
      waitingSlots: block ? 0 : q.waitingSlots,
      damaged,
      nextMs: active.length ? Math.min(...active.map((j) => j.remainingMs)) : null,
      finishMs: rows.length ? Math.max(...rows.map((j) => j.remainingMs)) : null,
    };
  });
  const marches = [...s.marches].sort((a, b) => a.seq - b.seq).map((m) => expeditionStatus(s, m));
  return {
    stations,
    expeditions: {
      id: 'expeditions',
      name: '世界出击',
      page: 'world',
      status: marches.length ? '执行中' : '待命',
      block: '',
      active: marches.length,
      waiting: 0,
      slots: vipBenefits(s).marches,
      waitingSlots: 0,
      damaged: 0,
      nextMs: marches.length ? Math.min(...marches.map((m) => m.returnMs)) : null,
      finishMs: marches.length ? Math.max(...marches.map((m) => m.returnMs)) : null,
      rows: marches,
    },
    active: stations.reduce((n, v) => n + v.active, 0) + marches.length,
    waiting: stations.reduce((n, v) => n + v.waiting, 0),
  };
}
