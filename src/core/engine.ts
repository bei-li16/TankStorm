import {
  allJobs,
  queueStatus,
  vipBenefits,
  buildingDuration,
  researchDuration,
  travelDuration,
  accelerationCost,
} from './vip';
import { validateShape } from './validate';
import { coreList, coreNames, dungeons, enableArsenal, productionQuote } from './arsenal';
import { enableRenewableWorld, nextWorldEvent, settleWorld, WORLD_RULES } from './world';
import { army, rng32, simulate, survivors } from './battle';
import {
  RULESET,
  buildingNames,
  costCurve,
  quests,
  resourceNames,
  rateCurve,
  researchCost,
  rules,
  stageFormation,
  stageNames,
  stageReward,
  techNames,
  unitList,
  units,
  upgradeCost,
} from './content';
import {
  resources,
  type BattleReport,
  type Building,
  type Command,
  type Cost,
  type Formation,
  type GameState,
  type Job,
  type JobKind,
  type March,
  type Resource,
  type Technology,
  type Wallet,
  type WorldSite,
} from './types';
export const emptyWallet = (): Wallet => ({
  iron: 0,
  oil: 0,
  lead: 0,
  titanium: 0,
  crystal: 0,
  gold: 0,
});
const currencies = [...resources, 'gold'] as const;
function fail(message: string): never {
  throw Error(message);
}
const integer = (n: number, min = 0, max = 1000000) =>
  Number.isSafeInteger(n) && n >= min && n <= max;
export function commanderRank(s: GameState) {
  const p = s.commander.prestige;
  return p >= 500 ? '少校' : p >= 200 ? '上尉' : p >= 50 ? '中尉' : '少尉';
}
export function commanderLevel(s: GameState) {
  return Math.min(50, 1 + Math.floor(Math.sqrt(s.commander.xp / 50)));
}
export function leadershipCap(s: GameState) {
  return 20 + (s.commander.leadership - 1) * 5;
}
export function capacity(s: GameState) {
  return Math.floor(
    ((10000 + (s.buildings.warehouse - 1) * 5000) * (100 + vipBenefits(s).storage)) / 100,
  );
}
export function protectedAmount(s: GameState) {
  return s.buildings.warehouse * 1000;
}
export function rate(s: GameState, r: Resource) {
  return r === 'titanium' && s.buildings.hq < 8
    ? 0
    : Math.floor((rules.economy.baseRatePerHour[r] * rateCurve[s.buildings[r]]) / 10000);
}
export function scaleCost(cost: Cost, n: number): Cost {
  return Object.fromEntries(Object.entries(cost).map(([r, v]) => [r, v * n]));
}
export function afford(s: GameState, cost: Cost) {
  return currencies.every((r) => s.wallet[r] >= (cost[r] ?? 0));
}
function pay(s: GameState, cost: Cost) {
  if (!afford(s, cost)) {
    const missing = currencies.filter((r) => s.wallet[r] < (cost[r] ?? 0));
    fail(
      '资源不足：' +
        missing.map((r) => `${resourceNames[r]}缺 ${(cost[r] ?? 0) - s.wallet[r]}`).join('、'),
    );
  }
  for (const r of currencies) s.wallet[r] -= cost[r] ?? 0;
}
function credit(s: GameState, cost: Cost) {
  for (const r of currencies) s.wallet[r] += cost[r] ?? 0;
}
function count(s: GameState, key: string, n = 1) {
  s.counters[key] = (s.counters[key] ?? 0) + n;
}
function notice(s: GameState, text: string) {
  s.notices.unshift({ id: ++s.sequence, at: s.now, text });
  s.notices = s.notices.slice(0, 60);
}
function nextSeed(s: GameState) {
  s.seed = rng32(s.seed)();
  return s.seed || 1;
}
function generateWorld(seed: number, now: number): WorldSite[] {
  const next = rng32(seed),
    sites: WorldSite[] = [];
  const used = new Set(['16,16']);
  // Nearby safe iron/oil deposits make the first expedition legible and affordable.
  for (let i = 0; i < 100; i++) {
    let x = i === 0 ? 17 : i === 1 ? 15 : next() % 32,
      y = i === 0 ? 16 : i === 1 ? 17 : next() % 32;
    while (used.has(`${x},${y}`)) {
      x = next() % 32;
      y = next() % 32;
    }
    used.add(`${x},${y}`);
    const level = i < 2 ? 1 : 1 + Math.min(7, Math.floor(Math.hypot(x - 16, y - 16) / 3));
    const kind = i % 7 === 6 ? 'npc' : 'mine';
    const r = resources[i % 5];
    const guards: Formation = Array.from({ length: 6 }, (_, j) =>
      i < 2 || j >= Math.min(level, 6)
        ? null
        : {
            unitId: `${['tank', 'tank_destroyer', 'spg', 'rocket'][j % 4]}_t${level >= 6 ? 2 : 1}`,
            count: 2 + level * 2,
          },
    );
    const wallet = emptyWallet();
    for (const resource of resources) wallet[resource] = 1000 + level * 500;
    sites.push({
      id: `site-${i}`,
      x,
      y,
      kind,
      name:
        kind === 'npc'
          ? '边境据点'
          : `${{ iron: '铁矿', oil: '油田', lead: '铅矿', titanium: '钛矿', crystal: '水晶矿' }[r]}`,
      level,
      resource: r,
      reserve: 1000 + level * 1000,
      guards,
      wallet,
      lastGrowth: now,
      conquered: false,
    });
  }
  return sites;
}
export function newGame(id: string, nickname: string, now: number, seed = 2601001): GameState {
  if (!integer(now, 0, 8640000000000000) || !integer(seed, 1, 4294967295)) fail('无效的新存档参数');
  const stocks = Object.fromEntries(unitList.map((u) => [u.unitId, 0]));
  Object.assign(stocks, { tank_t1: 20, tank_destroyer_t1: 8, spg_t1: 6, rocket_t1: 6 });
  const state: GameState = {
    schema: 1,
    ruleset: RULESET,
    id,
    nickname: nickname.trim().slice(0, 16) || '归来的指挥官',
    worldSeed: seed,
    worldRules: WORLD_RULES,
    seed,
    revision: 0,
    now,
    createdAt: now,
    sequence: 0,
    wallet: { ...rules.economy.initialWallet },
    remainders: { iron: 0, oil: 0, lead: 0, titanium: 0, crystal: 0 },
    buildings: {
      hq: 1,
      lab: 1,
      factory: 1,
      warehouse: 1,
      iron: 1,
      oil: 1,
      lead: 1,
      titanium: 1,
      crystal: 1,
    },
    tech: { attack: 0, hp: 0, production: 0, construction: 0, gather: 0 },
    available: { ...stocks },
    damaged: Object.fromEntries(unitList.map((u) => [u.unitId, 0])),
    createdUnits: { ...stocks },
    destroyedUnits: Object.fromEntries(unitList.map((u) => [u.unitId, 0])),
    formation: [
      { unitId: 'tank_t1', count: 20 },
      { unitId: 'tank_destroyer_t1', count: 8 },
      null,
      { unitId: 'spg_t1', count: 6 },
      { unitId: 'rocket_t1', count: 6 },
      null,
    ],
    presets: [],
    jobs: {},
    marches: [],
    world: generateWorld(seed, now),
    home: { x: 16, y: 16 },
    intel: {},
    reports: [],
    cleared: [],
    commander: { xp: 0, leadership: 1, books: 2, prestige: 0, skillPoints: 1, attackSkill: 0 },
    counters: { started: 1 },
    claimed: [],
    lastDaily: -1,
    receipts: {},
    notices: [{ id: 0, at: now, text: '欢迎归队。40 辆初始战车已集结，前往任务领取补给。' }],
  };
  enableArsenal(state);
  return state;
}
export function validateFormation(s: GameState, f: Formation, requireTroops = false) {
  if (!Array.isArray(f) || f.length !== 6) fail('编队必须为六个阵位');
  const totals: Record<string, number> = {};
  for (const slot of f) {
    if (!slot) continue;
    if (!units[slot.unitId] || !integer(slot.count, 1, leadershipCap(s)))
      fail(`每格最多可携带 ${leadershipCap(s)} 辆战车`);
    totals[slot.unitId] = (totals[slot.unitId] ?? 0) + slot.count;
  }
  for (const [id, n] of Object.entries(totals))
    if (n > (s.available[id] ?? 0)) fail(`${units[id].name} 库存不足，出征中的部队无法重复使用`);
  if (requireTroops && !Object.keys(totals).length) fail('请先在编队中部署战车');
}
export function usableFormation(s: GameState): Formation {
  const remaining = { ...s.available };
  return s.formation.map((slot) => {
    if (!slot) return null;
    const n = Math.min(slot.count, remaining[slot.unitId], leadershipCap(s));
    remaining[slot.unitId] -= n;
    return n ? { unitId: slot.unitId, count: n } : null;
  });
}
export function maxFormation(s: GameState): Formation {
  const remaining = { ...s.available };
  return Array.from({ length: 6 }, (_, i) => {
    const preferred = ['tank', 'tank_destroyer', 'tank', 'spg', 'rocket', 'spg'][i];
    const u =
      [...unitList].reverse().find((u) => u.classId === preferred && remaining[u.unitId] > 0) ??
      [...unitList].reverse().find((u) => remaining[u.unitId] > 0);
    if (!u) return null;
    const n = Math.min(remaining[u.unitId], leadershipCap(s));
    remaining[u.unitId] -= n;
    return { unitId: u.unitId, count: n };
  });
}
function reserve(s: GameState, f: Formation) {
  validateFormation(s, f, true);
  for (const slot of f) if (slot) s.available[slot.unitId] -= slot.count;
}
function returnArmy(s: GameState, f: Formation) {
  for (const slot of f) if (slot) s.available[slot.unitId] += slot.count;
}
function applyLoss(s: GameState, report: BattleReport) {
  for (const c of report.casualties) {
    s.damaged[c.unitId] += c.repairable;
    s.destroyedUnits[c.unitId] += c.destroyed;
  }
}
function report(s: GameState, b: BattleReport, title: string) {
  b.id = `report-${++s.sequence}`;
  b.at = s.now;
  b.title = title;
  s.reports.unshift(b);
  s.reports = s.reports.slice(0, 100);
  return b.id;
}
export function upgradeBlock(s: GameState, b: Building): string | undefined {
  if (s.buildings[b] >= 20) return '已达最高等级';
  if (b === 'titanium' && s.buildings.hq < 8) return '指挥中心 8 级解锁';
  if (b !== 'hq' && s.buildings[b] >= s.buildings.hq) return '请先升级指挥中心';
  if (allJobs(s).some((j) => j.kind === 'building' && j.target === b)) return '此建筑正在升级';
  if (queueStatus(s, 'building').full) return '建筑队列正在工作';
  return undefined;
}
function startJob(
  s: GameState,
  kind: JobKind,
  target: string,
  total: number,
  unitCost: Cost,
  duration: number,
) {
  if (queueStatus(s, kind).full) fail('此队列正在工作，等待位已满');
  if (
    (kind === 'building' || kind === 'research') &&
    allJobs(s).some((j) => j.kind === kind && j.target === target)
  )
    fail('此项目已在队列中');
  pay(s, scaleCost(unitCost, total));
  const job: Job = {
    kind,
    target,
    total,
    completed: 0,
    unitCost,
    duration,
    startedAt: s.now,
    dueAt: s.now + duration,
    seq: ++s.sequence,
  };
  if (kind === 'building') {
    const key = Array.from({ length: vipBenefits(s).building }, (_, i) =>
      i === 0 ? 'building' : `building:${i + 1}`,
    ).find((k) => !s.jobs[k as keyof typeof s.jobs])!;
    s.jobs[key as keyof typeof s.jobs] = job;
  } else if (s.jobs[kind]) {
    (s.jobBacklog ??= []).push(job);
  } else s.jobs[kind] = job;
  return job;
}
function removeJob(s: GameState, job: Job) {
  const key = Object.keys(s.jobs).find((k) => s.jobs[k as keyof typeof s.jobs]?.seq === job.seq);
  if (key) {
    delete s.jobs[key as keyof typeof s.jobs];
    const next = (s.jobBacklog ?? []).find((j) => j.kind === job.kind);
    if (next) {
      s.jobBacklog = s.jobBacklog!.filter((j) => j.seq !== next.seq);
      next.startedAt = s.now;
      next.dueAt = s.now + next.duration;
      s.jobs[next.kind] = next;
    }
  } else s.jobBacklog = (s.jobBacklog ?? []).filter((j) => j.seq !== job.seq);
}
function commandJob(s: GameState, kind: JobKind, seq?: number) {
  return seq === undefined
    ? s.jobs[kind]
    : allJobs(s).find((j) => j.kind === kind && j.seq === seq);
}
function finishJob(s: GameState, job: Job) {
  if (job.kind === 'building') {
    s.buildings[job.target as Building]++;
    count(s, 'build');
    notice(s, `${buildingNames[job.target as Building]}升级完成`);
  } else if (job.kind === 'research') {
    s.tech[job.target as Technology]++;
    count(s, 'research');
    notice(s, `${techNames[job.target as Technology]}研究完成`);
  } else {
    s.available[job.target]++;
    count(s, job.kind === 'production' ? 'produce' : 'repair');
    if (job.kind === 'production') {
      s.createdUnits[job.target]++;
      if (job.sourceUnitId) s.arsenal!.converted[job.sourceUnitId]++;
    }
  }
  job.completed++;
  if (job.completed === job.total) {
    removeJob(s, job);
    if (job.total > 1)
      notice(
        s,
        `${units[job.target]?.name ?? job.target} ×${job.total} ${job.kind === 'repair' ? '修复' : '生产'}完成`,
      );
  } else {
    job.startedAt = s.now;
    job.dueAt = s.now + job.duration;
  }
}
function grow(s: GameState, elapsed: number) {
  for (const r of resources) {
    const cap = capacity(s);
    if (s.wallet[r] >= cap) {
      s.remainders[r] = 0;
      continue;
    }
    const n = BigInt(rate(s, r)) * BigInt(elapsed) + BigInt(s.remainders[r]);
    const gained = Number(n / 3600000n);
    s.wallet[r] = Math.min(cap, s.wallet[r] + gained);
    s.remainders[r] = s.wallet[r] >= cap ? 0 : Number(n % 3600000n);
  }
  for (const m of s.marches)
    if (m.phase === 'gathering') {
      const site = s.world.find((t) => t.id === m.targetId)!;
      const held = resources.reduce((n, r) => n + m.cargo[r], 0);
      const n = m.gatherRate * elapsed + m.remainder;
      const gained = Math.min(Math.floor(n / 3600000), m.capacity - held, site.reserve);
      site.reserve -= gained;
      m.cargo[site.resource] += gained;
      m.remainder = n % 3600000;
    }
}
function sendHome(s: GameState, m: March, travel = m.travelMs) {
  m.phase = 'returning';
  m.startedAt = s.now;
  m.dueAt = s.now + Math.max(1, travel);
  m.remainder = 0;
}
function resolveArrival(s: GameState, m: March) {
  const site = s.world.find((t) => t.id === m.targetId)!;
  let battle: BattleReport | undefined;
  if (m.phase === 'returning') {
    returnArmy(s, m.troops);
    credit(s, m.cargo);
    const amount = resources.reduce((n, r) => n + m.cargo[r], 0);
    count(s, 'cargo', amount);
    notice(s, `部队返回基地，带回 ${amount} 份物资`);
    s.marches = s.marches.filter((x) => x.id !== m.id);
    return;
  }
  if (m.phase === 'gathering') {
    sendHome(s, m);
    return;
  }
  if (site.guards.some(Boolean)) {
    const b = simulate(
      m.combatArmy ?? army(m.troops, s.tech, s.commander.attackSkill),
      army(site.guards),
      nextSeed(s),
      'world',
    );
    battle = b;
    applyLoss(s, b);
    m.troops = survivors(b.final[0]);
    site.guards = survivors(b.final[1]);
    report(s, b, `${site.name} (${site.x}, ${site.y})`);
    if (b.winner !== 0) {
      if (m.troops.some(Boolean)) sendHome(s, m);
      else s.marches = s.marches.filter((x) => x.id !== m.id);
      notice(s, '远征未能突破守军，请查看战报');
      return;
    }
    count(s, 'victory');
    s.commander.xp += 30 * site.level;
    s.commander.prestige += site.level * 5;
    b.growth = { xp: 30 * site.level, books: 0, skillPoints: 0, prestige: site.level * 5 };
    site.conquered = true;
  }
  m.capacity = m.troops.reduce((n, t) => n + (t ? units[t.unitId].load * t.count : 0), 0);
  if (m.mission === 'raid') {
    let free = m.capacity;
    for (const r of resources) {
      const loot = Math.min(free, Math.max(0, site.wallet[r] - 1000));
      m.cargo[r] += loot;
      site.wallet[r] -= loot;
      free -= loot;
    }
    if (battle) battle.rewards = { ...m.cargo };
    sendHome(s, m);
  } else {
    const occupied = s.marches.some(
      (x) => x.id !== m.id && x.targetId === m.targetId && x.phase === 'gathering',
    );
    if (occupied || site.reserve === 0) {
      sendHome(s, m);
      notice(s, occupied ? '矿点已被己方部队占用，后到部队返航' : '矿点已枯竭，部队返航');
      return;
    }
    m.phase = 'gathering';
    m.startedAt = s.now;
    m.dueAt =
      s.now + Math.max(1, Math.ceil((Math.min(m.capacity, site.reserve) * 3600000) / m.gatherRate));
    notice(s, `${site.name}采集开始，装满后自动返航`);
  }
}
function advanceInPlace(s: GameState, target: number) {
  enableArsenal(s);
  enableRenewableWorld(s);
  target = Math.max(s.now, Math.floor(target));
  if (!integer(target, 0, 8640000000000000) || target - s.now > 315360000000) fail('时间跨度过大');
  let iterations = 0;
  while (s.now < target) {
    if (++iterations > 100000) fail('事件过多，时间结算已中止');
    const pending = [
      ...Object.values(s.jobs).map((j) => ({ at: j!.dueAt, priority: 10, seq: j!.seq, job: j })),
      ...s.marches.map((m) => ({
        at: m.dueAt,
        priority: m.phase === 'gathering' ? 20 : 30,
        seq: m.seq,
        march: m,
      })),
    ].sort((a, b) => a.at - b.at || a.priority - b.priority || a.seq - b.seq);
    const event = pending[0];
    const worldAt = nextWorldEvent(s);
    const next = Math.min(target, event?.at ?? target, worldAt);
    grow(s, Math.max(0, next - s.now));
    s.now = next;
    if (event && event.at <= next) {
      if ('job' in event) finishJob(s, event.job!);
      else resolveArrival(s, event.march);
    } else if (worldAt <= next) {
      settleWorld(s);
    }
  }
  // Drain simultaneous completions at the exact boundary in priority order.
  const due = [
    ...Object.values(s.jobs).map((j) => ({ at: j!.dueAt, priority: 10, seq: j!.seq, job: j })),
    ...s.marches.map((m) => ({
      at: m.dueAt,
      priority: m.phase === 'gathering' ? 20 : 30,
      seq: m.seq,
      march: m,
    })),
  ]
    .filter((e) => e.at <= s.now)
    .sort((a, b) => a.at - b.at || a.priority - b.priority || a.seq - b.seq);
  if (due.length) {
    for (const e of due) {
      if ('job' in e) finishJob(s, e.job!);
      else if (s.marches.includes(e.march)) resolveArrival(s, e.march);
    }
    advanceInPlace(s, target);
  }
  if (nextWorldEvent(s) <= s.now) settleWorld(s);
}
export function advance(state: GameState, time: number): GameState {
  const s = structuredClone(state);
  advanceInPlace(s, time);
  s.revision++;
  return s;
}
export function execute(
  state: GameState,
  command: Command,
  time: number,
  id: string,
  expectedRevision = state.revision,
): { state: GameState; result: string } {
  const signature = JSON.stringify(command);
  const receipt = state.receipts[id];
  if (receipt) {
    if (receipt.signature !== signature) fail('命令编号冲突');
    return { state, result: receipt.result };
  }
  if (expectedRevision !== state.revision) fail('存档已更新，请重试');
  const s = structuredClone(state);
  advanceInPlace(s, time);
  let result = '操作完成';
  switch (command.type) {
    case 'rest': {
      if (![60, 480].includes(command.minutes)) fail('请选择休整 1 小时或 8 小时');
      const elapsed = command.minutes * 60000;
      if ((s.timeOffset ?? 0) + elapsed > 315360000000) fail('此存档的休整时间已达到上限');
      s.timeOffset = (s.timeOffset ?? 0) + elapsed;
      advanceInPlace(s, s.now + elapsed);
      result = `已休整 ${command.minutes / 60} 小时，生产、资源与行军按时间结算`;
      break;
    }
    case 'upgrade': {
      const b = command.building;
      if (!(b in buildingNames)) fail('未知建筑');
      const block = upgradeBlock(s, b);
      if (block) fail(block);
      startJob(s, 'building', b, 1, upgradeCost(b, s.buildings[b]), buildingDuration(s, b));
      result = '建筑升级已开始';
      break;
    }
    case 'research': {
      const t = command.tech;
      if (!(t in techNames)) fail('未知科技');
      if (s.tech[t] >= Math.min(20, s.buildings.lab)) fail('请先升级科研中心');
      startJob(s, 'research', t, 1, researchCost(s.tech[t]), researchDuration(s, t));
      result = '研究已开始';
      break;
    }
    case 'produce':
    case 'refit':
    case 'repair': {
      const u = units[command.unitId];
      if (!u || !integer(command.count, 1, 10000)) fail('请输入 1 至 10000 的整数数量');
      const repairing = command.type === 'repair';
      const quote = productionQuote(s, u.unitId, command.type);
      if (quote.block) fail(quote.block);
      if (repairing && s.damaged[u.unitId] < command.count) fail('受损战车不足');
      if (quote.coreCost && s.arsenal!.cores[quote.coreCost.id] < command.count)
        fail(`${coreNames[quote.coreCost.id]}不足，请挑战核心副本`);
      if (quote.sourceUnitId && s.available[quote.sourceUnitId] < command.count)
        fail('用于改装的低一阶待命战车不足');
      const job = startJob(
        s,
        repairing ? 'repair' : 'production',
        u.unitId,
        command.count,
        quote.unitCost,
        quote.duration,
      );
      if (repairing) s.damaged[u.unitId] -= command.count;
      if (quote.coreCost) {
        s.arsenal!.cores[quote.coreCost.id] -= command.count;
        job.coreCost = { ...quote.coreCost };
      }
      if (quote.sourceUnitId) {
        s.available[quote.sourceUnitId] -= command.count;
        job.sourceUnitId = quote.sourceUnitId;
      }
      result = repairing ? '修复已开始' : command.type === 'refit' ? '改装已开始' : '生产已开始';
      break;
    }
    case 'cancel': {
      const j = commandJob(s, command.kind, command.seq);
      if (!j) fail('队列已结束');
      const left = j.total - j.completed;
      credit(s, scaleCost(j.unitCost, left));
      if (j.kind === 'repair') s.damaged[j.target] += left;
      if (j.sourceUnitId) s.available[j.sourceUnitId] += left;
      if (j.coreCost) s.arsenal!.cores[j.coreCost.id] += j.coreCost.count * left;
      removeJob(s, j);
      result = `已取消，退还 ${left} 份未完成任务的资源`;
      break;
    }
    case 'accelerate': {
      const j = commandJob(s, command.kind, command.seq);
      if (!j) fail('队列已结束');
      if ((s.jobBacklog ?? []).some((x) => x.seq === j.seq)) fail('请等待项目开工后再加速');
      const cost = accelerationCost(s, j);
      pay(s, { gold: cost });
      while (j.completed < j.total) finishJob(s, j);
      result = cost ? `消耗 ${cost} 金币，项目已完成` : 'VIP 免费加速，项目已完成';
      break;
    }
    case 'formation':
      validateFormation(s, command.slots);
      s.formation = structuredClone(command.slots);
      count(s, 'formation');
      result = '编队已保存';
      break;
    case 'presetSave': {
      const name = command.name.trim().slice(0, 20);
      if (!name) fail('请输入预设名称');
      if (s.presets.length >= 5) fail('最多保存 5 个编队预设');
      s.presets.push({ name, formation: structuredClone(s.formation) });
      result = '预设已保存';
      break;
    }
    case 'presetLoad': {
      const p = s.presets[command.index];
      if (!p) fail('预设不存在');
      validateFormation(s, p.formation);
      s.formation = structuredClone(p.formation);
      result = '预设已载入';
      break;
    }
    case 'battle': {
      const index = command.stage;
      if (!integer(index, 0, 11)) fail('战役不存在');
      if (!command.training && index > 0 && !s.cleared.includes(index - 1))
        fail('请先通过上一战役');
      const f = usableFormation(s);
      validateFormation(s, f, true);
      const b = simulate(
        army(f, s.tech, s.commander.attackSkill),
        army(stageFormation(index)),
        nextSeed(s),
        command.training ? 'training' : 'stage',
      );
      if (!command.training) {
        reserve(s, f);
        applyLoss(s, b);
        returnArmy(s, survivors(b.final[0]));
        if (b.winner === 0) {
          const first = !s.cleared.includes(index);
          b.rewards = stageReward(index, first);
          credit(s, b.rewards);
          if (first) {
            s.cleared.push(index);
            s.commander.books += 1;
            s.commander.skillPoints += 1;
          }
          count(s, 'victory');
          s.counters.cleared = s.cleared.length;
          s.commander.xp += Math.floor(((index + 1) * 50 * (100 + vipBenefits(s).xp)) / 100);
          s.commander.prestige += 10 + index * 5;
          b.growth = {
            xp: Math.floor(((index + 1) * 50 * (100 + vipBenefits(s).xp)) / 100),
            prestige: 10 + index * 5,
            books: first ? 1 : 0,
            skillPoints: first ? 1 : 0,
          };
        }
      }
      result = report(s, b, `${command.training ? '演习 · ' : ''}${stageNames[index]}`);
      break;
    }
    case 'dungeon': {
      const dungeon = dungeons.find((d) => d.id === command.dungeonId);
      if (!dungeon) fail('副本不存在');
      if (!command.training && s.buildings.factory < dungeon.factoryLevel)
        fail(`核心副本需要工厂 ${dungeon.factoryLevel} 级`);
      const f = usableFormation(s);
      validateFormation(s, f, true);
      const b = simulate(
        army(f, s.tech, s.commander.attackSkill),
        army(dungeon.formation),
        nextSeed(s),
        command.training ? 'training' : 'dungeon',
      );
      if (!command.training) {
        reserve(s, f);
        applyLoss(s, b);
        returnArmy(s, survivors(b.final[0]));
        if (b.winner === 0) {
          const first = !s.arsenal!.cleared.includes(dungeon.id);
          const amount = first ? dungeon.firstReward : dungeon.repeatReward;
          s.arsenal!.cores[dungeon.coreId] += amount;
          b.coreRewards = { [dungeon.coreId]: amount };
          if (first) s.arsenal!.cleared.push(dungeon.id);
          count(s, 'dungeonVictory');
          notice(s, `缴获${coreNames[dungeon.coreId]} ×${amount}`);
        }
      }
      result = report(s, b, `${command.training ? '演习 · ' : ''}${dungeon.name}`);
      break;
    }
    case 'scout': {
      const site = s.world.find((t) => t.id === command.targetId);
      if (!site) fail('目标不存在');
      pay(s, { crystal: 3 });
      s.intel[site.id] = {
        at: s.now,
        guards: structuredClone(site.guards),
        reserve: site.reserve,
        wallet: structuredClone(site.wallet),
      };
      count(s, 'scout');
      result = '侦察完成，情报已更新';
      break;
    }
    case 'march': {
      const site = s.world.find((t) => t.id === command.targetId);
      if (!site) fail('目标不存在');
      if ((site.kind === 'mine') !== (command.mission === 'gather')) fail('任务类型不匹配');
      if (s.marches.length >= vipBenefits(s).marches) fail('行军队列已满');
      const f = usableFormation(s);
      reserve(s, f);
      const travelMs = travelDuration(s, site);
      s.marches.push({
        id: `march-${++s.sequence}`,
        targetId: site.id,
        phase: 'outbound',
        mission: command.mission,
        troops: f,
        combatArmy: army(f, s.tech, s.commander.attackSkill),
        startedAt: s.now,
        dueAt: s.now + travelMs,
        travelMs,
        cargo: emptyWallet(),
        capacity: f.reduce((n, t) => n + (t ? units[t.unitId].load * t.count : 0), 0),
        gatherRate: 300 + s.tech.gather * 15,
        remainder: 0,
        seq: s.sequence,
      });
      result = '部队已出发';
      break;
    }
    case 'recall': {
      const m = s.marches.find((m) => m.id === command.marchId);
      if (!m) fail('部队已返回');
      if (m.phase === 'returning') fail('部队已在返航');
      const travel =
        m.phase === 'outbound' ? Math.min(m.travelMs, s.now - m.startedAt) : m.travelMs;
      sendHome(s, m, travel);
      result = '部队开始返航，已采集物资随队带回';
      break;
    }
    case 'leadership': {
      const cost = s.commander.leadership;
      if (cost >= 20) fail('统率已达最高等级');
      if (s.commander.books < cost) fail(`需要 ${cost} 本统率书`);
      s.commander.books -= cost;
      s.commander.leadership++;
      result = `统率提升，单格上限 ${leadershipCap(s)}`;
      break;
    }
    case 'skill':
      if (s.commander.skillPoints < 1) fail('技能点不足');
      if (s.commander.attackSkill >= 20) fail('技能已达最高等级');
      s.commander.skillPoints--;
      s.commander.attackSkill++;
      result = '战术指挥提升，全队攻击增加 2%';
      break;
    case 'daily': {
      const day = Math.floor((s.now + 28800000) / 86400000);
      if (day <= s.lastDaily) fail('今日补给已领取');
      s.lastDaily = day;
      s.commander.prestige += 20;
      s.commander.books++;
      credit(s, { crystal: 100, gold: 5 });
      result = '已领取每日补给';
      break;
    }
    case 'claim': {
      const q = quests.find((q) => q.id === command.questId);
      if (!q) fail('任务不存在');
      if (s.claimed.includes(q.id)) fail('奖励已领取');
      if ((s.counters[q.counter] ?? 0) < q.target) fail('任务尚未完成');
      credit(s, q.reward);
      s.commander.books += q.books ?? 0;
      s.claimed.push(q.id);
      result = '任务奖励已领取';
      break;
    }
    case 'vipRecharge': {
      if (!integer(command.gold, 1, 10000000)) fail('模拟充值请输入 1 至 10000000 的整数金币');
      s.vip ??= { version: 1, paidGold: 0, lastDaily: -1 };
      if (s.vip.paidGold + command.gold > 1e12 || s.wallet.gold + command.gold > 1e12)
        fail('金币达到存档上限');
      s.vip.paidGold += command.gold;
      s.wallet.gold += command.gold;
      result = `模拟充值 ${command.gold} 金币，当前 VIP ${vipBenefits(s).level}`;
      break;
    }
    case 'vipDaily': {
      const v = vipBenefits(s);
      if (!v.level || !s.vip) fail('VIP 1 解锁专属补给');
      const day = Math.floor((s.now + 28800000) / 86400000);
      if (day <= s.vip.lastDaily) fail('今日 VIP 补给已领取');
      s.vip.lastDaily = day;
      credit(s, { gold: v.dailyGold });
      result = `VIP 补给：金币 +${v.dailyGold}`;
      break;
    }
    case 'rename':
      if (!command.nickname.trim() || command.nickname.length > 16) fail('昵称应为 1 至 16 个字符');
      s.nickname = command.nickname.trim();
      result = '指挥官名称已更新';
      break;
    default:
      fail('未知命令');
  }
  s.revision++;
  s.receipts[id] = { signature, result, revision: s.revision };
  assertState(s);
  return { state: s, result };
}
export function assertState(s: GameState) {
  validateShape(s);
  if (!s || s.schema !== 1 || s.ruleset !== RULESET) fail('此存档版本不受支持');
  if (s.arsenal) {
    if (
      Object.keys(s.arsenal.cores).length !== coreList.length ||
      coreList.some((c) => !integer(s.arsenal!.cores[c.id], 0, 1e9))
    )
      fail('核心库存无效');
    if (
      s.arsenal.cleared.some((id) => !dungeons.some((d) => d.id === id)) ||
      new Set(s.arsenal.cleared).size !== s.arsenal.cleared.length
    )
      fail('副本进度无效');
    if (Object.keys(s.arsenal.converted).length !== unitList.length) fail('改装账目无效');
  }
  if (typeof s.id !== 'string' || !s.id || typeof s.nickname !== 'string' || s.nickname.length > 16)
    fail('存档身份无效');
  if (
    !integer(s.now, 0, 8640000000000000) ||
    !integer(s.revision, 0, 1e12) ||
    !integer(s.seed, 1, 4294967295) ||
    !integer(s.sequence, 0, 1e12)
  )
    fail('存档时间或序号无效');
  for (const r of currencies) if (!integer(s.wallet[r], 0, 1e12)) fail('存档资源无效');
  for (const r of resources) if (!integer(s.remainders[r], 0, 3599999)) fail('产量余数无效');
  for (const b of Object.keys(buildingNames) as Building[])
    if (!integer(s.buildings[b], 1, 20)) fail('建筑等级无效');
  for (const t of Object.keys(techNames) as Technology[])
    if (!integer(s.tech[t], 0, 20)) fail('科技等级无效');
  if (!integer(s.commander.leadership, 1, 20) || !integer(s.commander.attackSkill, 0, 20))
    fail('指挥官等级无效');
  for (const k of ['xp', 'books', 'prestige', 'skillPoints'] as const)
    if (!integer(s.commander[k], 0, 1e12)) fail('指挥官数据无效');
  const validF = (f: Formation) => {
    if (!Array.isArray(f) || f.length !== 6) fail('阵位数据无效');
    for (const t of f)
      if (t && (!units[t.unitId] || !integer(t.count, 1, 10000))) fail('战车数据无效');
  };
  validF(s.formation);
  if (!Array.isArray(s.marches) || s.marches.length > vipBenefits(s).marches) fail('行军数据无效');
  if (
    !Array.isArray(s.world) ||
    s.world.length !== 100 ||
    new Set(s.world.map((t) => t.id)).size !== 100
  )
    fail('世界数据无效');
  for (const t of s.world) {
    if (
      !integer(t.x, 0, 31) ||
      !integer(t.y, 0, 31) ||
      !resources.includes(t.resource) ||
      !['mine', 'npc'].includes(t.kind) ||
      !integer(t.reserve, 0, 1e9)
    )
      fail('地图数据无效');
    validF(t.guards);
    if (s.worldRules && (t.lastGrowth > s.now || s.now - t.lastGrowth >= 3600000))
      fail('世界补给时刻无效');
    for (const r of currencies) if (!integer(t.wallet[r], 0, 1e12)) fail('据点资源无效');
  }
  const pendingJobs = s.jobBacklog ?? [];
  for (const [key, j] of Object.entries(s.jobs)) {
    if (!j || !(key === j.kind || (j.kind === 'building' && /^building:[2-7]$/.test(key))))
      fail('队列编号无效');
  }
  for (const kind of ['building', 'production', 'research', 'repair'] as JobKind[]) {
    const q = queueStatus(s, kind);
    if (
      q.active.length > q.slots ||
      q.waiting.length > q.waitingSlots ||
      (q.waiting.length && !q.active.length)
    )
      fail('队列超出 VIP 容量');
  }
  if (new Set(allJobs(s).map((j) => j.seq)).size !== allJobs(s).length) fail('队列序号重复');
  for (const kind of ['building', 'research']) {
    const targets = allJobs(s)
      .filter((j) => j.kind === kind)
      .map((j) => j.target);
    if (new Set(targets).size !== targets.length) fail('同一项目重复排队');
  }
  for (const j of allJobs(s)) {
    const kind = j.kind;
    const pending = pendingJobs.includes(j);
    if (
      !['building', 'research', 'production', 'repair'].includes(kind) ||
      (pending && (j.completed !== 0 || !['research', 'production'].includes(kind))) ||
      !integer(j!.total, 1, 10000) ||
      !integer(j!.completed, 0, j!.total - 1) ||
      !integer(j!.duration, 1, 1e12) ||
      (!pending && j!.dueAt < s.now) ||
      !integer(j!.dueAt, 0, 8640000000000000)
    )
      fail('队列数据无效');
    if ((kind === 'production' || kind === 'repair') && !units[j!.target]) fail('未知战车');
    if (
      j!.sourceUnitId &&
      (kind !== 'production' ||
        !s.arsenal ||
        units[j!.target]?.tier < 2 ||
        j!.sourceUnitId !== `${units[j!.target].classId}_t${units[j!.target].tier - 1}`)
    )
      fail('改装来源无效');
    const requiredCore =
      kind === 'production' && units[j!.target]?.tier >= 6
        ? `${units[j!.target].classId}_core${units[j!.target].tier}`
        : '';
    if (
      j!.coreCost
        ? !s.arsenal || j!.coreCost.id !== requiredCore || j!.coreCost.count !== 1
        : !!requiredCore
    )
      fail('队列核心无效');
    if (kind === 'building' && !(j!.target in buildingNames)) fail('未知建筑');
    if (kind === 'research' && !(j!.target in techNames)) fail('未知科技');
    for (const [r, v] of Object.entries(j!.unitCost))
      if (!currencies.includes(r as (typeof currencies)[number]) || !integer(v, 0, 1e12))
        fail('队列资源无效');
  }
  for (const m of s.marches) {
    validF(m.troops);
    if (
      !s.world.some((t) => t.id === m.targetId) ||
      !['outbound', 'gathering', 'returning'].includes(m.phase) ||
      !integer(m.dueAt, s.now, 8640000000000000) ||
      !integer(m.travelMs, 1, 1e9) ||
      !integer(m.capacity, 0, 1e9) ||
      !integer(m.gatherRate, 1, 1e6) ||
      !integer(m.remainder, 0, 3599999)
    )
      fail('行军状态无效');
    for (const r of currencies) if (!integer(m.cargo[r], 0, 1e12)) fail('行军货物无效');
  }
  for (const u of unitList) {
    const id = u.unitId;
    if (!s.arsenal && u.tier > 3) {
      if (
        [s.available, s.damaged, s.createdUnits, s.destroyedUnits].some(
          (stock) => (stock[id] ?? 0) !== 0,
        )
      )
        fail('旧存档不能包含高阶库存');
      continue;
    }
    for (const stock of [s.available, s.damaged, s.createdUnits, s.destroyedUnits])
      if (!integer(stock[id], 0, 1e9)) fail('兵力库存无效');
    const onMarch = s.marches.reduce(
      (n, m) => n + m.troops.reduce((n, t) => n + (t?.unitId === id ? t.count : 0), 0),
      0,
    );
    const repair = s.jobs.repair?.target === id ? s.jobs.repair.total - s.jobs.repair.completed : 0;
    const refit = allJobs(s).reduce(
      (n, j) => n + (j.sourceUnitId === id ? j.total - j.completed : 0),
      0,
    );
    const converted = s.arsenal?.converted[id] ?? 0;
    if (s.arsenal && !integer(s.arsenal.converted[id], 0, 1e9)) fail('改装账目无效');
    if (
      s.available[id] +
        s.damaged[id] +
        onMarch +
        repair +
        refit +
        converted +
        s.destroyedUnits[id] !==
      s.createdUnits[id]
    )
      fail('兵力守恒校验失败');
  }
  if (
    !Array.isArray(s.cleared) ||
    s.cleared.some((n) => !integer(n, 0, 11)) ||
    new Set(s.cleared).size !== s.cleared.length
  )
    fail('战役进度无效');
  if (
    !Array.isArray(s.claimed) ||
    s.claimed.some((id) => !quests.some((q) => q.id === id)) ||
    new Set(s.claimed).size !== s.claimed.length
  )
    fail('任务数据无效');
  if (
    !Array.isArray(s.reports) ||
    s.reports.length > 100 ||
    !s.receipts ||
    typeof s.receipts !== 'object' ||
    !Array.isArray(s.notices)
  )
    fail('记录数据无效');
  for (const p of s.presets) {
    if (typeof p.name !== 'string') fail('预设无效');
    validF(p.formation);
  }
  for (const r of s.reports) {
    if (
      r.coreRewards &&
      (r.mode !== 'dungeon' ||
        r.winner !== 0 ||
        Object.keys(r.coreRewards).some((id) => !coreList.some((c) => c.id === id)))
    )
      fail('战报核心奖励无效');
  }
}
