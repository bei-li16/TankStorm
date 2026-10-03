// All saves and replay fixtures live in ignored QA output, apart from frozen legacy evidence.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, 'artifacts/native-v22');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: String.raw`
import {army,simulate} from './src/core/battle';
import {newGame,assertState} from './src/core/engine';
import {battleSummary} from './src/core/overview';
import {exportSave} from './src/core/storage';
import {writeFileSync} from 'node:fs';
const out='artifacts/native-v22/';
const troop=(slots,cls='tank')=>army(Array.from({length:6},(_,i)=>slots.includes(i+1)?{unitId:cls+'_t7',count:20}:null));
const cases=[
 ['tank-full','tank',2,[1,2,3,4,5,6],[1,2,3]],
 ['tank-two','tank',2,[1,3],[1,3]],
 ['tank-mixed','tank',2,[1,3,5],[1,5,3]],
 ['tank-front','tank',5,[2],[2]],
 ['tank-rear','tank',5,[5],[5]],
 ['tank-column','tank',3,[2,5],[2]],
 ['tank-rear-all','tank',1,[4,5,6],[4,5,6]],
 ['spg-one','spg',2,[1,5],[5]],
 ['spg-two','spg',5,[2,5],[2,5]],
 ['spg-adjacent','spg',3,[1,2,4,5],[2,5]],
 ['destroyer-rear','tank_destroyer',2,[1,5],[5]],
 ['destroyer-adjacent','tank_destroyer',6,[1,2,4,5],[2]],
 ['rocket-one','rocket',3,[2],[1,2,3,4,5,6]],
 ['rocket-two','rocket',1,[1,5],[1,2,3,4,5,6]],
 ['rocket-full','rocket',6,[1,2,3,4,5,6],[1,2,3,4,5,6]],
];
const titles={
 'tank-full':'坦克 · 三列前排完整', 'tank-two':'坦克 · 中列全空（2发）',
 'tank-mixed':'坦克 · 中列前空后存（3发）', 'tank-front':'坦克 · 仅存前排（1发）',
 'tank-rear':'坦克 · 仅存后排（1发）', 'tank-column':'坦克 · 同列前后都有车（1发）',
 'tank-rear-all':'坦克 · 三列仅存后排（3发）',
};
const fixtures=[];
for(const side of [0,1])for(const [id,cls,slot,targets,expected]of cases){
 const a=troop([slot],cls),b=troop(targets);a[0].initiative=1000;a[0].accuracy=10000;a[0].crit=-10000;
 for(const st of b){st.hp=1000000;st.totalHp=20000000;st.attack=1;}
 const r=simulate(side?b:a,side?a:b,2266,'training');
 r.title=titles[id]??('武器试验场 · '+id);r.id=id+'-'+side;r.summary=battleSummary(r);
 r.qaTargets=expected;
 if(JSON.stringify(r.events.filter(e=>e.action===1).map(e=>e.to))!==JSON.stringify(expected))throw Error('Wrong targets: '+r.id);
 fixtures.push(r);
}
const a=troop([2],'rocket');a[0].attack=1000000;a[0].accuracy=10000;a[0].initiative=1000;
const kill=simulate(a,troop([2]),1,'training');kill.id='rocket-wipe';kill.title='火箭末轮 · 空阵位验证';kill.summary=battleSummary(kill);kill.qaTargets=[1,2,3,4,5,6];fixtures.push(kill);
writeFileSync(out+'combat-fixtures.json',JSON.stringify(fixtures));
const s=newGame('v22-isolated','规则修正验收',Date.now(),2222);
s.buildings.hq=s.buildings.factory=60;s.tech.materials=80;
s.wallet.crystal=1000000;s.wallet.gold=1000000;
for(const id of ['tank_t1','tank_t7','spg_t7','rocket_t7']){s.damaged[id]=7;s.createdUnits[id]+=7;}
assertState(s);exportSave(s).then(t=>writeFileSync(out+'repair-save.json',t));
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
copyFileSync(resolve(root, 'native/tests/legacy-combat-v014.json'), out + '/legacy-fixtures.json');
copyFileSync(
  resolve(root, 'native/tests/legacy-combat-v020.json'),
  out + '/legacy-tank-fixtures.json',
);
