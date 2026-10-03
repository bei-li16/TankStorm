import { coreList } from './arsenal';
import { resourceNames, unitList, units, rules } from './content';
import { allJobs } from './vip';
import { resources, type BattleReport, type GameState } from './types';

// Read-only ledger. Reserved inputs have already left the spendable wallet/stock.
export function inventoryView(s: GameState) {
  const jobs = allJobs(s);
  const left = (j: (typeof jobs)[number]) => j.total - j.completed;
  const minerals = [...resources, 'gold' as const].map((id) => ({
    id,
    category: 'materials',
    name: resourceNames[id],
    icon: id,
    quantity: s.wallet[id],
    reserved: jobs.reduce((n, j) => n + (j.unitCost[id] ?? 0) * left(j), 0),
    incoming: s.marches.reduce((n, m) => n + (m.cargo[id] ?? 0), 0),
  }));
  const cores = coreList.map((c) => ({
    ...c,
    category: 'cores',
    icon: c.id,
    quantity: s.arsenal?.cores[c.id] ?? 0,
    reserved: jobs.reduce(
      (n, j) => n + (j.coreCost?.id === c.id ? j.coreCost.count * left(j) : 0),
      0,
    ),
  }));
  const vehicles = unitList.map((u) => {
    const marching = s.marches.reduce(
      (n, m) => n + m.troops.reduce((v, t) => v + (t?.unitId === u.unitId ? t.count : 0), 0),
      0,
    );
    const repairing = jobs.reduce(
      (n, j) => n + (j.kind === 'repair' && j.target === u.unitId ? left(j) : 0),
      0,
    );
    const refitting = jobs.reduce((n, j) => n + (j.sourceUnitId === u.unitId ? left(j) : 0), 0);
    const producing = jobs.reduce(
      (n, j) => n + (j.kind === 'production' && j.target === u.unitId ? left(j) : 0),
      0,
    );
    return {
      id: u.unitId,
      category: 'vehicles',
      name: u.name,
      icon: u.unitId,
      classId: u.classId,
      tier: u.tier,
      quantity: s.available[u.unitId] + s.damaged[u.unitId] + marching + repairing + refitting,
      available: s.available[u.unitId],
      damaged: s.damaged[u.unitId],
      marching,
      repairing,
      refitting,
      producing,
      destroyed: s.destroyedUnits[u.unitId],
    };
  });
  const items = [
    ['books', '统率书', '用于提升统率，可在指挥官页使用'],
    ['skillPoints', '技能点', '用于提升指挥官作战技能'],
    ['prestige', '声望', '累计成长属性，用于军衔晋升'],
    ['xp', '指挥官经验', '累计经验，用于提升指挥官等级'],
  ].map(([id, name, description]) => ({
    id,
    category: 'items',
    name,
    description,
    icon: 'emblem',
    quantity: s.commander[id as 'books' | 'skillPoints' | 'prestige' | 'xp'],
  }));
  return [...minerals, ...cores, ...vehicles, ...items];
}

// Effective damage excludes overkill. Use recorded HP deltas, including historical rulesets.
export function battleSummary(r: BattleReport) {
  const hp = r.initial.map((team) => new Map(team.map((st) => [st.slot, st.totalHp])));
  const damage = [new Map<number, number>(), new Map<number, number>()];
  const received = [new Map<number, number>(), new Map<number, number>()];
  let nominal = [0, 0];
  for (const e of r.events) {
    if (e.ground) continue;
    const target = hp[1 - e.side];
    const before = target.get(e.to) ?? 0;
    const dealt = Math.max(0, before - Math.max(0, e.hp));
    target.set(e.to, Math.max(0, e.hp));
    damage[e.side].set(e.from, (damage[e.side].get(e.from) ?? 0) + dealt);
    received[1 - e.side].set(e.to, (received[1 - e.side].get(e.to) ?? 0) + dealt);
    nominal[e.side] += e.damage;
  }
  const teams = r.initial.map((team, side) => {
    const rows = team.map((st) => {
      const final = r.final[side].find((f) => f.slot === st.slot);
      const survived = final ? Math.ceil(final.totalHp / final.hp) : 0;
      return {
        slot: st.slot,
        unitId: st.unitId,
        name: units[st.unitId].name,
        sent: st.count,
        survived,
        lost: st.count - survived,
        damage: damage[side].get(st.slot) ?? 0,
        received: received[side].get(st.slot) ?? 0,
      };
    });
    return {
      rows,
      sent: rows.reduce((n, v) => n + v.sent, 0),
      survived: rows.reduce((n, v) => n + v.survived, 0),
      lost: rows.reduce((n, v) => n + v.lost, 0),
      damage: rows.reduce((n, v) => n + v.damage, 0),
      nominal: nominal[side],
      critical: r.events.filter((e) => e.side === side && e.critical).length,
      miss: r.events.filter((e) => e.side === side && e.miss).length,
    };
  });
  return {
    teams,
    feedback: battleFeedback(r, teams),
    repairable: r.mode === 'training' ? 0 : r.casualties.reduce((n, c) => n + c.repairable, 0),
    destroyed: r.mode === 'training' ? 0 : r.casualties.reduce((n, c) => n + c.destroyed, 0),
  };
}

function battleFeedback(
  r: BattleReport,
  teams: { rows: { slot: number; lost: number; sent: number; received: number }[]; lost: number }[],
) {
  const hints: string[] = [];
  if (r.endReason === 'round-limit')
    hints.push(
      `第 ${r.roundLimit} 个大回合打完，双方仍有部队存活：${r.tactics?.firstSide === 0 ? '我方' : '敌方'}为先手方，按规则判负。`,
    );
  if (r.winner === 0) {
    if (teams[0].lost === 0)
      hints.push(
        r.mode === 'training'
          ? '演习无损获胜；可返回关卡评估正式出击。'
          : '本场无战损，可继续推进战线或再次挑战获取补给。',
      );
    else if (r.mode === 'training')
      hints.push(`演习预计损失 ${teams[0].lost} 辆，实际未扣兵；调整编队后再评估正式出击。`);
    else hints.push(`本场损失 ${teams[0].lost} 辆，先维修和补兵，再安排下一次挑战。`);
  } else {
    const empty = 6 - r.initial[0].length;
    if (empty > 0) hints.push(`有 ${empty} 个空阵位：补齐部队可增加行动轮转和承伤分担。`);
    const average = (side: number) =>
      r.initial[side].reduce((n, v) => n + units[v.unitId].tier * v.count, 0) /
      Math.max(
        1,
        r.initial[side].reduce((n, v) => n + v.count, 0),
      );
    if (average(1) - average(0) >= 1)
      hints.push(`敌军平均兵阶高 ${(average(1) - average(0)).toFixed(1)} 阶：优先评估制造或改装。`);
    const totalReceived = teams[0].rows.reduce((n, v) => n + v.received, 0);
    const concentrated = teams[0].rows.find((v) => v.received > totalReceived * 0.55);
    if (concentrated && teams[0].rows.length > 1)
      hints.push(`阵位 ${concentrated.slot} 承受了超过一半有效伤害；检查前排配置与纵列站位。`);
    const front = teams[0].rows.filter((v) => v.slot <= 3);
    if (!front.length || front.every((v) => v.lost === v.sent))
      hints.push('前排全部失守：补充承伤单位或提升装甲与生命科技。');
    const remaining = r.final[1].reduce((n, v) => n + v.totalHp, 0);
    const original = r.initial[1].reduce((n, v) => n + v.totalHp, 0);
    hints.push(
      `敌军仍保留 ${Math.round((100 * remaining) / Math.max(1, original))}% 生命；检查出战数量、火力科技与攻击覆盖。`,
    );
    if (r.tactics?.firstSide === 1) hints.push('本场敌方先攻：机动推进与更高阶战车可提升先手。');
  }
  if (
    r.winner !== 0 &&
    [
      'classic-combat-v0.10',
      'classic-combat-v0.14',
      'classic-combat-v0.20',
      'classic-combat-v0.22',
      'classic-combat-v0.24.3',
    ].includes(r.ruleset)
  ) {
    const shots = r.events.filter((e) => e.side === 0 && !e.miss && !e.ground);
    const poor = shots.filter((e) => {
      const attacker = r.initial[0].find((v) => v.slot === e.from)?.classId;
      const defender = r.initial[1].find((v) => v.slot === e.to)?.classId;
      return rules.matchup.some(
        (v) =>
          v.attackerClass === attacker && v.defenderClass === defender && v.multiplierBps < 10000,
      );
    }).length;
    if (poor > 0 && poor / Math.max(1, shots.length) >= 0.25)
      hints.push(`我方 ${poor}/${shots.length} 次命中处于克制劣势；在编队攻击图解中调整对应车系。`);
  }
  return hints;
}

// No inferred delivery for old saves: absence of an active march is not a receipt.
export function transportStatus(s: GameState, r: BattleReport) {
  if (r.mode !== 'world') return { status: 'settled', label: '已结算', cargo: r.rewards };
  const receipt = (s.expeditionLog ?? []).find((v) => v.marchId === r.marchId);
  if (receipt)
    return {
      status: receipt.outcome,
      label: receipt.outcome === 'returned' ? '已归队 · 实际物资已入库' : '部队全损 · 无返城物资',
      cargo: receipt.cargo,
      at: receipt.at,
    };
  const march = s.marches.find((v) => v.id === r.marchId);
  if (march)
    return {
      status: march.phase,
      label: {
        outbound: '前往目标',
        gathering: '正在采集 · 物资未入库',
        returning: '运输中 · 返城后入库',
      }[march.phase],
      cargo: march.cargo,
    };
  return { status: 'historical', label: '历史装运记录 · 旧档无入库凭据', cargo: r.rewards };
}

export function progressSummary(before: GameState, after: GameState) {
  const delta = (key: string) => (after.counters[key] ?? 0) - (before.counters[key] ?? 0);
  const changed = (a: Record<string, number>, b: Record<string, number>) =>
    Object.keys(b)
      .filter((k) => k !== 'version' && b[k] > (a[k] ?? 0))
      .map((id) => ({ id, from: a[id] ?? 0, to: b[id] }));
  const refit = Object.keys(after.arsenal?.converted ?? {}).reduce(
    (n, k) => n + (after.arsenal!.converted[k] ?? 0) - (before.arsenal?.converted[k] ?? 0),
    0,
  );
  return {
    elapsed: after.now - before.now,
    resources: Object.fromEntries(
      [...resources, 'gold' as const].map((k) => [k, after.wallet[k] - before.wallet[k]]),
    ),
    buildings: changed(
      { ...before.buildings, ...before.industry },
      { ...after.buildings, ...after.industry },
    ),
    research: changed(before.tech, after.tech),
    produced: delta('produce') - refit,
    refitted: refit,
    repaired: delta('repair'),
    returns: (after.expeditionLog ?? [])
      .filter((v) => !(before.expeditionLog ?? []).some((b) => b.marchId === v.marchId))
      .map((receipt) => {
        const site = after.world.find((v) => v.id === receipt.targetId);
        // A fight may precede this rest interval; match its immutable march record.
        const battle = after.reports.find((r) => r.marchId === receipt.marchId);
        return {
          ...receipt,
          title: site ? `${site.name} [${site.x},${site.y}]` : receipt.targetId,
          losses: battle
            ? {
                repairable: battle.casualties.reduce((n, v) => n + v.repairable, 0),
                destroyed: battle.casualties.reduce((n, v) => n + v.destroyed, 0),
              }
            : null,
        };
      }),
    battles: after.reports
      .filter((r) => !before.reports.some((b) => b.id === r.id))
      .map((r) => ({
        id: r.id,
        title: r.title,
        winner: r.winner,
        repairable: r.casualties.reduce((n, v) => n + v.repairable, 0),
        destroyed: r.casualties.reduce((n, v) => n + v.destroyed, 0),
      })),
  };
}
