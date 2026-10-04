import { build } from 'esbuild';
import { mkdirSync, copyFileSync, existsSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const { version } = JSON.parse(readFileSync(root + '/package.json', 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('Expected a numeric release version');
// Windows file properties and Godot metadata must match the package we distribute.
const syncVersion = (file, replacements) => {
  const before = readFileSync(file, 'utf8');
  let after = before;
  for (const [pattern, value] of replacements) {
    if (!pattern.test(after)) throw Error('Missing version setting in ' + file);
    after = after.replace(pattern, value);
  }
  if (after !== before) writeFileSync(file, after);
};
syncVersion(root + '/native/export_presets.cfg', [
  [/^application\/file_version="[^"]*"/m, `application/file_version="${version}.0"`],
  [/^application\/product_version="[^"]*"/m, `application/product_version="${version}.0"`],
]);
syncVersion(root + '/native/project.godot', [
  [/^config\/version="[^"]*"/m, `config/version="${version}"`],
]);
const buildDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Singapore',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(
  new Date(
    process.env.SOURCE_DATE_EPOCH ? Number(process.env.SOURCE_DATE_EPOCH) * 1000 : Date.now(),
  ),
);
syncVersion(root + '/native/project.godot', [
  [/^config\/build_date="[^"]*"/m, `config/build_date="${buildDate}"`],
]);
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
// Export can succeed despite a script parse error; fail before creating a broken release.
execFileSync(
  godot,
  ['--headless', '--path', root + '/native', '--script', 'res://scripts/game.gd', '--check-only'],
  {
    stdio: 'inherit',
    timeout: 30000,
  },
);
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
