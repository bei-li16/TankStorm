import { MAX_LEVEL, materialSavingBps, economyBonus } from './growth';
import { combatResearch, defenseReduction } from './combat_research';
import type { Cost, GameState, Technology } from './types';

export const legacyTech = ['attack', 'hp', 'production', 'construction', 'gather'] as const;
export const researchBranches = [
  { id: 'economy', name: '经济发展' },
  { id: 'industry', name: '工业工程' },
  { id: 'logistics', name: '远征后勤' },
  { id: 'combat', name: '战斗技术' },
];
type Node = {
  id: Technology;
  name: string;
  branch: string;
  col: number;
  row: number;
  lab: number;
  step: number;
  effect: string;
  prerequisites: { id: Technology; level: number }[];
};
const node = (
  id: Technology,
  name: string,
  branch: string,
  col: number,
  row: number,
  lab: number,
  step: number,
  effect: string,
  prerequisites: [Technology, number][] = [],
): Node => ({
  id,
  name,
  branch,
  col,
  row,
  lab,
  step,
  effect,
  prerequisites: prerequisites.map(([id, level]) => ({ id, level })),
});
export const researchTree: Node[] = [
  node('resourceOutput', '资源统筹', 'economy', 0, 1, 1, 5, '全部资源自产'),
  node('ironOutput', '高炉冶炼', 'economy', 1, 0, 2, 8, '铁矿自产', [['resourceOutput', 2]]),
  node('oilOutput', '石油精炼', 'economy', 1, 1, 2, 8, '石油自产', [['resourceOutput', 2]]),
  node('leadOutput', '铅矿选矿', 'economy', 1, 2, 2, 8, '铅矿自产', [['resourceOutput', 2]]),
  node('titaniumOutput', '钛合金提纯', 'economy', 2, 0, 6, 8, '钛矿自产', [
    ['ironOutput', 3],
    ['leadOutput', 3],
  ]),
  node('crystalOutput', '水晶培育', 'economy', 2, 1, 5, 8, '水晶自产', [['oilOutput', 3]]),
  node('storage', '立体仓储', 'economy', 2, 2, 4, 5, '自产储存上限', [['leadOutput', 2]]),
  node('construction', '工程管理', 'industry', 0, 1, 1, 5, '建筑建设速度'),
  node('researchSpeed', '实验室管理', 'industry', 1, 0, 3, 5, '科研速度', [['construction', 2]]),
  node('production', '装配工艺', 'industry', 1, 1, 2, 5, '制造、改装和维修速度', [
    ['construction', 2],
  ]),
  node('materials', '材料利用', 'industry', 1, 2, 5, 1, '建设、制造、改装和维修资源节省', [
    ['construction', 3],
    ['production', 3],
  ]),
  node('refitSpeed', '模块化改装', 'industry', 2, 0, 6, 8, '额外改装速度', [['production', 3]]),
  node('repairSpeed', '战地维修', 'industry', 2, 2, 4, 8, '额外维修速度', [['production', 2]]),
  node('gather', '野外后勤', 'logistics', 0, 1, 1, 5, '采集速度'),
  node('march', '机动推进', 'logistics', 1, 0, 3, 5, '往返行军速度', [['gather', 2]]),
  node('cargo', '运输挂载', 'logistics', 1, 2, 3, 5, '部队载重', [['gather', 2]]),
  node('survey', '矿脉勘测', 'logistics', 2, 1, 8, 5, '额外采集速度', [
    ['gather', 5],
    ['march', 3],
  ]),
  node('attack', '火控校准', 'combat', 0, 0, 1, 5, '全兵种攻击'),
  node('hp', '复合装甲', 'combat', 0, 3, 1, 5, '全兵种生命', [['attack', 1]]),
  node('ballistics', '精密弹道', 'combat', 1, 0, 6, 2, '额外攻击', [
    ['attack', 3],
    ['hp', 3],
  ]),
  node('armorPlating', '反应装甲', 'combat', 1, 3, 8, 3, '生命与基础防御', [['hp', 5]]),
  node('accuracy', '稳定瞄准', 'combat', 0, 1, 6, 0.15, '命中加成', [['attack', 3]]),
  node('critical', '弱点锁定', 'combat', 1, 1, 10, 0.2, '暴击率加成', [['ballistics', 3]]),
  node('criticalDamage', '毁伤强化', 'combat', 2, 1, 14, 0.5, '额外暴击伤害', [['critical', 5]]),
  node('evasion', '规避机动', 'combat', 0, 2, 8, 0.2, '闪避加成', [
    ['hp', 3],
    ['march', 3],
  ]),
  node('armorResistance', '抗爆装甲', 'combat', 1, 2, 12, 0.1, '装甲抗暴', [['armorPlating', 3]]),
  node('defense', '纵深防护', 'combat', 2, 2, 16, 0.25, '比例减伤', [
    ['hp', 5],
    ['armorResistance', 3],
  ]),
];
export const version1Tech = researchTree.filter((t) => !(t.id in combatResearch)).map((t) => t.id);
export const techNames = Object.fromEntries(researchTree.map((t) => [t.id, t.name])) as Record<
  Technology,
  string
>;
export const techDescriptions = Object.fromEntries(
  researchTree.map((t) => [
    t.id,
    t.id === 'defense'
      ? '每级减伤评级+25；比例减伤=评级/(10000+评级)，120级23.08%；在基础防御抵扣后结算，保留原科研收益'
      : t.id === 'armorPlating'
        ? '每级生命+3%、车辆基础防御+2%；防御先按目标组存活车数抵扣攻击，不影响装甲抗暴'
        : t.id in combatResearch
          ? `${t.effect}：每级+${t.step}个百分点${t.id === 'criticalDamage' ? '，在基础暴击额外50%上叠加' : ''}`
          : t.id === 'materials'
            ? `${t.effect}：每级0.5%，最高60%`
            : t.branch === 'economy' || ['gather', 'survey', 'cargo'].includes(t.id)
              ? `${t.effect}：${t.step * 40}%×(等级/120)^0.8，按完整曲线递增`
              : `${t.effect} +${t.step}% / 级${t.branch === 'industry' ? '（只加速可变工序）' : ''}`,
  ]),
) as Record<Technology, string>;
export const techLevel = (s: Pick<GameState, 'tech'>, id: Technology) => s.tech[id] ?? 0;
export function enableResearch(s: GameState) {
  if (s.researchVersion === 2) return;
  for (const t of researchTree) s.tech[t.id] ??= 0;
  s.researchVersion = 2;
}
export function researchRequirements(s: GameState, id: Technology) {
  const node = researchTree.find((t) => t.id === id)!;
  const next = techLevel(s, id) + 1;
  const lab = Math.max(node.lab, Math.min(MAX_LEVEL, next));
  const prerequisites = node.prerequisites.map((p) => ({
    ...p,
    level: Math.max(p.level, Math.ceil(Math.min(MAX_LEVEL, next) / 2)),
    current: techLevel(s, p.id),
  }));
  const block =
    next > MAX_LEVEL
      ? '已达最高等级'
      : s.buildings.lab < lab
        ? `需要科研中心 ${lab} 级`
        : prerequisites
            .filter((p) => p.current < p.level)
            .map((p) => `${techNames[p.id]} ${p.level} 级`)
            .join('、');
  return {
    lab,
    prerequisites,
    block: block && next <= MAX_LEVEL && s.buildings.lab >= lab ? `前置需要：${block}` : block,
  };
}
export function materialCost(s: GameState, cost: Cost): Cost {
  return Object.fromEntries(
    Object.entries(cost).map(([r, n]) => [
      r,
      r === 'gold'
        ? n
        : Math.ceil((n * (10000 - materialSavingBps(techLevel(s, 'materials')))) / 10000),
    ]),
  );
}

export function researchEffect(id: Technology, level: number) {
  const node = researchTree.find((t) => t.id === id)!;
  return id === 'defense'
    ? 100 * defenseReduction(level * combatResearch.defense)
    : id === 'materials'
      ? materialSavingBps(level) / 100
      : node.branch === 'economy' || ['gather', 'survey', 'cargo'].includes(id)
        ? economyBonus(level, node.step)
        : node.step * level;
}
