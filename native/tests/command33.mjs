import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..'),
  out = resolve(root, 'artifacts/native-v33');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: String.raw`
import {newGame,execute,assertState} from './src/core/engine';
import {exportSave,parseSave} from './src/core/storage';
import {prestigeRequired} from './src/core/commander';
import {configureSite,mineCapacity} from './src/core/world';
import {rng32} from './src/core/battle';
import {writeFileSync} from 'node:fs';
async function main(){
let s=newGame('command33','统率与补给验收',Date.now(),33), seq=0;
const act=c=>{s=execute(s,c,s.now,'fixture'+ ++seq).state;};
for(const key of Object.keys(s.buildings))s.buildings[key]=120;
s.industry={version:1,factory2:120,refit:120};
s.commander.prestige=prestigeRequired(120);s.commander.books=10000;
s.wallet.gold=100000;act({type:'leadership'});delete s.leadershipHistory;
s=await parseSave(await exportSave(s));
for(let i=0;i<7;i++)act({type:'leadership',attempts:10,payment:i%2?'gold':'books'});
s.commander.leadership=119;
for(let seed=500;seed<3000;seed++){
const random=rng32(seed);
if(Array.from({length:400},()=>Math.floor(random()*10000/4294967296)).every(v=>v>=10)){s.seed=seed;break;}
}
act({type:'leadership',attempts:100});
s.available.tank_t7=s.createdUnits.tank_t7=10000;
s.formation=Array.from({length:6},()=>({unitId:'tank_t7',count:390}));
s.tech.cargo=75;s.tech.gather=120;
Object.assign(s.tech,{attack:120,hp:120,ballistics:120,armorPlating:120,march:120});
const site=s.world.find(v=>v.kind==='mine'&&v.resource==='titanium'&&v.level===75);
configureSite(site,75,s.now);
const old={...site};delete old.reserveVersion;
assertState(s);
writeFileSync('artifacts/native-v33/ready-save.json',await exportSave(s));
writeFileSync('artifacts/native-v33/balance.json',JSON.stringify({site:site.id,level:75,old:mineCapacity(old),current:mineCapacity(site)},null,2));
console.log('V33_FIXTURE_READY',site.id,mineCapacity(old),mineCapacity(site));
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
