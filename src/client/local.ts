import type { Command, GameState } from '../core/types';
import type { Request } from './protocol';
let worker: Worker | undefined;
let requestId = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
function rpc<T>(request: Request): Promise<T> {
  if (!worker) {
    worker = new Worker(new URL('./game.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const message = event.data;
      const waiter = pending.get(message.requestId);
      if (!waiter) return;
      pending.delete(message.requestId);
      if (message.error) waiter.reject(Error(message.error));
      else waiter.resolve(message.result);
    };
    worker.onerror = () => {
      for (const waiter of pending.values())
        waiter.reject(Error('本地存档服务意外中断，请重新载入页面'));
      pending.clear();
      worker?.terminate();
      worker = undefined;
    };
  }
  const id = ++requestId;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ requestId: id, request });
  });
}
export const listSaves = () => rpc<GameState[]>({ kind: 'list' });
export const loadSave = (id: string) => rpc<GameState | undefined>({ kind: 'load', id });
export const restoreBackup = (id: string) => rpc<GameState>({ kind: 'restore', id });
export const createSave = (state: GameState) => rpc<void>({ kind: 'create', state });
export const exportSave = (state: GameState) => rpc<string>({ kind: 'export', state });
export const parseSave = (text: string) => rpc<GameState>({ kind: 'parse', text });
export const advanceSave = (id: string, now: number) =>
  rpc<{ state: GameState; result: null }>({ kind: 'tick', id, now });
export const commandSave = (id: string, command: Command, now: number, commandId: string) =>
  rpc<{ state: GameState; result: string }>({ kind: 'command', id, command, now, commandId });
