import { build } from 'esbuild';
import { mkdirSync, copyFileSync, existsSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const { version } = JSON.parse(readFileSync(root + '/package.json', 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('Expected a numeric release version');
const folder = 'TankStorm-v' + version;
const out = resolve(root, 'release', folder);
mkdirSync(out + '/runtime', { recursive: true });
mkdirSync(out + '/rules', { recursive: true });
await build({
  entryPoints: [root + '/native/rules/bridge.ts'],
  outfile: out + '/rules/bridge.cjs',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  minify: false,
});
copyFileSync(process.execPath, out + '/runtime/node.exe');
const godot = root + '/.tools/godot/Godot_v4.6.2-stable_win64_console.exe';
if (!existsSync(godot)) throw Error('Godot 4.6.2 editor is required in .tools/godot');
execFileSync(godot, ['--headless', '--path', root + '/native', '--editor', '--import'], {
  stdio: 'inherit',
  timeout: 120000,
});
execFileSync(
  godot,
  [
    '--headless',
    '--path',
    root + '/native',
    '--export-release',
    'Windows Desktop',
    out + '/TankStorm.exe',
  ],
  { stdio: 'inherit', timeout: 120000 },
);
console.log('Built: ' + out + '/TankStorm.exe');
cpSync(root + '/native/licenses', out + '/licenses', { recursive: true });
copyFileSync(root + '/native/PLAYER_GUIDE.txt', out + '/README.txt');
// Point the launcher at the completed new build without overwriting a running older release.
writeFileSync(
  root + '/start-game.cmd',
  [
    '@echo off',
    'cd /d "%~dp0"',
    `if not exist "release\\${folder}\\TankStorm.exe" (`,
    '  echo Native game build is missing. Run npm run build:native first.',
    '  pause',
    '  exit /b 1',
    ')',
    `start "" "%~dp0release\\${folder}\\TankStorm.exe"`,
    '',
  ].join('\r\n'),
);
