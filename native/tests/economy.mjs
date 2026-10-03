// Reproducible v0.9 economy audit. All generated outputs are local artifacts.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
mkdirSync(root + '/artifacts', { recursive: true });
await build({
  stdin: {
    contents: String.raw`
import { newGame, rate, capacity } from './src/core/engine';
import { unitList, upgradeCost, researchCost } from './src/core/content';
import { buildingDuration, researchDuration, marchQuote } from './src/core/vip';
import { resources } from './src/core/types';
import { writeFileSync } from 'node:fs';
const snapshot=level=>{const s=newGame('audit','经济审计',1760000000000);for(const k of Object.keys(s.buildings))s.buildings[k]=level;return s;};
const funding=(s,cost,count=1)=>Math.max(...resources.map(r=>(cost[r]??0)*count/Math.max(1,rate(s,r))*60));
const units=unitList.map(u=>{const s=snapshot(u.unlock.factoryLevel);return {name:u.name,id:u.unitId,level:u.unlock.factoryLevel,fundingMinutes:funding(s,u.cost,100),productionMinutes:u.productionSeconds*100/60,repairFundingMinutes:funding(s,u.repairCost,100),repairMinutes:u.repairSeconds*100/60,capacity:capacity(s)};});
const levels=[1,6,12,16,20].map(level=>{const s=snapshot(level);return {level,hourly:Object.fromEntries(resources.map(r=>[r,rate(s,r)])),storage:capacity(s),hqFundingMinutes:funding(s,upgradeCost('hq',level)),hqBuildMinutes:buildingDuration(s,'hq')/60000,researchFundingMinutes:funding(s,researchCost(level-1)),researchMinutes:researchDuration({...s,tech:{...s.tech,attack:level-1}},'attack')/60000,mine:marchQuote(s,s.world[0],s.formation)};});
const lines=['TankStorm v0.9 经济审计（VIP0、无科技）','同阶段：指挥中心、资源建筑、仓库与战车解锁工厂同级。筹料从零库存开始，五资源并行自产；不计战役/采矿奖励，不含核心掉落。','单位：分钟；每批100辆。资金曲线审核上限为筹料不超过2.5个原始生产周期。','名称 | 解锁等级 | 筹料 | 生产 | 修理筹料 | 修理 | 仓储'];
for(const u of units)lines.push([u.name,u.level,u.fundingMinutes.toFixed(2),u.productionMinutes.toFixed(2),u.repairFundingMinutes.toFixed(2),u.repairMinutes.toFixed(2),u.capacity].join(' | '));
lines.push('','基地等级 | 铁/油/铅/钛/晶每小时 | 仓储 | 下一HQ筹料/施工 | 本级科研筹料/研究');
for(const l of levels)lines.push([l.level,Object.values(l.hourly).join('/'),l.storage,l.level===20?'满级':l.hqFundingMinutes.toFixed(2)+'/'+l.hqBuildMinutes.toFixed(2),l.researchFundingMinutes.toFixed(2)+'/'+l.researchMinutes.toFixed(2)].join(' | '));
lines.push('','结论边界：常规单线发展可自给；同时满速运行多座工厂、持续高VIP提速需要升级资源建筑、经济科技或采矿。核心仍需副本，金币不由资源建筑产出。');
writeFileSync('artifacts/economy-v09.json',JSON.stringify({units,levels},null,2));writeFileSync('artifacts/economy-v09.txt',lines.join('\n')+'\n');
`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: root + '/artifacts/economy-audit.cjs',
});
execFileSync(process.execPath, [root + '/artifacts/economy-audit.cjs'], {
  cwd: root,
  stdio: 'inherit',
});
console.log('Economy audit: artifacts/economy-v09.txt and .json');
