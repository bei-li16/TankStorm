// Synthetic formation/library fixture, never reads a player's save.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..'),
  out = resolve(root, 'artifacts/native-v29');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: String.raw`
import {newGame,assertState} from './src/core/engine';
import {exportSave} from './src/core/storage';
import {prestigeRequired} from './src/core/commander';
import {researchCost} from './src/core/content';
import {writeFileSync} from 'node:fs';
async function main(){
const s=newGame('library29','连续部署与机制验收',Date.now(),290);
for(const k of Object.keys(s.buildings))s.buildings[k]=25;
s.buildings.hq=60;s.buildings.factory=60;
s.industry={version:1,factory2:60,refit:60};
s.commander.prestige=prestigeRequired(80);s.commander.leadership=47;
s.commander.attackSkill=20;s.tech.attack=5;s.tech.hp=5;s.tech.materials=60;
s.wallet={iron:12000000,oil:9200000,lead:7800000,titanium:6700000,crystal:3200000,gold:1000};
for(const id in s.available){s.available[id]=0;s.createdUnits[id]=0;}
s.available.rocket_t6=s.createdUnits.rocket_t6=630;
s.available.tank_t7=s.createdUnits.tank_t7=200;
s.formation=Array(6).fill(null);
s.presets=[{name:'计划满编',formation:Array.from({length:6},()=>({unitId:'rocket_t6',count:250}))}];
assertState(s);
writeFileSync('artifacts/native-v29/ready-save.json',await exportSave(s));
writeFileSync('artifacts/native-v29/research-expected.json',JSON.stringify(researchCost(5)));
console.log('V29_FIXTURE_READY');
}main();`,
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
