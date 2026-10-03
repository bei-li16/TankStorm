import { MAX_LEVEL } from './growth';
import { rules, classNames, vehicleUnlockLevels } from './content';
import { army, combatStats, extraFireChance, BATTLE_RULESET } from './battle';
import { BOOK_PRICE, leadershipChance } from './commander';
import { researchTree, techDescriptions } from './research';
import { coreChapters, dungeons } from './arsenal';
import { vipLevels } from './vip';

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
      const d = dungeons[i * 4];
      return `${name}：制造工厂${d.factoryLevel}级；首胜 VI / VII 为${d.drops[0].first} / ${d.drops[1].first}；重复 VI ${d.drops[0].min}—${d.drops[0].max}，VII ${d.drops[1].min}—${d.drops[1].max}。`;
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
    summary: '比较出战阵位的平均先手；同值时进攻方先攻。',
    keywords: '先攻 先手值 行动顺序 平手 机动推进 战场预判',
    sections: [
      {
        title: '单组先手',
        text: '单组先手 = 100 +（兵阶 − 1）×6 + 机动推进科技等级×3 + 战场预判技能等级×3。高兵阶、机动科技和指挥技能都能提升先手。',
      },
      {
        title: '双方怎样比较',
        text: '把本方非空出战阵位的先手相加，除以出战阵位数，向下取整。高者先攻；相同时进攻方先攻。常规战役、核心行动和主动世界出征中，玩家是进攻方。',
      },
      {
        title: '不是按车辆数量加权',
        text: '例如100辆 I阶坦克的一组先手100，1辆 VII阶坦克的一组先手136；团队先手是 $INIT_EXAMPLE。不会因为前者有100辆就把它重复计算100次。空阵位不参与平均。',
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
        text: '待行动单位已击毁就跳过，不给其他组额外轮次。一方全灭立即结束。达到 $MAX_ROUNDS 个大回合仍未歼灭防守方，判进攻方失败。',
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
    summary: '比较双方团队值，最多追加一次完整攻击。',
    keywords: '连击 连发 二次开火 三次齐射 额外攻击 概率',
    sections: [
      {
        title: '属性来源',
        text: '单组二次开火值 = 100 +（兵阶 − 1）×5 + 精密弹道科技等级×4 + 连击指挥技能等级×4。团队按非空出战阵位平均，向下取整，不随本场损失变化。',
      },
      {
        title: '概率公式',
        text: '连击概率 = 10% +（本方值 − 敌方值）×0.1个百分点，限制在0%—35%。同值为 $EXTRA_EQUAL；高50点为 $EXTRA_HIGH；低50点为 $EXTRA_LOW。达到35%后继续提高差值，不再增加本场概率。',
      },
      {
        title: '什么时候触发',
        text: '常规攻击完成且敌方仍有存活单位时判定；成功则当前组立即按现存目标再做一次完整攻击，然后换手。追加攻击不再次触发连击，也不占其他阵位的常规行动。',
      },
      {
        title: '连发与连击不同',
        text: '坦克每列优先前排、共一至三发，火炮对列一至两发、火箭六阵位固定六发，均为一次攻击内的连续射击。连击是把完整攻击再做一次，并按当时敌阵重新选敌。逐行动播放将该组常规攻击和连击一起播放。',
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
        text: '命中伤害 = 存活车数×单车基础攻击×科技/战术攻击倍率×坦克光环倍率×克制倍率×攻击模式倍率×暴击倍率×对应减伤倍率。\n全部相乘后只向下取整一次；命中至少1伤害，未命中为0。当前四系模式倍率均为1。',
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
        text: '攻击倍率=1+火控校准每级5%+精密弹道每级2%+战术指挥每级2%。\n单车生命=基础生命×（1+复合装甲每级5%+反应装甲每级3%），向下取整。同组加成相加，克制、光环等另行相乘。',
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
        text: '伤害能力=攻击×攻击倍率×覆盖数×命中率×（1+暴击率×0.5）。有效生命=生命/敌方命中率/（1+敌方暴击率×0.5）。中性敌方默认命中95%、暴击10%，再扣本车闪避、抗暴。\n覆盖数：坦克3、歼击车1、火炮2、火箭6。先手因子=1+相对白板先手提升/1000；连击因子=（1+对同车型白板的连击概率）/1.1。最终分数四舍五入。',
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
        text: '自动满编用于快速配置；最大战力选可用总分最高六组；最高兵阶先选高级车，再比较可用火力，均受库存和统率限制。调整后保存才成为常用编队；战前修改在确认出战时提交。',
      },
      {
        title: '预设',
        text: '保存预设记录已保存编队；命名、覆盖、删除在预设管理。加载不会补发缺少的车辆。有未保存草稿时需确认是否放弃。',
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
        text: '$UNLOCK_TABLE。\n两座制造工厂各按本厂等级解锁；改装要求改装厂与至少一座制造工厂同时达到目标兵阶门槛。13级指挥中心仍开放第二工厂和改装厂的建设。材料、核心及工作或等待位置也要满足。数量可手动输入，快捷20/50/100/MAX。MAX取材料、核心、原车和100辆批次上限中的最小值。新制造和改装每批最多100辆；旧存档已支付的订单按原数量、费用和速度完成。已有高阶车辆继续使用与维修，新订单按新门槛检查。',
      },
      {
        title: '费用和进度',
        text: '包括等待订单在内，材料与核心都在提交时扣除。每完成一辆入库一辆，整批剩余时间表示全部交付前还需多久。',
      },
      {
        title: '制造速度',
        text: '100辆坦克的七阶基础时长依次为2/6/12/24/36/48/60小时；歼击车×0.9，火炮×1.05，火箭车×1.1，单车秒数向上取整。制造中70%为固定装配与验收工序，其余30%按“1+装配工艺加速+VIP加速+本厂效率”提速。本厂效率从1级0%连续增至120级100%。\n整批实际时长=单车时长×数量，再减一次VIP免费分钟。七阶100辆在60级工厂无科技时约49—60小时，满科技/工厂/VIP时约40—49小时。提交时记录费用和速度，后续升级不改写旧订单。',
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
        text: '改装基础时间是目标制造时间60%，其中50%为固定工序，另50%计装配工艺、模块化改装、本厂效率与VIP加速。单批最多100辆，提交时占用原车；完工新车入库。取消未完成部分退回对应原车、核心和材料。',
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
    title: '战损、待修与全部修复',
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
        title: '逐辆与全部修复',
        text: '维修车间可选型号和数量，不能超待修或材料预算；逐辆入库。\n水晶基础费用=向上取整[40%×Σ(制造材料量×水晶1级时产÷该材料1级时产)]，再计材料利用科技减免并向上取整。铁/油/铅/钛/水晶1级时产为600/400/330/150/100；费用随车阶和车型提升，不随基地等级涨价，维修不另收核心。\n“全部修复”与普通维修使用同一材料报价；维修车间和结算页均可确认总材料后立即入库，不收金币、不推进时间。已付订单不重复收费；旧订单按原费用退款与交付。材料不足整笔不执行，清单变化需重确认。',
      },
      {
        title: '历史与当前',
        text: '永久损失不能修复。维修只更新当前库存，不改写历史战损；从旧战报点击全部修复，也只处理现在可修车辆，不重新生成历史损失。',
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
    ],
    related: ['effective-stats', 'queues'],
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
        text: '统率最高120，每格容量20+5×（统率−1），不能超过声望等级。声望等级=1+floor(sqrt(声望/40))，最高120；旧档保留已有统率对应的最低资格。顶部经验等级不是声望等级。',
      },
      {
        title: '获取与支付',
        text: '统率书可$BOOK_PRICE金币一本购买。每次升级用1本书，或直接花$BOOK_PRICE金币。买书不自动升级。战役每胜1本，核心四段每胜1/2/3/4本，任务和补给也可提供。',
      },
      {
        title: '概率速查',
        text: '$LEADERSHIP_CHANCES\n升至2—10级100%；11级起按指数曲线下降，最低0.1%。失败不降级、不累积保底。',
      },
      {
        title: '平均不等于保证',
        text: '0.1%平均1000次，可能1次成功，也可能连续200次失败。批量1/10/100次只是上限，成功即停，只扣实际次数；开始前需有整批预算。',
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
    summary: '七章112关；正式胜利才推进主线。',
    keywords: '战役 章节 关卡 首通 重复 再次挑战',
    sections: [
      {
        title: '推进',
        text: '七章每章16关，通过敌军兵阶、数量和混合配置提升难度。正式胜利开放下一关；原12关进度保留在第一章。已过关可以重复挑战。',
      },
      {
        title: '奖励',
        text: '首通与重复物资不同，详情根据当前进度显示。胜利同时提供成长奖励，演习没有奖励和解锁。跳过动画不取消结算。',
      },
      {
        title: '再次挑战',
        text: '结果页直接用当前已保存且可用编队开战，不再弹战前编队。损失导致可用数下降；需要补兵或换车时先从结果页进入维修、编队和制造。',
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
    summary: '16关连续推进；一关只产一个车系的两种核心。',
    keywords: '核心 副本 首通 随机 概率 产量 主线 原核心',
    sections: [
      {
        title: '开放规则',
        text: '四段各四关，依次为坦克、歼击车、自行火炮、火箭车。需通过前一关并满足制造工厂等级，任一制造工厂达标即可。旧已通关的关保持开放，库存和8种核心ID保留，不追补旧首通新增奖励。',
      },
      {
        title: '数量与门槛',
        text: '$CORE_TABLE',
      },
      {
        title: '随机规则',
        text: '每次重复胜利，两种数量分别在各自闭区间内等概率取整数，不共用总数量，只掉本关车系。外围VII为0—1，所以可能无精密核心；其他段两个区间都至少1。',
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
        text: '仓储上限限制基地自然产出；满仓时停止增加，超出的自然产出不会留存。战斗奖励、归队物资及退款可以使余额超过上限，这些已获得物资不会被仓库裁掉。金币和核心不按矿产自产上限处理。',
      },
      {
        title: '车辆口径',
        text: '待命库存是可用于新出征、改装的车辆。编队是待命库存上的出战计划，编入不会再次扣车；正式出征才预留并从可用库存移出。出征、待修和维修中分开统计。生产和维修每交付一辆就加入待命库存。',
      },
      {
        title: '产出如何成长',
        text: '1—120级统一曲线：资源基础时产=1级时产×等级^1.35（按实际规则取整）。1级铁/油/铅/钛/水晶时产为600/400/330/150/100，钛矿仍需指挥中心6级。基础仓储=同级基础铁时产×[48+432×(等级−1)/119]。\n资源统筹和仓储满级+200%，对应资源专精满级+320%，按“满级加成×(等级/120)^0.8”增长；两项增产相加，仓储另外乘其科技与VIP收益。材料利用每级节省0.5%，120级最多60%，所有非零费用至少1。顶部容量条表示每种资源的可用存量/自产容量，金币无此上限。',
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
        text: 'VIP 为每座制造／改装工厂及科研增加等待位；等待订单依序开始，不能同时工作。建设使用 VIP 提供的并行建设位，同一建筑不能同时升级两次。维修只有一条工作线，没有 VIP 等待队列。',
      },
      {
        title: 'VIP 队列速查',
        text: '各行依次为：等级 / 并行建设 / 每厂与科研等待位 / 可同时远征 / 免费时长。\n$VIP_TABLE',
      },
      {
        title: '免费完成与金币加速',
        text: '符合免费时长的整批任务自动完成；尚未轮到的订单先等待工作线。金币加速面向正在工作的项目，按扣除免费时长后的整批剩余分钟向上取整，每分钟 1 金币。具体可用福利与预计时间在下单前显示。',
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
        text: '休整主动推进本存档的游戏时间，可在确认前查看预计结果，结束后查看实际资源增量、完成项目和远征结果。推进的时段同样会触发世界敌军成长与满仓停产，不等于直接发放固定资源。',
      },
      {
        title: 'VIP 免费时长的准确含义',
        text: '建设、科研、制造／改装／维修整批剩余工作时长，以及采集剩余时长，进入 VIP 免费区间即自动完成。判断依据是整批剩余时间，不是每辆车都单独免一遍。出发和返程行军不适用免费分钟。',
      },
      {
        title: '升级与工业节奏',
        text: '建筑与科研的1—120级时长按连续里程碑增长。升至101—120级时，计入最高科技与VIP后，各项目仍在12小时—5天内。指挥中心、实验室、工厂较慢，资源设施较快；精密军事研究比资源研究更慢。\n建设和科研包含50%固定验收与试验时间，余下50%受相应科技和VIP提速。逐辆维修固定工序占25%。界面预计时间已计这些规则和VIP免费时长；不含队列等待时会另外说明。',
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
        text: '前往 → 到达作战 → 采集或携带战利品返回 → 归队入库。失败的生还者也会返程；可维修损失进入维修口径，永久损失不会自动补回。物资与生还车辆返城时加入可用库存，并保留实际入库记录。',
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
        text: '世界按五类资源各设1—120级固定区域，随距离逐步提升。矿储上限=该级同类基础自产的32小时；无任何在途/采集/返回队伍锁定该点时，每小时恢复1/4。已清除守军会在矿藏重新补满时恢复，附近两座安全矿例外。六格守军随等级提高兵阶、数量与军事实力（科技等级为据点等级的一半）；敌军据点比同级矿点驻军更强。已有队伍采集时，后到队伍不能重复占用。',
      },
      {
        title: '敌军据点突袭',
        text: '胜利后按生还载重装载可掠夺资源并直接返程，无矿点采集等待。新版据点每种资源容量为该级对应基础自产的4小时，最低10K，保护其容量10%；每小时补充2小时基础产量，按原车材料费重建最多1/4的守军。按铁、油、铅、钛、水晶顺序装载至载重上限，不掠夺金币。旧存档被在途队伍锁定的目标会等归队后再升级地区规则，旧队伍载重和采速不变。',
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
];
export const libraryEntries = authored.map((entry) => ({
  ...entry,
  sections: entry.sections.map((section) => ({ ...section, text: resolveText(section.text) })),
}));
export const fieldLibrary = {
  version: 1,
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
