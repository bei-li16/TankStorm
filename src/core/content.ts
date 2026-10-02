import rules from '../../design/classic-prototype-rules.json';
import type { Building, Cost, Formation, Quest, Technology, UnitClass } from './types';
export { rules };
export const RULESET = rules.rulesetId;
export const unitList = rules.units;
export const units = Object.fromEntries(unitList.map((u) => [u.unitId, u]));
export const resourceNames = {
  iron: '铁矿',
  oil: '石油',
  lead: '铅矿',
  titanium: '钛矿',
  crystal: '水晶',
  gold: '金币',
};
export const buildingNames: Record<Building, string> = {
  hq: '指挥中心',
  lab: '科研中心',
  factory: '战车工厂',
  warehouse: '资源仓库',
  iron: '铁矿冶炼厂',
  oil: '石油精炼厂',
  lead: '铅矿采集场',
  titanium: '钛矿采集场',
  crystal: '水晶矿场',
};
export const buildingDescriptions: Record<Building, string> = {
  hq: '基地的心脏。提升等级，解锁更先进的建筑与研究。',
  lab: '每一次技术突破，都会成为战场上的优势。',
  factory: '从钢铁到战车。升级工厂，生产更强的装甲部队。',
  warehouse: '提高自然产出的储存上限，保护基地的战略储备。',
  iron: '装甲、履带与工事，始于持续运转的冶炼炉。',
  oil: '让引擎保持轰鸣。石油是生产战车的基础。',
  lead: '为前线提供充足弹药，保障部队持续扩张。',
  titanium: '先进装甲不可或缺的稀有金属。指挥中心 8 级解锁。',
  crystal: '侦察、研究与伤兵修复都需要水晶。',
};
export const techNames: Record<Technology, string> = {
  attack: '火控校准',
  hp: '复合装甲',
  production: '装配工艺',
  construction: '工程管理',
  gather: '野外后勤',
};
export const techDescriptions: Record<Technology, string> = {
  attack: '全兵种攻击 +5% / 级',
  hp: '全兵种生命 +5% / 级',
  production: '生产与修复速度 +5% / 级',
  construction: '建筑升级速度 +5% / 级',
  gather: '野外采集速度 +5% / 级',
};
export const classNames: Record<UnitClass, string> = {
  tank: '坦克',
  tank_destroyer: '歼击车',
  spg: '自行火炮',
  rocket: '火箭车',
};
export const classDescriptions: Record<UnitClass, string> = {
  tank: '横排齐射 · 全队攻击 +5%',
  tank_destroyer: '前排单体 · 全队暴击 +5%',
  spg: '纵列穿透 · 降低穿甲伤害 10%',
  rocket: '全体齐射 · 降低火箭伤害 10%',
};
// Checked-in integer progression tables. Level index is the current level.
export const costCurve = [
  1, 1, 2, 2, 3, 4, 6, 8, 11, 15, 20, 27, 37, 49, 67, 90, 122, 164, 222, 299, 404,
];
export const durationCurve = [
  0, 30000, 39000, 50700, 65910, 85683, 111388, 144804, 188245, 244719, 318135, 413575, 537648,
  698942, 908622, 1181209, 1535571, 1996243, 2595116, 3373652, 4385748,
];
export const rateCurve = [
  0, 10000, 12000, 14400, 17280, 20736, 24883, 29860, 35832, 42998, 51598, 61917, 74301, 89161,
  106993, 128391, 154070, 184884, 221861, 266233, 319480,
];
export function upgradeCost(building: Building, level: number): Cost {
  const c = costCurve[level];
  return {
    iron: (building === 'hq' ? 160 : 90) * c,
    oil: 60 * c,
    lead: 40 * c,
    crystal: building === 'lab' ? 30 * c : 0,
  };
}
export function researchCost(level: number): Cost {
  return { iron: 100 * (level + 1), lead: 80 * (level + 1), crystal: 30 * (level + 1) };
}
export const stageNames = [
  '边境哨卡',
  '公路遭遇',
  '侧翼突破',
  '纵深防线',
  '山口封锁',
  '钢铁堡垒',
  '荒原追击',
  '燃烧油田',
  '装甲集群',
  '重炮阵地',
  '最后防线',
  '黎明行动',
];
export const stageHints = [
  '轻型守军。让坦克承担正面火力。',
  '歼击车克制坦克，尝试混合兵种。',
  '火箭车可同时压制多个目标。',
  '自行火炮攻击同一纵列，注意前后排。',
  '先补充兵力，修复之前的战损。',
  '工厂升级与科技研究同样重要。',
  '侦察、采矿，维持你的补给线。',
  '考虑中型战车，提升每格的战斗力。',
  '升级统率，增加单格带兵上限。',
  '用不同兵种的光环支援整个编队。',
  '让最坚固的装甲守住前排。',
  '组合科技、兵种与数量，完成最终突破。',
];
export function stageFormation(index: number): Formation {
  const types = ['tank', 'tank_destroyer', 'spg', 'rocket', 'tank', 'spg'];
  const n = index < 3 ? index + 1 : Math.min(6, index + 1);
  return Array.from({ length: 6 }, (_, i) =>
    i < n
      ? {
          unitId: `${types[(i + Math.floor(index / 3)) % 6]}_t${index >= 8 ? 2 : 1}`,
          count: 3 + index * 2,
        }
      : null,
  );
}
export function stageReward(index: number, first: boolean): Cost {
  const m = first ? 1 : 0.2;
  return {
    iron: Math.floor((250 + index * 150) * m),
    oil: Math.floor((180 + index * 120) * m),
    lead: Math.floor((160 + index * 100) * m),
    titanium: index >= 5 ? Math.floor(40 * (index - 4) * m) : 0,
    crystal: Math.floor((40 + index * 15) * m),
    gold: first ? 5 : 0,
  };
}
export const quests: Quest[] = [
  {
    id: 'welcome',
    name: '指挥官，欢迎归队',
    description: '领取首批补给，准备重建基地。',
    counter: 'started',
    target: 1,
    reward: { iron: 300, oil: 300, lead: 300 },
    books: 1,
  },
  {
    id: 'build',
    name: '重启建设',
    description: '完成 1 次建筑升级。',
    counter: 'build',
    target: 1,
    reward: { iron: 500, oil: 300, crystal: 50 },
    books: 1,
  },
  {
    id: 'produce',
    name: '钢铁洪流',
    description: '累计生产 10 辆战车。',
    counter: 'produce',
    target: 10,
    reward: { iron: 400, oil: 400, lead: 400 },
    books: 1,
  },
  {
    id: 'formation',
    name: '列队出发',
    description: '保存一次战斗编队。',
    counter: 'formation',
    target: 1,
    reward: { crystal: 50 },
    books: 1,
  },
  {
    id: 'stage',
    name: '首战告捷',
    description: '赢得 1 场战役胜利。',
    counter: 'victory',
    target: 1,
    reward: { iron: 600, oil: 400, lead: 400, gold: 10 },
    books: 2,
  },
  {
    id: 'research',
    name: '科技的力量',
    description: '完成 1 次科技研究。',
    counter: 'research',
    target: 1,
    reward: { crystal: 100 },
    books: 1,
  },
  {
    id: 'scout',
    name: '知己知彼',
    description: '完成 1 次世界侦察。',
    counter: 'scout',
    target: 1,
    reward: { crystal: 30 },
  },
  {
    id: 'gather',
    name: '补给线',
    description: '从世界带回至少 100 份物资。',
    counter: 'cargo',
    target: 100,
    reward: { iron: 500, oil: 500, lead: 500 },
    books: 2,
  },
  {
    id: 'repair',
    name: '重返前线',
    description: '修复 1 辆受损战车。',
    counter: 'repair',
    target: 1,
    reward: { crystal: 100 },
    books: 1,
  },
  {
    id: 'campaign',
    name: '黎明的曙光',
    description: '通过全部 12 个经典战役。',
    counter: 'cleared',
    target: 12,
    reward: { gold: 100, titanium: 500 },
    books: 10,
  },
];
