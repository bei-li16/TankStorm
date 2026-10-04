import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..'),
  out = resolve(root, 'artifacts/native-v35');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: String.raw`
import {newGame,assertState} from './src/core/engine';
import {exportSave} from './src/core/storage';
import {prestigeRequired} from './src/core/commander';
import {writeFileSync} from 'node:fs';
import {dungeons} from './src/core/arsenal';
async function main(){
const s=newGame('research35','科研与远征章节验收',Date.now(),35);
for(const key of Object.keys(s.buildings))s.buildings[key]=120;
s.industry={version:1,factory2:120,refit:120};
for(const key of Object.keys(s.tech))s.tech[key]=30;
s.vip={version:1,paidGold:500000,lastDaily:-1};
s.commander.leadership=2000;s.commander.prestige=prestigeRequired(2000);s.commander.attackSkill=120;
for(const key of Object.keys(s.wallet))s.wallet[key]=1000000000000;
s.available.tank_t7=s.createdUnits.tank_t7=100000;
s.formation=Array.from({length:6},()=>({unitId:'tank_t7',count:10000}));
s.cleared=Array.from({length:575},(_,i)=>i);
s.arsenal.cleared=dungeons.slice(0,-1).map(d=>d.id);
assertState(s);
writeFileSync('artifacts/native-v35/ready-save.json',await exportSave(s));
console.log('V35_FIXTURE_READY');
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
