// Synthetic v31 profile; never reads player saves.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..'),
  out = resolve(root, 'artifacts/native-v31');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: String.raw`
import {newGame,execute,advance,assertState,capacity} from './src/core/engine';
import {exportSave} from './src/core/storage';
import {prestigeRequired} from './src/core/commander';
import {dungeons} from './src/core/arsenal';
import {unitList} from './src/core/content';
import {writeFileSync} from 'node:fs';
let serial=0;const act=(s,c)=>execute(s,c,s.now,'fixture-'+ ++serial).state;
async function main(){
let s=newGame('expeditions31','归队与档案验收',Date.now(),31);
s.world[0].guards=[{unitId:'tank_t7',count:600},null,null,null,null,null];
s=act(s,{type:'march',targetId:'site-0',mission:'gather'});
s=act(s,{type:'rest',minutes:480});
for(const k of Object.keys(s.buildings))s.buildings[k]=40;
s.buildings.hq=s.buildings.factory=80;
s.industry={version:1,factory2:70,refit:60};
s.commander.prestige=prestigeRequired(100);s.commander.leadership=80;
s.commander.initiativeSkill=50;s.commander.extraFireSkill=45;s.commander.attackSkill=60;
s.tech.attack=s.tech.hp=50;s.tech.ballistics=s.tech.march=30;
s.wallet={iron:1000,oil:1000,lead:1000,titanium:1000,crystal:1000,gold:50000};
for(const u of unitList){s.available[u.unitId]+=5000;s.createdUnits[u.unitId]+=5000;}
s.formation=Array.from({length:6},()=>({unitId:'rocket_t6',count:410}));
s=act(s,{type:'battle',stage:0});s=act(s,{type:'dungeon',dungeonId:dungeons[0].id});
// Record an actual successful raid return as well.
const npc=s.world.find(t=>t.kind==='npc');npc.guards=[{unitId:'tank_t1',count:1},null,null,null,null,null];
s=act(s,{type:'march',targetId:npc.id,mission:'raid'});s=act(s,{type:'rest',minutes:60});
s.world[0].guards=[{unitId:'tank_t1',count:1},null,null,null,null,null];
s=act(s,{type:'march',targetId:'site-0',mission:'gather'});s=advance(s,s.marches[0].dueAt);
s.timeOffset=Math.max(0,s.now-Date.now());
s.intel['site-0']={at:s.now,guards:s.world[0].guards,reserve:s.world[0].reserve,wallet:s.world[0].wallet};
assertState(s);writeFileSync('artifacts/native-v31/ready-save.json',await exportSave(s));
s.wallet.iron=capacity(s);writeFileSync('artifacts/native-v31/overflow-save.json',await exportSave(s));
console.log('V31_FIXTURE_READY',s.reports.length,s.marches[0].phase);
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
