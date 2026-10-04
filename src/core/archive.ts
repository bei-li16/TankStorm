import type { GameState } from './types';

export const REPORT_LIMIT = 400;
const newest = (a: { id: string; at: number }, b: { id: string; at: number }) =>
  b.at - a.at ||
  Number(b.id.match(/(\d+)$/)?.[1] ?? 0) - Number(a.id.match(/(\d+)$/)?.[1] ?? 0) ||
  b.id.localeCompare(a.id);

// One chronological archive budget shared by fights and expedition receipts.
export function trimArchive(s: GameState) {
  const rows = [
    ...s.reports.map((r) => ({ id: r.id, at: r.at })),
    ...(s.expeditionLog ?? []).map((r) => ({ id: 'return:' + r.marchId, at: r.at })),
  ].sort(newest);
  const keep = new Set(rows.slice(0, REPORT_LIMIT).map((r) => r.id));
  s.reports = s.reports.filter((r) => keep.has(r.id));
  if (s.expeditionLog)
    s.expeditionLog = s.expeditionLog.filter((r) => keep.has('return:' + r.marchId));
}

export function archiveRows(s: GameState) {
  const battles = s.reports.map(({ events, initial, final, actions, ...r }) => ({
    ...r,
    category:
      r.mode === 'world'
        ? (({ mine: 'mine', npc: 'raid' } as Record<string, string>)[
            r.worldKind ??
              s.world.find(
                (v) =>
                  v.id ===
                  (s.marches.find((m) => m.id === r.marchId)?.targetId ??
                    s.expeditionLog?.find((m) => m.marchId === r.marchId)?.targetId),
              )?.kind ??
              ''
          ] ?? 'world')
        : r.mode,
    outcome: r.winner === 0 ? 'success' : 'failure',
    receipt: false,
  }));
  const returns = (s.expeditionLog ?? []).map((r) => {
    const site = s.world.find((v) => v.id === r.targetId);
    const battle = s.reports.find((b) => b.marchId === r.marchId);
    const mission = r.mission ?? (site?.kind === 'npc' ? 'raid' : 'gather');
    return {
      id: 'return:' + r.marchId,
      at: r.at,
      title: r.title ?? `${site?.name ?? r.targetId} [${site?.x ?? '?'},${site?.y ?? '?'}]`,
      category: mission === 'gather' ? 'gather-return' : 'raid-return',
      outcome: !(r.success ?? (r.outcome === 'returned' && battle?.winner !== 1))
        ? 'failure'
        : 'success',
      receipt: true,
      mode: 'return',
      winner: !(r.success ?? (r.outcome === 'returned' && battle?.winner !== 1)) ? 1 : 0,
      rewards: r.stored ?? r.cargo,
      cargo: r.cargo,
      discarded: r.discarded ?? {},
      casualties: r.casualties ?? battle?.casualties ?? [],
      survivors: r.survivors,
      battleId: r.battleId ?? battle?.id ?? '',
      confirmed: r.stored !== undefined,
    };
  });
  return [...battles, ...returns].sort(newest).slice(0, REPORT_LIMIT);
}
