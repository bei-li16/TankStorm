import { rules, units } from './content';
import { prestigeBonusBps } from './commander';
import type {
  ArmyStack,
  BattleAction,
  BattleReport,
  Casualty,
  CombatStats,
  Formation,
  GameState,
  HitEvent,
} from './types';
export function rng32(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return x >>> 0;
  };
}
export function army(
  formation: Formation,
  tech?: GameState['tech'],
  skill = 0,
  commander?: Partial<
    Pick<GameState['commander'], 'initiativeSkill' | 'extraFireSkill' | 'prestige'>
  >,
): ArmyStack[] {
  return formation.flatMap((s, i) => {
    if (!s || !s.count) return [];
    const u = units[s.unitId];
    const hp = Math.floor(
      (u.hp *
        (10000 +
          (tech?.hp ?? 0) * rules.economy.techBonusPerLevelBps +
          (tech?.armorPlating ?? 0) * 300 +
          prestigeBonusBps(commander?.prestige ?? 0))) /
        10000,
    );
    return [
      {
        slot: i + 1,
        unitId: s.unitId,
        classId: u.classId as ArmyStack['classId'],
        count: s.count,
        attack: u.attack,
        hp,
        totalHp: hp * s.count,
        accuracy: 0,
        evasion: 0,
        crit: 0,
        armor: 0,
        attackBonus:
          10000 +
          (tech?.attack ?? 0) * rules.economy.techBonusPerLevelBps +
          (tech?.ballistics ?? 0) * 200 +
          skill * 200 +
          prestigeBonusBps(commander?.prestige ?? 0),
      },
    ];
  });
}
function alive(a: ArmyStack[]) {
  return a.filter((s) => s.totalHp > 0);
}
// Save schema stays compatible; historical reports retain their recorded rules and events.
export const BATTLE_RULESET = 'classic-combat-v0.31';
// Army composition never participates in these commander-level attributes.
export function commanderStats(
  tech?: Partial<GameState['tech']>,
  commander?: Partial<GameState['commander']>,
): CombatStats {
  return {
    initiative: 100 + (tech?.march ?? 0) * 3 + (commander?.initiativeSkill ?? 0) * 3,
    extraFire: 100 + (tech?.ballistics ?? 0) * 4 + (commander?.extraFireSkill ?? 0) * 4,
  };
}
// Commit targets once per action. Only rockets fire at empty cells.
export function attackSlots(
  classId: ArmyStack['classId'],
  defenders: ArmyStack[],
  fromSlot = 1,
): number[] {
  const enemies = alive(defenders).sort((a, b) => a.slot - b.slot);
  if (!enemies.length) return [];
  if (classId === 'rocket') return [1, 2, 3, 4, 5, 6];
  if (classId === 'tank')
    return [1, 2, 3].flatMap((front) => {
      const target = enemies.find((t) => t.slot === front || t.slot === front + 3);
      return target ? [target.slot] : [];
    });
  const ownColumn = (fromSlot - 1) % 3;
  const columns = [0, 1, 2].sort(
    (a, b) => Math.abs(a - ownColumn) - Math.abs(b - ownColumn) || a - b,
  );
  const column = columns.find((c) => enemies.some((t) => (t.slot - 1) % 3 === c));
  const targets = enemies.filter((t) => (t.slot - 1) % 3 === column).map((t) => t.slot);
  return classId === 'spg' ? targets : targets.slice(0, 1);
}
export function attackTargets(
  classId: ArmyStack['classId'],
  defenders: ArmyStack[],
  fromSlot = 1,
): ArmyStack[] {
  const slots = attackSlots(classId, defenders, fromSlot);
  return slots.flatMap((slot) => defenders.filter((t) => t.slot === slot && t.totalHp > 0));
}
export function casualtySummary(
  initial: ArmyStack[],
  final: ArmyStack[],
  persist = true,
  repairableBps = rules.battle.losses.stage.repairableBps,
): Casualty[] {
  return [...new Set(initial.map((s) => s.unitId))].map((unitId) => {
    const sent = initial.filter((s) => s.unitId === unitId).reduce((n, s) => n + s.count, 0);
    const survived = final
      .filter((s) => s.unitId === unitId)
      .reduce((n, s) => n + Math.ceil(s.totalHp / s.hp), 0);
    const lost = sent - survived;
    const repairable = persist ? Math.ceil((lost * repairableBps) / 10000) : 0;
    return { unitId, sent, survived, lost, repairable, destroyed: persist ? lost - repairable : 0 };
  });
}
// Legacy in-flight saves can still contain the old per-stack snapshot. New battles
// always pass explicit commander snapshots; historical events are never re-simulated.
export function combatStats(stacks: ArmyStack[]): CombatStats {
  const deployed = alive(stacks);
  const mean = (key: keyof CombatStats) =>
    deployed.length
      ? Math.floor(deployed.reduce((sum, st) => sum + (st[key] ?? 100), 0) / deployed.length)
      : 0;
  return { initiative: mean('initiative'), extraFire: mean('extraFire') };
}
export function extraFireChance(own: number, opponent: number): number {
  return Math.max(0, Math.min(3500, 1000 + (own - opponent) * 10));
}
export function simulate(
  attacker: ArmyStack[],
  defender: ArmyStack[],
  seed: number,
  mode: BattleReport['mode'] = 'training',
  commanders?: [CombatStats, CombatStats],
): BattleReport {
  if (!Number.isInteger(seed) || seed < 1 || seed > 4294967295) throw Error('无效的战斗种子');
  const initial = structuredClone([attacker, defender]) as [ArmyStack[], ArmyStack[]];
  const teams = structuredClone(initial);
  const stats = structuredClone(commanders ?? initial.map(combatStats)) as [
    CombatStats,
    CombatStats,
  ];
  const firstSide: 0 | 1 = stats[1].initiative > stats[0].initiative ? 1 : 0;
  const chances: [number, number] = [
    extraFireChance(stats[0].extraFire, stats[1].extraFire),
    extraFireChance(stats[1].extraFire, stats[0].extraFire),
  ];
  const events: HitEvent[] = [];
  const actions: BattleAction[] = [];
  const next = rng32(seed);
  // Separate stream: proc rolls do not consume the hit/crit stream.
  const nextExtra = rng32((seed ^ 0x9e3779b9) >>> 0);
  // A full final major round (including extra fire) may still win by elimination.
  // Otherwise the side that acted first loses the stalemate, whichever army it is.
  let winner = (1 - firstSide) as 0 | 1;
  let rounds = 0;
  const attack = (source: ArmyStack, action: BattleAction) => {
    actions.push(action);
    const side = action.side;
    const enemies = alive(teams[1 - side]).sort((a, b) => a.slot - b.slot);
    const profile = rules.battle.classProfiles[source.classId];
    const slots = attackSlots(source.classId, enemies, source.slot);
    const ownClasses = new Set(alive(teams[side]).map((s) => s.classId));
    const enemyClasses = new Set(enemies.map((s) => s.classId));
    for (const [targetIndex, slot] of slots.entries()) {
      const target = enemies.find((t) => t.slot === slot);
      if (!target) {
        events.push({
          action: action.id,
          exchange: action.exchange,
          shot: targetIndex + 1,
          shots: slots.length,
          extra: action.extra,
          round: action.round,
          side,
          from: source.slot,
          to: slot,
          ground: true,
          damage: 0,
          critical: false,
          miss: false,
          remaining: 0,
          hp: 0,
        });
        continue;
      }
      const hitRoll = Math.floor((next() * 10000) / 4294967296),
        critRoll = Math.floor((next() * 10000) / 4294967296);
      const miss =
        hitRoll >=
        Math.max(
          rules.battle.minHitBps,
          Math.min(
            rules.battle.maxHitBps,
            rules.battle.baseHitBps + source.accuracy - target.evasion,
          ),
        );
      const critical =
        critRoll <
        Math.max(
          0,
          Math.min(
            rules.battle.maxCritBps,
            rules.battle.baseCritBps +
              source.crit -
              target.armor +
              (ownClasses.has('tank_destroyer')
                ? rules.battle.classProfiles.tank_destroyer.aura.value
                : 0),
          ),
        );
      const matchup = rules.matchup.find(
        (m) => m.attackerClass === source.classId && m.defenderClass === target.classId,
      )!.multiplierBps;
      const attackBonus = (source as ArmyStack & { attackBonus?: number }).attackBonus ?? 10000;
      const aura =
        10000 + (ownClasses.has('tank') ? rules.battle.classProfiles.tank.aura.value : 0);
      const reduction =
        source.classId === 'tank_destroyer' && enemyClasses.has('spg')
          ? 10000 - rules.battle.classProfiles.spg.aura.value
          : source.classId === 'rocket' && enemyClasses.has('rocket')
            ? 10000 - rules.battle.classProfiles.rocket.aura.value
            : 10000;
      const product =
        BigInt(Math.ceil(source.totalHp / source.hp)) *
        BigInt(source.attack) *
        BigInt(attackBonus) *
        BigInt(aura) *
        BigInt(matchup) *
        BigInt(profile.patternMultiplierBps) *
        BigInt(critical ? rules.battle.critMultiplierBps : 10000) *
        BigInt(reduction);
      // Half attack before downstream multipliers, with only final integer rounding.
      const damage = miss
        ? 0
        : Math.max(1, Number(product / (10000n ** 6n * (action.extra ? 2n : 1n))));
      target.totalHp = Math.max(0, target.totalHp - damage);
      events.push({
        action: action.id,
        exchange: action.exchange,
        shot: targetIndex + 1,
        shots: slots.length,
        extra: action.extra,
        round: action.round,
        side: action.side,
        from: source.slot,
        to: target.slot,
        damage,
        critical: !miss && critical,
        miss,
        remaining: Math.ceil(target.totalHp / target.hp),
        hp: target.totalHp,
      });
    }
  };
  outer: for (let round = 1; round <= rules.battle.maxRounds; round++) {
    // Each survivor gets at most one regular action in this major round.
    // Dead pending actors are skipped. Exhausted sides wait, never wrap early.
    const pending = teams.map((team) => alive(team).sort((a, b) => a.slot - b.slot));
    for (let exchange = 1; pending.some((team) => team.some((st) => st.totalHp > 0)); exchange++) {
      for (const side of [firstSide, (1 - firstSide) as 0 | 1]) {
        if (!alive(teams[0]).length || !alive(teams[1]).length) {
          winner = alive(teams[0]).length ? 0 : 1;
          break outer;
        }
        while (pending[side].length && pending[side][0].totalHp <= 0) pending[side].shift();
        const source = pending[side].shift();
        if (!source) continue;
        rounds = round;
        const action: BattleAction = {
          id: actions.length + 1,
          round,
          exchange,
          side,
          from: source.slot,
          extra: false,
        };
        attack(source, action);
        if (!alive(teams[1 - side]).length) {
          winner = side;
          break outer;
        }
        action.extraRoll = Math.floor((nextExtra() * 10000) / 4294967296);
        action.extraTriggered = action.extraRoll < chances[side];
        if (action.extraTriggered) {
          attack(source, {
            id: actions.length + 1,
            round,
            exchange,
            side,
            from: source.slot,
            extra: true,
          });
          if (!alive(teams[1 - side]).length) {
            winner = side;
            break outer;
          }
        }
      }
    }
  }
  return {
    id: '',
    title: '',
    at: 0,
    seed,
    ruleset: BATTLE_RULESET,
    winner,
    rounds,
    roundLimit: rules.battle.maxRounds,
    endReason: teams.every((team) => alive(team).length > 0) ? 'round-limit' : 'elimination',
    mode,
    tactics: { teams: stats, firstSide, chances },
    actions,
    initial,
    final: teams,
    events,
    casualties: casualtySummary(
      initial[0],
      teams[0],
      mode !== 'training',
      rules.battle.losses[mode].repairableBps,
    ),
    rewards: {},
  };
}
export function survivors(stacks: ArmyStack[]): Formation {
  return Array.from({ length: 6 }, (_, i) => {
    const s = stacks.find((s) => s.slot === i + 1);
    return s && s.totalHp > 0 ? { unitId: s.unitId, count: Math.ceil(s.totalHp / s.hp) } : null;
  });
}
