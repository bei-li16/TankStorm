// Generate isolated reports and validate barrel/arrival geometry before native visual QA.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, 'artifacts/native-v242');
mkdirSync(out, { recursive: true });
execFileSync(process.execPath, ['native/tests/rocket241.mjs'], { cwd: root, stdio: 'inherit' });
for (const file of [
  'combat-fixtures.json',
  'legacy-fixtures.json',
  'legacy-tank-fixtures.json',
  'repair-save.json',
])
  copyFileSync(resolve(root, 'artifacts/native-v241', file), resolve(out, file));

for (const name of ['aim', 'indirect242']) {
  const log = execFileSync(
    resolve(root, '.tools/godot/Godot_v4.6.2-stable_win64_console.exe'),
    ['--headless', '--path', 'native', '--script', `res://tests/${name}.gd`],
    { cwd: root, encoding: 'utf8' },
  );
  if (log.includes('SCRIPT ERROR') || log.includes('Parse Error')) throw Error(log);
  writeFileSync(resolve(out, name + '.log'), log);
  console.log(log.trim());
}
