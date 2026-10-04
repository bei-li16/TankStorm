import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..'),
  out = resolve(root, 'artifacts/native-v32');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: String.raw`
import {newGame,execute,advance,assertState} from './src/core/engine';
import {exportSave} from './src/core/storage';
import {prestigeRequired} from './src/core/commander';
import {stageNames,unitList} from './src/core/content';
import {dungeons} from './src/core/arsenal';
import {writeFileSync} from 'node:fs';
async function main(){
let s=newGame('base32','基地与休整验收',Date.now(),32),seq=0;
const act=c=>{s=execute(s,c,s.now,'fixture'+ ++seq).state;};
for(const k of Object.keys(s.buildings)) s.buildings[k]=40;
s.buildings.hq=s.buildings.factory=120;s.buildings.lab=60;s.tech.resourceOutput=40;s.industry={version:1,factory2:80,refit:60};
s.commander.prestige=prestigeRequired(120);s.commander.leadership=120;
s.commander.attackSkill=120;s.commander.initiativeSkill=50;s.commander.extraFireSkill=45;
s.vip={version:1,paidGold:500000,lastDaily:-1};
for(const k of Object.keys(s.wallet))s.wallet[k]=10000000;
for(const u of unitList){s.available[u.unitId]+=5000;s.createdUnits[u.unitId]+=5000;}
s.formation=Array.from({length:6},()=>({unitId:'tank_t7',count:615}));
s.cleared=stageNames.map((_,i)=>i).slice(0,-1);s.arsenal.cleared=dungeons.map(d=>d.id).slice(0,-1);
s.damaged.tank_t7=6;s.createdUnits.tank_t7+=6;
act({type:'produce',unitId:'tank_t4',count:50,facility:'factory'});
act({type:'produce',unitId:'tank_t4',count:50,facility:'factory2'});
act({type:'research',tech:'resourceOutput'});act({type:'repair',unitId:'tank_t7',count:6});
act({type:'refit',unitId:'tank_t4',count:3});
s.world[0].guards=[{unitId:'tank_t1',count:1},null,null,null,null,null];
act({type:'march',targetId:'site-0',mission:'gather'});
s=advance(s,s.marches[0].dueAt);
s.timeOffset=Math.max(0,s.now-Date.now());assertState(s);
writeFileSync('artifacts/native-v32/ready-save.json',await exportSave(s));
console.log('V32_FIXTURE_READY');
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
