import { MAX_LEVEL } from './growth';
import {
  rules,
  classNames,
  vehicleUnlockLevels,
  chapters,
  stageNames,
  stageFormation,
  researchCost,
} from './content';
import { army, combatStats, extraFireChance, BATTLE_RULESET } from './battle';
import { BOOK_PRICE, leadershipChance, rankNames, prestigeRequired } from './commander';
import { researchTree, techDescriptions } from './research';
import { coreChapters, dungeons } from './arsenal';
import { vipLevels } from './vip';
import { protectionBps } from './protection';
import { WORLD_LEVELS } from './world';
import { INDUSTRY_UNLOCK } from './industry';

export type LibraryEntry = {
  id: string;
  category: string;
  title: string;
  summary: string;
  keywords: string;
  sections: { title: string; text: string }[];
  related: string[];
  destination: { page: string; label: string };
  sources: string[];
};
export const libraryCategories = [
  { id: 'battle', name: '交战规则' },
  { id: 'stats', name: '属性与战力' },
  { id: 'arsenal', name: '编队与军备' },
  { id: 'growth', name: '科技与成长' },
  { id: 'economy', name: '基地与时间' },
  { id: 'world', name: '世界行动' },
  { id: 'records', name: '存档与复盘' },
];
const pct = (bps: number) => `${bps / 100}%`;
const b = rules.battle;
const values: Record<string, string> = {
  LEVEL_CAP: String(MAX_LEVEL),
  INDUSTRY_UNLOCK: String(INDUSTRY_UNLOCK),
  CHAPTER_COUNT: String(chapters.length),
  STAGE_COUNT: String(stageNames.length),
  CORE_CHAPTER_COUNT: String(coreChapters.length),
  CORE_STAGE_COUNT: String(dungeons.length),
  CHAPTER_TABLE: chapters
    .map((ch, i) => {
      const a = stageFormation(i * 16).filter((st) => st !== null);
      const z = stageFormation(i * 16 + 15).filter((st) => st !== null);
      return `${i + 1}章 ${ch.name}：${a.reduce((n, st) => n + st.count, 0)}→${z.reduce((n, st) => n + st.count, 0)}辆（首关→末关，均为敌军合计）。`;
    })
    .join('\n'),
  RESEARCH_COSTS: [1, 5, 6, 20, 60, 100, 120]
    .map((target) => {
      const c = researchCost(target - 1);
      return `升至${target}级：铁 ${c.iron} / 油 ${c.oil} / 铅 ${c.lead} / 钛 ${c.titanium} / 水晶 ${c.crystal}。`;
    })
    .join('\n'),
  RESEARCH_DEPENDENCIES: researchTree
    .map(
      (t) =>
        `${t.name}：科研中心起始门槛${t.lab}级；${t.prerequisites.length ? t.prerequisites.map((p) => `${researchTree.find((v) => v.id === p.id)!.name}≥${p.level}级`).join('、') : '无前置科技'}。`,
    )
    .join('\n'),
  RANK_TABLE: rankNames
    .map((name, i) => {
      const first = i * 10 + 1;
      return `${first}—${first + 9}级 ${name}：起始累计声望${prestigeRequired(first)}，攻击/生命各+${(first - 1) / 10}%。`;
    })
    .join('\n'),
  PROTECTION_TABLE: [1, 20, 40, 60, 80, 100, 120]
    .map((l) => `${l}级 ${pct(protectionBps(l))}`)
    .join('；'),
  WORLD_LEVELS: WORLD_LEVELS.join(' / '),
  VIP_OTHER: vipLevels
    .map(
      (v) =>
        `VIP ${v.level}（累计${v.threshold}金币）：制造+${v.production}%、改装+${v.refit}%、科研+${v.research}%、经典战役经验+${v.xp}%、仓储+${v.storage}%、行军速度+${v.marchSpeed}%、专属每日金币${v.dailyGold}。`,
    )
    .join('\n'),
  UNLOCK_TABLE: Object.entries(vehicleUnlockLevels)
    .map(([tier, level]) => `第${tier}阶：工厂${level}级`)
    .join('；'),
  INIT_EXAMPLE: String(
    combatStats(
      army([
        { unitId: 'tank_t1', count: 100 },
        { unitId: 'tank_t7', count: 1 },
      ]),
    ).initiative,
  ),
  MAX_ROUNDS: String(b.maxRounds),
  HIT_BASE: pct(b.baseHitBps),
  HIT_MIN: pct(b.minHitBps),
  HIT_MAX: pct(b.maxHitBps),
  CRIT_BASE: pct(b.baseCritBps),
  CRIT_MAX: pct(b.maxCritBps),
  CRIT_MULT: String(b.critMultiplierBps / 10000),
  TD_AURA: pct(b.classProfiles.tank_destroyer.aura.value),
  TANK_AURA: pct(b.classProfiles.tank.aura.value),
  SPG_AURA: pct(b.classProfiles.spg.aura.value),
  ROCKET_AURA: pct(b.classProfiles.rocket.aura.value),
  EXTRA_EQUAL: pct(extraFireChance(100, 100)),
  EXTRA_HIGH: pct(extraFireChance(150, 100)),
  EXTRA_LOW: pct(extraFireChance(100, 150)),
  REPAIR_RATE: pct(b.losses.stage.repairableBps),
  BOOK_PRICE: String(BOOK_PRICE),
  MATCHUPS: Object.entries(classNames)
    .map(
      ([id, name]) =>
        name +
        ' → ' +
        rules.matchup
          .filter((m) => m.attackerClass === id)
          .map(
            (m) =>
              classNames[m.defenderClass as keyof typeof classNames] +
              ' ×' +
              m.multiplierBps / 10000,
          )
          .join('；'),
    )
    .join('\n'),
  TECH_COUNT: String(researchTree.length),
  TECH_LIST: researchTree.map((t) => `${t.name}：${techDescriptions[t.id]}。`).join('\n'),
  LEADERSHIP_CHANCES: [10, 11, 20, 40, 60, 80, 100, 120]
    .map((n) => `升至${n}级：${pct(leadershipChance(n))}`)
    .join('；'),
  CORE_TABLE: coreChapters
    .map((name, i) => {
      return (
        `${i + 1}章 ${name}（16关）：\n` +
        [0, 1, 2, 3]
          .map((block) => {
            const d = dungeons[i * 16 + block * 4];
            return `第${block * 4 + 1}—${block * 4 + 4}关：制造工厂${d.factoryLevel}级；首胜 VI / VII 为${d.drops[0].first} / ${d.drops[1].first}；重复 VI ${d.drops[0].min}—${d.drops[0].max}，VII ${d.drops[1].min}—${d.drops[1].max}。`;
          })
          .join('\n')
      );
    })
    .join('\n'),
  VIP_TABLE: vipLevels
    .map(
      (v) => `VIP ${v.level}：${v.building} / ${v.waiting} / ${v.marches} / ${v.freeMinutes}分钟`,
    )
    .join('\n'),
};
const resolveText = (text: string) =>
  text.replace(/\$([A-Z_]+)/g, (_, key: string) => {
    if (!(key in values)) throw Error('Unknown library rule: ' + key);
    return values[key];
  });
// Player-facing explanations describe this edition. Sources are maintenance metadata.
const authored: LibraryEntry[] = [
  {
    id: 'initiative',
    category: 'battle',
    title: '先手：谁先开火',
    summary: '比较双方指挥官先手；同值时进攻方先攻。',
    keywords: '先攻 先手值 行动顺序 平手 机动推进 战场预判',
    sections: [
      {
        title: '指挥官先手',
        text: '指挥官先手 = 100 + 机动推进科技等级×3 + 战场预判技能等级×3。先手属于指挥官，兵阶、兵种、数量、空阵位不影响数值。',
      },
      {
        title: '双方怎样比较',
        text: '直接比较双方指挥官的先手值，高者先攻；相同时进攻方先攻。常规战役、核心行动和主动世界出征中，玩家是进攻方。',
      },
      {
        title: '不是按车辆数量加权',
        text: '例如没有科技和技能加成时，指挥官先手为100；不论带I阶还是VII阶，一组还是六组，均为100。不按车辆或阵位求和、平均。',
      },
      {
        title: '开战后固定',
        text: '团队数值在出战时固定，伤亡不会改变本场先手。先手只决定每个大回合哪一方优先行动；本方内部仍按阵位1→6轮转，不给予额外攻击次数。',
      },
    ],
    related: ['turns', 'extra-fire'],
    destination: {
      page: 'army',
      label: '前往编队',
    },
    sources: ['src/core/battle.ts:army/combatStats/simulate'],
  },
  {
    id: 'turns',
    category: 'battle',
    title: '大回合、小回合与换手',
    summary: '每组每个大回合行动一次；少阵位一方用尽后等待。',
    keywords: '回合 交替 换手 小回合 大回合 阵亡',
    sections: [
      {
        title: '一轮如何进行',
        text: '每个大回合开始，双方存活阵位按1→6进入待行动队列。每个小回合，先手方取下一组开火，再由另一方取下一组。连击紧接当前组，属于同一次小回合。',
      },
      {
        title: '一组对六组',
        text: '若我方只有1组、敌方六组，且我方先手：我1→敌1→敌2→敌3→敌4→敌5→敌6，然后进入下个大回合。我的唯一一组不会在同一大回合循环攻击六次。',
      },
      {
        title: '阵亡与结束',
        text: '待行动单位已击毁就跳过，不给其他组额外轮次。一方全灭立即结束。第 $MAX_ROUNDS 个大回合双方全部行动（含连击）结束后，如双方仍有部队存活，判先手方失败，不进入下一回合。先手由出战时的先手值决定，与进攻方或防守方身份无关；同值时进攻方先手。旧战报保留原上限和结果。',
      },
    ],
    related: ['initiative', 'extra-fire'],
    destination: {
      page: 'doctrine',
      label: '查看六格图解',
    },
    sources: ['src/core/battle.ts:simulate'],
  },
  {
    id: 'hit-evasion',
    category: 'battle',
    title: '命中与闪避',
    summary: '默认命中95%；未命中不等于敌方拥有闪避加成。',
    keywords: '闪避 命中 未命中 accuracy evasion miss 概率',
    sections: [
      {
        title: '判定公式',
        text: '命中率 = $HIT_BASE + 攻击者命中加成 − 目标闪避加成，限制在 $HIT_MIN—$HIT_MAX。命中率与闪避的加减按百分点计算。未命中伤害为0，不显示暴击。',
      },
      {
        title: '当前闪避来源',
        text: '当前常规战车、科技和指挥官没有常驻命中或闪避加成来源，两项加成为0。零加成下仍有5%未命中机会。图书馆解释已有结算属性，不表示已经开放闪避科技。',
      },
      {
        title: '每个目标单独判定',
        text: '每个存活目标分别抽取命中结果。一轮火箭攻击可能部分命中、部分闪避；连击也重新判定。固定覆盖的空阵位只产生地面着弹，不抽命中/暴击，不计伤害、闪避或击毁。',
      },
      {
        title: '举例与概率含义',
        text: '假设特殊快照中命中加成3个百分点、目标闪避加成8个百分点：95%+3%−8%=90%。这是公式示例，当前没有这些常驻加成的培养渠道。95%不意味着每20次必命中19次，连续未命中仍可能发生。',
      },
    ],
    related: ['critical', 'damage'],
    destination: {
      page: 'attributes',
      label: '查看当前属性',
    },
    sources: ['src/core/battle.ts:army/simulate', 'design/classic-prototype-rules.json:battle'],
  },
  {
    id: 'critical',
    category: 'battle',
    title: '暴击、装甲与抗暴',
    summary: '暴击增加伤害；装甲属性在当前规则中降低暴击概率。',
    keywords: '暴击 装甲 抗暴 护甲 反应装甲 复合装甲',
    sections: [
      {
        title: '公式',
        text: '暴击率 = $CRIT_BASE + 攻击者暴击加成 − 目标装甲抗暴 + 本方歼击车光环，限制在0—$CRIT_MAX。命中后暴击伤害为普通伤害的 $CRIT_MULT 倍。',
      },
      {
        title: '当前数值与光环',
        text: '本方有存活歼击车时，全队暴击率增加 $TD_AURA，同车系多组不叠加。当前常规单车暴击、抗暴加成为0，因此通常10%，有歼击车光环时15%。',
      },
      {
        title: '两种装甲不要混淆',
        text: '战斗属性“装甲 / 抗暴”减少敌方暴击率，不是每发扣除固定伤害。科研“复合装甲”和“反应装甲”增加生命，属性表将它们的战力收益计入生命。',
      },
      {
        title: '公式示例',
        text: '假设暴击加成4个百分点、目标抗暴6个百分点，并有歼击车光环：10%+4%−6%+5%=13%。当前没有直接培养这两项常驻加成的渠道。',
      },
    ],
    related: ['auras-counters', 'effective-stats'],
    destination: {
      page: 'attributes',
      label: '查看属性表',
    },
    sources: ['src/core/battle.ts:simulate', 'src/core/research.ts'],
  },
  {
    id: 'extra-fire',
    category: 'battle',
    title: '连击与二次开火值',
    summary: '比较双方团队值，最多追加一次半威力的完整攻击。',
    keywords: '连击 连发 二次开火 三次齐射 额外攻击 概率',
    sections: [
      {
        title: '属性来源',
        text: '指挥官二次开火值 = 100 + 精密弹道科技等级×4 + 连击指挥技能等级×4。它是全军共享的指挥官属性，不随车型、兵阶、阵位和损失变化；每个行动单位均使用双方指挥官的数值判定。',
      },
      {
        title: '概率公式',
        text: '连击概率 = 10% +（本方值 − 敌方值）×0.1个百分点，限制在0%—35%。同值为 $EXTRA_EQUAL；高50点为 $EXTRA_HIGH；低50点为 $EXTRA_LOW。达到35%后继续提高差值，不再增加本场概率。',
      },
      {
        title: '什么时候触发',
        text: '常规攻击完成且敌方仍有存活单位时判定；成功则当前组立即按现存目标再做一次完整攻击，使用首次攻击50%的攻击力，再独立判定命中、暴击、克制、光环和减伤，然后换手。追加攻击不再次触发连击，也不占其他阵位的常规行动。',
      },
      {
        title: '连发与连击不同',
        text: '坦克每列优先前排、共一至三发，火炮对列一至两发、火箭六阵位固定六发，均为一次攻击内的连续射击。连击按50%攻击力再做一次完整攻击，并按当时敌阵重新选敌；同一攻击内的第2、3发不会减半。逐行动播放将该组常规攻击和连击一起播放。',
      },
    ],
    related: ['turns', 'targets'],
    destination: {
      page: 'army',
      label: '前往编队',
    },
    sources: ['src/core/battle.ts:army/extraFireChance/simulate'],
  },
  {
    id: 'targets',
    category: 'battle',
    title: '六阵位与攻击范围',
    summary: '前排1/2/3，后排4/5/6；坦克逐列优先前排。',
    keywords: '横排 纵列 单体 全体 前排 后排 三发 两发',
    sections: [
      {
        title: '六格布局',
        text: '前排1、2、3；后排4、5、6；纵列1↔4、2↔5、3↔6。战场斜向排列只是表现，规则仍使用固定阵位编号。',
      },
      {
        title: '四车系',
        text: '坦克：按第1→2→3列依次选敌，每列优先前排；前排为空或已击毁则打同列后排；整列无存活目标则跳过。每个非空列一发，共1至3发，坦克不向空位射击。例：敌方仅1/3/5存活时依次打1→5→3，共3发；仅1/3存活时打1→3，共2发；仅5存活时只打5，共1发。\n自行火炮：优先正对己方阵位所在列；该列有几个存活单位就打几发（1至2发），不向空位开火。\n歼击车：优先正对列的第一个存活单位；前排为空时可直接打同列后排。\n火炮和歼击车仅在整列为空时改选最近邻列，距离相同先小列号。例如我方2/5号对第2列，空列时依次检查第1、第3列；我方3/6号依次检查第3、第2、第1列。\n火箭车：依次向1至6号阵位射击，固定六发；空位留下弹坑，随地面后移。命中与暴击规则不变。整次攻击在开火前锁定目标，不在击毁前排后额外攻击同列后排；连击重新选敌。只有火箭车在歼灭最后目标后仍播完本次剩余空位射击。',
      },
      {
        title: '前排空缺',
        text: '坦克每列单独判断：其他列前排存活，不会阻止攻击本列暴露的后排。火炮覆盖选中列的所有存活目标；歼击车打选中列的第一个存活目标；火箭始终覆盖六个阵位，空位射击地面。',
      },
      {
        title: '射击次数',
        text: '坦克射击次数等于有存活目标的列数，而不是敌方总组数；同一列前后都有车也只打前排一发。攻击开始确定本次目标集合，不会因击毁前排就额外补射同列后排。连击重新选敌。火箭车始终六发。',
      },
    ],
    related: ['auras-counters', 'formation'],
    destination: {
      page: 'doctrine',
      label: '查看六格图解',
    },
    sources: ['src/core/battle.ts:attackTargets/simulate'],
  },
  {
    id: 'auras-counters',
    category: 'battle',
    title: '兵种克制与团队光环',
    summary: '克制按攻击方向查表；光环按存活车系判断。',
    keywords: '克制 增伤 减伤 光环 25% 20% 抵抗',
    sections: [
      {
        title: '完整克制表',
        text: '$MATCHUPS',
      },
      {
        title: '倍率含义',
        text: '×1.25表示伤害增加25%，×0.8表示减少20%，×1不增不减。必须按攻击者→目标的方向查表，不能把反方向自动当作倒数。',
      },
      {
        title: '四种光环',
        text: '坦克：全队攻击 +$TANK_AURA。\n歼击车：全队暴击率 +$TD_AURA。\n自行火炮：全队受到的歼击车伤害 −$SPG_AURA。\n火箭车：全队受到的火箭车伤害 −$ROCKET_AURA。',
      },
      {
        title: '叠加与失效',
        text: '同车系多组不叠加，不同车系可共同提供不同光环。每次攻击开始按当前存活车系重算；最后一组对应车系被消灭后，其光环对后续攻击失效。先手和连击团队值则固定于开战快照。',
      },
    ],
    related: ['damage', 'power'],
    destination: {
      page: 'doctrine',
      label: '查看攻击图解',
    },
    sources: ['src/core/battle.ts:simulate', 'design/classic-prototype-rules.json:matchup'],
  },
  {
    id: 'damage',
    category: 'battle',
    title: '伤害与生存数量',
    summary: '伤害整乘后向下取整；不足一辆的余血仍算一辆。',
    keywords: '伤害公式 总生命 血量 数量 有效伤害 溢出 取整',
    sections: [
      {
        title: '伤害公式',
        text: '命中伤害 = 存活车数×单车基础攻击×科技/战术/声望攻击倍率×坦克光环倍率×克制倍率×攻击模式倍率×暴击倍率×对应减伤倍率×本次开火系数。正常开火系数1，连击0.5。\n全部相乘后只向下取整一次；命中至少1伤害，未命中为0。当前四系模式倍率均为1。',
      },
      {
        title: '算例',
        text: '10辆轻型坦克，基础攻击20，无科研和指挥技能，非暴击打轻型火箭车：10×20×1.05（坦克光环）×1.25（克制）=262.5，最终262。每个目标各自计算，不把总伤害在横排均分。',
      },
      {
        title: '血量与车数',
        text: '阵位保存合计生命。存活数=合计余血/单车生命，向上取整。若单车100生命，201余血算3辆，200余血算2辆。输出使用开火时的存活数；最后一辆未击毁就仍有完整单车火力。',
      },
      {
        title: '有效伤害与战后',
        text: '有效伤害只计算真正扣掉的敌方生命，超过余血为溢出。战后幸存车辆恢复完整生命，被击毁车辆另分为待修和永久损失。',
      },
    ],
    related: ['hit-evasion', 'repair'],
    destination: {
      page: 'reports',
      label: '查看战报',
    },
    sources: ['src/core/battle.ts:simulate/survivors', 'src/core/overview.ts:battleSummary'],
  },
  {
    id: 'effective-stats',
    category: 'stats',
    title: '基础属性与有效属性',
    summary: '当前加成影响新出征；历史记录保留当时属性。',
    keywords: '基础 攻击 生命 科技 指挥官 快照 实际属性',
    sections: [
      {
        title: '攻击与生命',
        text: '攻击倍率=1+火控校准每级5%+精密弹道每级2%+战术指挥每级2%+真实声望等级超过1级的部分每级0.1%。\n单车生命=基础生命×（1+复合装甲每级5%+反应装甲每级3%+声望加成），向下取整。同组加成相加，克制、光环等另行相乘。页面单车攻击显示取整值；战斗保留基础攻击与倍率直到最终伤害取整，不能用页面整数逐步回算。',
      },
      {
        title: '三种口径',
        text: '白板只有车型自身数值。当前有效属性计入当前科研和指挥技能。历史战斗属性来自那场出征快照；不要用现在的属性反推旧战报。出征后升级科技也不会改写新式远征已经保存的战斗快照。',
      },
      {
        title: '载重与经济属性',
        text: '载重决定能带走多少资源，不直接增加伤害或命中。当前载重按七阶运输基准80/150/250/375/500/625/800，保留车系差异，乘基础保障5倍，再计运输挂载。旧远征保留出发时的载重记录。产量、建造和生产速度支持补给，但直接战力为0。',
      },
    ],
    related: ['power', 'research'],
    destination: {
      page: 'attributes',
      label: '查看属性表',
    },
    sources: ['src/core/battle.ts:army', 'src/core/vip.ts:unitLoad', 'src/core/engine.ts:march'],
  },
  {
    id: 'power',
    category: 'stats',
    title: '战力与属性贡献',
    summary: '同阶白板四系等分；战力便于比较养成，不承诺必胜。',
    keywords: '战力 总战力 满编 上限 分摊 贡献 增量',
    sections: [
      {
        title: '单车分数',
        text: '以中性目标计算覆盖伤害能力与有效生命，取乘积平方根，再相对该车型白板归一化到同阶统一基准，乘先手和二次开火提升因子。因此同阶四系白板等分，实际攻击范围与克制仍影响胜负。',
      },
      {
        title: '详细口径',
        text: '伤害能力=攻击×攻击倍率×覆盖数×命中率×（1+暴击率×0.5）。有效生命=生命/敌方命中率/（1+敌方暴击率×0.5）。中性敌方默认命中95%、暴击10%，再扣本车闪避、抗暴。\n覆盖数：坦克3、歼击车1、火炮2、火箭6。先手因子=1+相对白板先手提升/1000；连击因子=（1+0.5×对同车型白板的连击概率）/1.05。最终分数四舍五入。',
      },
      {
        title: '三个总量',
        text: '当前编队：已保存且当前可用的各组单车分×数量相加。\n库存最大可编：只从待命车辆中取总分最高的六组。\n六格满编上限：已解锁或曾获得的最高单车分×当前每格容量×6；这是成长潜力，不表示库存已足够。',
      },
      {
        title: '贡献如何相加',
        text: '白板基准单列；乘算属性按对数权重分摊增量，尾差归入最后有效项。满编额外统率容量单列。基础+容量+各属性增量恰等于总分；这不是“移除某项后减少多少”的反事实计算。',
      },
      {
        title: '战力以外的战术',
        text: '克制和依赖阵容的光环不重复加静态分；载重和经济收益直接为0。高战力仍可能因空位、范围浪费或克制劣势失败。',
      },
    ],
    related: ['effective-stats', 'auras-counters'],
    destination: {
      page: 'attributes',
      label: '查看战力贡献',
    },
    sources: ['src/core/power.ts', 'src/core/attributes.ts'],
  },
  {
    id: 'formation',
    category: 'arsenal',
    title: '编队、预留与库存',
    summary: '编队只是分配方案，正式出征才预留车辆。',
    keywords: '库存 预设 最大战力 最高兵阶 自动满编 数量',
    sections: [
      {
        title: '容量',
        text: '每格20+5×（统率等级−1）辆，最多六格；一格只放一种型号，同型号可占多格，但总数不能超过可用库存。拖动交换阵位不耗车。',
      },
      {
        title: '库存口径',
        text: '待命是当前可用；已编入是待命车辆的分配方案，不再次扣除。出征是已预留。待修是可修战损，维修中是已提交未交付，改装原车是已投入且不能出征。未生产出的车辆不计入现有总量。',
      },
      {
        title: '排布与保存',
        text: '自动满编用于快速配置；最大战力选可用总分最高六组；最高兵阶先选高级车，再比较整组战力，均受库存和统率限制。调整后保存才成为常用编队；战前修改在确认出战时提交。\n连续部署：先选左侧阵位，再选右侧候选车，点击部署。候选车保持选中；之后只需换阵位，再点击部署。每次按新阵位重新计算库存和统率上限；库存用尽时显示“无可分配库存”。不会自动换成其他型号或增加库存。',
      },
      {
        title: '预设',
        text: '保存预设记录已保存编队；命名、覆盖、删除在预设管理。加载时按1→6号阵位依次分配当前待命库存，同型号跨阵位共享库存，并遵守当前统率单格上限。数量不足会提示原计划、实际加载及逐阵位缺额，无车阵位留空；出征预留、待修、维修中均不算可用。原预设的车型和数量保持不变，补足库存后重新加载即可恢复；只有主动覆盖才改写预设。加载不消耗车辆，全空编队不能出战。有未保存草稿时需确认是否放弃。',
      },
    ],
    related: ['targets', 'production'],
    destination: {
      page: 'army',
      label: '调整编队',
    },
    sources: [
      'src/core/engine.ts:usableFormation/battleFormation/reserve',
      'src/core/power.ts:arrangedFormation',
    ],
  },
  {
    id: 'production',
    category: 'arsenal',
    title: '制造、MAX与交付',
    summary: '提交整批扣费，逐辆入库；MAX同时考虑核心和材料。',
    keywords: '生产 制造 MAX 时间 数量 费用 工厂',
    sections: [
      {
        title: '提交条件',
        text: '$UNLOCK_TABLE。\n两座制造工厂各按本厂等级解锁；改装要求改装厂与至少一座制造工厂同时达到目标兵阶门槛。13级指挥中心仍开放第二工厂和改装厂的建设。材料、核心及工作或等待位置也要满足。数量可手动输入，快捷50/100/500/MAX。MAX取材料、核心、原车和500辆批次上限中的最小值。新制造和改装每批最多500辆；旧存档已支付的订单按原数量、费用和速度完成。已有高阶车辆继续使用与维修，新订单按新门槛检查。',
      },
      {
        title: '费用和进度',
        text: '包括等待订单在内，材料与核心都在提交时扣除。每完成一辆入库一辆，整批剩余时间表示全部交付前还需多久。\n坦克偏铁、歼击车偏石油、自行火炮偏铅；另外两项约为主料的52%—58%。II—VII阶钛费用为铁油铅平均值先四舍五入，再乘1.5向上取整；火箭车铁/油/铅/钛约100:96:92:132。制造、改装再计材料利用科技折扣。轻型车不耗钛，保留6级指挥中心开放钛矿的流程。科研使用独立配方，见“科研材料与钛矿预算”；本轮科研加价不再次增加车辆制造或改装费用。',
      },
      {
        title: '制造速度',
        text: '100辆坦克的七阶基础时长依次为2/6/12/24/36/48/60小时；歼击车×0.9，火炮×1.05，火箭车×1.1，单车秒数向上取整。制造中70%为固定装配与验收工序，其余30%按“1+装配工艺加速+VIP加速+本厂效率”提速。本厂效率从1级0%连续增至120级100%。\n整批实际时长=单车时长×数量，再减一次VIP免费分钟。七阶100辆在60级工厂无科技时约49—60小时，满科技/工厂/VIP时约40—49小时。车间左侧列出单辆制造与改装材料、核心、原车及工时；订单区分别显示整批工时、排队等待、VIP减免后工时和预计全部交付时间。两个制造厂使用各自等级计算，即使同车同数量也可耗时不同。500辆的工时为100辆的5倍，再对整单扣一次VIP免费时长。提交时记录费用和速度，后续升级不改写旧订单。',
      },
      {
        title: '取消',
        text: '只退尚未完成部分的原始材料和核心。已完成车辆留在库存，已用材料不退，不会重复发车。',
      },
    ],
    related: ['queues', 'time'],
    destination: {
      page: 'factory',
      label: '前往工厂',
    },
    sources: [
      'src/core/arsenal.ts:productionQuote',
      'src/core/engine.ts:startJob/finishJob/cancel',
    ],
  },
  {
    id: 'refit',
    category: 'arsenal',
    title: '改装与两种核心',
    summary: '低一阶原车换高一阶；VI与VII核心对应不同目标兵阶。',
    keywords: '改装 核心 原车 原型 费用 七阶',
    sections: [
      {
        title: '原车和成本',
        text: '同车系低一阶原车一辆换目标车一辆。基础成本取目标成本减原车型成本，再应用材料利用折扣。需要改装厂及相应制造能力同时满足等级。',
      },
      {
        title: '核心用途',
        text: '目标VI阶用同系改装核心，目标VII阶用精密核心，制造或改装均每辆1核心。其他阶级不用核心，维修高阶车不额外消耗核心。',
      },
      {
        title: '时间和返还',
        text: '改装基础时间是目标制造时间60%，其中50%为固定工序，另50%计装配工艺、模块化改装、本厂效率与VIP加速。单批最多500辆，提交时占用原车；完工新车入库。取消未完成部分退回对应原车、核心和材料。',
      },
      {
        title: '来源与计划',
        text: '核心行动每关产出一个车系的两种核心。资源一览显示库存与订单占用；成长成本可比较制造/改装总材料、原车缺额和预计挑战次数。',
      },
    ],
    related: ['cores', 'repair'],
    destination: {
      page: 'industry',
      label: '前往工业区',
    },
    sources: ['src/core/arsenal.ts:productionQuote', 'src/core/engine.ts'],
  },
  {
    id: 'repair',
    category: 'arsenal',
    title: '战损、待修与批量送修',
    summary: '同型号合并损失后，80%向上取整可修，其余永久损失。',
    keywords: '战损 维修 全部修复 水晶 永久 80%',
    sections: [
      {
        title: '损失拆分',
        text: '正式战役、核心行动、世界战斗，均按同型号合并损失×$REPAIR_RATE向上取整为可修数，余下永久损失。损失2辆→可修2、永久0；损失7辆→可修6、永久1。不是每个阵位分别取整。',
      },
      {
        title: '演习',
        text: '演习展示模拟损失，但不实际扣库存，不增加待修或永久损失，不发奖励、不开新关。',
      },
      {
        title: '逐辆维修与批量送修',
        text: '维修车间可选型号和数量，不能超待修或材料预算；逐辆入库。\n水晶基础费用=向上取整[40%×Σ(v0.27制造材料量×水晶1级时产÷该材料1级时产)]，再计材料利用科技减免并向上取整。铁/油/铅/钛/水晶1级时产为600/400/330/150/100；本次增加钛制造费用不追加维修水晶费用；费用随车阶和车型提升，不随基地等级涨价，维修不另收核心。\n维修车间和结算页的“批量送修”使用相同材料与时间报价。1个工作位、3个等待位，每种车型一单；只安排空位能容纳的订单，其余保留待修。点击即扣料，按顺序逐辆入库；仅满足VIP免费时间的任务自动完成。已送修订单不重复收费或提前完成；取消按未完成数量退料、退回待修。材料不足整笔不执行，清单变化需刷新后重新点击。',
      },
      {
        title: '历史与当前',
        text: '永久损失不能修复。维修只更新当前库存，不改写历史战损；从旧战报点击批量送修，也只处理现在可修车辆，不重新生成历史损失。',
      },
    ],
    related: ['damage', 'replay'],
    destination: {
      page: 'repair',
      label: '前往维修车间',
    },
    sources: [
      'src/core/battle.ts:casualtySummary',
      'src/core/arsenal.ts:repairAllQuote',
      'src/core/engine.ts:repairAll',
    ],
  },
  {
    id: 'research',
    category: 'growth',
    title: '科技树、依赖与收益',
    summary: '科研中心与所有前置都要达标，依赖随目标等级提高。',
    keywords: '科研 科技 前置 等级 建造 生产 行军 资源',
    sections: [
      {
        title: '四个分支',
        text: '经济、工业、后勤、战斗共$TECH_COUNT项，每项最多$LEVEL_CAP级。经济增产与仓储；工业加速和省料；后勤提升行军、运力与采速；战斗提升攻防。',
      },
      {
        title: '门槛公式',
        text: '要升到L级，科研中心需达到“科技基础门槛”和L的较大者；每项前置达到“固定前置等级”和ceil(L/2)的较大者，多项同时满足。\n例如精密弹道升8级，需要科研中心8级，火控校准和复合装甲各4级。',
      },
      {
        title: '全部科技收益',
        text: '$TECH_LIST\n补充：机动推进每级另加先手3；精密弹道每级另加二次开火4。材料利用是降低材料费用，不是增加消耗。',
      },
      {
        title: '生效时间',
        text: '科研完成后生效；新订单与新出征使用新数值。已有订单速度、已保存远征快照和历史战报不会重算。',
      },
      {
        title: '研究材料',
        text: '科技目标1—5级消耗铁、石油、铅、水晶；目标6级起再计钛矿。v0.29研究钛费用在v0.28已取整金额上再增加50%并向上取整，其他研究材料不变。科研费用不享受材料利用折扣。研究计划提交时统一扣费，等待订单也预付；取消未完成订单按原支付快照退款，不按新配方重算。',
      },
    ],
    related: ['research-cost', 'research-paths'],
    destination: {
      page: 'research',
      label: '前往科技树',
    },
    sources: ['src/core/research.ts', 'src/core/vip.ts:researchDuration'],
  },
  {
    id: 'commander',
    category: 'growth',
    title: '统率、声望与升级概率',
    summary: '统率决定每格数量；10级后独立判定，无次数保底。',
    keywords: '统率 统帅 指挥官 书籍 声望 金币 120 概率 技能',
    sections: [
      {
        title: '等级与容量',
        text: '统率不设玩法等级上限，每格容量20+5×（统率−1），不能超过声望等级。声望等级=1+floor(sqrt(声望/40))，不设玩法等级上限；旧档保留已有统率对应的最低资格。顶部经验等级不是声望等级。',
      },
      {
        title: '军衔与声望收益',
        text: '真实声望每10级晋升一个军衔，达到上将后不再改变：列兵、下士、中士、上士、少尉、中尉、上尉、少校、中校、上校、少将、上将。升到L级需累计40×(L−1)²声望。每升1级，全队攻击与生命各+0.1%，120级为+11.9%，之后继续每级增加0.1%，与科技及战术指挥的百分比相加。旧档统率资格不额外发放声望属性。可在指挥官的军衔页面逐级查看门槛、加成和统率培养上限。',
      },
      {
        title: '获取与支付',
        text: '统率书可$BOOK_PRICE金币一本购买。每次升级用1本书，或直接花$BOOK_PRICE金币。买书不自动升级。经典战役仅首胜1本，核心仅首通获得章节序号数量的统率书；核心重复无书、声望减半、经验不减，任务和补给也可提供。',
      },
      {
        title: '概率速查',
        text: '$LEADERSHIP_CHANCES\n升至2—10级100%；11级起按指数曲线下降，120级及以后固定0.1%。失败不降级、不累积保底。',
      },
      {
        title: '平均不等于保证',
        text: '0.1%平均1000次，可能1次成功，也可能连续200次失败。批量1/10/100/1000次只是上限，成功即停，只扣实际次数；开始前需有整批预算。培养页直接选择1、10、100或1000次；点击即执行，无二次确认；全部升级记录按最新在前分页查看，每批保存逐次判定、实际费用与时间。旧档仅能迁入原有最后一批汇总，无法恢复更早记录。',
      },
      {
        title: '指挥技能',
        text: '战术指挥每级攻击+2%；战场预判每级先手+3；连击指挥每级二次开火+4。三项各最多$LEVEL_CAP级，每级消耗1技能点，影响新出征和当前战力。战役首通提供技能点；指挥中心21级起每日补给额外1点，可持续获取。指挥官经验等级上限也为120。',
      },
    ],
    related: ['initiative', 'extra-fire'],
    destination: {
      page: 'commandTraining',
      label: '培养统率与技能',
    },
    sources: ['src/core/commander.ts', 'src/core/engine.ts:leadership'],
  },
  {
    id: 'campaign',
    category: 'growth',
    title: '经典战役与再次挑战',
    summary: '$CHAPTER_COUNT章$STAGE_COUNT关；正式胜利才推进主线。',
    keywords: '战役 章节 关卡 首通 重复 再次挑战',
    sections: [
      {
        title: '推进',
        text: '主线$CHAPTER_COUNT章，每章16关，通过敌军兵阶、数量和混合配置提升难度。正式胜利开放下一关；原12关进度保留在第一章。已过关可以重复挑战。第8章起每章首关的单格兵力比上章首关+25，章内按floor(关卡序号从0起×1.6)增加；车辆最高VII阶，但敌军数量与难度延伸没有封顶。',
      },
      {
        title: '奖励',
        text: '经典战役首通给技能点1、统率书1、声望、金币、资源和经验。重复胜利仅给资源、声望和正常经验；无金币、技能点或统率书，声望为首通一半向下取整。原有重复资源数量保持不变。核心行动保留独立掉落规则。演习没有奖励和解锁，跳过动画不取消结算；已结算旧战报不改写、不追扣。',
      },
      {
        title: '再次挑战',
        text: '结果页直接用当前已保存且可用编队开战，不再弹战前编队。损失导致可用数下降；需要补兵或换车时先从结果页进入维修、编队和制造。',
      },
      {
        title: '章节与守军规模',
        text: '$CHAPTER_TABLE\n第8章起以VII阶为主继续增加组内数量，当前没有VIII阶车。经典守军不附加玩家科技与指挥官加成；核心行动和世界守军另有科技强度。',
      },
    ],
    related: ['cores', 'formation'],
    destination: {
      page: 'campaign',
      label: '前往经典战役',
    },
    sources: ['src/core/content.ts:stageReward/stageGrowth', 'src/core/engine.ts:battle'],
  },
  {
    id: 'cores',
    category: 'growth',
    title: '核心主线与随机掉落',
    summary: '核心$CORE_CHAPTER_COUNT章各16关、共$CORE_STAGE_COUNT关；一关只产一个车系的两种核心。',
    keywords: '核心 副本 首通 随机 概率 产量 主线 原核心',
    sections: [
      {
        title: '开放规则',
        text: '核心$CORE_CHAPTER_COUNT章各16关，每四关依次为坦克、歼击车、自行火炮、火箭车。同系每章有四个逐渐加强的补给点。需通过前一关并满足制造工厂等级，任一制造工厂达标即可。章节首关承接上章第16关。旧16关对应前四章各自前四关；原已通关节点可重打并继续后续，新增关卡需正常突破，不追补旧首通奖励。核心库存、维修和历史战报保持不变。',
      },
      {
        title: '数量与门槛',
        text: '$CORE_TABLE\n第10章起，守军科技承接上章末级+2，每章内增长22级，后续不封顶；兵力从上章末关每格+5开始，章节内增幅逐章+5。VI/VII核心重复区间每章下限+8、上限+10。工厂准入保持120级，守军科技不受玩家科研120级上限限制；旧1—9章保持原值。',
      },
      {
        title: '随机规则',
        text: '每次重复胜利，两种数量分别在各自闭区间内等概率取整数，不共用总数量，只掉本关车系。第一章前8关的VII下限为0，所以可能无精密核心；后续两种区间的下限都至少1。重复产出每四关提高，后期需要同时提升兵力、科技和克制配置。',
      },
      {
        title: '结算',
        text: '首通固定、重复随机，实际结果写入本场战报。失败和演习不掉落；跳过、回放、重新打开或载入战后档，不重新抽取，不重复入库。',
      },
      {
        title: '预算含义',
        text: '成本计划优先用已开放最高产出同系关，列最快、按均值估算、最慢。区间含0且首通不足时，没有有限次数的最慢保证。预算不含前置关、失败和补兵。',
      },
    ],
    related: ['refit', 'replay'],
    destination: {
      page: 'campaign',
      label: '前往核心行动',
    },
    sources: [
      'src/core/arsenal.ts:dungeons/dungeonBlock',
      'src/core/engine.ts:dungeon',
      'src/core/planning.ts:coreBudget',
    ],
  },
  {
    id: 'resources',
    category: 'economy',
    title: '资源、仓储与库存口径',
    summary: '看清可用物资、订单投入、运输中以及满仓后的产出。',
    keywords: '矿产 金币 满仓 容量 库存 入库 资源生产',
    sections: [
      {
        title: '可用、订单投入、运输中',
        text: '可用资源可以立即支付。简写采用K=千、M=百万、G=十亿、T=万亿，最多两位小数并向下截取；仅改变显示，精确数量见资源详情或顶部悬停。订单在提交时扣除材料；订单投入表示尚未完成部分已支付的材料，不能再次消费。远征携带物资在回城前不能使用；胜利奖励与实际入库是不同时间点。',
      },
      {
        title: '仓库限制什么',
        text: '仓储上限限制基地自然产出；满仓时停止增加，超出的自然产出不会留存。采集归队也按当时剩余仓容入库，超出部分丢弃，收据列明实际入库和丢弃量。战斗奖励、据点突袭战利品及退款仍可超仓；已经持有的超仓余额不会削减。金币和核心不按矿产自产上限处理。保护额度为每项容量乘保护比例（仓库1级20%，120级40%，线性按基点取整），当前受保护=min(库存,额度)，可掠夺=max(0,库存−额度)。保护库存可正常消费；仓储科技/VIP增加容量也增加保护额度。当前单机无真人攻击或自动来袭；突袭NPC实际按对方保护库存结算。',
      },
      {
        title: '车辆口径',
        text: '待命库存是可用于新出征、改装的车辆。编队是待命库存上的出战计划，编入不会再次扣车；正式出征才预留并从可用库存移出。出征、待修和维修中分开统计。生产和维修每交付一辆就加入待命库存。',
      },
      {
        title: '产出如何成长',
        text: '1—120级统一曲线：资源基础时产=1级时产×等级^1.35（按实际规则取整）。1级铁/油/铅/钛/水晶时产为600/400/330/150/100，钛矿仍需指挥中心6级。基础仓储=同级基础铁时产×[48+432×(等级−1)/119]。\n资源统筹和仓储满级+200%，对应资源专精满级+320%，按“满级加成×(等级/120)^0.8”增长；两项增产相加，仓储另外乘其科技与VIP收益。材料利用每级节省0.5%，120级最多60%，所有非零费用至少1。顶部容量条表示每种资源的可用存量/自产容量；白色标尺是保护线，绿色是受保护库存，橙色是超过保护额度的可掠夺库存。金币无此上限。',
      },
    ],
    related: ['formation', 'time'],
    destination: {
      page: 'inventory',
      label: '查看资源一览',
    },
    sources: ['src/core/engine.ts', 'src/core/overview.ts'],
  },
  {
    id: 'queues',
    category: 'economy',
    title: '工业队列与 VIP 福利',
    summary: '工作线与等待位不同；VIP 不会将每个工厂变成多条制造线。',
    keywords: 'VIP 免费分钟 建造 科研 制造 等待 队列 加速',
    sections: [
      {
        title: '并行结构',
        text: '第一、第二坦克工厂各有 1 条制造线，改装厂另有 1 条改装线，维修车间独立 1 条维修线，科研中心 1 条研究线。第二制造工厂和改装厂在指挥中心 13 级开放建设；每座工厂的等级分别决定本厂可用兵阶。',
      },
      {
        title: '等待位与建设位',
        text: '每座制造／改装工厂、科研与维修均固定1个工作位和3个等待位，VIP0也可使用。等待位是已扣料订单，依序开工；不是并行工位，也不是待修车辆数。建设继续使用VIP并行建设位，同一建筑不能同时升级两次。旧档超过3个等待位的已付订单保留，消化至有空位后才能追加。',
      },
      {
        title: 'VIP 队列速查',
        text: '各行依次为：等级 / 并行建设 / 每厂／科研／维修等待位 / 可同时远征 / 免费时长。\n$VIP_TABLE',
      },
      {
        title: '免费完成与金币加速',
        text: '符合免费时长的整批任务自动完成；尚未轮到的订单先等待工作线。金币加速面向正在工作的项目，按扣除免费时长后的整批剩余分钟向上取整，每分钟 1 金币。具体可用福利与预计时间在下单前显示。',
      },
      {
        title: 'VIP 其他福利',
        text: '$VIP_OTHER\n速度福利仅加速相应可变工序；维修没有VIP专用速度加成，但享受免费完成。经验倍率目前用于经典战役胜利，核心与世界的成长奖励按各自表结算。VIP不增加资源自产速度。',
      },
    ],
    related: ['production', 'time'],
    destination: {
      page: 'queues',
      label: '查看全部队列',
    },
    sources: ['src/core/vip.ts', 'src/core/industry.ts'],
  },
  {
    id: 'time',
    category: 'economy',
    title: '休整、离线与时间推进',
    summary: '三种推进方式使用同一结算顺序；行军不享受 VIP 免费分钟。',
    keywords: '离线 休整 等待 时间 立即完成 资源损耗',
    sections: [
      {
        title: '正常等待与离线',
        text: '在线计时与读档时的离线结算均推进同一份游戏时钟。完成建设、研究、逐辆交付、远征到达和归队按实际事件顺序处理，等待订单会继续接替。已扣除的订单材料不会重复扣费。',
      },
      {
        title: '单机休整',
        text: '休整主动推进本存档的游戏时间，在基地输入1—720的整数小时后直接休整；记忆上次输入，下一次可以直接重复。结束后自动展示带资源图标的结算浮窗，包含实际资源增量、完成项目、满仓影响和远征结果；点击任意处关闭，内容较多时滚轮查看。推进的时段同样会触发世界敌军成长与满仓停产，不等于直接发放固定资源。',
      },
      {
        title: 'VIP 免费时长的准确含义',
        text: '建设、科研、制造／改装／维修整批剩余工作时长，以及采集剩余时长，进入 VIP 免费区间即自动完成。判断依据是整批剩余时间，不是每辆车都单独免一遍。出发和返程行军不适用免费分钟。',
      },
      {
        title: '升级与工业节奏',
        text: '建筑与科研的1—120级时长按连续里程碑增长。升至101—120级时，计入最高科技与VIP后，各项目仍在12小时—5天内。指挥中心、实验室、工厂较慢，资源设施较快；精密军事研究比资源研究更慢。\n建设和科研包含50%固定验收与试验时间，余下50%由相应科技提速；科研另计VIP科研速度，建设没有VIP专用速度加成。逐辆维修固定工序占25%。界面预计时间已计这些规则和VIP免费时长；不含队列等待时会另外说明。',
      },
      {
        title: '例子与边界',
        text: '若整批原需 20 分钟、免费时长 5 分钟且无需排队，预计 15 分钟后全部交付；若整批原需 4 分钟，立即完成。休整或离线跨越多个任务仍按顺序结算；具体结果受材料、守军、矿藏剩余和仓储容量影响。',
      },
    ],
    related: ['queues', 'travel'],
    destination: {
      page: 'settings',
      label: '前往存档／设置',
    },
    sources: ['src/core/engine.ts', 'src/core/vip.ts', 'src/core/planning.ts'],
  },
  {
    id: 'scouting',
    category: 'world',
    title: '侦察、守军与情报可靠性',
    summary: '未知不等于没有守军；侦察记录是当时的敌阵快照。',
    keywords: '世界 情报 未知 过期 侦察 守军 阵位',
    sections: [
      {
        title: '侦察费用与内容',
        text: '6级以内侦察消耗3水晶；更高级消耗该据点等级基础水晶产率的1/120，向上取整。记录目标资源、守军车系、兵阶、数量和阵位，以及侦察时间。选择世界目标可查看已知配置；未侦察的敌阵保持未知。',
      },
      {
        title: '判断可靠性',
        text: '无情报时无法据此判断安全。侦察显示无守军，指侦察当时为空；记录满 1 小时标为过期，建议重新侦察。世界据点会随时间补给和重建，战斗按到达时的实际守军计算；未满 1 小时的情报也只是当时快照。',
      },
      {
        title: '战前核对',
        text: '在出征确认页核对目标坐标、当前队伍、敌军已知阵位和往返时间。调整编队或使用预设后重新查看兵力与运力；已经出征的队伍保持自己的出发快照。',
      },
    ],
    related: ['travel', 'gather-raid'],
    destination: {
      page: 'world',
      label: '打开世界地图',
    },
    sources: ['src/core/world.ts', 'src/core/engine.ts', 'native/rules/bridge.ts'],
  },
  {
    id: 'travel',
    category: 'world',
    title: '出征、预留与返程',
    summary: '下一队预测不代表当前远征队；车辆和物资回城才进入可用库存。',
    keywords: '行军 往返 召回 预留 归队 快照 先手',
    sections: [
      {
        title: '出征时发生什么',
        text: '正式出征将本队车辆从待命库存预留，记录出发编队、战斗属性和运力加成。后续更换基地编队或提升科技不会改写这支队伍的出发战斗快照；旧存档缺少完整快照的远征按兼容规则处理。',
      },
      {
        title: '单程时间',
        text: '基础秒数 = 向上取整（目标与基地的直线格距 × 8），至少 1 秒。实际时间按（100＋VIP 行军速度加成＋机动推进等级 × 5）折算并向上取整，至少 1 秒。往返行军均不享受 VIP 免费完成。',
      },
      {
        title: '阶段与归队',
        text: '前往 → 到达作战 → 采集或携带战利品返回 → 归队入库。失败的生还者也会返程；可维修损失进入维修口径，永久损失不会自动补回。物资与生还车辆返城时加入可用库存。采集物资按归队时剩余仓容入库，超出部分丢弃；已有超仓库存不削减。战报页分别保留资源点进攻和采集归队记录，归队收据列出带回、实际入库、丢弃和战损；8小时休整与实时推进采用同一结算。',
      },
      {
        title: '归队档案与筛选',
        text: '战报统一保留最近400条，包括主线、核心、资源点进攻、据点突袭、采集归队、突袭归队和演习，可按类型和成功/失败筛选。新记录点击刷新后接入列表，避免误点；归队收据只能查看，关联战斗可回放，均不会再次入库。旧记录保持原快照，无凭据时不凭空补发。',
      },
      {
        title: '主动召回',
        text: '前往途中召回，返程按已经走过的时间计算且不超过原单程时间；采集中召回结束采集并返程。已经返程的队伍无需再次召回。以远征队自己的阶段与预计归队时间为准。',
      },
    ],
    related: ['scouting', 'gather-raid'],
    destination: {
      page: 'world',
      label: '查看远征队伍',
    },
    sources: ['src/core/engine.ts', 'src/core/vip.ts'],
  },
  {
    id: 'gather-raid',
    category: 'world',
    title: '采集量、载重与世界突袭',
    summary: '分别看计划量、实际采集和实际入库；战损会减少最终运力。',
    keywords: '载重 采矿 收益 矿藏 采集速度 突袭 抢夺',
    sections: [
      {
        title: '计划与实际',
        text: '矿点计划采集量取出征载重与矿藏剩余量的较小值。占领前的战斗可能造成车辆损失，战后按生还车辆和出发时的载重加成重新计算运力；矿藏变化也会影响最终数量。不能把出发预测当作保证奖励。',
      },
      {
        title: '载重与速度',
        text: '新远征：单车运输基准按七阶80/150/250/375/500/625/800，乘车型原载重相对同阶坦克的比例，再乘5×(1+运输挂载加成)，单车取整后按数量相加。采速=矿点等级对应同类资源基础自产×8×(1+野外后勤加成+矿脉勘测加成)。高级基地采低级矿不会自动提高矿点基础产率。三种后勤科技各为+200%×(等级/120)^0.8。时间=目标量/采速，再减VIP免费时长；出征时保存每种单车载重、采速和行军时间，科技升级不改写在途队伍。',
      },
      {
        title: '矿点恢复',
        text: '世界按五类资源各设1—120级固定区域，随距离逐步提升。矿储上限取“该级同类基础自产128小时”和“两支同等级参考满编运力”的较大值，向上取4的倍数；参考运力按矿点等级的统率、载重科技与地区兵阶，六格满编计算，不随当前选择的编队变化；无任何在途/采集/返回队伍锁定该点时，每小时恢复1/4。已清除守军会在矿藏重新补满时恢复，附近两座安全矿例外。六格守军随等级提高兵阶、数量与军事实力（科技等级为据点等级的一半）；敌军据点比同级矿点驻军更强。已有队伍采集时，后到队伍不能重复占用。旧矿储按剩余比例迁移；已有远征锁定的矿点归队后才迁移，采速、守军与在途计划不变。',
      },
      {
        title: '敌军据点突袭',
        text: '胜利后按生还载重装载可掠夺资源并直接返程，无矿点采集等待。新版据点每种资源容量为该级对应基础自产的4小时，最低10K，保护比例从20%随据点等级升至40%；每小时补充2小时基础产量，按原车材料费重建最多1/4的守军。按铁、油、铅、钛、水晶顺序装载至载重上限，不掠夺金币。旧存档被在途队伍锁定的目标会等归队后再升级地区规则，旧队伍载重和采速不变。',
      },
    ],
    related: ['resources', 'travel'],
    destination: {
      page: 'world',
      label: '查看采集计划',
    },
    sources: ['src/core/engine.ts', 'src/core/vip.ts', 'src/core/world.ts'],
  },
  {
    id: 'replay',
    category: 'records',
    title: '战报、奖励与历史回放',
    summary: '结算一次，回放不限次数；历史属性与当前成长分开看。',
    keywords: '战报 回放 跳过 逐行动 种子 历史 奖励 运输中',
    sections: [
      {
        title: '何时结算',
        text: '正式战斗的胜负、奖励与战损由规则系统一次性结算并保存。播放动画、跳过、暂停、倍速和逐次攻击只是查看记录，不会再次计算或领奖。战后再次挑战会发起新的一场战斗，也会产生新的扣损与奖励。',
      },
      {
        title: '原始快照',
        text: '回放使用原始双方军队快照、日志和结果，不使用你当前的科技、指挥官、库存或编队重演。高级详情保留规则版本和随机种子；旧记录缺少新字段时显示兼容信息，不假装拥有完整数据。',
      },
      {
        title: '原始奖励与运输结果',
        text: '战斗记录展示当时获得或装载的物资。世界战斗还要结合远征返城凭据显示最终运输状态与实际入库；仍在路上、已入库、旧记录无法确认是不同情况。修好伤车后，原战报的当场损失仍应保留。',
      },
      {
        title: '阅读与复盘',
        text: '结果页先看胜负、奖励、生还、待修、永久损失，再看伤害贡献和逐次日志。每份详细战报独立管理阅读位置；新记录从顶部开始。图书馆的阅读位置与战报、图鉴弹窗相互独立。',
      },
    ],
    related: ['damage', 'repair'],
    destination: {
      page: 'reports',
      label: '查看战地档案',
    },
    sources: ['src/core/overview.ts', 'src/core/storage.ts', 'native/scripts/game.gd'],
  },
  {
    id: 'saves',
    category: 'records',
    title: '存档、兼容与本机设置',
    summary: '自动保存与多存档切换；测试副本和主存档独立。',
    keywords: '保存 载入 导入 导出 备份 JSON root 评测 高级',
    sections: [
      {
        title: '保存与切换',
        text: '游戏使用本机存档；资源、库存、科技、战报和队列保存在各自存档中。可新建、复制、重命名、切换和恢复备份。另存副本后检查当前存档名，再进行试验。关闭或切换前留意保存结果提示。',
      },
      {
        title: '导入、导出与兼容',
        text: '高级区域可导入／导出 JSON，导入先校验结构与数值。旧档会补齐缺失系统字段并保留已获得车辆、核心与通关；不会把未实现过的历史字段补成虚构战果。导出文件可以用于人工备份，不需要修改原始文件。',
      },
      {
        title: '高级功能',
        text: 'root 模拟充值、规则诊断、规则版本与随机种子用于本机测试；没有真实支付。评测与冒烟测试采用独立存档目录。普通设置优先提供声音、显示、操作说明与存档信息。',
      },
      {
        title: '图书馆阅读约定',
        text: '这里说明当前单机版本的实际实现，包含本项目适配规则，不把未核实数值当作原版设定。阅读、分类和搜索不扣资源、不修改战斗随机序列；各文章记忆本次运行的阅读位置，新文章默认从顶部开始。',
      },
    ],
    related: ['time', 'replay'],
    destination: {
      page: 'settings',
      label: '打开存档／设置',
    },
    sources: ['src/core/storage.ts', 'src/core/validate.ts', 'native/rules/bridge.ts'],
  },
  {
    id: 'base-districts',
    category: 'economy',
    title: '基地区域与作业调度',
    summary: '点击基地热点进入子区域；区域入口与调度共享同一份作业数据。',
    keywords: '基地 指挥中心 资源区 工业区 科研 调度 Q 工位',
    sections: [
      {
        title: '区域关系',
        text: '主基地的指挥中心与科研中心通往指挥科研区，资源热点通往资源区，工业热点通往工业区。每张地图可点建筑查看等级、当前收益、升级成本与时间；右侧直接升级或进入生产、科研、维修等功能。返回主基地不会取消作业。',
      },
      {
        title: '区域内容',
        text: '资源区有铁、油、铅、钛、水晶五处资源设施与仓库。工业区有两座制造工厂、改装厂和维修车间。指挥科研区包含指挥中心、科研中心和指挥学院；学院是指挥官功能入口，维修车间是独立服务设施，二者没有独立升级等级。',
      },
      {
        title: '调度操作',
        text: '主基地右侧点击基地建造或科研中心，会在右侧原地展开建筑或科技清单，滚轮浏览。直接升级/研究后显示倒计时和金币加速，无二次确认，操作后保留滚动位置；进入详情后返回也恢复该清单。科研等待项目按原顺序开工，等待位不是并行位。返回全部作业或Esc收起清单；建筑与科研分别记忆位置，换存档后重置。Q或展开调度中心进入完整调度页，制造、改装、科研和维修仍保留原有直接安排及专用页面入口；各入口扣同一份材料、占同一工位。',
      },
      {
        title: '时间口径',
        text: '调度显示工作项目、等待顺序、已交付/整批数量与预计完成。整批进度包含已交付数量及当前一辆的进度。远征单独显示前往、采集、返回；前往中的归队时间是预测，战损与矿藏变化可能影响实际。',
      },
    ],
    related: ['construction', 'queues'],
    destination: {
      page: 'queues',
      label: '打开作业调度',
    },
    sources: ['src/core/dispatch.ts', 'native/scripts/game.gd:_draw_district_scene/_draw_dispatch'],
  },
  {
    id: 'construction',
    category: 'economy',
    title: '建筑升级与解锁',
    summary: '指挥中心约束其他设施等级，满级120；先付款再建设。',
    keywords: '建筑 等级 上限 建造 消耗 时间 解锁 工厂',
    sections: [
      {
        title: '等级门槛',
        text: '所有可升级建筑最高$LEVEL_CAP级。除指挥中心外，设施下一等级不能超过当前指挥中心；同一建筑不能同时安排两个升级。指挥中心6级开放钛矿，$INDUSTRY_UNLOCK级开放第二制造工厂与改装厂的建设。新建两厂需先付款施工至1级。',
      },
      {
        title: '升级费用',
        text: '当前等级为L，倍率C=ceil(1.125×max(1,L)^2.65)。指挥中心铁160C，其他建筑铁90C；石油60C、铅40C；科研中心另需水晶30C。再计材料利用减免。建筑不收钛；第二制造厂与改装厂按普通工厂费用，首次建设按L=1报价。',
      },
      {
        title: '收益和满级',
        text: '资源设施提高自产，仓库提高容量与保护比例，制造/改装厂提高可用兵阶与效率，科研中心放开科研等级。工厂解锁：$UNLOCK_TABLE。工厂超过60级继续提高效率；没有VIII阶车辆。满级不再收升级费用，可转向科技、核心主线与编队目标。',
      },
      {
        title: '建设时间',
        text: '建筑基础工时随当前等级连续增长。指挥中心系数1、科研中心0.9、工厂0.8、仓库0.6、矿场0.35；50%固定工序，50%由工程管理加速。VIP提供并行建设位和免费时长，没有额外建筑速度加成。实际时间及缺少材料在点击前查看；点击升级直接扣料开工，金币加速也直接执行，无二次确认。主基地右侧建设清单使用滚轮浏览，操作后保留原位置。',
      },
    ],
    related: ['base-districts', 'time'],
    destination: {
      page: 'base',
      label: '返回基地',
    },
    sources: [
      'src/core/content.ts:upgradeCost',
      'src/core/engine.ts:upgradeBlock/facilityUpgradeQuote',
      'src/core/vip.ts:buildingDuration',
    ],
  },
  {
    id: 'warehouse-protection',
    category: 'economy',
    title: '仓库保护与可掠夺量',
    summary: '保护的是按容量算出的额度，不是固定20%的当前余额。',
    keywords: '保护 掠夺 仓库 溢出 容量 安全库存 20% 40%',
    sections: [
      {
        title: '保护比例',
        text: '仓库1级20%，120级40%，中间按基点向下取整线性增长。比例速查：$PROTECTION_TABLE。每项资源分别计算，金币与核心不参与矿产仓储保护。',
      },
      {
        title: '保护和暴露',
        text: '保护额度=floor(每项容量×保护比例)。受保护量=min(现有库存,保护额度)，可掠夺=max(0,现有库存−保护额度)。例：容量10000、比例20%，库存1000全部保护；库存6000保护2000、可掠夺4000；库存12000仍只保护2000。',
      },
      {
        title: '成长与用途',
        text: '升级仓库同时增加容量和保护比例；立体仓储及VIP扩容也增加保护额度。保护部分可正常花费，无需解锁。当前为单机世界，没有真人玩家或自动入侵基地；主动突袭NPC会实际保留对方保护资源。',
      },
    ],
    related: ['resources', 'gather-raid'],
    destination: {
      page: 'inventory',
      label: '查看库存与保护',
    },
    sources: [
      'src/core/protection.ts',
      'src/core/engine.ts:protectedAmount/resolveArrival',
      'src/core/world.ts:npcProtected',
    ],
  },
  {
    id: 'material-budget',
    category: 'economy',
    title: '材料预算与省料科技',
    summary: '区分制造、改装、维修和科研各自的计费方式。',
    keywords: '材料利用 缺额 钛矿 石油 预算 消耗 折扣',
    sections: [
      {
        title: '四系材料分工',
        text: '坦克主铁、歼击车主油、火炮主铅；副料约主料52%—58%，两个副料不同。II—VII阶钛为前三项平均取整后的1.5倍。火箭四项接近，钛比铁约多32%。这些是本版生产配方，不代表原版史实。原料卡显示单辆与整批总价。',
      },
      {
        title: '材料利用适用范围',
        text: '每级节省0.5%，120级最多60%；建设、制造、改装、维修均适用，每项正费用折后向上取整，至少1。科研材料、侦察水晶、购买统率书和金币加速不享受省料。核心和改装原车数量也不打折。',
      },
      {
        title: '缺料时的选择',
        text: 'MAX受最短缺材料、核心、原车及批次上限共同限制。材料不够可提高相应自产、科技增产或外出采集；缺核心去同系核心行动；缺原车先制造低一阶车辆。退款仅返还原订单未完成部分，不能靠价格变化赚取资源。',
      },
    ],
    related: ['research-cost', 'production'],
    destination: {
      page: 'inventory',
      label: '查看资源详情',
    },
    sources: [
      'src/core/arsenal.ts:productionQuote',
      'src/core/research.ts:materialCost',
      'src/core/engine.ts:execute',
    ],
  },
  {
    id: 'research-cost',
    category: 'growth',
    title: '科研材料与钛矿预算',
    summary: '本轮仅科研钛成本再增加50%；已付订单保留原价。',
    keywords: '科研 钛矿 50% 研究材料 费用 预算 退款',
    sections: [
      {
        title: '目标等级与配方',
        text: '令目标等级为L，S=1.2×L^2.65。L≤5时，铁/油/铅/水晶分别为ceil(80S/55S/65S/26S)，钛为0；L≥6时，铁ceil(60S)、油ceil(39S)、铅ceil(46S)、水晶ceil(17S)。各科技同目标等级使用相同材料表，但前置与工期不同。',
      },
      {
        title: '钛矿本轮变更',
        text: '目标6级起，v0.28钛费=ceil(ceil(32S)×1.5)；当前钛费=ceil(v0.28钛费×1.5)。因逐次取整，不能只把最终未取整系数写成72S。铁、油、铅、水晶和时间不随本次调整变化，制造/改装的钛费也不再加价。',
      },
      {
        title: '当前精确材料表',
        text: '以下为一项科研升一级，顺序铁/油/铅/钛/水晶，未使用K/M简写：\n$RESEARCH_COSTS',
      },
      {
        title: '扣费与旧订单',
        text: '科研不享受材料利用折扣。工作与等待订单均在提交时付款；已支付项目保存单价和时长。载入旧存档不补扣钛，取消也只退原价。满级120不再接受升级。科研调度中直接研究后，同一行显示剩余时间和金币加速；点击立即扣费完成，无二次确认。等待项目显示等待时间，前项完成后自动开工，再可加速；每次只完成当前项目。',
      },
    ],
    related: ['research-paths', 'material-budget'],
    destination: {
      page: 'research',
      label: '查看科研报价',
    },
    sources: [
      'src/core/content.ts:researchCost',
      'src/core/engine.ts:research/startJob/cancel',
      'native/rules/bridge.ts:research',
    ],
  },
  {
    id: 'research-paths',
    category: 'growth',
    title: '全科技前置索引',
    summary: '21项科技的起始门槛，以及升高等级时的动态依赖。',
    keywords: '科研树 科技 前置 依赖 路线 材料利用 实验室',
    sections: [
      {
        title: '读取规则',
        text: '下面列起始门槛。升至L级时，科研中心至少max(起始门槛,L)，每个前置至少max(表中等级,ceil(L/2))。多个前置必须全部满足，已排队但未完成的科技不能提前提供资格。',
      },
      {
        title: '全部依赖',
        text: '$RESEARCH_DEPENDENCIES',
      },
      {
        title: '成长路线',
        text: '先发展资源统筹与各矿专精保障产出；工程管理通向科研、生产和省料；野外后勤通向行军与运输；火控校准通向生命、精密弹道与反应装甲。收益表见“科技树、依赖与收益”，具体不足直接显示在科研页。',
      },
      {
        title: '重复和并行',
        text: '科研只有1个工作位、3个等待位；同一科技不能同时排两个升级。等待中的不同科技依序开工，使用下单时确认的材料和工期；取消会释放等待位。',
      },
    ],
    related: ['research', 'research-cost'],
    destination: {
      page: 'research',
      label: '打开科技树',
    },
    sources: [
      'src/core/research.ts:researchTree/researchRequirements',
      'src/core/engine.ts:startJob',
    ],
  },
  {
    id: 'prestige',
    category: 'growth',
    title: '经验、声望与军衔',
    summary: '经验等级、军衔、统率是三个不同的成长指标。',
    keywords: '声望 军衔 等级 经验 攻击 生命 门槛',
    sections: [
      {
        title: '三种等级',
        text: '顶部经验等级=1+floor(sqrt(经验/50))，最高120。真实声望等级=1+floor(sqrt(声望/40))，不设玩法等级上限；军衔跟随真实声望，达到上将后保持不变。统率单独花书或金币升级，并受声望资格限制，增加单格人数。',
      },
      {
        title: '军衔表',
        text: '每个区间内逐级增加属性，换军衔时不额外重复加成。\n$RANK_TABLE',
      },
      {
        title: '升级与加成',
        text: '升至L级需要累计40×(L−1)²声望，还需声望=max(0,目标累计−现有)。真实声望每超过1级，攻击/生命各+0.1%，120级各+11.9%，之后继续每级增加；与相应科技、战术指挥同组相加。旧档为保护已有统率保留的资格底线不提供虚构声望与属性。',
      },
      {
        title: '来源',
        text: '经典战役和核心行动正式胜利、击败世界守军、每日补给提供声望；演习不提供。查看本次结算的经验、声望、统率书，不能将其中一种当成另一种。',
      },
    ],
    related: ['commander', 'effective-stats'],
    destination: {
      page: 'commander',
      label: '查看指挥官军衔',
    },
    sources: ['src/core/commander.ts', 'src/core/engine.ts:commanderLevel/battle/dungeon/daily'],
  },
  {
    id: 'skills',
    category: 'growth',
    title: '指挥技能与提升上限',
    summary: '三项技能分别影响攻击、先手和连击，每项最多120级。',
    keywords: '技能点 战术指挥 战场预判 连击指挥 攻击 上限',
    sections: [
      {
        title: '三项技能',
        text: '战术指挥：每级攻击+2%，120级+240%。战场预判：每级团队阵位先手+3，120级+360点。连击指挥：每级二次开火+4，120级+480点。这三项不同，提升攻击按钮对应战术指挥，没有第二份独立攻击技能。',
      },
      {
        title: '点数与限制',
        text: '升级一次消耗1技能点，无随机失败。经典战役首通每关1点；指挥中心21级起每日补给另给1点。技能上限120，不受统率的成功概率约束；点数不足或满级会显示原因。',
      },
      {
        title: '战术影响',
        text: '先手比较双方指挥官的统一属性；二次开火概率取决于双方差值且最高35%，点数不是百分比。技能影响当前有效属性与新出征；已在途快照和历史战报保持原值。',
      },
    ],
    related: ['initiative', 'extra-fire'],
    destination: {
      page: 'commandTraining',
      label: '分配指挥技能',
    },
    sources: [
      'src/core/engine.ts:skill/initiativeSkill/extraFireSkill',
      'src/core/battle.ts:army/extraFireChance',
    ],
  },
  {
    id: 'presets',
    category: 'arsenal',
    title: '连续部署与编队预设',
    summary: '候选车持续选中；命名预设保存的是期望配置。',
    keywords: '部署 选中 保持 预设 保存 加载 覆盖 缺额 筛选',
    sections: [
      {
        title: '连续部署',
        text: '选左侧阵位→选右侧车型→部署。完成后候选车型保留，直接换左侧阵位继续部署即可。数量取本阵位可分配库存与单格上限的较小值；计算时释放本阵位原配置，其他五格仍占用其计划份额。没有可分配库存时不能部署。',
      },
      {
        title: '例子',
        text: '若待命共有250辆，单格上限100：同型号先后部署到1、2、3号，得到100、100、50；第4号显示无可分配库存。重新选1号仍可部署100，不会再扣一次。换另一型号才改变候选选中。编队草稿不消耗待命车辆。',
      },
      {
        title: '保存和加载',
        text: '最多5个命名预设，名称最多20字符。先保存编队，再保存预设；覆盖、重命名、删除在预设管理。加载按1→6阵位依次分配当前可用数，不足提示缺额；原命名预设数量不变，补兵后重载可恢复。只有主动覆盖才改变原预设。',
      },
      {
        title: '场景与库存',
        text: '普通编队保存后成为常用方案；战前草稿确认出战才提交。待修、维修中和出征预留不算可分配。筛选/排序只改变候选列表，不替你更换候选车；连续部署仍受库存限制。',
      },
    ],
    related: ['formation', 'resources'],
    destination: {
      page: 'army',
      label: '前往作战编队',
    },
    sources: [
      'native/scripts/game.gd:_assign/_free_for_slot',
      'src/core/engine.ts:formationAvailability/presetLoad',
    ],
  },
  {
    id: 'daily-objectives',
    category: 'growth',
    title: '补给、任务与后期目标',
    summary: '已领取奖励不重复发放；成长目标连接现有培养系统。',
    keywords: '每日 任务 奖励 荣誉 后期 通关 统率书 技能点',
    sections: [
      {
        title: '普通每日补给',
        text: '按存档游戏时间UTC+8每日零点换日，每天领取一次：水晶100、金币5、统率书1、声望20；指挥中心21级起另给1技能点。休整推进游戏日历，也影响下一次可领取日期。',
      },
      {
        title: 'VIP补给',
        text: 'VIP1起另有专属每日金币，数量=VIP等级×5；需单独领取。VIP按累计模拟充值金币判断，消费金币不降级，战斗金币不增加累计充值。没有真实付款，管理入口在高级设置。',
      },
      {
        title: '任务与成长目标',
        text: '战地任务达到计数后在指挥官页主动领取，一次性奖励不因反复打开页面重发。后续目标依次检查经典主线、四系核心、60级制造能力、六格VI阶以上满编、攻防科技10级、核心$CORE_STAGE_COUNT关，以及基地更高里程碑。当前进度决定下一目标。',
      },
      {
        title: '挑战荣誉',
        text: '正式核心第二章及以后：用单一指定车系获胜可记录该系荣誉；损失≤出战数5%可记录低战损荣誉，四系加低损共5项。荣誉永久保留，不重复增加独立材料奖励；正常副本奖励照常发放。',
      },
    ],
    related: ['campaign', 'cores'],
    destination: {
      page: 'objectives',
      label: '查看成长目标',
    },
    sources: [
      'src/core/engine.ts:daily/vipDaily/claim/dungeon',
      'src/core/planning.ts:progression',
    ],
  },
  {
    id: 'world-regions',
    category: 'world',
    title: '世界等级与驻军成长',
    summary: '世界等级由固定区域决定，不跟着玩家自动升降。',
    keywords: '世界 矿点 NPC 守军 刷新 等级 区域 难度',
    sections: [
      {
        title: '分区等级',
        text: '各资源和NPC按距基地的距离安排梯度，等级池为：$WORLD_LEVELS。每类实际点位按距离分配这些等级。附近两座安全矿没有守军；高级矿更远、产率更高，也有更强守军。',
      },
      {
        title: '守军构成',
        text: '普通资源点车阶按据点等级1/6/12/18/30/50/80开放I—VII阶；不是玩家工厂解锁表。阵位数=min(6,ceil(等级/3))。6级以内每组2+等级×2；更高级以统率基准20+5×floor((等级−1)/2)计算，矿点取55%、NPC取80%，向上取整。守军攻防、弹道、装甲及机动科技为floor(据点等级/2)。',
      },
      {
        title: '刷新与情报',
        text: '世界每游戏小时结算补给。矿点有任意前往、采集、返回队伍关联时停止恢复；清空后重新补满才重建守军。NPC恢复材料并支付制造费逐阵位补兵，不保证每小时全部恢复。旧情报只是快照，侦察后也可能因时间变化而与到达时不同。',
      },
    ],
    related: ['scouting', 'gather-raid'],
    destination: {
      page: 'world',
      label: '查看世界地图',
    },
    sources: ['src/core/world.ts:worldLevels/guardTemplate/settleWorld'],
  },
  {
    id: 'battle-presentation',
    category: 'records',
    title: '战场观察与逐行动复盘',
    summary: '移动与弹道是表现；伤害和胜负来自已保存的战斗记录。',
    keywords: '暂停 倍速 逐行动 跳过 回放 弹坑 音效 残骸',
    sections: [
      {
        title: '观察界面',
        text: '左侧提示攻击方与兵种，VS下方显示当前大回合/上限。阵位编号、数量和生命条辅助判断目标。存活车沿行进方向微动，背景后移；残骸与弹坑留在地面并随背景后移，不跟随部队前进。',
      },
      {
        title: '火力表现',
        text: '坦克和歼击车平射；火炮、火箭先沿炮口方向射出，再由高位斜向落点，远空段省略。火箭一轮六发用一次发射声与密集命中爆炸声；四系发射/命中音不同，车辆击毁另有通用音效。空位火箭只打地面，不产生伤害或闪避统计。',
      },
      {
        title: '播放操作',
        text: '空格暂停/继续，界面切换倍速；N逐行动查看，当前组常规攻击及紧接的连击算一次观察步骤。跳过直接显示完整结算，不撤销战损，也不额外开奖。回放展示原日志。再次挑战使用当时可用编队直接开新一战，可能发生新的战损。',
      },
    ],
    related: ['replay', 'turns'],
    destination: {
      page: 'reports',
      label: '查看战斗档案',
    },
    sources: [
      'native/scripts/game.gd:_battle_step/_battle_sound',
      'src/core/overview.ts:battleSummary',
    ],
  },
  {
    id: 'controls',
    category: 'records',
    title: '显示、操作与安全存档',
    summary: '普通设置管声音和显示，高级区域集中导入导出与诊断。',
    keywords: 'F1 F5 F11 Q I Esc 音量 缩放 全屏 键盘 高级 存档',
    sections: [
      {
        title: '常用按键',
        text: 'F1图书馆，库内Ctrl+F搜索；Q作业调度，I资源一览，F5保存，F11全屏/窗口；1—6切换底部的基地、编队、战役、世界、指挥官、战报；制造与科研从基地建筑进入，Tab与Enter导航按钮，Esc关闭弹窗或返回。战斗空格暂停，N逐行动。普通命中为浅色数字，暴击为更大的橙红色“暴击”数字；换手前命中后的停顿延长50%，连发和火箭六发的间隔不变。',
      },
      {
        title: '显示与声音',
        text: '设置提供静音、音量和100%/110%/120%字号。字号影响正文、按钮及阅读区域，标题与地图布局保留统一基准。小窗口会按比例展示；详细长文在阅读区滚动，不影响战报等其他内容的阅读位置。',
      },
      {
        title: '副本与导入',
        text: '另存副本会切到新的独立存档，原档保留；导入校验格式、校验和及数据后也创建独立存档。若当前草稿需要保留，先保存编队。恢复备份会回到最近一次操作前的存档，并按当前时间结算；先导出备份便于保留多份历史。JSON与root在高级区域，日常游玩无需操作它们。',
      },
      {
        title: '版本与说明',
        text: '本图书馆核对的是当前单机实现。软件版本、战斗规则版本、存档格式分别管理，软件升级不代表旧战报改用新公式。库内阅读不扣材料、不触发战斗随机；各文章独立记忆本次运行的阅读位置。',
      },
    ],
    related: ['saves', 'battle-presentation'],
    destination: {
      page: 'settings',
      label: '打开设置与存档',
    },
    sources: ['native/scripts/game.gd:_unhandled_key_input', 'native/rules/bridge.ts:handle'],
  },
];
export const libraryEntries = authored.map((entry) => ({
  ...entry,
  summary: resolveText(entry.summary),
  sections: entry.sections.map((section) => ({ ...section, text: resolveText(section.text) })),
}));
export const fieldLibrary = {
  version: 2,
  edition: 'v0.34.0',
  ruleset: BATTLE_RULESET,
  categories: libraryCategories,
  entries: libraryEntries,
};
export function searchLibrary(category = 'all', query = '') {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return libraryEntries.filter(
    (entry) =>
      (category === 'all' || entry.category === category) &&
      words.every((word) =>
        [
          entry.title,
          entry.summary,
          entry.keywords,
          ...entry.sections.flatMap((s) => [s.title, s.text]),
        ]
          .join(' ')
          .toLocaleLowerCase()
          .includes(word),
      ),
  );
}
