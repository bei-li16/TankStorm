import { MAX_LEVEL, MAX_PRODUCTION_BATCH, facilitySpeedBps, economyBonus } from './growth';
import { enableCommander, leadershipQuote, BOOK_PRICE } from './commander';
import {
  enableResearch,
  researchTree,
  legacyTech,
  techLevel,
  materialCost,
  researchRequirements,
} from './research';
import {
  allJobs,
  queueStatus,
  vipBenefits,
  buildingDuration,
  researchDuration,
  travelDuration,
  accelerationCost,
  freeTime,
  jobRemaining,
  jobEffectiveRemaining,
  loadBonus,
  troopLoad,
  gatheringRate,
  unitLoad,
  expeditionLoad,
} from './vip';
import { validateShape } from './validate';
import {
  enableIndustry,
  facilityLevel,
  facilityNames,
  INDUSTRY_UNLOCK,
  jobFacility,
  productionKey,
  productionFacilities,
} from './industry';
import {
  coreList,
  coreNames,
  dungeons,
  dungeonArmy,
  dungeonBlock,
  repairAllQuote,
  enableArsenal,
  productionQuote,
} from './arsenal';
import {
  enableRenewableWorld,
  nextWorldEvent,
  settleWorld,
  WORLD_RULES,
  configureSite,
  worldLevels,
  guardArmy,
  npcProtected,
  scoutCost,
} from './world';
import { army, rng32, simulate, survivors, BATTLE_RULESET } from './battle';
import {
  RULESET,
  classNames,
  buildingNames,
  costCurve,
  quests,
  resourceNames,
  rateCurve,
  storageCurve,
  researchCost,
  rules,
  stageFormation,
  stageNames,
  stageReward,
  stageGrowth,
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
  type ProductionFacility,
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
  return Math.min(MAX_LEVEL, 1 + Math.floor(Math.sqrt(s.commander.xp / 50)));
}
export function leadershipCap(s: GameState) {
  return 20 + (s.commander.leadership - 1) * 5;
}
export function capacity(s: GameState) {
  return Math.floor(
    (storageCurve[s.buildings.warehouse] *
      (100 + vipBenefits(s).storage + economyBonus(techLevel(s, 'storage'), 5))) /
      100,
  );
}
export function protectedAmount(s: GameState) {
  return s.buildings.warehouse * 1000;
}
export function rate(s: GameState, r: Resource) {
  return r === 'titanium' && s.buildings.hq < rules.economy.titaniumUnlockHeadquartersLevel
    ? 0
    : Math.floor(
        (((rules.economy.baseRatePerHour[r] * rateCurve[s.buildings[r]]) / 10000) *
          (100 +
            economyBonus(techLevel(s, 'resourceOutput'), 5) +
            economyBonus(techLevel(s, `${r}Output` as Technology), 8))) /
          100,
      );
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
      reserve: 6000 + level * level * 6000,
      guards,
      wallet,
      lastGrowth: now,
      conquered: false,
    });
  }
  const levels = worldLevels(sites);
  for (const site of sites) configureSite(site, levels[site.id], now);
  return sites;
}
export function newGame(id: string, nickname: string, now: number, seed = 2601001): GameState {
  if (!integer(now, 0, 8640000000000000) || !integer(seed, 1, 4294967295)) fail('无效的新存档参数');
  const stocks = Object.fromEntries(unitList.map((u) => [u.unitId, 0]));
  Object.assign(stocks, { tank_t1: 20, tank_destroyer_t1: 8, spg_t1: 6, rocket_t1: 6 });
  const state: GameState = {
    schema: 1,
    commandVersion: 1,
    prestigeFloor: 1,
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
    researchVersion: 1,
    tech: Object.fromEntries(researchTree.map((t) => [t.id, 0])) as Record<Technology, number>,
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
  enableIndustry(state);
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
// Deployment and battle share one cloned transaction: a failed attack cannot
// overwrite the saved formation, spend troops, or award progress.
function battleFormation(s: GameState, formation?: Formation) {
  const f = formation === undefined ? usableFormation(s) : structuredClone(formation);
  validateFormation(s, f, true);
  if (formation !== undefined) {
    s.formation = structuredClone(f);
    count(s, 'formation');
  }
  return f;
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
  if (s.buildings[b] >= MAX_LEVEL) return '已达最高等级';
  if (b === 'titanium' && s.buildings.hq < rules.economy.titaniumUnlockHeadquartersLevel)
    return `指挥中心 ${rules.economy.titaniumUnlockHeadquartersLevel} 级解锁`;
  if (b !== 'hq' && s.buildings[b] >= s.buildings.hq) return '请先升级指挥中心';
  if (allJobs(s).some((j) => j.kind === 'building' && j.target === b)) return '此建筑正在升级';
  if (queueStatus(s, 'building').full) return '建筑队列正在工作';
  return undefined;
}
export function facilityUpgradeQuote(s: GameState, facility: 'factory' | 'factory2' | 'refit') {
  if (facility === 'factory')
    return {
      level: s.buildings.factory,
      speedPercent: facilitySpeedBps(s.buildings.factory) / 100,
      nextSpeedPercent: facilitySpeedBps(s.buildings.factory + 1) / 100,
      block: upgradeBlock(s, 'factory') ?? '',
      unitCost: materialCost(s, upgradeCost('factory', s.buildings.factory)),
      duration: buildingDuration(s, 'factory'),
    };
  const level = facilityLevel(s, facility);
  const block =
    s.buildings.hq < INDUSTRY_UNLOCK
      ? `指挥中心 ${INDUSTRY_UNLOCK} 级解锁`
      : level >= MAX_LEVEL
        ? '已达最高等级'
        : level >= s.buildings.hq
          ? '请先升级指挥中心'
          : allJobs(s).some((j) => j.kind === 'building' && j.target === facility)
            ? '此建筑正在施工'
            : queueStatus(s, 'building').full
              ? '建筑队列正在工作'
              : '';
  return {
    level,
    speedPercent: facilitySpeedBps(level) / 100,
    nextSpeedPercent: facilitySpeedBps(level + 1) / 100,
    block,
    unitCost: materialCost(s, upgradeCost('factory', Math.max(1, level))),
    duration: buildingDuration(
      { ...s, buildings: { ...s.buildings, factory: Math.max(1, level) } },
      'factory',
    ),
  };
}
function startJob(
  s: GameState,
  kind: JobKind,
  target: string,
  total: number,
  unitCost: Cost,
  duration: number,
  facility?: ProductionFacility,
) {
  if (queueStatus(s, kind, facility).full) fail('此队列正在工作，等待位已满');
  if (
    (kind === 'building' || kind === 'research') &&
    allJobs(s).some((j) => j.kind === kind && j.target === target)
  )
    fail('此项目已在队列中');
  pay(s, scaleCost(unitCost, total));
  const job: Job = {
    ...(facility ? { facility } : {}),
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
  } else {
    const key = kind === 'production' ? productionKey(facility ?? 'factory') : kind;
    if (s.jobs[key]) (s.jobBacklog ??= []).push(job);
    else s.jobs[key] = job;
  }
  return job;
}
function removeJob(s: GameState, job: Job) {
  const key = Object.keys(s.jobs).find((k) => s.jobs[k as keyof typeof s.jobs]?.seq === job.seq);
  if (key) {
    delete s.jobs[key as keyof typeof s.jobs];
    const next = (s.jobBacklog ?? []).find(
      (j) =>
        j.kind === job.kind && (j.kind !== 'production' || jobFacility(j) === jobFacility(job)),
    );
    if (next) {
      s.jobBacklog = s.jobBacklog!.filter((j) => j.seq !== next.seq);
      next.startedAt = s.now;
      next.dueAt = s.now + next.duration;
      s.jobs[key as keyof typeof s.jobs] = next;
    }
  } else s.jobBacklog = (s.jobBacklog ?? []).filter((j) => j.seq !== job.seq);
}
function commandJob(s: GameState, kind: JobKind, seq?: number) {
  return seq === undefined
    ? (s.jobs[kind] ?? queueStatus(s, kind).active[0])
    : allJobs(s).find((j) => j.kind === kind && j.seq === seq);
}
function finishJob(s: GameState, job: Job) {
  if (job.kind === 'building') {
    if (job.target === 'factory2' || job.target === 'refit') s.industry![job.target]++;
    else s.buildings[job.target as Building]++;
    count(s, 'build');
    notice(
      s,
      `${buildingNames[job.target as Building] ?? facilityNames[job.target as ProductionFacility]}建设完成`,
    );
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
    if (job.kind === 'production' || job.kind === 'repair')
      notice(
        s,
        `${units[job.target]?.name ?? job.target} ×${job.total} ${job.kind === 'repair' ? '修复' : '生产'}完成`,
      );
  } else {
    job.startedAt = s.now;
    job.dueAt = s.now + job.duration;
  }
}
export type ResourceAccounting = { generated: Cost; capacityLimited: Resource[] };
function grow(s: GameState, elapsed: number, accounting?: ResourceAccounting) {
  for (const r of resources) {
    const cap = capacity(s);
    if (s.wallet[r] >= cap) {
      if (accounting && elapsed > 0 && !accounting.capacityLimited.includes(r))
        accounting.capacityLimited.push(r);
      s.remainders[r] = 0;
      continue;
    }
    const n = BigInt(rate(s, r)) * BigInt(elapsed) + BigInt(s.remainders[r]);
    const gained = Number(n / 3600000n);
    if (accounting) {
      const actual = Math.min(cap - s.wallet[r], gained);
      accounting.generated[r] = (accounting.generated[r] ?? 0) + actual;
      if (gained > actual && !accounting.capacityLimited.includes(r))
        accounting.capacityLimited.push(r);
    }
    s.wallet[r] = Math.min(cap, s.wallet[r] + gained);
    s.remainders[r] = s.wallet[r] >= cap ? 0 : Number(n % 3600000n);
  }
  for (const m of s.marches)
    if (m.phase === 'gathering') {
      const site = s.world.find((t) => t.id === m.targetId)!;
      const held = resources.reduce((n, r) => n + m.cargo[r], 0);
      const n = BigInt(m.gatherRate) * BigInt(elapsed) + BigInt(m.remainder);
      const gained = Math.min(Number(n / 3600000n), m.capacity - held, site.reserve);
      site.reserve -= gained;
      m.cargo[site.resource] += gained;
      m.remainder = Number(n % 3600000n);
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
    recordExpedition(s, m, 'returned');
    s.marches = s.marches.filter((x) => x.id !== m.id);
    return;
  }
  if (m.phase === 'gathering') {
    const held = resources.reduce((n, r) => n + m.cargo[r], 0);
    const gain = Math.min(Math.max(0, m.capacity - held), site.reserve);
    m.cargo[site.resource] += gain;
    site.reserve -= gain;
    sendHome(s, m);
    return;
  }
  if (site.guards.some(Boolean)) {
    const b = simulate(
      m.combatArmy ?? army(m.troops, s.tech, s.commander.attackSkill),
      guardArmy(site),
      nextSeed(s),
      'world',
    );
    b.marchId = m.id;
    battle = b;
    applyLoss(s, b);
    m.troops = survivors(b.final[0]);
    site.guards = survivors(b.final[1]);
    report(s, b, `${site.name} (${site.x}, ${site.y})`);
    if (b.winner !== 0) {
      if (m.troops.some(Boolean)) sendHome(s, m);
      else {
        recordExpedition(s, m, 'defeated');
        s.marches = s.marches.filter((x) => x.id !== m.id);
      }
      notice(s, '远征未能突破守军，请查看战报');
      return;
    }
    count(s, 'victory');
    s.commander.xp += 30 * site.level;
    s.commander.prestige += site.level * 5;
    b.growth = { xp: 30 * site.level, books: 0, skillPoints: 0, prestige: site.level * 5 };
    site.conquered = true;
  }
  m.capacity = m.unitLoads
    ? m.troops.reduce((n, t) => n + (t ? m.unitLoads![t.unitId] * t.count : 0), 0)
    : troopLoad(m.troops, m.loadBps ?? 10000);
  if (m.mission === 'raid') {
    let free = m.capacity;
    for (const r of resources) {
      const loot = Math.min(free, Math.max(0, site.wallet[r] - npcProtected(site, r)));
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
function recordExpedition(s: GameState, m: March, outcome: 'returned' | 'defeated') {
  s.expeditionLog = [
    {
      marchId: m.id,
      targetId: m.targetId,
      at: s.now,
      outcome,
      cargo: { ...m.cargo },
      survivors: m.troops.reduce((n, st) => n + (st?.count ?? 0), 0),
    },
    ...(s.expeditionLog ?? []),
  ].slice(0, 100);
}
function advanceInPlace(s: GameState, target: number, accounting?: ResourceAccounting) {
  enableCommander(s);
  enableArsenal(s);
  enableIndustry(s);
  enableResearch(s);
  enableRenewableWorld(s);
  target = Math.max(s.now, Math.floor(target));
  if (!integer(target, 0, 8640000000000000) || target - s.now > 315360000000) fail('时间跨度过大');
  let iterations = 0;
  // Natural per-unit completions and the free whole-batch boundary are separate events.
  // Drain at the current instant too: new orders and promoted FIFO orders can be free.
  while (true) {
    if (++iterations > 100000) fail('事件过多，时间结算已中止');
    const pending = [
      ...Object.values(s.jobs).map((j) => ({
        at: Math.max(s.now, Math.min(j!.dueAt, s.now + jobEffectiveRemaining(s, j!))),
        priority: 10,
        seq: j!.seq,
        job: j!,
      })),
      ...s.marches.map((m) => ({
        at: Math.max(s.now, m.dueAt - (m.phase === 'gathering' ? freeTime(s) : 0)),
        priority: m.phase === 'gathering' ? 20 : 30,
        seq: m.seq,
        march: m,
      })),
    ].sort((a, b) => a.at - b.at || a.priority - b.priority || a.seq - b.seq);
    const event = pending[0];
    const worldAt = nextWorldEvent(s);
    const next = Math.min(event?.at ?? Infinity, worldAt);
    if (next > target) {
      grow(s, target - s.now, accounting);
      s.now = target;
      break;
    }
    grow(s, Math.max(0, next - s.now), accounting);
    s.now = next;
    if (event && event.at <= worldAt) {
      if ('job' in event) {
        const j = event.job;
        if (freeTime(s) > 0 && jobRemaining(s, j) <= freeTime(s)) {
          while (j.completed < j.total) finishJob(s, j);
        } else finishJob(s, j);
      } else {
        resolveArrival(s, event.march);
        enableRenewableWorld(s);
      }
    } else settleWorld(s);
  }
}
export function advance(
  state: GameState,
  time: number,
  accounting?: ResourceAccounting,
): GameState {
  const s = structuredClone(state);
  advanceInPlace(s, time, accounting);
  s.revision++;
  return s;
}
export function execute(
  state: GameState,
  command: Command,
  time: number,
  id: string,
  expectedRevision = state.revision,
): { state: GameState; result: string; accounting?: ResourceAccounting } {
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
  let accounting: ResourceAccounting | undefined;
  switch (command.type) {
    case 'rest': {
      if (![60, 480].includes(command.minutes)) fail('请选择休整 1 小时或 8 小时');
      const elapsed = command.minutes * 60000;
      if ((s.timeOffset ?? 0) + elapsed > 315360000000) fail('此存档的休整时间已达到上限');
      s.timeOffset = (s.timeOffset ?? 0) + elapsed;
      accounting = { generated: {}, capacityLimited: [] };
      advanceInPlace(s, s.now + elapsed, accounting);
      result = `已休整 ${command.minutes / 60} 小时，生产、资源与行军按时间结算`;
      break;
    }
    case 'upgrade': {
      const b = command.building;
      if (!(b in buildingNames)) fail('未知建筑');
      const block = upgradeBlock(s, b);
      if (block) fail(block);
      startJob(
        s,
        'building',
        b,
        1,
        materialCost(s, upgradeCost(b, s.buildings[b])),
        buildingDuration(s, b),
      );
      result = '建筑升级已开始';
      break;
    }
    case 'research': {
      const t = command.tech;
      if (!(t in techNames)) fail('未知科技');
      const requirement = researchRequirements(s, t);
      if (requirement.block) fail(requirement.block);
      startJob(s, 'research', t, 1, researchCost(s.tech[t]), researchDuration(s, t));
      result = '研究已开始';
      break;
    }
    case 'facilityUpgrade': {
      if (!['factory2', 'refit'].includes(command.facility)) fail('未知工业设施');
      const quote = facilityUpgradeQuote(s, command.facility);
      if (quote.block) fail(quote.block);
      startJob(s, 'building', command.facility, 1, quote.unitCost, quote.duration);
      result = `${facilityNames[command.facility]}${quote.level === 0 ? '建设' : '升级'}已开始`;
      break;
    }
    case 'produce':
    case 'refit':
    case 'repair': {
      const u = units[command.unitId];
      if (!u || !integer(command.count, 1, 10000)) fail('请输入 1 至 10000 的整数数量');
      const repairing = command.type === 'repair';
      if (!repairing && command.count > MAX_PRODUCTION_BATCH)
        fail('制造或改装单次最多100辆，请分批提交');
      const facility = command.facility ?? (command.type === 'refit' ? 'refit' : 'factory');
      if (!productionFacilities.includes(facility)) fail('未知工业设施');
      const quote = productionQuote(s, u.unitId, command.type, facility);
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
        repairing ? undefined : facility,
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
    case 'presetRename':
    case 'presetReplace':
    case 'presetDelete': {
      if (!Number.isInteger(command.index) || !s.presets[command.index]) fail('预设不存在');
      if (command.type === 'presetDelete') s.presets.splice(command.index, 1);
      else if (command.type === 'presetRename') {
        const name = command.name.trim().slice(0, 20);
        if (!name) fail('请输入预设名称');
        s.presets[command.index].name = name;
      } else s.presets[command.index].formation = structuredClone(s.formation);
      result = '预设已删除';
      if (command.type === 'presetRename') result = '预设已重命名';
      if (command.type === 'presetReplace') result = '预设已覆盖为当前已保存编队';
      break;
    }
    case 'battle': {
      const index = command.stage;
      if (!integer(index, 0, stageNames.length - 1)) fail('战役不存在');
      if (!command.training && index > 0 && !s.cleared.includes(index - 1))
        fail('请先通过上一战役');
      const f = battleFormation(s, command.formation);
      const b = simulate(
        army(f, s.tech, s.commander.attackSkill, s.commander),
        army(stageFormation(index)),
        nextSeed(s),
        command.training ? 'training' : 'stage',
      );
      b.target = { type: 'battle', stage: index, training: !!command.training };
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
          }
          count(s, 'victory');
          s.counters.cleared = s.cleared.length;
          b.growth = stageGrowth(index, first);
          b.growth.xp = Math.floor((b.growth.xp * (100 + vipBenefits(s).xp)) / 100);
          s.commander.xp += b.growth.xp;
          s.commander.prestige += b.growth.prestige;
          s.commander.books += b.growth.books;
          s.commander.skillPoints += b.growth.skillPoints;
        }
      }
      result = report(s, b, `${command.training ? '演习 · ' : ''}${stageNames[index]}`);
      break;
    }
    case 'repairAll': {
      const q = repairAllQuote(s);
      if (!q.count) fail('没有可以修复的战车');
      if (command.quote !== q.token) fail('维修清单已变化，请重新确认全部修复');
      pay(s, q.cost);
      for (const row of q.rows) {
        s.available[row.unitId] += row.count;
        s.damaged[row.unitId] = 0;
      }
      for (const job of allJobs(s).filter((j) => j.kind === 'repair')) removeJob(s, job);
      count(s, 'repair', q.count);
      result = `全部修复完成：${q.count} 辆已回到待命库存，含 ${q.prepaid} 辆已付费维修`;
      notice(s, result);
      break;
    }
    case 'dungeon': {
      const dungeon = dungeons.find((d) => d.id === command.dungeonId);
      if (!dungeon) fail('副本不存在');
      if (!command.training && dungeonBlock(s, dungeon)) fail(dungeonBlock(s, dungeon));
      const f = battleFormation(s, command.formation);
      const b = simulate(
        army(f, s.tech, s.commander.attackSkill, s.commander),
        dungeonArmy(dungeon),
        nextSeed(s),
        command.training ? 'training' : 'dungeon',
      );
      b.target = { type: 'dungeon', dungeonId: dungeon.id, training: !!command.training };
      if (!command.training) {
        reserve(s, f);
        applyLoss(s, b);
        returnArmy(s, survivors(b.final[0]));
        if (b.winner === 0) {
          const first = !s.arsenal!.cleared.includes(dungeon.id);
          b.coreRewards = {};
          for (const drop of dungeon.drops) {
            const amount = first
              ? drop.first
              : drop.min + Math.floor((nextSeed(s) * (drop.max - drop.min + 1)) / 4294967296);
            s.arsenal!.cores[drop.id] += amount;
            b.coreRewards[drop.id] = amount;
          }
          if (first) s.arsenal!.cleared.push(dungeon.id);
          count(s, 'dungeonVictory');
          b.growth = { ...dungeon.growth };
          s.commander.books += b.growth.books;
          s.commander.prestige += b.growth.prestige;
          s.commander.xp += b.growth.xp;
          notice(
            s,
            '缴获 ' +
              Object.entries(b.coreRewards)
                .map(([id, n]) => `${coreNames[id]} ×${n}`)
                .join('、'),
          );
        }
      }
      result = report(s, b, `${command.training ? '演习 · ' : ''}${dungeon.name}`);
      if (!command.training && b.winner === 0 && dungeon.coreId.endsWith('7')) {
        const ids: string[] = [];
        const classes = new Set(b.initial[0].map((v) => v.classId));
        if (classes.size === 1) ids.push([...classes][0]);
        const sent = b.casualties.reduce((n, v) => n + v.sent, 0),
          lost = b.casualties.reduce((n, v) => n + v.lost, 0);
        if (sent > 0 && lost * 20 <= sent) ids.push('low-loss');
        for (const id of ids) {
          if ((s.honors ?? []).some((h) => h.id === id)) continue;
          (s.honors ??= []).push({ id, at: s.now, reportId: b.id });
          notice(
            s,
            '完成精英挑战荣誉：' +
              (id === 'low-loss'
                ? '低战损胜利'
                : classNames[id as keyof typeof classNames] + '单兵种胜利'),
          );
        }
      }
      break;
    }
    case 'scout': {
      const site = s.world.find((t) => t.id === command.targetId);
      if (!site) fail('目标不存在');
      pay(s, { crystal: scoutCost(site) });
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
      const f = battleFormation(s, command.formation);
      reserve(s, f);
      const travelMs = travelDuration(s, site);
      s.marches.push({
        id: `march-${++s.sequence}`,
        targetId: site.id,
        phase: 'outbound',
        mission: command.mission,
        troops: f,
        combatArmy: army(f, s.tech, s.commander.attackSkill, s.commander),
        startedAt: s.now,
        dueAt: s.now + travelMs,
        travelMs,
        cargo: emptyWallet(),
        loadBps: loadBonus(s),
        unitLoads: Object.fromEntries(
          f.filter((t) => t !== null).map((t) => [t.unitId, unitLoad(s, t.unitId)]),
        ),
        capacity: expeditionLoad(s, f),
        gatherRate: gatheringRate(s, site),
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
    case 'buyBooks': {
      if (!integer(command.count, 1, 10000)) fail('购书数量需为 1—10000');
      pay(s, { gold: command.count * BOOK_PRICE });
      s.commander.books += command.count;
      result = `已购买统率书 ${command.count} 本`;
      break;
    }
    case 'leadership': {
      const q = leadershipQuote(s),
        payment = command.payment ?? 'books',
        attempts = command.attempts ?? 1;
      if (q.block) fail(q.block);
      if (!['books', 'gold'].includes(payment) || ![1, 10, 100].includes(attempts))
        fail('统率尝试参数无效');
      if (payment === 'books' && s.commander.books < attempts)
        fail(
          `最多尝试 ${attempts} 次，需要 ${attempts} 本书，还缺 ${attempts - s.commander.books}`,
        );
      if (payment === 'gold' && s.wallet.gold < attempts * BOOK_PRICE)
        fail(
          `需要准备 ${attempts * BOOK_PRICE} 金币，还缺 ${attempts * BOOK_PRICE - s.wallet.gold}`,
        );
      let tried = 0,
        roll = 0,
        success = false;
      for (; tried < attempts;) {
        if (payment === 'books') s.commander.books--;
        else pay(s, { gold: BOOK_PRICE });
        tried++;
        roll = Math.floor((nextSeed(s) * 10000) / 4294967296);
        success = roll < q.chance;
        if (success) {
          s.commander.leadership++;
          break;
        }
      }
      s.lastLeadership = {
        target: q.target,
        attempts: tried,
        chance: q.chance,
        roll,
        success,
        payment,
        at: s.now,
      };
      result = success
        ? `第 ${tried} 次成功，统率 ${s.commander.leadership} 级，单格 ${leadershipCap(s)} 辆`
        : `${tried} 次未成功，统率保持 ${s.commander.leadership} 级；下次概率仍为 ${q.chance / 100}%`;
      break;
    }
    case 'initiativeSkill':
    case 'extraFireSkill': {
      const key = command.type;
      if (s.commander.skillPoints < 1) fail('技能点不足');
      if ((s.commander[key] ?? 0) >= MAX_LEVEL) fail(`技能已达 ${MAX_LEVEL} 级`);
      s.commander.skillPoints--;
      s.commander[key] = (s.commander[key] ?? 0) + 1;
      result = key === 'initiativeSkill' ? '战场预判提升：先手 +3' : '连击指挥提升：二次开火 +4';
      break;
    }
    case 'skill':
      if (s.commander.skillPoints < 1) fail('技能点不足');
      if (s.commander.attackSkill >= MAX_LEVEL) fail('技能已达最高等级');
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
      if (s.buildings.hq > 20) s.commander.skillPoints++;
      result = s.buildings.hq > 20 ? '已领取每日补给，额外获得 1 技能点' : '已领取每日补给';
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
  const submitted = [
    'upgrade',
    'facilityUpgrade',
    'research',
    'produce',
    'refit',
    'repair',
  ].includes(command.type)
    ? allJobs(s).find((j) => j.seq === s.sequence)
    : undefined;
  advanceInPlace(s, s.now);
  if (submitted && submitted.completed === submitted.total) result = 'VIP 免费时长生效，任务已完成';
  s.revision++;
  s.receipts[id] = { signature, result, revision: s.revision };
  assertState(s);
  return { state: s, result, accounting };
}
export function assertState(s: GameState) {
  validateShape(s);
  if (s.honors && new Set(s.honors.map((h) => h.id)).size !== s.honors.length) fail('重复挑战荣誉');
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
    if (!integer(s.buildings[b], 1, MAX_LEVEL)) fail('建筑等级无效');
  for (const t of (s.researchVersion ? Object.keys(techNames) : legacyTech) as Technology[])
    if (!integer(s.tech[t], 0, MAX_LEVEL)) fail('科技等级无效');
  for (const [t, n] of Object.entries(s.tech))
    if (
      !(t in techNames) ||
      !integer(n, 0, MAX_LEVEL) ||
      (!s.researchVersion && !legacyTech.includes(t as (typeof legacyTech)[number]) && n !== 0)
    )
      fail('科技扩展无效');
  if (!integer(s.commander.leadership, 1, 120) || !integer(s.commander.attackSkill, 0, MAX_LEVEL))
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
  if (s.industry && (s.industry.factory2 || s.industry.refit) && s.buildings.hq < INDUSTRY_UNLOCK)
    fail('工业设施尚未解锁');
  for (const [key, j] of Object.entries(s.jobs)) {
    if (
      !j ||
      !(j.kind === 'production'
        ? key === productionKey(jobFacility(j))
        : key === j.kind || (j.kind === 'building' && /^building:[2-7]$/.test(key)))
    )
      fail('队列编号无效');
  }
  const queues = [
    queueStatus(s, 'building'),
    queueStatus(s, 'research'),
    queueStatus(s, 'repair'),
    ...productionFacilities.map((f) => queueStatus(s, 'production', f)),
  ];
  for (const q of queues) {
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
    if (
      j.facility &&
      (kind !== 'production' ||
        (j.facility !== 'factory' &&
          (s.buildings.hq < INDUSTRY_UNLOCK || !facilityLevel(s, j.facility))) ||
        (j.facility === 'refit' ? !j.sourceUnitId : !!j.sourceUnitId))
    )
      fail('生产设施与作业不匹配');
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
    if (
      kind === 'building' &&
      !(j!.target in buildingNames) &&
      !(s.industry && ['factory2', 'refit'].includes(j.target) && s.buildings.hq >= INDUSTRY_UNLOCK)
    )
      fail('未知建筑');
    if (kind === 'research' && !(j!.target in techNames)) fail('未知科技');
    for (const [r, v] of Object.entries(j!.unitCost))
      if (!currencies.includes(r as (typeof currencies)[number]) || !integer(v, 0, 1e12))
        fail('队列资源无效');
  }
  for (const m of s.marches) {
    validF(m.troops);
    if (
      m.unitLoads &&
      (Object.keys(m.unitLoads).some((id) => !units[id]) ||
        m.troops.some((t) => t && !m.unitLoads![t.unitId]))
    )
      fail('远征载重快照无效');
    if (
      !s.world.some((t) => t.id === m.targetId) ||
      !['outbound', 'gathering', 'returning'].includes(m.phase) ||
      !integer(m.dueAt, s.now, 8640000000000000) ||
      !integer(m.travelMs, 1, 1e9) ||
      !integer(m.capacity, 0, 1e9) ||
      !integer(m.gatherRate, 1, 1e10) ||
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
    s.cleared.some((n) => !integer(n, 0, stageNames.length - 1)) ||
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
    const recordedHp = r.initial.map((team) => new Map(team.map((st) => [st.slot, st.totalHp])));
    for (const e of r.events) {
      if (e.ground) {
        const source = r.initial[e.side].find((st) => st.slot === e.from);
        if (
          !source ||
          !['tank', 'rocket'].includes(source.classId) ||
          (['classic-combat-v0.22', BATTLE_RULESET].includes(r.ruleset) &&
            source.classId !== 'rocket') ||
          e.damage !== 0 ||
          e.hp !== 0 ||
          e.remaining !== 0 ||
          e.miss ||
          e.critical ||
          (recordedHp[1 - e.side].get(e.to) ?? 0) > 0
        )
          fail('战报空位射击无效');
      } else recordedHp[1 - e.side].set(e.to, e.hp);
    }
    if (r.ruleset === BATTLE_RULESET) {
      const bothAlive = r.final.every((team) => team.some((st) => st.totalHp > 0));
      if (
        r.roundLimit !== 50 ||
        !r.tactics ||
        r.rounds > r.roundLimit ||
        r.events.some((e) => e.round > r.rounds) ||
        r.actions?.some((a) => a.round > r.rounds) ||
        r.endReason !== (bothAlive ? 'round-limit' : 'elimination') ||
        (bothAlive && (r.rounds !== r.roundLimit || r.winner === r.tactics.firstSide))
      )
        fail('战报回合上限或超时判定无效');
    }
    if (
      r.coreRewards &&
      (r.mode !== 'dungeon' ||
        r.winner !== 0 ||
        Object.keys(r.coreRewards).some((id) => !coreList.some((c) => c.id === id)))
    )
      fail('战报核心奖励无效');
  }
}
