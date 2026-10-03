// Deterministic, isolated native UI acceptance fixtures; never reads player saves.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, process.argv[2] || 'artifacts/native-v18');
mkdirSync(out, { recursive: true });
copyFileSync(root + '/artifacts/arsenal-journey-save.json', out + '/arsenal-journey-save.json');
await build({
  stdin: {
    contents: `
import { army, rng32, simulate as simulateBattle } from './src/core/battle';
import { newGame, assertState } from './src/core/engine';
import { unitList } from './src/core/content';
import { exportSave } from './src/core/storage';
import { writeFileSync } from 'node:fs';
import { battleSummary } from './src/core/overview';
const simulate=(...args)=>{const r=simulateBattle(...args);return {...r,summary:battleSummary(r)};};
const out = ${JSON.stringify(out)};
const a=army(['rocket_t2','tank_t3','tank_destroyer_t4','spg_t2','tank_t5','tank_t7'].map((unitId,i)=>({unitId,count:[20,25,18,12,16,10][i]})));
const b=army(['tank_t3','spg_t3','rocket_t3','tank_destroyer_t4','tank_t5','tank_t7'].map(unitId=>({unitId,count:30})));
const heavy=army(['tank_t7','tank_destroyer_t7','tank_t7','spg_t7','rocket_t7','spg_t7'].map(unitId=>({unitId,count:50})));
const full=simulate(heavy,structuredClone(heavy),2751,'stage');full.title='钢铁堡垒';full.id='v12-layout-qa';
writeFileSync(out+'/v12-battle.json',JSON.stringify(full));
for(const st of a)st.initiative=1000;
const report=simulate(a,b,174,'training');report.title='草原交锋';report.id='visual-qa-only';
writeFileSync(out+'/battle-report-v05.json',JSON.stringify(report,null,2));
const duel=(cls,count,enemyCount)=>{
 const r=simulate(army([{unitId:cls+'_t1',count}]),army([{unitId:'tank_t1',count:enemyCount}]),1);
 r.title='兵种声效与残骸验证';r.id='v07-qa-only';return r;
};
const audio=['tank','tank_destroyer','spg','rocket'].map(cls=>duel(cls,10,100));
const deaths=[duel('tank',20,1),duel('tank',1,20)];
const volleys=['tank','spg','rocket'].map(cls=>{
 const own=army([{unitId:cls+'_t1',count:10}]);
 const enemy=army(Array.from({length:6},()=>({unitId:'tank_t1',count:100})));
 const r=simulate(own,enemy,1);r.title='交替行动与逐发射击';return r;
});
let extra;
for(let seed=1;seed<=10000;seed++){
 const candidate=simulate(army([{unitId:'tank_t1',count:10}]),army([{unitId:'tank_t1',count:100}]),seed);
 if(candidate.actions[0].extraTriggered){extra=candidate;break;}
}
if(!extra)throw Error('Missing deterministic extra-fire fixture');
const historical=structuredClone(volleys[0]);
delete historical.tactics;delete historical.actions;
historical.ruleset='classic-combat-v0.9';
for(const e of historical.events){delete e.action;delete e.shot;delete e.shots;delete e.extra;}
writeFileSync(out+'/v10-fixtures.json',JSON.stringify({volleys,extra,historical},null,2));
writeFileSync(out+'/v07-fixtures.json',JSON.stringify({audio,deaths},null,2));
async function main() {
 const s=newGame('industry-qa','工业与维修',Date.now());
 s.buildings.hq=s.buildings.factory=20;
 s.industry={version:1,factory2:20,refit:20};
 s.vip={version:1,paidGold:0,lastDaily:-1};
 for(const key of Object.keys(s.wallet)) s.wallet[key]=1000000;
 for(const u of unitList) {s.available[u.unitId]+=1000;s.createdUnits[u.unitId]+=1000;}
 for(const u of unitList.filter(u=>u.tier<=3)) {
  s.damaged[u.unitId]=37;s.destroyedUnits[u.unitId]=2;s.createdUnits[u.unitId]+=39;
 }
 assertState(s);
 writeFileSync(out+'/industry-save.json',await exportSave(s));
 const capped=structuredClone(s);capped.id='industry-cap120';
 capped.buildings.hq=capped.buildings.factory=120;capped.industry.factory2=capped.industry.refit=120;
 assertState(capped);writeFileSync(out+'/industry-cap-save.json',await exportSave(capped));
 const depot=structuredClone(s);depot.id='depot-qa';depot.nickname='后勤总览验收';
 depot.buildings.factory=18;depot.industry.factory2=18;depot.industry.refit=18;
 for(const [i,id] of Object.keys(depot.arsenal.cores).entries())depot.arsenal.cores[id]=i%3===0?0:13+i;
 depot.commander.books=42;depot.commander.skillPoints=18;
 assertState(depot);writeFileSync(out+'/v11-save.json',await exportSave(depot));
 const win=simulate(army([{unitId:'tank_t7',count:50}]),army([{unitId:'tank_t1',count:2}]),1,'stage');
 win.id='qa-win';win.title='边境哨卡 · 首通';win.rewards={iron:250,oil:180,lead:160,titanium:20,crystal:40,gold:5};
 win.growth={xp:50,prestige:10,books:1,skillPoints:1};
 const lose=simulate(army([{unitId:'tank_t1',count:5}]),army([{unitId:'tank_t7',count:100}]),1,'stage');lose.title='防线失守';
 const core=structuredClone(win);core.title='装甲试验场 · 精英';core.mode='dungeon';core.rewards={};delete core.growth;core.coreRewards={tank_core6:3,tank_core7:10};
 const world=structuredClone(win);world.title='运输行动';world.mode='world';world.marchId='legacy-test';world.rewards={iron:250};delete world.growth;
 const legacy=structuredClone(world);delete legacy.marchId;legacy.ruleset='classic-combat-v0.9';
 writeFileSync(out+'/v11-reports.json',JSON.stringify({win,lose,core,world,legacy,training:volleys[0]}));
 const repair=structuredClone(depot);repair.id='repair-v13';repair.nickname='维修与战报验收';
 for(const id of Object.keys(repair.damaged)){repair.createdUnits[id]-=repair.damaged[id];repair.damaged[id]=0;}
 repair.damaged.tank_t1=7;repair.createdUnits.tank_t1+=7;
 repair.damaged.tank_destroyer_t1=6;repair.createdUnits.tank_destroyer_t1+=6;
 repair.reports=[core,world,lose,win].map((r,i)=>{const copy=structuredClone(r);delete copy.summary;copy.id='report-'+(i+1);copy.at=repair.now-i*60000;return copy;});
 repair.sequence=100;
 assertState(repair);writeFileSync(out+'/v13-save.json',await exportSave(repair));
 const modern=structuredClone(depot);modern.id='v14-qa';modern.nickname='章节与统率验收';
 modern.buildings.hq=modern.buildings.factory=20;modern.commander.leadership=10;
 modern.commander.prestige=16000;modern.commander.books=2000;modern.commander.skillPoints=60;
 modern.seed=1;modern.cleared=Array.from({length:12},(_,i)=>i);
 modern.formation=['tank_t7','tank_t7','tank_destroyer_t7','spg_t7','rocket_t7','spg_t7'].map(unitId=>({unitId,count:65}));
 assertState(modern);writeFileSync(out+'/v14-save.json',await exportSave(modern));
 const logistics=structuredClone(repair);logistics.id='v15-logistics';logistics.nickname='核心战线与后勤验收';
 logistics.buildings.hq=logistics.buildings.factory=20;logistics.industry={version:1,factory2:20,refit:20};
 logistics.commander.leadership=20;logistics.commander.prestige=16000;
 logistics.commander.attackSkill=5;logistics.commander.initiativeSkill=3;logistics.commander.extraFireSkill=4;
 logistics.tech.attack=10;logistics.tech.hp=7;logistics.tech.armorPlating=5;logistics.tech.march=6;logistics.tech.ballistics=8;
 logistics.damaged.tank_t7=2;logistics.createdUnits.tank_t7+=2;
 logistics.formation=modern.formation;logistics.seed=3719;
 assertState(logistics);writeFileSync(out+'/v15-save.json',await exportSave(logistics));
 const probability=structuredClone(modern);probability.id='v14-probability';probability.commander.leadership=119;probability.commander.prestige=566440;
 for(let seed=500;seed<2000;seed++){const next=rng32(seed);if(Array.from({length:300},()=>Math.floor(next()*10000/4294967296)).every(v=>v>=10)){probability.seed=seed;break;}}
 assertState(probability);writeFileSync(out+'/v14-probability-save.json',await exportSave(probability));
 const durable=n=>army(Array.from({length:n},()=>({unitId:'tank_destroyer_t1',count:100}))).map(st=>({...st,attack:1,hp:1000000,totalHp:100000000}));
 const asymmetric=simulate(durable(1),durable(6),917);asymmetric.id='v14-asymmetric';asymmetric.title='一组对六组 · 轮次验收';
 writeFileSync(out+'/v14-asymmetric.json',JSON.stringify(asymmetric));
 const q=newGame('queue-qa','长任务队列验收',Date.now());
 for(const b of Object.keys(q.buildings)) q.buildings[b]=b==='hq'?20:18;
 q.vip={version:1,paidGold:960,lastDaily:-1};
 q.tech.attack=q.tech.construction=q.tech.resourceOutput=19;
 q.buildings.lab=20;
 for(const r of Object.keys(q.wallet))q.wallet[r]=1000000000;
 assertState(q);writeFileSync(out+'/queue-save.json',await exportSave(q));
 const tree=newGame('tree-qa','技术发展验收',Date.now());
 tree.buildings.hq=tree.buildings.lab=12;
 tree.tech.construction=5;tree.tech.production=3;tree.tech.resourceOutput=5;
 tree.tech.ironOutput=3;tree.tech.oilOutput=3;tree.tech.leadOutput=2;
 tree.tech.attack=5;tree.tech.hp=3;tree.tech.gather=5;tree.tech.march=2;
 tree.vip={version:1,paidGold:40,lastDaily:-1};
 for(const r of Object.keys(tree.wallet))tree.wallet[r]=100000;
 assertState(tree);writeFileSync(out+'/tree-save.json',await exportSave(tree));
}
main().catch(e=>{console.error(e);process.exitCode=1;});`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out + '/make-fixtures.cjs',
});
execFileSync(process.execPath, [out + '/make-fixtures.cjs'], { stdio: 'inherit' });
console.log('Native QA fixtures: ' + out);
