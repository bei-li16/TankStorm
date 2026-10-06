import { army, commanderStats } from './battle';
import { unitList, units } from './content';
import { flatDefenseFactor, powerOverview, tierPower, unitPower } from './power';
import { defenseReduction, defenseStats } from './combat_research';
import type { Formation, GameState } from './types';

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
// The power formula is multiplicative. Allocate its gain using log weights so
// interaction effects are shared without depending on arbitrary table order.
export function unitAttributes(s: GameState, unitId: string) {
  const base = army([{ unitId, count: 1 }])[0],
    st = army([{ unitId, count: 1 }], s.tech, s.commander.attackSkill, s.commander)[0];
  const baseline = tierPower[units[unitId].tier - 1],
    tactics = commanderStats(s.tech, s.commander),
    power = unitPower(st, tactics);
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
    Math.sqrt((1 + crit * ((st.critMultiplierBps ?? 15000) / 10000 - 1)) / (1 + crit * 0.5)),
    Math.sqrt(1.05 / (1 + enemyCrit * 0.5)),
    Math.sqrt(flatDefenseFactor(st) / flatDefenseFactor(base)),
    Math.sqrt(1 + defenseStats(st).rating / 10000),
    1 + Math.max(0, tactics.initiative - 100) / 1000,
    (1 + 0.5 * clamp(0.1 + (tactics.extraFire - 100) / 1000, 0, 0.35)) / 1.05,
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
    '命中值',
    '闪避率',
    '暴击率',
    '暴击额外伤害',
    '装甲 / 抗暴',
    '车辆防御',
    '比例减伤',
    '指挥官先手',
    '指挥官二次开火',
  ];
  const ids = [
    'attack',
    'hp',
    'accuracy',
    'evasion',
    'crit',
    'criticalDamage',
    'armor',
    'defense',
    'damageReduction',
    'initiative',
    'extraFire',
  ];
  const bases = [base.attack, base.hp, 95, 0, 10, 50, 0, base.defense ?? 0, 0, 100, 100];
  const values = [
    (st.attack * (st.attackBonus ?? 10000)) / 10000,
    st.hp,
    95 + st.accuracy / 100,
    st.evasion / 100,
    crit * 100,
    ((st.critMultiplierBps ?? 15000) - 10000) / 100,
    st.armor / 100,
    defenseStats(st).flat,
    100 * defenseReduction(defenseStats(st).rating),
    tactics.initiative,
    tactics.extraFire,
  ];
  const sources = [
    `攻击科技 ${s.tech.attack} / 弹道 ${s.tech.ballistics} / 战术 ${s.commander.attackSkill} / 声望军衔`,
    `生命科技 ${s.tech.hp} / 装甲加固 ${s.tech.armorPlating} / 声望军衔`,
    `稳定瞄准 ${s.tech.accuracy ?? 0}；对手闪避另扣`,
    `规避机动 ${s.tech.evasion ?? 0}`,
    `弱点锁定 ${s.tech.critical ?? 0}；光环另计`,
    `毁伤强化 ${s.tech.criticalDamage ?? 0}；基础+50%`,
    `抗爆装甲 ${s.tech.armorResistance ?? 0}；减少暴击率`,
    `车型基础 ${base.defense} / 反应装甲 ${s.tech.armorPlating}；每级+2%基础防御`,
    `纵深防护 ${s.tech.defense ?? 0}；减伤评级 ${defenseStats(st).rating}`,
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
      percent: (i >= 2 && i <= 6) || i === 8,
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
      '白板基准由伤害、生命等归一化得到，单列以保持同阶四系等分。乘算加成按对数权重分摊，整数尾差归并；各增量加基础分恰等于总战力。满编额外统率容量单列；指挥官先手与二次开火是全军统一系数，此处显示分摊到战力的贡献，不是车辆自身属性。条件光环、克制、载重和经济属性不重复计分。',
  };
}
