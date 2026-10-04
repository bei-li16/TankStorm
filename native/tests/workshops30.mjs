// Independent synthetic profile. No player save is read or modified.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, 'artifacts/native-v30');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: String.raw`
import {newGame,assertState,execute,capacity} from './src/core/engine';
import {exportSave} from './src/core/storage';
import {prestigeRequired} from './src/core/commander';
import {unitList} from './src/core/content';
import {army,simulate} from './src/core/battle';
import {battleSummary} from './src/core/overview';
import {writeFileSync} from 'node:fs';
async function main(){
let s=newGame('workshops30','车间与奖励验收',Date.now(),300);
for(const k of Object.keys(s.buildings))s.buildings[k]=40;
s.buildings.hq=100;s.buildings.factory=60;
s.industry={version:1,factory2:90,refit:70};
s.commander.prestige=prestigeRequired(100);s.commander.leadership=60;
s.commander.attackSkill=20;s.commander.skillPoints=30;
s.vip={version:1,paidGold:500000,lastDaily:-1};
for(const k of Object.keys(s.wallet))s.wallet[k]=Math.floor(capacity(s)*.95);
s.wallet.gold=500000;
for(const u of unitList){s.available[u.unitId]+=3000;s.createdUnits[u.unitId]+=3000;}
for(const k of Object.keys(s.arsenal.cores))s.arsenal.cores[k]=2000;
s.damaged.rocket_t6=7;s.createdUnits.rocket_t6+=7;
s.formation=Array.from({length:6},()=>({unitId:'tank_t7',count:250}));
s.cleared=Array.from({length:17},(_,i)=>i);
for(const facility of ['factory','factory2','refit']){
 for(let i=0;i<3;i++)s=execute(s,{type:facility==='refit'?'refit':'produce',facility,unitId:'tank_t7',count:50},s.now,'fixture'+facility+i).state;
}
assertState(s);
writeFileSync('artifacts/native-v30/ready-save.json',await exportSave(s));
const fixtures=[];
for(const cls of ['tank','rocket']){
 const a=army([{unitId:cls+'_t7',count:90}]),b=army([{unitId:'tank_t7',count:300},{unitId:'tank_t7',count:300}]);
 a[0].crit=5000;a[0].accuracy=10000;a[0].extraFire=0;a[0].initiative=1000;
 for(let seed=1;seed<100;seed++){
  const r=simulate(a,b,seed,'training');
  if(r.events.some(e=>e.critical)&&r.events.some(e=>!e.critical&&!e.miss&&!e.ground)){
   r.id='presentation-'+cls;r.title='命中与换手验收 · '+cls;r.summary=battleSummary(r);fixtures.push(r);break;
  }
 }
}
writeFileSync('artifacts/native-v30/combat-fixtures.json',JSON.stringify(fixtures));
console.log('V30_FIXTURE_READY',fixtures.map(r=>[r.id,r.events.length]));
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
