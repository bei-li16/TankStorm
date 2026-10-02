import { assertState } from './engine';
import { enableArsenal } from './arsenal';
import { RULESET } from './content';
import type { GameState } from './types';
const DB = 'tankstorm-classic-v1';
export async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('saves', { keyPath: 'id' });
      r.result.createObjectStore('backups', { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function listSaves(): Promise<GameState[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saves', 'readonly'),
      req = tx.objectStore('saves').getAll();
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function loadSave(id: string): Promise<GameState | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saves', 'readonly'),
      req = tx.objectStore('saves').get(id);
    tx.oncomplete = () => {
      db.close();
      try {
        if (req.result) assertState(req.result);
        resolve(req.result);
      } catch (e) {
        reject(e);
      }
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function createSave(s: GameState): Promise<void> {
  assertState(s);
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saves', 'readwrite');
    tx.objectStore('saves').add(s);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
// The updater is synchronous: read/validate/write stay in a single IDB transaction.
// Multiple tabs serialize here, so a second writer always reads the committed state.
export async function updateSave<T>(
  id: string,
  updater: (state: GameState) => { state: GameState; result: T },
  expectedRevision?: number,
): Promise<{ state: GameState; result: T }> {
  const db = await database();
  return new Promise((resolve, reject) => {
    let output: { state: GameState; result: T };
    let failure: unknown;
    const tx = db.transaction(['saves', 'backups'], 'readwrite');
    const store = tx.objectStore('saves');
    const req = store.get(id);
    req.onsuccess = () => {
      try {
        const previous = req.result as GameState;
        if (!previous) throw Error('存档不存在');
        if (expectedRevision !== undefined && previous.revision !== expectedRevision)
          throw Error('存档已被其他页面更新');
        output = updater(previous);
        assertState(output.state);
        if (output.state.id !== id) throw Error('存档编号不能修改');
        tx.objectStore('backups').put(previous);
        store.put(output.state);
      } catch (e) {
        failure = e;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(output);
    };
    tx.onabort = () => {
      db.close();
      reject(failure ?? tx.error ?? Error('存档事务中止'));
    };
    tx.onerror = () => {
      failure ??= tx.error;
    };
  });
}
export async function restoreBackup(id: string): Promise<GameState> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['saves', 'backups'], 'readwrite');
    let state: GameState;
    let error: unknown;
    const r = tx.objectStore('backups').get(id);
    r.onsuccess = () => {
      try {
        state = r.result;
        if (!state) throw Error('没有可用备份');
        assertState(state);
        tx.objectStore('saves').put(state);
      } catch (e) {
        error = e;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(state);
    };
    tx.onabort = () => {
      db.close();
      reject(error ?? tx.error);
    };
  });
}
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return (
    '{' +
    Object.keys(value)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}
async function digest(value: unknown) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(buffer), (v) => v.toString(16).padStart(2, '0')).join('');
}
export async function exportSave(s: GameState) {
  assertState(s);
  const payload = { format: 'tankstorm-save', schema: 1, ruleset: RULESET, state: s };
  return JSON.stringify({ ...payload, checksum: await digest(payload) }, null, 2);
}
export async function parseSave(text: string): Promise<GameState> {
  if (text.length > 20000000) throw Error('存档文件超过 20 MB');
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw Error('文件不是有效的 JSON 存档');
  }
  if (
    doc?.format !== 'tankstorm-save' ||
    doc.schema !== 1 ||
    doc.ruleset !== RULESET ||
    typeof doc.checksum !== 'string'
  )
    throw Error('存档格式或规则版本不兼容');
  const payload = {
    format: doc.format,
    schema: doc.schema,
    ruleset: doc.ruleset,
    state: doc.state,
  };
  if ((await digest(payload)) !== doc.checksum) throw Error('存档校验失败，文件可能已损坏');
  try {
    assertState(doc.state);
    enableArsenal(doc.state);
    assertState(doc.state);
  } catch (e) {
    throw Error(`存档数据无效：${(e as Error).message}`);
  }
  return doc.state;
}
