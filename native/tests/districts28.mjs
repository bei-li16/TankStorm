// Synthetic regional UI fixture: no player data is read.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..'),
  out = resolve(root, 'artifacts/native-v28');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: String.raw`
import {newGame,assertState} from './src/core/engine';
import {exportSave} from './src/core/storage';
import {prestigeRequired} from './src/core/commander';
import {writeFileSync} from 'node:fs';
async function main(){
const s=newGame('district28','区域场景验收副本',Date.now(),280);
for(const k of Object.keys(s.buildings))s.buildings[k]=25;
s.buildings.hq=60;s.buildings.factory=60;
s.industry={version:1,factory2:60,refit:60};
s.commander.prestige=prestigeRequired(80);s.commander.leadership=50;
s.commander.attackSkill=20;
s.tech.attack=20;s.tech.hp=20;
s.wallet={iron:12000000,oil:9200000,lead:7800000,titanium:6700000,crystal:3200000,gold:1000};
s.available.tank_t7=1600;s.createdUnits.tank_t7=1600;
s.damaged.rocket_t5=7;s.createdUnits.rocket_t5=7;
s.formation=Array.from({length:6},()=>({unitId:'tank_t7',count:260}));
s.cleared=Array.from({length:112},(_,i)=>i);
assertState(s);
writeFileSync('artifacts/native-v28/ready-save.json',await exportSave(s));
console.log('V28_FIXTURE_READY');
}main();`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  outfile: out + '/fixtures.cjs',
});
execFileSync(process.execPath, [out + '/fixtures.cjs'], { cwd: root, stdio: 'inherit' });
