import { build } from 'esbuild';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const godot = root + '/.tools/godot/Godot_v4.6.2-stable_win64_console.exe';
if (!existsSync(godot)) throw Error('Run python native/bootstrap-godot.py first.');
mkdirSync(root + '/release/development/runtime', { recursive: true });
await build({
  entryPoints: [root + '/native/rules/bridge.ts'],
  outfile: root + '/release/development/rules/bridge.cjs',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
});
copyFileSync(process.execPath, root + '/release/development/runtime/node.exe');
execFileSync(godot, ['--headless', '--path', root + '/native', '--editor', '--import'], {
  stdio: 'inherit',
  windowsHide: true,
});
const child = spawn(godot, ['--path', root + '/native'], { stdio: 'inherit', windowsHide: true });
child.on('exit', (code) => process.exit(code ?? 0));
