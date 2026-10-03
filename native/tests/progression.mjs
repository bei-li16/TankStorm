// Deterministic design evidence. Never loads or writes player save files.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, 'artifacts/native-v14');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: `
import {newGame} from './src/core/engine';
import {army,simulate} from './src/core/battle';
import {chapters,stageFormation,stageGrowth,stageReward} from './src/core/content';
import {tierPower,armyPower} from './src/core/power';
import {leadershipChance,prestigeRequired} from './src/core/commander';
import {writeFileSync} from 'node:fs';
const stages=Array.from({length:112},(_,stage)=>{
 const f=stageFormation(stage),a=army(f);
 return {stage:stage+1,chapter:Math.floor(stage/16)+1,formation:f,power:armyPower(a),reward:stageReward(stage,false),growth:stageGrowth(stage,false)};
});
const benchmark=chapters.map((chapter,c)=>{
 const counts=[20,45,70,100,125,150,175];
 const formation=['tank','tank_destroyer','tank','spg','rocket','spg'].map(cls=>({unitId:cls+'_t'+(c+1),count:counts[c]}));
 const s=newGame('benchmark','平衡样本',1700000000000);
 s.tech.attack=s.tech.hp=s.tech.armorPlating=s.tech.ballistics=Math.min(20,c*3);
 s.tech.march=Math.min(20,c*2);
 s.commander.attackSkill=s.commander.initiativeSkill=s.commander.extraFireSkill=Math.min(20,c*2);
 const initial=army(formation,s.tech,s.commander.attackSkill,s.commander);
 const simulateStage=(stage,own=initial)=>{
  const reports=Array.from({length:100},(_,i)=>simulate(own,army(stageFormation(stage)),i+1));
  return {stage:stage+1,wins:reports.filter(r=>r.winner===0).length,meanLost:reports.reduce((n,r)=>n+r.casualties.reduce((x,v)=>x+v.lost,0),0)/100,maxRounds:Math.max(...reports.map(r=>r.rounds))};
 };
 const preparedCount=[35,65,80,100,125,150,175][c],preparedTier=Math.max(2,c+1);
 const preparedScience={...s.tech,attack:Math.max(3,s.tech.attack),hp:Math.max(3,s.tech.hp),armorPlating:Math.max(3,s.tech.armorPlating),ballistics:Math.max(3,s.tech.ballistics)};
 const prepared=army(formation.map(st=>({unitId:st.unitId.slice(0,-1)+preparedTier,count:preparedCount})),preparedScience,s.commander.attackSkill,s.commander);
 return {...chapter,countPerGroup:counts[c],leadershipRequired:1+Math.ceil((counts[c]-20)/5),power:armyPower(initial),science:s.tech,commander:s.commander,entry:simulateStage(c*16),final:simulateStage(c*16+15),preparedFinal:{tier:preparedTier,count:preparedCount,science:preparedScience,...simulateStage(c*16+15,prepared)}};
});
const probability=Array.from({length:119},(_,i)=>{
 const target=i+2,p=leadershipChance(target)/10000;
 return {target,chance:p,meanAttempts:1/p,meanGold:19/p,fail100:(1-p)**100,fail200:(1-p)**200,prestigeRequired:prestigeRequired(target)};
});
const result={assumptions:'Fixed 100 seeds 1..100 per chapter endpoint; fully supplied mixed six-group same-tier fleet, chapter-index science and commander values shown in each row. Prepared final scenarios explicitly increase troops, research or tier. Statistical samples, not a victory guarantee. Fixture provisioning is not a resource acquisition simulation.',tierPower,stages,benchmark,probability,totalMeanBooks:probability.reduce((n,r)=>n+r.meanAttempts,0),totalMeanGold:probability.reduce((n,r)=>n+r.meanGold,0)};
writeFileSync(${JSON.stringify(out + '/progression-analysis.json')},JSON.stringify(result,null,2));
console.log(JSON.stringify({tierPower,benchmark:benchmark.map(r=>({chapter:r.name,groups:r.countPerGroup,leadership:r.leadershipRequired,entryWins:r.entry.wins,finalWins:r.final.wins,finalMeanLost:r.final.meanLost,preparedFinal:r.preparedFinal})),totalMeanBooks:result.totalMeanBooks,totalMeanGold:result.totalMeanGold,probability:probability.filter(r=>[10,11,20,40,60,80,100,120].includes(r.target))},null,2));`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out + '/progression-analysis.cjs',
});
execFileSync(process.execPath, [out + '/progression-analysis.cjs'], { stdio: 'inherit' });
