import { army } from './battle';
import { unitList, units } from './content';
import { powerOverview, tierPower, unitPower } from './power';
import type { Formation, GameState } from './types';

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
// The power formula is multiplicative. Allocate its gain using log weights so
// interaction effects are shared without depending on arbitrary table order.
export function unitAttributes(s: GameState, unitId: string) {
  const base = army([{ unitId, count: 1 }])[0],
    st = army([{ unitId, count: 1 }], s.tech, s.commander.attackSkill, s.commander)[0];
  const baseline = tierPower[units[unitId].tier - 1],
    power = unitPower(st);
  const hit = clamp(0.95 + st.accuracy / 10000, 0.1, 1),
    crit = clamp(0.1 + st.crit / 10000, 0, 0.75);
  const enemyHit = clamp(0.95 - st.evasion / 10000, 0.1, 1),
    enemyCrit = clamp(0.1 - st.armor / 10000, 0, 0.75);
  const factors = [
    Math.sqrt((st.attack * (st.attackBonus ?? 10000)) / 10000 / base.attack),
    Math.sqrt(st.hp / base.hp),
    Math.sqrt(hit / 0.95),
    Math.sqrt(0.95 / enemyHit),
    Math.sqrt((1 + crit * 0.5) / 1.05),
    Math.sqrt(1.05 / (1 + enemyCrit * 0.5)),
    1 + Math.max(0, st.initiative! - base.initiative!) / 1000,
    (1 + clamp(0.1 + (st.extraFire! - base.extraFire!) / 1000, 0, 0.35)) / 1.1,
  ];
  const weight = factors.map(Math.log),
    sum = weight.reduce((a, b) => a + b, 0);
  const delta = weight.map((w) =>
    Math.abs(sum) < 1e-12 ? 0 : Math.round(((power - baseline) * w) / sum),
  );
  const last = weight.reduce((index, w, i) => (Math.abs(w) > 1e-12 ? i : index), -1);
  if (last >= 0) delta[last] += power - baseline - delta.reduce((a, b) => a + b, 0);
  const names = [
    '攻击',
    '生命',
    '命中率',
    '闪避率',
    '暴击率',
    '装甲 / 抗暴',
    '先手值',
    '二次开火值',
  ];
  const ids = ['attack', 'hp', 'accuracy', 'evasion', 'crit', 'armor', 'initiative', 'extraFire'];
  const bases = [base.attack, base.hp, 95, 0, 10, 0, base.initiative!, base.extraFire!];
  const values = [
    (st.attack * (st.attackBonus ?? 10000)) / 10000,
    st.hp,
    hit * 100,
    st.evasion / 100,
    crit * 100,
    st.armor / 100,
    st.initiative!,
    st.extraFire!,
  ];
  const sources = [
    `攻击科技 ${s.tech.attack} / 弹道 ${s.tech.ballistics} / 战术 ${s.commander.attackSkill}`,
    `生命科技 ${s.tech.hp} / 装甲加固 ${s.tech.armorPlating}`,
    '当前无额外命中加成',
    '当前无额外闪避加成',
    '团队歼击车光环不计入静态分数',
    '抗暴属性；装甲加固的收益计入生命',
    `机动 ${s.tech.march} / 战场预判 ${s.commander.initiativeSkill ?? 0}`,
    `弹道 ${s.tech.ballistics} / 连击指挥 ${s.commander.extraFireSkill ?? 0}`,
  ];
  return {
    unitId,
    base: baseline,
    power,
    rows: ids.map((id, i) => ({
      id,
      name: names[i],
      base: bases[i],
      value: values[i],
      percent: i >= 2 && i <= 5,
      delta: delta[i],
      source: sources[i],
    })),
  };
}
export function attributeSheet(s: GameState, formation: Formation) {
  const byUnit = Object.fromEntries(unitList.map((u) => [u.unitId, unitAttributes(s, u.unitId)]));
  const p = powerOverview(s, formation),
    best = byUnit[p.bestUnit];
  const sum = (pick: (u: ReturnType<typeof unitAttributes>) => number) =>
    formation.reduce((n, v) => n + (v ? pick(byUnit[v.unitId]) * v.count : 0), 0);
  return {
    byUnit,
    formation: {
      power: p.current,
      base: sum((u) => u.base),
      capacity: 0,
      rows: best.rows.map((r, i) => ({ ...r, delta: sum((u) => u.rows[i].delta) })),
    },
    ceiling: {
      power: p.ceiling,
      base: best.base * 120,
      capacity: best.base * (p.cap * 6 - 120),
      rows: best.rows.map((r) => ({ ...r, delta: r.delta * p.cap * 6 })),
    },
    bestUnit: p.bestUnit,
    explanation:
      '白板基准由伤害、生命等归一化得到，单列以保持同阶四系等分。乘算加成按对数权重分摊，整数尾差归并；各增量加基础分恰等于总战力。满编额外统率容量单列；条件光环、克制、载重和经济属性不重复计分。',
  };
}
