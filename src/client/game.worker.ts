import { advance, execute } from '../core/engine';
import {
  createSave,
  exportSave,
  listSaves,
  loadSave,
  parseSave,
  restoreBackup,
  updateSave,
} from '../core/storage';
import type { Request } from './protocol';
// The entire read/compute/commit operation runs off the rendering thread.
// IndexedDB serializes readwrite transactions across all tabs' workers.
async function handle(request: Request) {
  switch (request.kind) {
    case 'list':
      return listSaves();
    case 'load':
      return loadSave(request.id);
    case 'restore':
      return restoreBackup(request.id);
    case 'create':
      return createSave(request.state);
    case 'export':
      return exportSave(request.state);
    case 'parse':
      return parseSave(request.text);
    case 'tick':
      return updateSave(request.id, (s) => ({ state: advance(s, request.now), result: null }));
    case 'command':
      return updateSave(request.id, (s) =>
        execute(s, request.command, request.now, request.commandId),
      );
  }
}
self.addEventListener(
  'message',
  async (event: MessageEvent<{ requestId: number; request: Request }>) => {
    const { requestId, request } = event.data;
    try {
      self.postMessage({ requestId, result: await handle(request) });
    } catch (error) {
      self.postMessage({
        requestId,
        error: error instanceof Error ? error.message : '本地存档服务失败',
      });
    }
  },
);
