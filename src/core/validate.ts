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
    if (v !== null) obj({ unitId: unit, count: num(1, 10000) })(v, p);
  },
  6,
  6,
);
const stack = obj(
  {
    slot: num(1, 6),
    unitId: unit,
    classId: one(['tank', 'tank_destroyer', 'spg', 'rocket']),
    count: num(1, 10000),
    attack: num(1, 1000000),
    hp: num(1, 1000000),
    totalHp: num(0, 1e10),
    accuracy: num(-10000, 10000),
    evasion: num(-10000, 10000),
    crit: num(-10000, 10000),
    armor: num(-10000, 10000),
    attackBonus: num(1, 1000000),
  },
  ['attackBonus'],
);
const army = list(stack, 6);
const report = obj(
  {
    id: str(100),
    title: str(200),
    at: time,
    seed: num(1, 4294967295),
    ruleset: str(100),
    winner: one([0, 1]),
    rounds: num(0, 40),
    mode: one(['training', 'stage', 'world', 'dungeon']),
    coreRewards: record(num(0, 1e9), 8),
    initial: list(army, 2, 2),
    final: list(army, 2, 2),
    events: list(
      obj({
        round: num(1, 40),
        side: one([0, 1]),
        from: num(1, 6),
        to: num(1, 6),
        damage: num(0, 1e12),
        critical: bool,
        miss: bool,
        remaining: num(0, 10000),
        hp: num(0, 1e10),
      }),
      3000,
    ),
    casualties: list(
      obj({
        unitId: unit,
        sent: num(0, 60000),
        survived: num(0, 60000),
        lost: num(0, 60000),
        repairable: num(0, 60000),
        destroyed: num(0, 60000),
      }),
      12,
    ),
    rewards: cost,
    growth: obj({ xp: integer, books: integer, skillPoints: integer, prestige: integer }),
  },
  ['growth', 'coreRewards'],
);
const job = obj(
  {
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
  ['sourceUnitId', 'coreCost'],
);
const march = obj(
  {
    id: str(100),
    targetId: str(100),
    phase: one(['outbound', 'gathering', 'returning']),
    mission: one(['gather', 'raid']),
    troops: formation,
    startedAt: time,
    dueAt: time,
    travelMs: num(1, 1e9),
    cargo: wallet,
    capacity: num(0, 1e9),
    gatherRate: num(1, 1e6),
    remainder: num(0, 3599999),
    seq: integer,
    combatArmy: army,
  },
  ['combatArmy'],
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
        (k) => [k, num(1, 20)],
      ),
    ),
  ),
  tech: obj(
    Object.fromEntries(
      ['attack', 'hp', 'production', 'construction', 'gather'].map((k) => [k, num(0, 20)]),
    ),
  ),
  available: record(integer, 28),
  damaged: record(integer, 28),
  createdUnits: record(integer, 28),
  destroyedUnits: record(integer, 28),
  formation,
  presets: list(obj({ name: str(20), formation }), 5),
  jobs: record(job, 10),
  marches: list(march, 8),
  world: list(
    obj({
      id: str(100),
      x: num(0, 31),
      y: num(0, 31),
      kind: one(['mine', 'npc']),
      name: str(100),
      level: num(1, 20),
      resource,
      reserve: integer,
      guards: formation,
      wallet,
      lastGrowth: time,
      conquered: bool,
    }),
    100,
    100,
  ),
  home: coordinate,
  intel: record(obj({ at: time, guards: formation, reserve: integer, wallet }), 100),
  reports: list(report, 100),
  cleared: list(num(0, 11), 12),
  commander: obj({
    xp: integer,
    leadership: num(1, 20),
    books: integer,
    prestige: integer,
    skillPoints: integer,
    attackSkill: num(0, 20),
  }),
  counters: record(integer, 50),
  claimed: list(str(100), 20),
  lastDaily: num(-1, 1e9),
  receipts: record(obj({ signature: str(10000), result: str(1000), revision: integer })),
  notices: list(obj({ id: integer, at: time, text: str(1000) }), 60),
});
export function validateShape(value: unknown) {
  schema(value, 'save');
  const extension = value as { vip?: unknown; jobBacklog?: unknown };
  if (extension.vip !== undefined)
    obj({ version: one([1]), paidGold: num(0, 1e12), lastDaily: num(-1, 1e9) })(
      extension.vip,
      'save.vip',
    );
  if (extension.jobBacklog !== undefined) list(job, 10)(extension.jobBacklog, 'save.jobBacklog');
  const arsenal = (value as { arsenal?: unknown }).arsenal;
  if (arsenal !== undefined)
    obj({
      version: one([1]),
      cores: record(num(0, 1e9), 8),
      converted: record(num(0, 1e9), 28),
      cleared: list(str(50), 8),
    })(arsenal, 'save.arsenal');
  const worldSeed = (value as { worldSeed?: unknown }).worldSeed;
  if (worldSeed !== undefined) num(1, 4294967295)(worldSeed, 'save.worldSeed');
  const worldRules = (value as { worldRules?: unknown }).worldRules;
  if (worldRules !== undefined) one(['renewable-v1'])(worldRules, 'save.worldRules');
  const timeOffset = (value as { timeOffset?: unknown }).timeOffset;
  if (timeOffset !== undefined) num(0, 315360000000)(timeOffset, 'save.timeOffset');
}
