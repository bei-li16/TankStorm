import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..'),
  out = resolve(root, 'artifacts/native-v39');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: String.raw`
import {newGame,assertState,execute} from './src/core/engine';
import {exportSave} from './src/core/storage';
import {prestigeRequired} from './src/core/commander';
import {writeFileSync} from 'node:fs';
async function main(){
const s=newGame('defense39','战斗科研与持续成长验收',Date.now(),35);
for(const key of Object.keys(s.buildings))s.buildings[key]=120;
s.industry={version:1,factory2:120,refit:120};
for(const key of Object.keys(s.tech))s.tech[key]=30;
s.vip={version:1,paidGold:500000,lastDaily:-1};
s.commander.leadership=192;s.commander.prestige=prestigeRequired(193);
s.commander.attackSkill=s.commander.initiativeSkill=s.commander.extraFireSkill=120;
s.commander.skillPoints=3;
for(const key of Object.keys(s.wallet))s.wallet[key]=1000000000;
s.available.tank_t7=s.createdUnits.tank_t7=20000;
s.formation=Array.from({length:6},()=>({unitId:'tank_t7',count:1000}));
assertState(s);
writeFileSync('artifacts/native-v39/ready-save.json',await exportSave(s));
const large=structuredClone(s);
large.commander.leadership=2500;large.commander.prestige=prestigeRequired(2501);
large.available.tank_t7=large.createdUnits.tank_t7=2000000;
writeFileSync('artifacts/native-v39/large-save.json',await exportSave(large));
const legacy=structuredClone(s);
for(const id of ['accuracy','evasion','critical','criticalDamage','armorResistance','defense'])legacy.tech[id]=0;
const old=execute(legacy,{type:'battle',stage:0,training:true},s.now,'old-report').state;
old.researchVersion=1;
for(const id of ['accuracy','evasion','critical','criticalDamage','armorResistance','defense'])delete old.tech[id];
const r=old.reports[0];r.ruleset='classic-combat-v0.31';
for(const st of [...r.initial.flat(),...r.final.flat()]){delete st.critMultiplierBps;delete st.defense;delete st.baseDefense;delete st.damageReduction;}
writeFileSync('artifacts/native-v39/legacy-save.json',await exportSave(old));
console.log('V39_FIXTURE_READY');
}main();`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out + '/fixtures.cjs',
});
execFileSync(process.execPath, [out + '/fixtures.cjs'], { cwd: root, stdio: 'inherit' });
