import { buildingBaseTime, MAX_LEVEL } from './growth';
export { MAX_LEVEL, growthLimits } from './growth';
import rules from '../../design/classic-prototype-rules.json';
import type { Building, Cost, Formation, Quest, UnitClass } from './types';
export { rules };
export const RULESET = rules.rulesetId;
export const unitList = rules.units;
// One source for industrial gates, milestone guidance and the core supply line.
export const vehicleUnlockLevels = Object.fromEntries(
  unitList.filter((u) => u.classId === 'tank').map((u) => [u.tier, u.unlock.factoryLevel]),
);
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
  titanium: '先进装甲不可或缺的稀有金属。指挥中心 6 级解锁。',
  crystal: '侦察、研究与伤兵修复都需要水晶。',
};
export { techNames, techDescriptions, researchTree, researchBranches } from './research';
export const classNames: Record<UnitClass, string> = {
  tank: '坦克',
  tank_destroyer: '歼击车',
  spg: '自行火炮',
  rocket: '火箭车',
};
export const classDescriptions: Record<UnitClass, string> = {
  tank: '逐列前排优先 · 一至三发 · 全队攻击 +5%',
  tank_destroyer: '对列首个目标 · 全队暴击 +5%',
  spg: '对列一至两发 · 降低穿甲伤害 10%',
  rocket: '六阵位固定六发 · 降低火箭伤害 10%',
};
// Rebuilt across all 120 levels; costs index the current level, rates the completed level.
export const costCurve = Array.from({ length: 121 }, (_, l) =>
  Math.ceil(1.125 * Math.max(1, l) ** 2.65),
);
export const durationCurve = Array.from({ length: 121 }, (_, l) => buildingBaseTime(l));
export const rateCurve = Array.from({ length: 121 }, (_, l) => Math.round(10000 * l ** 1.35));
export const storageCurve = Array.from({ length: 121 }, (_, l) =>
  Math.ceil(600 * l ** 1.35 * (48 + (432 * Math.max(0, l - 1)) / 119)),
);
export function upgradeCost(building: Building, level: number): Cost {
  if (level >= MAX_LEVEL) return {};
  const c = costCurve[level];
  return {
    iron: (building === 'hq' ? 160 : 90) * c,
    oil: 60 * c,
    lead: 40 * c,
    crystal: building === 'lab' ? 30 * c : 0,
  };
}
export function researchCost(level: number): Cost {
  if (level >= MAX_LEVEL) return {};
  const scale = 1.2 * (level + 1) ** 2.65;
  return {
    // Apply v29's additional 50% to the rounded v28 research quote only.
    // Levels 1–5 remain reachable before HQ6 unlocks local titanium production.
    iron: Math.ceil((level < 5 ? 80 : 60) * scale),
    oil: Math.ceil((level < 5 ? 55 : 39) * scale),
    lead: Math.ceil((level < 5 ? 65 : 46) * scale),
    titanium: level < 5 ? 0 : Math.ceil(Math.ceil(Math.ceil(32 * scale) * 1.5) * 1.5),
    crystal: Math.ceil((level < 5 ? 26 : 17) * scale),
  };
}
const legacyStageNames = [
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
const legacyStageHints = [
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
function legacyStageFormation(index: number): Formation {
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
function legacyStageReward(index: number, first: boolean): Cost {
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
export const chapters = [
  { name: '边境序曲', theme: '边境警戒与黎明反攻', tier: 1 },
  { name: '山地防线', theme: '山口、隘道与纵深工事', tier: 2 },
  { name: '铁壁攻势', theme: '突破要塞与重炮封锁', tier: 3 },
  { name: '黄沙远征', theme: '荒漠油田与漫长补给线', tier: 4 },
  { name: '钢铁会战', theme: '工业基地与装甲决战', tier: 5 },
  { name: '极地突围', theme: '冰原边境与精锐集群', tier: 6 },
  { name: '终焉黎明', theme: '精密战车与最后防区', tier: 7 },
  { name: '破晓追击', theme: '越过旧防线，追击纵深装甲集团', tier: 7 },
  { name: '熔炉风暴', theme: '夺回钢铁工业带与重型军械库', tier: 7 },
  { name: '荒原铁流', theme: '贯穿沙海油田与长距离补给线', tier: 7 },
  { name: '寒锋壁垒', theme: '冰原要塞与密集防御集群', tier: 7 },
  { name: '最终攻势', theme: '精锐装甲总攻与指挥中枢决战', tier: 7 },
  { name: '长河渡口', theme: '跨河突击与桥头装甲防线', tier: 7 },
  { name: '群山回响', theme: '山岭隧道与纵深炮兵阵地', tier: 7 },
  { name: '焦土前沿', theme: '焦土工业带与补给据点争夺', tier: 7 },
  { name: '北境风暴', theme: '北境冰原与重装机动集群', tier: 7 },
  { name: '钢铁洪流', theme: '纵深装甲集结与战略反攻', tier: 7 },
  { name: '曙光之路', theme: '穿越最终防线，重建大陆交通网', tier: 7 },
  { name: '远海登陆', theme: '跨海桥头与沿岸登陆场', tier: 7 },
  { name: '峡谷壁垒', theme: '狭长峡谷与高地防线', tier: 7 },
  { name: '赤沙军团', theme: '沙漠补给线与装甲集群', tier: 7 },
  { name: '群岛封锁', theme: '岛链据点与港口争夺', tier: 7 },
  { name: '高原长征', theme: '高原山口与纵深运输线', tier: 7 },
  { name: '雷霆走廊', theme: '铁路枢纽与机械化突击', tier: 7 },
  { name: '冰河战线', theme: '冰河渡口与极地集结场', tier: 7 },
  { name: '黑石堡垒', theme: '采矿要塞与地下军械设施', tier: 7 },
  { name: '远东烽火', theme: '密林山地与边境军团', tier: 7 },
  { name: '熔钢之城', theme: '重工业城区与工厂守军', tier: 7 },
  { name: '苍穹防线', theme: '山顶雷达站与远程火力网', tier: 7 },
  { name: '荒漠风雷', theme: '沙海中的连续补给据点', tier: 7 },
  { name: '深蓝港湾', theme: '海岸仓库与重装港区', tier: 7 },
  { name: '钢铁天幕', theme: '连续堡垒与交叉火力阵地', tier: 7 },
  { name: '裂谷远征', theme: '裂谷交通线与精锐装甲军', tier: 7 },
  { name: '极夜反攻', theme: '极地防区与纵深反攻', tier: 7 },
  { name: '群星要塞', theme: '高地据点群与战略枢纽', tier: 7 },
  { name: '无尽前线', theme: '远征终点与更强的装甲防线', tier: 7 },
];
const chapterMissions = [
  '前沿侦察',
  '公路伏击',
  '翼侧接触',
  '补给走廊',
  '前哨肃清',
  '重炮阵地',
  '纵深穿插',
  '桥头争夺',
  '装甲集结',
  '侧翼包围',
  '油田防卫',
  '堡垒压制',
  '反击前线',
  '钢铁封锁',
  '最后防线',
  '决战黎明',
];
export const stageNames = Array.from(
  { length: chapters.length * 16 },
  (_, i) =>
    legacyStageNames[i] ?? `${chapters[Math.floor(i / 16)].name} · ${chapterMissions[i % 16]}`,
);
export const stageHints = stageNames.map(
  (_, i) =>
    legacyStageHints[i] ??
    `${chapters[Math.floor(i / 16)].theme}。观察混合兵阶与各阵位数量，运用克制和完整六格行动。`,
);
export function stageFormation(index: number): Formation {
  if (!Number.isInteger(index) || index < 0 || index >= stageNames.length)
    throw Error('战役不存在');
  if (index < 12) return legacyStageFormation(index);
  const chapter = Math.floor(index / 16),
    step = index % 16;
  const classes = ['tank', 'tank_destroyer', 'spg', 'rocket', 'tank', 'spg'];
  return Array.from({ length: 6 }, (_, slot) => {
    const tier = chapter === 0 ? 2 : Math.min(7, chapter + 1 + (step >= 12 && slot === 0 ? 1 : 0));
    return {
      unitId: `${classes[(slot + Math.floor(step / 4)) % 6]}_t${tier}`,
      // VII is the highest vehicle tier. Append strength through troop counts;
      // a 25-unit chapter step preserves the existing +floor(step*1.6) slope without boundary regression.
      count:
        chapter === 0
          ? 3 + index * 2
          : (chapter >= 7 ? 161 + (chapter - 7) * 25 : 16 + chapter * 20) + Math.floor(step * 1.6),
    };
  });
}
export function stageReward(index: number, first: boolean): Cost {
  const reward = legacyStageReward(index, first);
  if (index >= 12) reward.gold = first ? 15 + Math.floor(index / 16) * 5 : 0;
  return reward;
}
export function stageGrowth(index: number, first: boolean) {
  const prestige =
    index < 12 ? 10 + index * 5 : 50 + Math.floor(index / 16) * 150 + (index % 16) * 10;
  return {
    xp: (index + 1) * 50,
    books: first ? 1 : 0,
    skillPoints: first ? 1 : 0,
    // Scale the previous payout after repeat rounding, including the original odd early values.
    prestige: (first ? prestige : Math.floor(prestige / 2)) * 5,
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
    description: '通过第一章的前 12 关，领取老兵补给。',
    counter: 'cleared',
    target: 12,
    reward: { gold: 100, titanium: 500 },
    books: 10,
  },
];
