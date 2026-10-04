// Generated acceptance data only. Never access a player's profile directory.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, 'artifacts/native-v27');
mkdirSync(out, { recursive: true });
execFileSync(process.execPath, ['native/tests/rocket241.mjs'], { cwd: root, stdio: 'inherit' });
for (const f of ['combat-fixtures.json','legacy-fixtures.json','legacy-tank-fixtures.json'])
  copyFileSync(resolve(root,'artifacts/native-v241',f),resolve(out,f));
await build({
  stdin: {
    contents: String.raw`
import {newGame,assertState,rate,capacity} from './src/core/engine';
import {exportSave} from './src/core/storage';
import {unitList,researchCost} from './src/core/content';
import {researchTree} from './src/core/research';
import {army,simulate} from './src/core/battle';
import {battleSummary} from './src/core/overview';
import {readFileSync,writeFileSync} from 'node:fs';
async function main(){
 const s=newGame('materials27-qa','材料与音效验收副本',Date.now(),2700);
 for(const k of Object.keys(s.buildings))s.buildings[k]=60;
 s.industry={version:1,factory2:60,refit:60};
 for(const t of researchTree)s.tech[t.id]=30;
 s.commander.leadership=35;s.commander.prestige=46395;s.commander.attackSkill=79;s.commander.skillPoints=3;
 for(const k of Object.keys(s.wallet))s.wallet[k]=50000000;
 s.wallet.crystal=1;
 for(const u of unitList){s.available[u.unitId]+=200;s.createdUnits[u.unitId]+=200;}
 for(const k of Object.keys(s.arsenal.cores))s.arsenal.cores[k]=100;
 s.formation=['tank','rocket','tank_destroyer','spg','tank','spg'].map(c=>({unitId:c+'_t7',count:50}));
 assertState(s);
 writeFileSync('artifacts/native-v27/ready-save.json',await exportSave(s));
 const fixtures=JSON.parse(readFileSync('artifacts/native-v27/combat-fixtures.json','utf8'));
 for(const cls of ['tank','tank_destroyer','spg','rocket']) {
  const a=army([{unitId:cls+'_t7',count:20}]), b=army([{unitId:'tank_t7',count:20}]);
  a[0].initiative=1000;a[0].accuracy=10000;a[0].attack=1000000;a[0].crit=-10000;a[0].extraFire=0;
  const r=simulate(a,b,1,'training');r.id='destroy-'+cls;r.title='击毁音效验收 · '+cls;r.summary=battleSummary(r);fixtures.push(r);
 }
 writeFileSync('artifacts/native-v27/combat-fixtures.json',JSON.stringify(fixtures));
 const rows=unitList.map(u=>{
  const b=newGame('budget','budget',s.now);
  for(const k of Object.keys(b.buildings))b.buildings[k]=u.unlock.factoryLevel;
  const fundingHours=Math.max(...Object.entries(u.cost).map(([r,n])=>n*100/Math.max(1,rate(b,r))));
  return {id:u.unitId,cost:u.cost,repair:u.repairCost,fundingHours,productionHours:u.productionSeconds*100/3600,capacity:capacity(b)};
 });
 writeFileSync('artifacts/native-v27/budget.json',JSON.stringify({units:rows,research:[0,5,19,59,99,119].map(l=>({target:l+1,cost:researchCost(l)}))},null,2));
 console.log('V27_FIXTURES_READY',rows.filter(r=>r.id.endsWith('t7')));
}
main();`,
    resolveDir: root, loader: 'ts',
  },
  bundle: true, platform: 'node', target: 'node24', format: 'cjs', outfile: out + '/fixtures.cjs',
});
execFileSync(process.execPath, [out + '/fixtures.cjs'], { cwd: root, stdio: 'inherit' });
