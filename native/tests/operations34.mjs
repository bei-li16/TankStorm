import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..'),
  out = resolve(root, 'artifacts/native-v34');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: String.raw`
import {newGame,assertState} from './src/core/engine';
import {exportSave} from './src/core/storage';
import {prestigeRequired} from './src/core/commander';
import {writeFileSync} from 'node:fs';
async function main(){
const s=newGame('operations34','基地作业验收',Date.now(),1);
for(const key of Object.keys(s.buildings))s.buildings[key]=70;
s.buildings.hq=90;s.industry={version:1,factory2:70,refit:70};
s.vip={version:1,paidGold:500000,lastDaily:-1};
s.commander.leadership=120;s.commander.prestige=prestigeRequired(131);s.commander.books=10000;
for(const key of Object.keys(s.wallet))s.wallet[key]=1000000000;
s.available.tank_t7=s.createdUnits.tank_t7=10000;
s.damaged.tank_t7=7;s.createdUnits.tank_t7+=7;
s.formation=Array.from({length:6},()=>({unitId:'tank_t7',count:615}));
assertState(s);
writeFileSync('artifacts/native-v34/ready-save.json',await exportSave(s));
console.log('V34_FIXTURE_READY');
}main();`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out + '/fixtures.cjs',
});
execFileSync(process.execPath, [out + '/fixtures.cjs'], { cwd: root, stdio: 'inherit' });
