import { units } from './content';
import { economyBonus } from './growth';
import { techLevel } from './research';
import type { GameState, Formation } from './types';

export const baseUnitLoad = (id: string) => {
  const u = units[id];
  const nominal = [80, 150, 250, 375, 500, 625, 800][u.tier - 1];
  return (nominal * u.load * 5) / [10, 15, 20, 30, 40, 50, 60][u.tier - 1];
};
export const unitLoad = (s: GameState, id: string) => {
  return Math.floor((baseUnitLoad(id) * (100 + economyBonus(techLevel(s, 'cargo'), 5))) / 100);
};
export const expeditionLoad = (s: GameState, f: Formation) =>
  f.reduce((n, t) => n + (t ? unitLoad(s, t.unitId) * t.count : 0), 0);
