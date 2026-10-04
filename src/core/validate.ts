import { LEADERSHIP_BATCHES } from './commander';
import { stageNames } from './content';
import { dungeons } from './arsenal';
import { MAX_LEVEL } from './growth';
import { REPORT_LIMIT } from './archive';
// Structural validation runs before semantic checks. A checksum detects damaged files;
// it is not a trust boundary and must never replace validating every persisted object.
type Check = (v: unknown, path: string) => void;
const bad = (p: string): never => {
  throw Error(`字段 ${p} 无效`);
};
const num =
  (min = 0, max = 1e12): Check =>
  (v, p) => {
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max) bad(p);
  };
const str =
  (max = 1000): Check =>
  (v, p) => {
    if (typeof v !== 'string' || v.length > max) bad(p);
  };
const bool: Check = (v, p) => {
  if (typeof v !== 'boolean') bad(p);
};
const one =
  (values: readonly (string | number)[]): Check =>
  (v, p) => {
    if (!values.includes(v as string)) bad(p);
  };
const obj =
  (fields: Record<string, Check>, optional: string[] = []): Check =>
  (v, p) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) bad(p);
    const o = v as Record<string, unknown>;
    for (const key of Object.keys(o))
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') bad(p);
    for (const [k, check] of Object.entries(fields)) {
      if (optional.includes(k) && o[k] === undefined) continue;
      check(o[k], `${p}.${k}`);
    }
  };
const list =
  (check: Check, max = 10000, min = 0): Check =>
  (v, p) => {
    if (!Array.isArray(v) || v.length > max || v.length < min) bad(p);
    (v as unknown[]).forEach((x, i) => check(x, `${p}[${i}]`));
  };
const record =
  (check: Check, max = 100000): Check =>
  (v, p) => {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).length > max) bad(p);
    for (const [key, value] of Object.entries(v as object)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') bad(p);
      check(value, `${p}.${key}`);
    }
  };
const time = num(0, 8640000000000000),
  integer = num(),
  unit = one(
    ['tank', 'tank_destroyer', 'spg', 'rocket'].flatMap((c) =>
      [1, 2, 3, 4, 5, 6, 7].map((t) => `${c}_t${t}`),
    ),
  ),
  kind = one(['building', 'research', 'production', 'repair']);
const resource = one(['iron', 'oil', 'lead', 'titanium', 'crystal']);
const currencyKeys = ['iron', 'oil', 'lead', 'titanium', 'crystal', 'gold'];
const wallet = obj(Object.fromEntries(currencyKeys.map((k) => [k, integer])));
const cost: Check = (v, p) => {
  record(integer, 6)(v, p);
  if (Object.keys(v as object).some((k) => !currencyKeys.includes(k))) bad(p);
};
const formation = list(
  (v, p) => {
    if (v !== null) obj({ unitId: unit, count: num(1, Number.MAX_SAFE_INTEGER) })(v, p);
  },
  6,
  6,
);
const stack = obj(
  {
    slot: num(1, 6),
    unitId: unit,
    classId: one(['tank', 'tank_destroyer', 'spg', 'rocket']),
    count: num(1, Number.MAX_SAFE_INTEGER),
    attack: num(1, 1000000),
    hp: num(1, Number.MAX_SAFE_INTEGER),
    totalHp: num(0, Number.MAX_SAFE_INTEGER),
    accuracy: num(-10000, 10000),
    evasion: num(-10000, 10000),
    crit: num(-10000, 10000),
    armor: num(-10000, 10000),
    attackBonus: num(1, Number.MAX_SAFE_INTEGER),
    initiative: num(0, 1000000),
    extraFire: num(0, 1000000),
  },
  ['attackBonus', 'initiative', 'extraFire'],
);
const army = list(stack, 6);
const report = obj(
  {
    id: str(100),
    title: str(200),
    at: time,
    seed: num(1, 4294967295),
    ruleset: str(100),
    target: obj(
      {
        type: one(['battle', 'dungeon']),
        stage: num(0, stageNames.length - 1),
        dungeonId: str(30),
        training: bool,
      },
      ['stage', 'dungeonId', 'training'],
    ),
    winner: one([0, 1]),
    rounds: num(0, 50),
    roundLimit: num(1, 50),
    endReason: one(['elimination', 'round-limit']),
    mode: one(['training', 'stage', 'world', 'dungeon']),
    coreRewards: record(num(0, 1e9), 8),
    marchId: str(100),
    worldKind: one(['mine', 'npc']),
    initial: list(army, 2, 2),
    final: list(army, 2, 2),
    tactics: obj({
      teams: list(obj({ initiative: num(0, 1000000), extraFire: num(0, 1000000) }), 2, 2),
      firstSide: one([0, 1]),
      chances: list(num(0, 3500), 2, 2),
    }),
    actions: list(
      obj(
        {
          id: num(1, 1200),
          round: num(1, 50),
          exchange: num(1, 6),
          side: one([0, 1]),
          from: num(1, 6),
          extra: bool,
          extraRoll: num(0, 9999),
          extraTriggered: bool,
        },
        ['extraRoll', 'extraTriggered', 'exchange'],
      ),
      1200,
    ),
    events: list(
      obj(
        {
          action: num(1, 1200),
          exchange: num(1, 6),
          shot: num(1, 6),
          shots: num(1, 6),
          ground: bool,
          extra: bool,
          round: num(1, 50),
          side: one([0, 1]),
          from: num(1, 6),
          to: num(1, 6),
          damage: num(0, Number.MAX_SAFE_INTEGER),
          critical: bool,
          miss: bool,
          remaining: num(0, Number.MAX_SAFE_INTEGER),
          hp: num(0, Number.MAX_SAFE_INTEGER),
        },
        ['action', 'shot', 'shots', 'extra', 'exchange', 'ground'],
      ),
      7200,
    ),
    casualties: list(
      obj({
        unitId: unit,
        sent: num(0, Number.MAX_SAFE_INTEGER),
        survived: num(0, Number.MAX_SAFE_INTEGER),
        lost: num(0, Number.MAX_SAFE_INTEGER),
        repairable: num(0, Number.MAX_SAFE_INTEGER),
        destroyed: num(0, Number.MAX_SAFE_INTEGER),
      }),
      12,
    ),
    rewards: cost,
    growth: obj({ xp: integer, books: integer, skillPoints: integer, prestige: integer }),
  },
  [
    'growth',
    'coreRewards',
    'tactics',
    'actions',
    'marchId',
    'target',
    'roundLimit',
    'endReason',
    'worldKind',
  ],
);
const job = obj(
  {
    facility: one(['factory', 'factory2', 'refit']),
    kind,
    target: str(100),
    total: num(1, 10000),
    completed: integer,
    unitCost: cost,
    duration: num(1, 1e12),
    startedAt: time,
    dueAt: time,
    seq: integer,
    sourceUnitId: unit,
    coreCost: obj({ id: str(50), count: num(1, 1) }),
  },
  ['sourceUnitId', 'coreCost', 'facility'],
);
const march = obj(
  {
    battleId: str(100),
    battleWon: bool,
    casualties: list(
      obj({
        unitId: unit,
        sent: integer,
        survived: integer,
        lost: integer,
        repairable: integer,
        destroyed: integer,
      }),
      28,
    ),
    commanderStats: obj({ initiative: num(0, 1000000), extraFire: num(0, 1000000) }),
    id: str(100),
    targetId: str(100),
    phase: one(['outbound', 'gathering', 'returning']),
    mission: one(['gather', 'raid']),
    troops: formation,
    startedAt: time,
    dueAt: time,
    travelMs: num(1, 1e9),
    cargo: wallet,
    capacity: num(0, Number.MAX_SAFE_INTEGER),
    gatherRate: num(1, 1e10),
    remainder: num(0, 3599999),
    seq: integer,
    combatArmy: army,
    loadBps: num(10000, 350000),
    unitLoads: record(num(1, 1e7), 28),
  },
  ['combatArmy', 'loadBps', 'unitLoads', 'commanderStats', 'battleId', 'battleWon', 'casualties'],
);
const coordinate = obj({ x: num(0, 31), y: num(0, 31) });
const schema = obj({
  schema: one([1]),
  ruleset: str(100),
  id: str(100),
  nickname: str(16),
  seed: num(1, 4294967295),
  revision: integer,
  now: time,
  createdAt: time,
  sequence: integer,
  wallet,
  remainders: obj(
    Object.fromEntries(
      ['iron', 'oil', 'lead', 'titanium', 'crystal'].map((k) => [k, num(0, 3599999)]),
    ),
  ),
  buildings: obj(
    Object.fromEntries(
      ['hq', 'lab', 'factory', 'warehouse', 'iron', 'oil', 'lead', 'titanium', 'crystal'].map(
        (k) => [k, num(1, MAX_LEVEL)],
      ),
    ),
  ),
  tech: obj(
    Object.fromEntries(
      ['attack', 'hp', 'production', 'construction', 'gather'].map((k) => [k, num(0, MAX_LEVEL)]),
    ),
  ),
  available: record(integer, 28),
  damaged: record(integer, 28),
  createdUnits: record(integer, 28),
  destroyedUnits: record(integer, 28),
  formation,
  presets: list(obj({ name: str(20), formation }), 5),
  jobs: record(job, 12),
  marches: list(march, 8),
  world: list(
    obj(
      {
        economyVersion: one([2, 3]),
        protectionVersion: one([1]),
        reserveVersion: one([1]),
        id: str(100),
        x: num(0, 31),
        y: num(0, 31),
        kind: one(['mine', 'npc']),
        name: str(100),
        level: num(1, MAX_LEVEL),
        resource,
        reserve: integer,
        guards: formation,
        wallet,
        lastGrowth: time,
        conquered: bool,
      },
      ['economyVersion', 'protectionVersion', 'reserveVersion'],
    ),
    100,
    100,
  ),
  home: coordinate,
  intel: record(obj({ at: time, guards: formation, reserve: integer, wallet }), 100),
  reports: list(report, REPORT_LIMIT),
  cleared: list(num(0, stageNames.length - 1), stageNames.length),
  commander: obj({
    xp: integer,
    leadership: num(1, Number.MAX_SAFE_INTEGER),
    books: integer,
    prestige: num(0, Number.MAX_SAFE_INTEGER),
    skillPoints: integer,
    attackSkill: num(0, MAX_LEVEL),
  }),
  counters: record(integer, 50),
  claimed: list(str(100), 20),
  lastDaily: num(-1, 1e9),
  receipts: record(obj({ signature: str(10000), result: str(1000), revision: integer })),
  notices: list(obj({ id: integer, at: time, text: str(1000) }), 60),
});
export function validateShape(value: unknown) {
  schema(value, 'save');
  const ext = value as Record<string, any>;
  if (ext.commandVersion !== undefined) one([1])(ext.commandVersion, 'save.commandVersion');
  if (ext.prestigeFloor !== undefined)
    num(1, Number.MAX_SAFE_INTEGER)(ext.prestigeFloor, 'save.prestigeFloor');
  for (const skill of ['initiativeSkill', 'extraFireSkill'])
    if (ext.commander[skill] !== undefined)
      num(0, MAX_LEVEL)(ext.commander[skill], 'save.commander.' + skill);
  const leadershipFields = {
    target: num(2, Number.MAX_SAFE_INTEGER),
    attempts: num(1, 1000),
    chance: num(10, 10000),
    roll: num(0, 9999),
    success: bool,
    payment: one(['books', 'gold']),
    at: time,
  };
  if (ext.lastLeadership !== undefined)
    obj(leadershipFields)(ext.lastLeadership, 'save.lastLeadership');
  if (ext.leadershipHistory !== undefined) {
    list(
      obj(
        {
          ...leadershipFields,
          requested: one(LEADERSHIP_BATCHES),
          rolls: list(num(0, 9999), 1000, 1),
          legacy: (v: unknown, p: string) => {
            if (v !== true) bad(p);
          },
        },
        ['requested', 'rolls', 'legacy'],
      ),
      Number.MAX_SAFE_INTEGER,
    )(ext.leadershipHistory, 'save.leadershipHistory');
    for (const h of ext.leadershipHistory) {
      if (h.success !== h.roll < h.chance) bad('save.leadershipHistory.result');
      if (h.legacy) {
        if (h.rolls !== undefined || h.requested !== undefined)
          bad('save.leadershipHistory.legacy');
      } else if (
        !h.rolls ||
        h.requested === undefined ||
        h.attempts > h.requested ||
        h.rolls.length !== h.attempts ||
        h.rolls.at(-1) !== h.roll ||
        h.rolls.slice(0, -1).some((v: number) => v < h.chance) ||
        (!h.success && h.attempts !== h.requested)
      )
        bad('save.leadershipHistory.rolls');
    }
  }
  const honors = (value as { honors?: unknown }).honors;
  if (honors !== undefined)
    list(
      obj({
        id: one(['tank', 'tank_destroyer', 'spg', 'rocket', 'low-loss']),
        at: time,
        reportId: str(100),
      }),
      5,
    )(honors, 'save.honors');
  const expeditionLog = (value as { expeditionLog?: unknown }).expeditionLog;
  if (expeditionLog !== undefined)
    list(
      obj(
        {
          success: bool,
          mission: one(['gather', 'raid']),
          title: str(200),
          stored: wallet,
          discarded: wallet,
          battleId: str(100),
          casualties: list(
            obj({
              unitId: unit,
              sent: integer,
              survived: integer,
              lost: integer,
              repairable: integer,
              destroyed: integer,
            }),
            28,
          ),
          marchId: str(100),
          targetId: str(100),
          at: time,
          outcome: one(['returned', 'defeated']),
          cargo: wallet,
          survivors: num(0, Number.MAX_SAFE_INTEGER),
        },
        ['mission', 'title', 'stored', 'discarded', 'battleId', 'casualties', 'success'],
      ),
      REPORT_LIMIT,
    )(expeditionLog, 'save.expeditionLog');
  const researchVersion = (value as { researchVersion?: unknown }).researchVersion;
  if (researchVersion !== undefined) one([1])(researchVersion, 'save.researchVersion');
  const industry = (value as { industry?: unknown }).industry;
  if (industry !== undefined)
    obj({ version: one([1]), factory2: num(0, MAX_LEVEL), refit: num(0, MAX_LEVEL) })(
      industry,
      'save.industry',
    );
  const extension = value as { vip?: unknown; jobBacklog?: unknown };
  if (extension.vip !== undefined)
    obj({ version: one([1]), paidGold: num(0, 1e12), lastDaily: num(-1, 1e9) })(
      extension.vip,
      'save.vip',
    );
  if (extension.jobBacklog !== undefined) list(job, 23)(extension.jobBacklog, 'save.jobBacklog');
  const arsenal = (value as { arsenal?: unknown }).arsenal;
  if (arsenal !== undefined)
    obj({
      version: one([1]),
      cores: record(num(0, 1e9), 8),
      converted: record(num(0, 1e9), 28),
      cleared: list(str(50), dungeons.length),
    })(arsenal, 'save.arsenal');
  const worldSeed = (value as { worldSeed?: unknown }).worldSeed;
  if (worldSeed !== undefined) num(1, 4294967295)(worldSeed, 'save.worldSeed');
  const worldRules = (value as { worldRules?: unknown }).worldRules;
  if (worldRules !== undefined)
    one(['renewable-v1', 'renewable-v2', 'renewable-v3'])(worldRules, 'save.worldRules');
  const timeOffset = (value as { timeOffset?: unknown }).timeOffset;
  if (timeOffset !== undefined) num(0, 315360000000)(timeOffset, 'save.timeOffset');
}
