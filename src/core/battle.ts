import { rules, units } from './content';
import type { ArmyStack, BattleReport, Casualty, Formation, GameState, HitEvent } from './types';
export function rng32(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return x >>> 0;
  };
}
export function army(formation: Formation, tech?: GameState['tech'], skill = 0): ArmyStack[] {
  return formation.flatMap((s, i) => {
    if (!s || !s.count) return [];
    const u = units[s.unitId];
    const hp = Math.floor(
      (u.hp * (10000 + (tech?.hp ?? 0) * rules.economy.techBonusPerLevelBps)) / 10000,
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
        attackBonus: 10000 + (tech?.attack ?? 0) * rules.economy.techBonusPerLevelBps + skill * 200,
      },
    ];
  });
}
function alive(a: ArmyStack[]) {
  return a.filter((s) => s.totalHp > 0);
}
// Save schema stays compatible; historical reports retain their recorded rules and events.
export const BATTLE_RULESET = 'classic-combat-v0.7';
export function attackTargets(classId: ArmyStack['classId'], defenders: ArmyStack[]): ArmyStack[] {
  const enemies = alive(defenders).sort((a, b) => a.slot - b.slot);
  if (!enemies.length) return [];
  const anchor = enemies[0];
  switch (rules.battle.classProfiles[classId].attackPattern) {
    case 'all_alive':
      return enemies;
    case 'front_row':
      // Classic horizontal volley: the living front row, then the rear row once it is cleared.
      return enemies.filter((t) => t.slot <= 3 === anchor.slot <= 3);
    case 'column':
      return enemies.filter((t) =>
        rules.battle.columns.find((c) => c.includes(anchor.slot))!.includes(t.slot),
      );
    default:
      return [anchor];
  }
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
    const repairable = persist ? Math.floor((lost * repairableBps) / 10000) : 0;
    return { unitId, sent, survived, lost, repairable, destroyed: persist ? lost - repairable : 0 };
  });
}
export function simulate(
  attacker: ArmyStack[],
  defender: ArmyStack[],
  seed: number,
  mode: BattleReport['mode'] = 'training',
): BattleReport {
  if (!Number.isInteger(seed) || seed < 1 || seed > 4294967295) throw Error('无效的战斗种子');
  const initial = structuredClone([attacker, defender]) as [ArmyStack[], ArmyStack[]];
  const teams = structuredClone(initial);
  const events: HitEvent[] = [];
  const next = rng32(seed);
  let winner: 0 | 1 = 1;
  let rounds = 0;
  outer: for (let round = 1; round <= rules.battle.maxRounds; round++) {
    for (let slot = 1; slot <= rules.battle.slots; slot++)
      for (const side of [0, 1] as const) {
        if (!alive(teams[0]).length || !alive(teams[1]).length) {
          winner = alive(teams[0]).length ? 0 : 1;
          break outer;
        }
        const source = teams[side].find((s) => s.slot === slot && s.totalHp > 0);
        if (!source) continue;
        rounds = round;
        const enemies = alive(teams[1 - side]).sort((a, b) => a.slot - b.slot);
        const profile = rules.battle.classProfiles[source.classId];
        const targets = attackTargets(source.classId, enemies);
        const ownClasses = new Set(alive(teams[side]).map((s) => s.classId));
        const enemyClasses = new Set(enemies.map((s) => s.classId));
        for (const target of targets) {
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
          const damage = miss ? 0 : Math.max(1, Number(product / 10000n ** 6n));
          target.totalHp = Math.max(0, target.totalHp - damage);
          events.push({
            round,
            side,
            from: source.slot,
            to: target.slot,
            damage,
            critical: !miss && critical,
            miss,
            remaining: Math.ceil(target.totalHp / target.hp),
            hp: target.totalHp,
          });
        }
        if (!alive(teams[1 - side]).length) {
          winner = side;
          break outer;
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
    mode,
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
