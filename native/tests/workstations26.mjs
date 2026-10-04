// Synthetic acceptance saves only; never read or write the player's profiles.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, 'artifacts/native-v26');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: String.raw`
import {newGame,execute,assertState} from './src/core/engine';
import {exportSave} from './src/core/storage';
import {unitList} from './src/core/content';
import {researchTree} from './src/core/research';
import {writeFileSync} from 'node:fs';
async function main(){
 let s=newGame('workstations26-qa','工位验收副本',Date.now(),2600);
 for(const k of Object.keys(s.buildings))s.buildings[k]=60;
 s.industry={version:1,factory2:60,refit:60};
 for(const t of researchTree)s.tech[t.id]=30;
 s.commander.leadership=35;s.commander.prestige=46395;s.commander.attackSkill=73;s.commander.skillPoints=8;
 for(const k of Object.keys(s.wallet))s.wallet[k]=50000000;
 for(const u of unitList){s.available[u.unitId]+=200;s.createdUnits[u.unitId]+=200;}
 for(const [id,n] of [['tank_t7',7],['spg_t7',6],['tank_t1',7],['tank_t2',6],['rocket_t1',8],['rocket_t2',9]]){s.damaged[id]=n;s.createdUnits[id]+=n;}
 s.formation=['tank','rocket','tank_destroyer','spg','tank','spg'].map(c=>({unitId:c+'_t7',count:50}));
 s=execute(s,{type:'battle',stage:0},s.now,'first').state;
 if(s.reports[0].winner!==0)throw Error('Expected victory');
 assertState(s);
 writeFileSync('artifacts/native-v26/ready-save.json',await exportSave(s));
 console.log('V26_FIXTURES_READY');
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
