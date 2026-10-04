// Purely synthetic shortage fixture; never reads the player's save folder.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const out=resolve(root,'artifacts/native-v271');
mkdirSync(out,{recursive:true});
await build({stdin:{contents:String.raw`
import {newGame,assertState} from './src/core/engine';
import {exportSave} from './src/core/storage';
import {writeFileSync} from 'node:fs';
async function main(){
 const s=newGame('presets271','编队缺额验收副本',Date.now(),2710);
 s.presets=[{name:'满编突击队',formation:[{unitId:'tank_t7',count:20},{unitId:'rocket_t5',count:20},{unitId:'rocket_t5',count:20},{unitId:'spg_t7',count:20},null,{unitId:'tank_t7',count:20}]}];
 for(const [id,n] of [['tank_t7',7],['rocket_t5',31]]){s.available[id]=n;s.createdUnits[id]=n;}
 s.damaged.spg_t7=8;s.createdUnits.spg_t7=8;
 assertState(s);
 writeFileSync('artifacts/native-v271/ready-save.json',await exportSave(s));
 for(const id of ['tank_t7','rocket_t5']){s.available[id]=0;s.createdUnits[id]=0;}
 assertState(s);
 writeFileSync('artifacts/native-v271/empty-save.json',await exportSave(s));
 console.log('V271_FIXTURES_READY');
}
main();`,resolveDir:root,loader:'ts'},bundle:true,platform:'node',target:'node24',format:'cjs',outfile:out+'/fixtures.cjs'});
execFileSync(process.execPath,[out+'/fixtures.cjs'],{cwd:root,stdio:'inherit'});
