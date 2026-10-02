import type { Command, GameState } from '../core/types';
export type Request =
  | { kind: 'list' }
  | { kind: 'load' | 'restore'; id: string }
  | { kind: 'create' | 'export'; state: GameState }
  | { kind: 'parse'; text: string }
  | { kind: 'tick'; id: string; now: number }
  | { kind: 'command'; id: string; now: number; command: Command; commandId: string };
