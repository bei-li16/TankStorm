// Self-contained synthetic saves; no access to player profiles.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, 'artifacts/native-v25');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: String.raw`
import {newGame,execute,assertState} from './src/core/engine';
import {exportSave} from './src/core/storage';
import {unitList} from './src/core/content';
import {writeFileSync} from 'node:fs';
async function main(){
 let s=newGame('experience25-qa','发布验收',Date.now(),2500);
 for(const k of Object.keys(s.buildings))s.buildings[k]=60;
 s.industry={version:1,factory2:60,refit:60};
 s.commander.leadership=20;s.commander.prestige=566440;
 for(const k of Object.keys(s.wallet))s.wallet[k]=10000000;
 for(const u of unitList){s.available[u.unitId]+=200;s.createdUnits[u.unitId]+=200;}
 for(const [id,n] of [['tank_t7',7],['spg_t7',6]]){s.damaged[id]=n;s.createdUnits[id]+=n;}
 s.destroyedUnits.tank_t1=9;s.createdUnits.tank_t1+=9;
 s.formation=['tank','rocket','tank_destroyer','spg','tank','spg'].map(c=>({unitId:c+'_t7',count:50}));
 s=execute(s,{type:'battle',stage:0},s.now,'first').state;
 if(s.reports[0].winner!==0)throw Error('Expected victory');
 const site=s.world.find(v=>v.level>=60 && v.kind==='mine');
 s=execute(s,{type:'scout',targetId:site.id},s.now,'scout').state;
 assertState(s);
 writeFileSync('artifacts/native-v25/ready-save.json',await exportSave(s));
 writeFileSync('artifacts/native-v25/meta.json',JSON.stringify({site:site.id,report:s.reports[0].id}));
 console.log('V25_FIXTURES_READY');
}
main();`,
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
