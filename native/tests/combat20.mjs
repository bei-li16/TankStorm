// Deterministic rule snapshots and isolated native QA; never reads player saves.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..'),
  out = resolve(root, 'artifacts/native-v20');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: String.raw`
import {army,simulate,survivors} from './src/core/battle';
import {newGame,assertState,rate} from './src/core/engine';
import {unitList} from './src/core/content';
import {productionQuote} from './src/core/arsenal';
import {battleSummary} from './src/core/overview';
import {exportSave} from './src/core/storage';
import {researchTree} from './src/core/research';
import {configureSite,guardArmy} from './src/core/world';
import {marchQuote,expeditionLoad} from './src/core/vip';
import {writeFileSync} from 'node:fs';
const out='artifacts/native-v20/';
const worldBudgets=[];
for(const level of [1,6,12,20,40,60,80,100,120]){
 const st=newGame('world-budget','维修后采集预算',1791000000000,190019),tech=Math.floor(level/2);
 for(const k of Object.keys(st.buildings))st.buildings[k]=level;
 for(const t of researchTree)st.tech[t.id]=tech;
 st.industry={version:1,factory2:level,refit:level};
 st.commander.leadership=1+Math.floor((level-1)/2);st.commander.prestige=40*(st.commander.leadership-1)**2;
 st.commander.attackSkill=st.commander.initiativeSkill=st.commander.extraFireSkill=Math.floor(level/6);
 const cap=20+(st.commander.leadership-1)*5,tier=unitList.filter(u=>u.classId==='tank'&&u.unlock.factoryLevel<=level).at(-1).tier;
 const f=['tank','tank_destroyer','tank','spg','rocket','spg'].map(cls=>({unitId:cls+'_t'+tier,count:cap}));
 const site={...st.world.find(v=>v.kind==='mine'&&v.resource==='iron'),id:'audit-guarded',x:28,y:27};configureSite(site,level,st.now);
 const m=marchQuote(st,site,f),local=rate(st,'iron'),samples=[];
 for(let i=0;i<32;i++){
  const b=simulate(army(f,st.tech,st.commander.attackSkill,st.commander),guardArmy(site),19000+i,'world');
  const cost={};for(const c of b.casualties)for(const kind of ['repair','produce'])for(const [k,n]of Object.entries(productionQuote(st,c.unitId,kind).unitCost))cost[k]=(cost[k]??0)+n*(kind==='repair'?c.repairable:c.destroyed);
  const loot=b.winner===0?Math.min(expeditionLoad(st,survivors(b.final[0])),site.reserve):0;
  const funding=Math.max(0,...Object.entries(cost).map(([r,n])=>n/Math.max(1,rate(st,r))));
  const elapsed=loot/m.gatherRate+2*m.outboundMs/3600000;
  samples.push({win:b.winner===0,crystal:cost.crystal??0,netMultiple:(loot/local-funding)/elapsed});
 }
 worldBudgets.push({level,tech,trials:32,wins:samples.filter(v=>v.win).length,averageRepairCrystal:samples.reduce((n,v)=>n+v.crystal,0)/32,netMultiple:samples.reduce((n,v)=>n+v.netMultiple,0)/32});
}
writeFileSync(out+'world-combat-budgets.json',JSON.stringify(worldBudgets,null,2));
const troop=(slots,cls='tank')=>army(Array.from({length:6},(_,i)=>slots.includes(i+1)?{unitId:cls+'_t7',count:20}:null));
const cases=[['tank-two','tank',2,[1,3,5]],['tank-rear','tank',5,[5]],['spg-one','spg',2,[1,5]],['spg-two','spg',5,[2,5]],['spg-adjacent','spg',3,[1,2,4,5]],['destroyer-rear','tank_destroyer',2,[1,5]],['destroyer-adjacent','tank_destroyer',6,[1,2,4,5]],['rocket-one','rocket',3,[2]],['rocket-two','rocket',1,[1,5]],['rocket-full','rocket',6,[1,2,3,4,5,6]]];
const fixtures=[];
for(const side of [0,1])for(const [id,cls,slot,targets]of cases){
 const a=troop([slot],cls),b=troop(targets);a[0].initiative=1000;a[0].accuracy=10000;a[0].crit=-10000;
 for(const st of b){st.hp=1000000;st.totalHp=20000000;st.attack=1;}
 const r=simulate(side?b:a,side?a:b,2060,'training');r.title='武器试验场 · '+id;r.id=id+'-'+side;r.summary=battleSummary(r);
 fixtures.push(r);
}
const a=troop([2],'rocket');a[0].attack=1000000;a[0].accuracy=10000;a[0].initiative=1000;
const kill=simulate(a,troop([2]),1,'training');kill.id='rocket-wipe';kill.title='火箭末轮 · 空阵位验证';kill.summary=battleSummary(kill);fixtures.push(kill);
writeFileSync(out+'combat-fixtures.json',JSON.stringify(fixtures));
const s=newGame('v20-repair','维修与弹坑验收',Date.now(),2020);
s.buildings.hq=s.buildings.factory=s.buildings.warehouse=20;s.buildings.crystal=1;s.tech.materials=80;
s.wallet.crystal=1000000;s.wallet.gold=1000000;
for(const id of ['tank_t1','tank_t7','spg_t7','rocket_t7']){s.damaged[id]=7;s.createdUnits[id]+=7;}
assertState(s);exportSave(s).then(t=>writeFileSync(out+'repair-save.json',t));
writeFileSync(out+'repair-budgets.json',JSON.stringify(unitList.map(u=>{
 const t=newGame('budget','budget',s.now);t.buildings.crystal=u.unlock.factoryLevel;
 return {id:u.unitId,baseCrystal:u.repairCost.crystal,previousCrystal:Math.ceil(u.cost.iron/30),maxTechCrystal:Math.ceil(u.repairCost.crystal*.4),crystalMineLevel:t.buildings.crystal,batch100FundingHours:u.repairCost.crystal*100/rate(t,'crystal')};
}),null,2));
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
// Use an actual previous-version snapshot when available, never relabel new damage as old.
const legacy = resolve(root, 'native/tests/legacy-combat-v014.json');
copyFileSync(legacy, out + '/legacy-fixtures.json');
