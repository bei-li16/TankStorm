import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..'),
  out = resolve(root, 'artifacts/native-v18');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: String.raw`
import {newGame,rate,capacity,assertState} from './src/core/engine';
import {upgradeCost,researchCost} from './src/core/content';
import {researchTree,materialCost} from './src/core/research';
import {buildingDuration,researchDuration} from './src/core/vip';
import {productionQuote} from './src/core/arsenal';
import {exportSave} from './src/core/storage';
import {writeFileSync} from 'node:fs';
const levels=[20,40,60,80,100,120];
function state(level,tech=0) {const s=newGame('growth','120级成长验收',Date.now(),17017); for(const b of Object.keys(s.buildings))s.buildings[b]=level; for(const t of researchTree)s.tech[t.id]=tech;s.industry={version:1,factory2:level,refit:level};return s;}
const rows=levels.map(level=>{const s=state(level,level);const from=Math.min(level,119);const base=state(from);const upgrade=state(from,from);
return {level,ironPerHour:rate(s,'iron'),warehouse:capacity(s),upgradeFrom:from,hqCost:materialCost(upgrade,upgradeCost('hq',from)),hqHours:buildingDuration(upgrade,'hq')/3600000,rawIron:rate(state(level),'iron'),rawStorage:capacity(state(level)),rawHqCost:upgradeCost('hq',from),rawHqHours:buildingDuration(base,'hq')/3600000,
researchHours:researchDuration({...s,tech:{...s.tech,attack:from}},'attack')/3600000,productionSeconds:productionQuote(s,'tank_t7').duration/1000};});
writeFileSync('artifacts/native-v18/growth-budget.json',JSON.stringify(rows,null,2));
const s=state(119,119);
s.commander.xp=50*119**2;s.commander.skillPoints=50;s.commander.attackSkill=s.commander.initiativeSkill=s.commander.extraFireSkill=119;
s.wallet={iron:12345678901,oil:1000000000000,lead:987654321,titanium:7654321,crystal:1234567,gold:999999};
for(const stock of [s.available,s.createdUnits])stock.tank_t7=1000;
s.arsenal.cores.tank_core7=10;s.arsenal.cores.tank_core6=20;
assertState(s);
exportSave(s).then(text=>writeFileSync('artifacts/native-v18/v17-save.json',text));
console.log(JSON.stringify(rows));
`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out + '/audit.cjs',
});
execFileSync(process.execPath, [out + '/audit.cjs'], { cwd: root, stdio: 'inherit' });
