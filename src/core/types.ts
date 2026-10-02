export const resources = ['iron', 'oil', 'lead', 'titanium', 'crystal'] as const;
export type Resource = (typeof resources)[number];
export type Currency = Resource | 'gold';
export type Wallet = Record<Currency, number>;
export type Cost = Partial<Wallet>;
export type UnitClass = 'tank' | 'tank_destroyer' | 'spg' | 'rocket';
export type Building = 'hq' | 'lab' | 'factory' | 'warehouse' | Resource;
export type Technology = 'attack' | 'hp' | 'production' | 'construction' | 'gather';
export type Slot = { unitId: string; count: number } | null;
export type Formation = Slot[];
export type JobKind = 'building' | 'research' | 'production' | 'repair';
export interface Job {
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
  attackBonus?: number;
}
export interface HitEvent {
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
  id: string;
  title: string;
  at: number;
  seed: number;
  ruleset: string;
  winner: 0 | 1;
  rounds: number;
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
  id: string;
  targetId: string;
  phase: 'outbound' | 'gathering' | 'returning';
  mission: 'gather' | 'raid';
  troops: Formation;
  combatArmy?: ArmyStack[];
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
export interface GameState {
  schema: 1;
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
  worldRules?: 'renewable-v1';
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
  jobs: Partial<Record<JobKind | `building:${number}`, Job>>;
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
  };
  counters: Record<string, number>;
  claimed: string[];
  lastDaily: number;
  receipts: Record<string, Receipt>;
  notices: { id: number; at: number; text: string }[];
}
export type Command =
  | { type: 'rest'; minutes: 60 | 480 }
  | { type: 'upgrade'; building: Building }
  | { type: 'research'; tech: Technology }
  | { type: 'produce' | 'repair' | 'refit'; unitId: string; count: number }
  | { type: 'dungeon'; dungeonId: string; training?: boolean }
  | { type: 'cancel' | 'accelerate'; kind: JobKind; seq?: number }
  | { type: 'vipRecharge'; gold: number }
  | { type: 'vipDaily' }
  | { type: 'formation'; slots: Formation }
  | { type: 'presetSave'; name: string }
  | { type: 'presetLoad'; index: number }
  | { type: 'battle'; stage: number; training?: boolean }
  | { type: 'scout'; targetId: string }
  | { type: 'march'; targetId: string; mission: 'gather' | 'raid' }
  | { type: 'recall'; marchId: string }
  | { type: 'leadership' | 'skill' | 'daily' }
  | { type: 'claim'; questId: string }
  | { type: 'rename'; nickname: string };
