import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, 'artifacts/native-v243');
mkdirSync(out, { recursive: true });
execFileSync(process.execPath, ['native/tests/rocket241.mjs'], { cwd: root, stdio: 'inherit' });
for (const file of [
  'combat-fixtures.json',
  'legacy-fixtures.json',
  'legacy-tank-fixtures.json',
  'repair-save.json',
])
  copyFileSync(resolve(root, 'artifacts/native-v241', file), resolve(out, file));
await build({
  stdin: {
    contents: String.raw`
import {army,simulate} from './src/core/battle';
import {newGame,assertState} from './src/core/engine';
import {battleSummary} from './src/core/overview';
import {exportSave} from './src/core/storage';
import {readFileSync,writeFileSync} from 'node:fs';
const out='artifacts/native-v243/';
const durable=(initiative)=>army([{unitId:'tank_destroyer_t7',count:1}]).map(st=>({...st,attack:1,hp:1000000,totalHp:1000000,initiative}));
const reports=[];
for(const first of [0,1]){
 const r=simulate(durable(first===0?200:100),durable(first===1?200:100),243,'training');
 r.id='timeout-'+first;r.title='50回合上限验收';
 if(r.rounds!==50||r.winner!==1-first||r.endReason!=='round-limit')throw Error('Timeout failed');
 reports.push(r);
}
const old=JSON.parse(readFileSync('native/tests/legacy-rounds-v022.json','utf8'));
reports.push(old);
const s=newGame('round-ui','指挥官',1791014400000);
s.reports=reports;assertState(s);
exportSave(s).then(text=>writeFileSync(out+'round-save.json',text));
writeFileSync(out+'round-fixtures.json',JSON.stringify(reports.map(r=>({...r,summary:battleSummary(r)}))));
console.log('ROUND_FIXTURES: 2 new timeouts and unchanged v22 history');
`,
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
