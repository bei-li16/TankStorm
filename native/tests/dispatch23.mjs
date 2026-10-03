// Isolated native fixtures only; no player save is read or modified.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, 'artifacts/native-v23');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: String.raw`
import {newGame,execute,assertState} from './src/core/engine';
import {exportSave} from './src/core/storage';
import {researchTree} from './src/core/research';
import {writeFileSync} from 'node:fs';
let seq=0;
const act=(s,c)=>execute(s,c,s.now,'dispatch-fixture-'+(++seq)).state;
async function main(){
let s=newGame('dispatch-fixture','基地调度验收',Date.now());
for(const k of Object.keys(s.buildings))s.buildings[k]=60;
s.buildings.hq=61;
for(const node of researchTree)s.tech[node.id]=30;
for(const r of Object.keys(s.wallet))s.wallet[r]=1e11;
s.industry={version:1,factory2:60,refit:60};
s.vip={version:1,paidGold:500000,lastDaily:-1};
s.available.tank_t4=600;s.createdUnits.tank_t4=600;
s.damaged.tank_t7=1000;s.createdUnits.tank_t7=1000;
for(const b of ['iron','oil','lead','titanium','crystal','factory','lab'])s=act(s,{type:'upgrade',building:b});
for(const facility of ['factory','factory2'])for(let i=0;i<(facility==='factory'?6:3);i++)s=act(s,{type:'produce',facility,unitId:i%2?'spg_t5':'tank_t5',count:100});
for(let i=0;i<3;i++)s=act(s,{type:'refit',unitId:'tank_t5',count:100});
for(const tech of ['attack','construction','hp'])s=act(s,{type:'research',tech});
s=act(s,{type:'repair',unitId:'tank_t7',count:1000});
// Three independent, valid paid travel snapshots, long enough for visual QA.
const targets=s.world.filter(v=>v.kind==='mine').slice(0,3);
for(let i=0;i<3;i++){
 const site=targets[i];site.guards.fill(null);site.reserve=1e8;
 s=act(s,{type:'formation',slots:[{unitId:'tank_t4',count:10},null,null,null,null,null]});
 s=act(s,{type:'march',targetId:site.id,mission:'gather'});
 const m=s.marches.at(-1);m.travelMs=3600000;m.dueAt=s.now+3600000;
 if(i===1){m.phase='gathering';m.gatherRate=m.capacity;m.cargo[site.resource]=100;}
 if(i===2){m.phase='returning';m.mission='raid';m.cargo.iron=12345;}
}
assertState(s);
writeFileSync('artifacts/native-v23/busy-save.json',await exportSave(s));
const idle=newGame('dispatch-idle','新基地调度',Date.now());
idle.damaged.tank_t1=7;idle.createdUnits.tank_t1+=7;assertState(idle);
writeFileSync('artifacts/native-v23/idle-save.json',await exportSave(idle));
}
main();
`,
    resolveDir: root, loader: 'ts',
  },
  bundle: true, platform: 'node', target: 'node24', format: 'cjs', outfile: out + '/fixtures.cjs',
});
execFileSync(process.execPath, [out + '/fixtures.cjs'], { cwd: root, stdio: 'inherit' });
