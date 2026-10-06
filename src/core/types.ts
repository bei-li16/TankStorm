export const resources = ['iron', 'oil', 'lead', 'titanium', 'crystal'] as const;
export type Resource = (typeof resources)[number];
export type Currency = Resource | 'gold';
export type Wallet = Record<Currency, number>;
export type Cost = Partial<Wallet>;
export type UnitClass = 'tank' | 'tank_destroyer' | 'spg' | 'rocket';
export type Building = 'hq' | 'lab' | 'factory' | 'warehouse' | Resource;
export type Technology =
  | 'attack'
  | 'hp'
  | 'production'
  | 'construction'
  | 'gather'
  | 'resourceOutput'
  | 'ironOutput'
  | 'oilOutput'
  | 'leadOutput'
  | 'titaniumOutput'
  | 'crystalOutput'
  | 'storage'
  | 'repairSpeed'
  | 'refitSpeed'
  | 'researchSpeed'
  | 'materials'
  | 'march'
  | 'cargo'
  | 'survey'
  | 'ballistics'
  | 'armorPlating'
  | 'accuracy'
  | 'evasion'
  | 'critical'
  | 'criticalDamage'
  | 'armorResistance'
  | 'defense';
export type Slot = { unitId: string; count: number } | null;
export type Formation = Slot[];
export type JobKind = 'building' | 'research' | 'production' | 'repair';
export type ProductionFacility = 'factory' | 'factory2' | 'refit';
export interface Job {
  facility?: ProductionFacility;
  kind: JobKind;
  target: string;
  total: number;
  completed: number;
  unitCost: Cost;
  duration: number;
  startedAt: number;
  dueAt: number;
  seq: number;
  sourceUnitId?: string;
  coreCost?: { id: string; count: number };
}
export interface ArmyStack {
  slot: number;
  unitId: string;
  classId: UnitClass;
  count: number;
  attack: number;
  hp: number;
  totalHp: number;
  accuracy: number;
  evasion: number;
  crit: number;
  armor: number;
  critMultiplierBps?: number;
  defense?: number;
  baseDefense?: number;
  damageReduction?: number;
  attackBonus?: number;
  initiative?: number;
  extraFire?: number;
}
export interface CombatStats {
  initiative: number;
  extraFire: number;
}
export interface BattleAction {
  id: number;
  round: number;
  exchange?: number;
  side: 0 | 1;
  from: number;
  extra: boolean;
  extraRoll?: number;
  extraTriggered?: boolean;
}
export interface HitEvent {
  /** An empty formation cell: no unit hit/miss roll, damage or casualty. */
  ground?: boolean;
  action?: number;
  exchange?: number;
  shot?: number;
  shots?: number;
  extra?: boolean;
  round: number;
  side: 0 | 1;
  from: number;
  to: number;
  damage: number;
  critical: boolean;
  miss: boolean;
  remaining: number;
  hp: number;
}
export interface Casualty {
  unitId: string;
  sent: number;
  survived: number;
  lost: number;
  repairable: number;
  destroyed: number;
}
export interface BattleReport {
  worldKind?: 'mine' | 'npc';
  target?: { type: 'battle' | 'dungeon'; stage?: number; dungeonId?: string; training?: boolean };
  marchId?: string;
  tactics?: { teams: [CombatStats, CombatStats]; firstSide: 0 | 1; chances: [number, number] };
  actions?: BattleAction[];
  id: string;
  title: string;
  at: number;
  seed: number;
  ruleset: string;
  winner: 0 | 1;
  rounds: number;
  // Optional only for historical reports; new battles persist their own limit and outcome.
  roundLimit?: number;
  endReason?: 'elimination' | 'round-limit';
  mode: 'stage' | 'world' | 'training' | 'dungeon';
  coreRewards?: Record<string, number>;
  initial: [ArmyStack[], ArmyStack[]];
  final: [ArmyStack[], ArmyStack[]];
  events: HitEvent[];
  casualties: Casualty[];
  growth?: { xp: number; books: number; skillPoints: number; prestige: number };
  rewards: Cost;
}
export interface WorldSite {
  reserveVersion?: 1;
  protectionVersion?: 1;
  economyVersion?: 2 | 3;
  id: string;
  x: number;
  y: number;
  kind: 'mine' | 'npc';
  name: string;
  level: number;
  resource: Resource;
  reserve: number;
  guards: Formation;
  wallet: Wallet;
  lastGrowth: number;
  conquered: boolean;
}
export interface Intel {
  at: number;
  guards: Formation;
  reserve: number;
  wallet: Wallet;
}
export interface March {
  battleId?: string;
  battleWon?: boolean;
  casualties?: Casualty[];
  commanderStats?: CombatStats;
  unitLoads?: Record<string, number>;
  id: string;
  targetId: string;
  phase: 'outbound' | 'gathering' | 'returning';
  mission: 'gather' | 'raid';
  troops: Formation;
  combatArmy?: ArmyStack[];
  loadBps?: number;
  startedAt: number;
  dueAt: number;
  travelMs: number;
  cargo: Wallet;
  capacity: number;
  gatherRate: number;
  remainder: number;
  seq: number;
}
export interface Quest {
  id: string;
  name: string;
  description: string;
  counter: string;
  target: number;
  reward: Cost;
  books?: number;
}
export interface Receipt {
  signature: string;
  result: string;
  revision: number;
}
export interface LeadershipResult {
  target: number;
  attempts: number;
  chance: number;
  roll: number;
  success: boolean;
  payment: 'books' | 'gold';
  at: number;
}
export interface LeadershipRecord extends LeadershipResult {
  requested?: 1 | 10 | 100 | 1000;
  rolls?: number[];
  legacy?: true;
}
export interface GameState {
  schema: 1;
  commandVersion?: 1;
  prestigeFloor?: number;
  lastLeadership?: LeadershipResult;
  leadershipHistory?: LeadershipRecord[];
  honors?: { id: string; at: number; reportId: string }[];
  expeditionLog?: {
    success?: boolean;
    mission?: 'gather' | 'raid';
    title?: string;
    stored?: Wallet;
    discarded?: Wallet;
    battleId?: string;
    casualties?: Casualty[];
    marchId: string;
    targetId: string;
    at: number;
    outcome: 'returned' | 'defeated';
    cargo: Wallet;
    survivors: number;
  }[];
  researchVersion?: 1 | 2;
  industry?: { version: 1; factory2: number; refit: number };
  vip?: { version: 1; paidGold: number; lastDaily: number };
  jobBacklog?: Job[];
  arsenal?: {
    version: 1;
    cores: Record<string, number>;
    converted: Record<string, number>;
    cleared: string[];
  };
  ruleset: string;
  id: string;
  nickname: string;
  worldSeed?: number;
  worldRules?: 'renewable-v1' | 'renewable-v2' | 'renewable-v3';
  timeOffset?: number;
  seed: number;
  revision: number;
  now: number;
  createdAt: number;
  sequence: number;
  wallet: Wallet;
  remainders: Record<Resource, number>;
  buildings: Record<Building, number>;
  tech: Record<Technology, number>;
  available: Record<string, number>;
  damaged: Record<string, number>;
  createdUnits: Record<string, number>;
  destroyedUnits: Record<string, number>;
  formation: Formation;
  presets: { name: string; formation: Formation }[];
  jobs: Partial<Record<JobKind | `building:${number}` | `production:${ProductionFacility}`, Job>>;
  marches: March[];
  world: WorldSite[];
  home: { x: number; y: number };
  intel: Record<string, Intel>;
  reports: BattleReport[];
  cleared: number[];
  commander: {
    xp: number;
    leadership: number;
    books: number;
    prestige: number;
    skillPoints: number;
    attackSkill: number;
    initiativeSkill?: number;
    extraFireSkill?: number;
  };
  counters: Record<string, number>;
  claimed: string[];
  lastDaily: number;
  receipts: Record<string, Receipt>;
  notices: { id: number; at: number; text: string }[];
}
export type Command =
  | { type: 'repairAll'; quote: string }
  | { type: 'rest'; minutes: number }
  | { type: 'upgrade'; building: Building }
  | { type: 'facilityUpgrade'; facility: 'factory2' | 'refit' }
  | { type: 'research'; tech: Technology }
  | {
      type: 'produce' | 'repair' | 'refit';
      unitId: string;
      count: number;
      facility?: ProductionFacility;
    }
  | { type: 'dungeon'; dungeonId: string; training?: boolean; formation?: Formation }
  | { type: 'cancel' | 'accelerate'; kind: JobKind; seq?: number }
  | { type: 'vipRecharge'; gold: number }
  | { type: 'vipDaily' }
  | { type: 'formation'; slots: Formation }
  | { type: 'presetSave'; name: string }
  | { type: 'presetLoad'; index: number }
  | { type: 'presetRename'; index: number; name: string }
  | { type: 'presetReplace'; index: number }
  | { type: 'presetDelete'; index: number }
  | { type: 'battle'; stage: number; training?: boolean; formation?: Formation }
  | { type: 'scout'; targetId: string }
  | { type: 'march'; targetId: string; mission: 'gather' | 'raid'; formation?: Formation }
  | { type: 'recall'; marchId: string }
  | { type: 'leadership'; payment?: 'books' | 'gold'; attempts?: 1 | 10 | 100 | 1000 }
  | { type: 'buyBooks'; count: number }
  | { type: 'skill' | 'initiativeSkill' | 'extraFireSkill' | 'daily' }
  | { type: 'claim'; questId: string }
  | { type: 'rename'; nickname: string };
