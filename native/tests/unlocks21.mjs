// Isolated fixtures for the native client, plus a genuine v0.20 paid-order export.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, 'artifacts/native-v21');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: String.raw`
import {newGame,assertState,rate} from './src/core/engine';
import {unitList,vehicleUnlockLevels} from './src/core/content';
import {productionQuote} from './src/core/arsenal';
import {exportSave} from './src/core/storage';
import {writeFileSync} from 'node:fs';
const out='artifacts/native-v21/';
async function main(){
 const s=newGame('unlock-59','60级工业验收',Date.now(),2121);
 for(const b of Object.keys(s.buildings))s.buildings[b]=60;
 s.buildings.factory=59;s.industry={version:1,factory2:60,refit:59};
 s.commander.xp=50*59**2;
 for(const r of Object.keys(s.wallet))s.wallet[r]=1e10;
 for(const u of unitList){s.available[u.unitId]+=20;s.createdUnits[u.unitId]+=20;}
 for(const c of Object.keys(s.arsenal.cores))s.arsenal.cores[c]=20;
 assertState(s);writeFileSync(out+'factory-save.json',await exportSave(s));
 s.id='unlock-capacity';s.industry.factory2=59;s.industry.refit=60;
 writeFileSync(out+'capacity-save.json',await exportSave(s));
 const budgets=Object.entries(vehicleUnlockLevels).map(([tier,level])=>{
  const st=structuredClone(s);for(const k of Object.keys(st.buildings))st.buildings[k]=level;
  return {tier:Number(tier),factoryLevel:level,models:unitList.filter(u=>u.tier===Number(tier)).map(u=>{
   const q=productionQuote(st,u.unitId);
   return {id:u.unitId,batch100Hours:q.duration*100/3600000,cost100:Object.fromEntries(Object.entries(q.unitCost).map(([r,n])=>[r,n*100])),fundingHours:Math.max(...Object.entries(q.unitCost).filter(([r,n])=>n>0).map(([r,n])=>n*100/rate(st,r)))};
  })};
 });writeFileSync(out+'unlock-budgets.json',JSON.stringify(budgets,null,2));
}
main();
`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out + '/fixtures.cjs',
});
execFileSync(process.execPath, [out + '/fixtures.cjs'], { cwd: root, stdio: 'inherit' });
const oldBridge = resolve(root, 'release/TankStorm-v0.20.0/rules/bridge.cjs');
if (!existsSync(oldBridge)) throw Error('Use the original v0.20 portable bridge for legacy QA');
const { NativeStore } = createRequire(import.meta.url)(oldBridge);
const old = new NativeStore(resolve(out, 'old-runtime-' + process.pid));
try {
  await old.handle({ op: 'boot' });
  const s = old.state;
  s.buildings.hq = s.buildings.factory = 20;
  s.industry = { version: 1, factory2: 20, refit: 20 };
  s.vip = { version: 1, paidGold: 40, lastDaily: -1 };
  for (const r of Object.keys(s.wallet)) s.wallet[r] = 1e10;
  s.available.tank_t6 = s.createdUnits.tank_t6 = 20;
  s.arsenal.cores.tank_core7 = 20;
  s.arsenal.cleared = ['core-0'];
  for (const facility of ['factory', 'factory2', 'refit'])
    for (let i = 0; i < 2; i++)
      await old.handle({
        op: 'command',
        id: 'legacy-' + facility + i,
        command: {
          type: facility === 'refit' ? 'refit' : 'produce',
          facility,
          unitId: 'tank_t7',
          count: 2,
        },
      });
  const exported = await old.handle({ op: 'export' });
  writeFileSync(out + '/legacy-save.json', exported.text);
  console.log('v0.20 snapshot exported: six paid VII orders at level 20');
} finally {
  old.close();
}
