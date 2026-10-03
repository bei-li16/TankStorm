import { advance, leadershipCap, usableFormation, type ResourceAccounting } from './engine';
import { productionQuote, dungeons, dungeonBlock } from './arsenal';
import { quests, units, classNames, stageNames, vehicleUnlockLevels } from './content';
import { progressSummary } from './overview';
import type { GameState, Cost, UnitClass } from './types';

// Uses a clone without expeditions: planning must not reveal unknown future battle outcomes.
export function restPreview(s: GameState, minutes: number) {
  if (![60, 480].includes(minutes)) throw Error('请选择休整 1 小时或 8 小时');
  const isolated = structuredClone(s);
  isolated.marches = [];
  const accounting: ResourceAccounting = { generated: {}, capacityLimited: [] };
  const projected = advance(isolated, isolated.now + minutes * 60000, accounting);
  return {
    ...progressSummary(isolated, projected),
    ...accounting,
    minutes,
    expeditions: s.marches.map((m) => ({
      id: m.id,
      targetId: m.targetId,
      phase: m.phase,
      dueIn: Math.max(0, m.dueAt - s.now),
    })),
    note: '仅预计当前基地作业与自产；不含行军收益、战损及预览之后的新操作。确认后按真实状态结算。',
  };
}

export function coreBudget(
  s: GameState,
  classId: UnitClass,
  tier: number,
  count: number,
  factory: 'factory' | 'factory2' = (s.industry?.factory2 ?? 0) > s.buildings.factory
    ? 'factory2'
    : 'factory',
) {
  if (
    !classNames[classId] ||
    ![6, 7].includes(tier) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 10000 ||
    !['factory', 'factory2'].includes(factory)
  )
    throw Error('核心计划参数无效');
  const unitId = `${classId}_t${tier}`,
    coreId = `${classId}_core${tier}`;
  const options = dungeons.filter((d) => d.classId === classId);
  const unlocked = options.filter((d) => !dungeonBlock(s, d));
  const dungeon = unlocked[unlocked.length - 1] ?? options[0];
  const drop = dungeon.drops.find((d) => d.id === coreId)!;
  const needed = Math.max(0, count - (s.arsenal?.cores[coreId] ?? 0));
  const first = !(s.arsenal?.cleared ?? []).includes(dungeon.id);
  const wins = (yieldPerWin: number) =>
    needed <= 0
      ? 0
      : (first ? 1 : 0) + Math.ceil(Math.max(0, needed - (first ? drop.first : 0)) / yieldPerWin);
  const plan = (mode: 'produce' | 'refit') => {
    const q = productionQuote(s, unitId, mode, mode === 'produce' ? factory : 'refit');
    return {
      facility: q.facility,
      cost: Object.fromEntries(
        Object.entries(q.unitCost).map(([key, n]) => [key, n * count]),
      ) as Cost,
      duration: q.duration * count,
      source: q.sourceUnitId,
      sourceCount: q.sourceUnitId ? count : 0,
      sourceShortage: q.sourceUnitId ? Math.max(0, count - s.available[q.sourceUnitId]) : 0,
      block: q.block,
    };
  };
  return {
    unitId,
    coreId,
    count,
    owned: s.arsenal?.cores[coreId] ?? 0,
    needed,
    victories: wins((drop.min + drop.max) / 2),
    victoriesMin: wins(drop.max),
    victoriesMax:
      drop.min > 0
        ? wins(drop.min)
        : needed <= (first ? drop.first : 0)
          ? needed > 0
            ? 1
            : 0
          : null,
    dungeonName: dungeon.name,
    dungeonBlock: dungeonBlock(s, dungeon),
    drop,
    dungeonId: dungeon.id,
    firstReward: drop.first,
    repeatReward: (drop.min + drop.max) / 2,
    manufacture: plan('produce'),
    refit: plan('refit'),
  };
}

export function progression(s: GameState) {
  const cap = leadershipCap(s);
  const filled = usableFormation(s).filter(
    (st) => st && units[st.unitId].tier >= 6 && st.count >= cap,
  ).length;
  const normal = (s.arsenal?.cleared ?? []).filter((id) =>
    dungeons.some((d) => d.id === id && d.coreId.endsWith('6')),
  ).length;
  const elite = (s.arsenal?.cleared ?? []).length;
  const cards = [
    {
      id: 'campaign',
      title: '完成经典战役',
      current: s.cleared.length,
      total: stageNames.length,
      page: 'campaign',
      purpose: '首通物资与指挥官成长',
    },
    {
      id: 'normal',
      title: '四车系核心补给线',
      current: normal,
      total: 4,
      page: 'campaign',
      purpose: '开放各类首胜核心与重复获取',
    },
    {
      id: 'factory',
      title: '完成高阶生产线',
      current: Math.max(s.buildings.factory, s.industry?.factory2 ?? 0),
      total: vehicleUnlockLevels[7],
      page: 'industry',
      purpose: '解锁 VII 阶制造能力',
    },
    {
      id: 'army',
      title: '六格高阶部队成型',
      current: filled,
      total: 6,
      page: 'army',
      purpose: `每格至少 VI 阶、当前统率 ${cap} 辆`,
    },
    {
      id: 'science',
      title: '攻防技术协同',
      current: Math.min(s.tech.attack, s.tech.hp),
      total: 10,
      page: 'research',
      purpose: '攻击与生命科技都达到 10 级',
    },
    {
      id: 'elite',
      title: '完成核心行动主线',
      current: elite,
      total: dungeons.length,
      page: 'campaign',
      purpose: '获取四车系 VII 阶精密核心',
    },
  ];
  const honors = ['tank', 'tank_destroyer', 'spg', 'rocket', 'low-loss'].map((id, i) => ({
    id,
    title: id === 'low-loss' ? '精英低战损胜利' : `${classNames[id as UnitClass]}限定挑战`,
    condition:
      id === 'low-loss'
        ? '正式精英副本获胜，损失不超过出战数 5%'
        : '正式精英副本获胜，所有出战阵位使用同一指定车系',
    done: (s.honors ?? []).some((h) => h.id === id),
    dungeonId: `core-${Math.min(i, 3) * 2 + 1}`,
  }));
  const quest = quests.find((q) => !s.claimed.includes(q.id));
  const next = quest
    ? {
        title: quest.name,
        condition: `${Math.min(s.counters[quest.counter] ?? 0, quest.target)}/${quest.target} · ${quest.description}`,
        purpose: '完成后在指挥官页领取任务奖励',
        page: 'commander',
      }
    : (() => {
        const card = cards.find((v) => v.current < v.total);
        if (card)
          return {
            title: card.title,
            condition: `${card.current}/${card.total}`,
            purpose: card.purpose,
            page: card.page,
          };
        const milestone = [40, 60, 80, 100, 120].find((level) => s.buildings.hq < level);
        if (milestone)
          return {
            title: `基地扩建至 ${milestone} 级`,
            condition: `指挥中心 ${s.buildings.hq}/${milestone}`,
            purpose: '提升建筑与科研等级上限；查看设施升级收益',
            page: 'base',
          };
        const honor = honors.find((v) => !v.done);
        return honor
          ? {
              title: honor.title,
              condition: honor.condition,
              purpose: '记录永久荣誉；物资沿用副本奖励',
              page: 'objectives',
            }
          : {
              title: '自由整备与精英演练',
              condition: '成长目标与五项荣誉均已完成',
              purpose: '优化编队与低损战术',
              page: 'objectives',
            };
      })();
  return { cards, honors, next };
}
