import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { version } = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'),
);
const exe = resolve(import.meta.dirname, '../release/TankStorm-v' + version + '/TankStorm.exe');
if (!existsSync(exe)) throw Error('Run npm run build:native first.');
const child = spawn(exe, [], { detached: true, stdio: 'ignore', windowsHide: false });
child.unref();
