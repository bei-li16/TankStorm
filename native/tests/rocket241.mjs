// Reuse real four-class targeting reports, then add salvo-specific miss/combo cases.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, 'artifacts/native-v241');
mkdirSync(out, { recursive: true });
execFileSync(process.execPath, ['native/tests/targeting22.mjs'], { cwd: root, stdio: 'inherit' });
for (const file of [
  'combat-fixtures.json',
  'legacy-fixtures.json',
  'legacy-tank-fixtures.json',
  'repair-save.json',
])
  copyFileSync(resolve(root, 'artifacts/native-v22', file), resolve(out, file));
await build({
  stdin: {
    contents: String.raw`
import {army,simulate} from './src/core/battle';
import {battleSummary} from './src/core/overview';
import {readFileSync,writeFileSync} from 'node:fs';
const file='artifacts/native-v241/combat-fixtures.json';
const fixtures=JSON.parse(readFileSync(file,'utf8'));
const troop=(cls)=>army(Array.from({length:6},()=>({unitId:cls+'_t7',count:20})));
for(const kind of ['miss','extra']){
 const a=troop('rocket').slice(0,1),b=troop('tank');
 a[0].initiative=1000;a[0].accuracy=kind==='miss'?-100000:10000;a[0].extraFire=kind==='extra'?1000:0;
 for(const st of b){st.hp=1000000;st.totalHp=20000000;st.attack=1;st.extraFire=1000;}
 if(kind==='extra')for(const st of b)st.extraFire=0;
 let chosen;
 for(let seed=1;seed<1000;seed++){
  const r=simulate(a,b,seed*7919,'training');
  if(kind==='miss'?r.events.filter(e=>e.action===1).every(e=>e.miss):r.actions.some(e=>e.extra&&e.side===0)){chosen=r;break;}
 }
 if(!chosen)throw Error('Missing rocket '+kind+' case');
 chosen.id='rocket-'+kind;chosen.title=kind==='miss'?'火箭齐射 · 全部闪避':'火箭齐射 · 连击';chosen.qaTargets=[1,2,3,4,5,6];chosen.summary=battleSummary(chosen);fixtures.push(chosen);
}
writeFileSync(file,JSON.stringify(fixtures));
console.log('ROCKET_FIXTURES:',fixtures.length);
`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  outfile: out + '/extra.cjs',
});
execFileSync(process.execPath, [out + '/extra.cjs'], { cwd: root, stdio: 'inherit' });
