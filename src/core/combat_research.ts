import type { ArmyStack, GameState } from './types';

// Basis points, except the legacy defense research's percentage-reduction rating.
export const combatResearch = {
  accuracy: 15,
  evasion: 20,
  critical: 20,
  criticalDamage: 50,
  armorResistance: 10,
  defense: 25,
} as const;
export const defenseReduction = (rating: number) => rating / (10000 + rating);
// Old saved army snapshots used `defense` for percentage reduction. Never
// reinterpret that rating as vehicle flat defense, or add research retroactively.
export function defenseStats(st: ArmyStack) {
  const current = st.baseDefense !== undefined || st.damageReduction !== undefined;
  return {
    flat: current ? (st.defense ?? 0) : 0,
    base: st.baseDefense ?? 0,
    rating: current ? (st.damageReduction ?? 0) : (st.defense ?? 0),
  };
}
export function combatModifiers(tech?: Partial<GameState['tech']>) {
  return {
    accuracy: (tech?.accuracy ?? 0) * combatResearch.accuracy,
    evasion: (tech?.evasion ?? 0) * combatResearch.evasion,
    crit: (tech?.critical ?? 0) * combatResearch.critical,
    armor: (tech?.armorResistance ?? 0) * combatResearch.armorResistance,
    critMultiplierBps: 15000 + (tech?.criticalDamage ?? 0) * combatResearch.criticalDamage,
    damageReduction: (tech?.defense ?? 0) * combatResearch.defense,
  };
}
