// Reproducible budgets and seeded combat samples; never accesses player saves.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..'),
  out = resolve(root, 'artifacts/native-v19');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: String.raw`
import {newGame,rate,capacity,scaleCost,assertState,facilityUpgradeQuote,execute} from './src/core/engine';
import {productionQuote} from './src/core/arsenal';
import {unitList,upgradeCost,researchCost,units,buildingNames} from './src/core/content';
import {researchTree,materialCost} from './src/core/research';
import {marchQuote,buildingDuration,researchDuration,expeditionLoad,effectiveTime} from './src/core/vip';
import {configureSite,guardArmy,mineCapacity,guardTemplate} from './src/core/world';
import {army,simulate,survivors} from './src/core/battle';
import {resources} from './src/core/types';
import {exportSave} from './src/core/storage';
import {writeFileSync} from 'node:fs';
const hours=(s,cost)=>Math.max(...resources.map(r=>(cost[r]??0)/Math.max(1,rate(s,r))));
function state(level,tech){const s=newGame('v19-budget','经济与野外验收',Date.now(),190019);for(const b of Object.keys(s.buildings))s.buildings[b]=level;for(const t of researchTree)s.tech[t.id]=tech;s.industry={version:1,factory2:level,refit:level};s.commander.leadership=1+Math.floor((level-1)/2);s.commander.prestige=40*(s.commander.leadership-1)**2;s.commander.attackSkill=s.commander.initiativeSkill=s.commander.extraFireSkill=Math.floor(level/6);return s;}
const rows=[];
for(const level of [1,6,12,20,40,60,80,100,120])for(const tech of [...new Set([0,Math.floor(level/2),level])]){
 const s=state(level,tech),cap=20+(s.commander.leadership-1)*5,tier=unitList.filter(u=>u.classId==='tank'&&u.unlock.factoryLevel<=level).at(-1).tier;
 const q=productionQuote(s,'tank_t'+tier),manufacture=scaleCost(q.unitCost,100),r=productionQuote(s,'tank_t'+tier,'repair');
 const f=['tank','tank_destroyer','tank','spg','rocket','spg'].map(c=>({unitId:c+'_t'+tier,count:cap}));
 const site={...s.world.find(v=>v.kind==='mine'&&v.resource==='iron'),id:'audit-guarded',x:28,y:27};configureSite(site,level,s.now);
 const m=marchQuote(s,site,f),local=rate(s,'iron');
 const trials=Array.from({length:32},(_,i)=>simulate(army(f,s.tech,s.commander.attackSkill,s.commander),guardArmy(site),19000+i,'world'));
 const wins=trials.filter(b=>b.winner===0),net=wins.map(b=>{const loot=Math.min(expeditionLoad(s,survivors(b.final[0])),site.reserve),cost={};for(const c of b.casualties){for(const kind of ['repair','produce']){const q=productionQuote(s,c.unitId,kind);for(const [key,n]of Object.entries(q.unitCost))cost[key]=(cost[key]??0)+n*(kind==='repair'?c.repairable:c.destroyed);}}const elapsed=loot/m.gatherRate+2*m.outboundMs/3600000;return {loss:b.casualties.reduce((n,c)=>n+c.lost,0),returnAmount:loot,netMultiple:(loot/local-hours(s,cost))/elapsed};});
 const from=Math.min(119,level),building={...s,buildings:{...s.buildings,hq:from}},research={...s,tech:{...s.tech,attack:from}};
 rows.push({level,tech,tier,stack:cap,rates:Object.fromEntries(resources.map(r=>[r,rate(s,r)])),warehouse:capacity(s),storageHours:capacity(s)/local,manufacture100:manufacture,funding100Minutes:hours(s,manufacture)*60,production100Minutes:q.duration*100/60000,twoFactoriesHourlyIron:q.unitCost.iron*7200000/q.duration,repair100Minutes:hours(s,scaleCost(r.unitCost,100))*60,hqFundingMinutes:hours(s,materialCost(s,upgradeCost('hq',from)))*60,hqBuildHours:buildingDuration(building,'hq')/3600000,researchFundingMinutes:hours(s,researchCost(from))*60,researchHours:researchDuration(research,'attack')/3600000,mine:{level,rate:m.gatherRate,reserve:mineCapacity(site),load:m.load,amount:m.amount,totalMinutes:m.totalMs/60000,grossMultiple:m.amount/(local*m.totalMs/3600000),wins:wins.length,trials:trials.length,avgLoss:net.reduce((n,v)=>n+v.loss,0)/Math.max(1,net.length),netMultiple:net.reduce((n,v)=>n+v.netMultiple,0)/Math.max(1,net.length)}});
}
writeFileSync('artifacts/native-v19/economy.json',JSON.stringify(rows,null,2));
const expenses=[1,6,12,20,40,60,80,100,120].map(level=>{
 const s=state(level,Math.floor(level/2)),from=Math.min(119,level);
 const quote=cost=>({cost,localFundingMinutes:hours(s,cost)*60});
 return {level,buildings:Object.fromEntries(Object.keys(buildingNames).map(id=>[id,quote(materialCost(s,upgradeCost(id,from)))])),facilities:Object.fromEntries(['factory2','refit'].map(id=>[id,quote(facilityUpgradeQuote({...s,industry:{...s.industry,[id]:from}},id).unitCost)])),research:quote(researchCost(from)),vehicles:unitList.map(u=>({id:u.unitId,unlocked:u.unlock.factoryLevel<=level,corePerVehicle:u.tier>=6?1:0,...Object.fromEntries(['produce','refit','repair'].filter(mode=>mode!=='refit'||u.tier>1).map(mode=>{const q=productionQuote(s,u.unitId,mode);return[mode,{...quote(scaleCost(q.unitCost,100)),batch100Minutes:q.duration*100/60000,sourceUnitId:q.sourceUnitId??''}];}))}))};
});
writeFileSync('artifacts/native-v19/expense-ledger.json',JSON.stringify(expenses,null,2));
console.log(rows.filter(r=>r.tech===Math.floor(r.level/2)).map(r=>({L:r.level,tech:r.tech,iron:r.rates.iron,storeHours:r.storageHours.toFixed(1),fund100:r.funding100Minutes.toFixed(1),twoFactories:r.twoFactoriesHourlyIron.toFixed(0),hqFunding:r.hqFundingMinutes.toFixed(1),researchFunding:r.researchFundingMinutes.toFixed(1),mine:r.mine})));
const pacing=[];
for(const level of [1,6,12,20,40,60,80,100,110,119])for(const speed of [0,Math.floor(level/2),120])for(const paidGold of [0,1000000]){
 const s=state(level,speed);s.vip={version:1,paidGold,lastDaily:-1};
 pacing.push({level,targetLevel:level+1,speed,vip:paidGold?10:0,buildHours:Object.fromEntries(Object.keys(buildingNames).map(b=>[b,effectiveTime(s,buildingDuration(s,b))/3600000])),researchHours:Object.fromEntries(researchTree.map(t=>{const v=structuredClone(s);v.tech[t.id]=Math.min(119,level);return[t.id,effectiveTime(v,researchDuration(v,t.id))/3600000];})),manufacture100Hours:Object.fromEntries(unitList.map(u=>[u.unitId,effectiveTime(s,productionQuote(s,u.unitId).duration*100)/3600000]))});
}
writeFileSync('artifacts/native-v19/pacing-matrix.json',JSON.stringify(pacing,null,2));
const s=state(119,119);s.tech.attack=s.tech.ballistics=118;s.commander.xp=50*119**2;s.vip={version:1,paidGold:1000000,lastDaily:-1};
s.buildings.factory=s.industry.factory2=s.industry.refit=118;
const cap=capacity(s);resources.forEach((r,i)=>s.wallet[r]=Math.floor(cap*[0.25,0.5,0.9,1,1.2][i]));s.wallet.gold=1000000;
for(const u of unitList){s.available[u.unitId]=2000;s.createdUnits[u.unitId]=2000;s.arsenal.cores[u.classId+'_core6']=500;s.arsenal.cores[u.classId+'_core7']=500;}
s.damaged.tank_t7=12;s.createdUnits.tank_t7+=12;
s.formation=['tank','tank_destroyer','tank','spg','rocket','spg'].map(c=>({unitId:c+'_t7',count:315}));assertState(s);
exportSave(s).then(text=>writeFileSync('artifacts/native-v19/v19-save.json',text));
let old=state(20,0);for(const r of Object.keys(old.wallet))old.wallet[r]=1000000;
for(const facility of ['factory','factory2']){
 old=execute(old,{type:'produce',facility,unitId:'tank_t1',count:100},old.now,'legacy-'+facility).state;
 const j=old.jobs[facility==='factory'?'production':'production:factory2'];
 j.total=1000;j.duration=5000;j.startedAt=old.now;j.dueAt=old.now+5000;j.unitCost={iron:20,oil:10,lead:5};
}
assertState(old);exportSave(old).then(text=>writeFileSync('artifacts/native-v19/v19-legacy-save.json',text));
`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out + '/economy-audit.cjs',
});
execFileSync(process.execPath, [out + '/economy-audit.cjs'], { cwd: root, stdio: 'inherit' });
