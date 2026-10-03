// Reproducible core progression evidence; creates no player saves.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, 'artifacts/native-v15');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: `
import {newGame} from './src/core/engine';
import {army,simulate} from './src/core/battle';
import {dungeons} from './src/core/arsenal';
import {coreBudget} from './src/core/planning';
import {armyPower} from './src/core/power';
import {writeFileSync} from 'node:fs';
const benchmarks=dungeons.map(d=>{
 const s=newGame('core-benchmark','核心成长样本',1700000000000);
 s.buildings.hq=s.buildings.factory=20;s.industry={version:1,factory2:20,refit:20};
 s.arsenal.cleared=dungeons.slice(0,d.index).map(v=>v.id);
 s.tech.attack=s.tech.hp=10;s.tech.ballistics=s.tech.armorPlating=5;s.tech.march=5;
 s.commander.attackSkill=s.commander.initiativeSkill=s.commander.extraFireSkill=5;
 const tier=[5,6,7,7][d.band],count=[45,60,85,115][d.band];
 const formation=['tank','tank_destroyer','tank','spg','rocket','spg'].map(cls=>({unitId:cls+'_t'+tier,count}));
 const reports=Array.from({length:100},(_,i)=>simulate(army(formation,s.tech,s.commander.attackSkill,s.commander),army(d.formation),i+1));
 const budget=coreBudget(s,d.classId,7,100);
 return {stage:d.index+1,id:d.id,name:d.name,factoryLevel:d.factoryLevel,enemy:d.formation,enemyPower:armyPower(army(d.formation)),drops:d.drops,
 suppliedSample:{tier,count,science:s.tech,commander:s.commander,wins:reports.filter(r=>r.winner===0).length,meanLost:reports.reduce((n,r)=>n+r.casualties.reduce((a,b)=>a+b.lost,0),0)/100},
 hundredVII:{first:budget.drop.first,range:[budget.drop.min,budget.drop.max],meanRateEstimate:budget.victories,fastest:budget.victoriesMin,slowest:budget.victoriesMax,materials:budget.manufacture.cost,refitMaterials:budget.refit.cost,prototypes:100}};
});
const result={note:'Fixed seeds 1..100; supplied six-group mixed fleets, no resource-acquisition simulation. Win rates are samples, not guarantees. Challenge estimates exclude prerequisite battles and losses; mean-rate estimate is not an exact stopping-time expectation.',benchmarks};
writeFileSync(${JSON.stringify(out + '/logistics-analysis.json')},JSON.stringify(result,null,2));
console.log(JSON.stringify(benchmarks.map(r=>({stage:r.stage,name:r.name,power:r.enemyPower,tier:r.suppliedSample.tier,count:r.suppliedSample.count,wins:r.suppliedSample.wins,meanLost:r.suppliedSample.meanLost,budget:r.hundredVII})),null,2));`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out + '/logistics-analysis.cjs',
});
execFileSync(process.execPath, [out + '/logistics-analysis.cjs'], { stdio: 'inherit' });
