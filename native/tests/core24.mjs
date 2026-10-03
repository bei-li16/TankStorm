// Deterministic balance evidence and isolated native QA fixtures; never read player saves.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, 'artifacts/native-v24');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: String.raw`
import {newGame,assertState,rate} from './src/core/engine';
import {exportSave} from './src/core/storage';
import {researchTree} from './src/core/research';
import {dungeons,dungeonArmy,coreChapters} from './src/core/arsenal';
import {army,simulate} from './src/core/battle';
import {armyPower} from './src/core/power';
import {unitList,units} from './src/core/content';
import {writeFileSync} from 'node:fs';
async function main(){
 const probes=[];
 const classes=['tank','tank_destroyer','spg','rocket'];
 const counters={tank:'tank_destroyer',tank_destroyer:'spg',spg:'rocket',rocket:'tank'};
 for(const d of dungeons){
  const b=d.band,lead=[20,25,35,45,55][b],count=20+(lead-1)*5,tier=Math.min(7,5+b);
  const level=[20,40,60,85,110][b],skill=[10,15,20,25,30][b];
  const tech={attack:level,hp:level,ballistics:level,armorPlating:level,march:level};
  const samples=[];
  for(const strategy of ['mixed','counter']){
   const formation=Array.from({length:6},(_,i)=>({unitId:(strategy==='counter'?counters[d.classId]:['tank','tank_destroyer','tank','spg','rocket','spg'][i])+'_t'+tier,count}));
   const a=army(formation,tech,skill,{initiativeSkill:skill,extraFireSkill:skill});
   let wins=0,lost=0,dead=0,crystal=0,coreLoss=0;
   for(let seed=1;seed<=100;seed++){
    const r=simulate(a,dungeonArmy(d),seed*7919,'dungeon');
    wins+=r.winner===0?1:0;
    for(const c of r.casualties){lost+=c.lost;dead+=c.destroyed;crystal+=c.repairable*(units[c.unitId].repairCost.crystal??0);coreLoss+=units[c.unitId].tier>=6?c.destroyed:0;}
   }
   samples.push({strategy,power:armyPower(a),wins,lost:lost/100,permanent:dead/100,repairCrystal:crystal/100,coreLoss:coreLoss/100});
  }
  const economy=newGame('benchmark','曲线',1700000000000);economy.buildings.crystal=d.factoryLevel;economy.tech.crystalOutput=Math.floor(d.factoryLevel/2);
  probes.push({id:d.id,chapter:b+1,number:d.number,family:d.classId,gate:d.factoryLevel,enemyTech:d.guardTech,enemyPower:armyPower(dungeonArmy(d)),enemies:d.formation,leadership:lead,tech:level,skill,tier,cap:count,drops:d.drops,growth:d.growth,baseCrystalPerHour:rate(economy,'crystal'),samples});
 }
 writeFileSync('artifacts/native-v24/balance.json',JSON.stringify(probes,null,2));
 for(let b=0;b<5;b++){
  const rows=probes.filter(v=>v.chapter===b+1);
  console.log(coreChapters[b],JSON.stringify({power:[rows[0].enemyPower,rows.at(-1).enemyPower],mixedMinWins:Math.min(...rows.map(r=>r.samples[0].wins)),counterMinWins:Math.min(...rows.map(r=>r.samples[1].wins)),maxMixedLoss:Math.max(...rows.map(r=>r.samples[0].lost)),maxCounterLoss:Math.max(...rows.map(r=>r.samples[1].lost)),last:rows.slice(-4).map(r=>({family:r.family,drop:r.drops,samples:r.samples}))}));
 }
 const s=newGame('core24-qa','核心战线验收',Date.now());
 for(const k of Object.keys(s.buildings))s.buildings[k]=120;
 for(const node of researchTree)s.tech[node.id]=120;
 s.industry={version:1,factory2:120,refit:120};
 s.commander.leadership=120;s.commander.prestige=566440;
 s.commander.attackSkill=120;s.commander.initiativeSkill=120;s.commander.extraFireSkill=120;
 for(const r of Object.keys(s.wallet))s.wallet[r]=1e11;
 for(const u of unitList){s.available[u.unitId]+=5000;s.createdUnits[u.unitId]+=5000;}
 s.formation=Array.from({length:6},(_,i)=>({unitId:['tank','tank_destroyer','tank','spg','rocket','spg'][i]+'_t7',count:615}));
 s.arsenal.cleared=dungeons.slice(0,63).map(d=>d.id);
 assertState(s);writeFileSync('artifacts/native-v24/ready-save.json',await exportSave(s));
 const old=structuredClone(s);old.id='core24-legacy';old.arsenal.cleared=Array.from({length:16},(_,i)=>'core-'+i);old.buildings.factory=20;old.industry.factory2=20;
 assertState(old);writeFileSync('artifacts/native-v24/legacy-save.json',await exportSave(old));
}
main();
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
