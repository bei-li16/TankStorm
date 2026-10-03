// Read-only cost scenarios. These are balance evidence, not player save modifications.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
mkdirSync(resolve(root, 'artifacts/native-v13'), { recursive: true });
const out = resolve(root, 'artifacts/native-v13/growth-analysis.cjs');
await build({
  stdin: {
    contents: `
import {newGame} from './src/core/engine';
import {coreBudget} from './src/core/planning';
import {writeFileSync} from 'node:fs';
const s=newGame('budget','成本评估',1700000000000);s.buildings.hq=s.buildings.factory=20;s.industry={version:1,factory2:20,refit:20};
const rows=[];
for(const classId of ['tank','tank_destroyer','spg','rocket'])for(const tier of [6,7])for(const count of [20,120,270])rows.push(coreBudget(s,classId,tier,count));
writeFileSync(${JSON.stringify(resolve(root, 'artifacts/native-v13/growth-analysis.json'))},JSON.stringify({assumptions:'No cores, first win unclaimed, no materials technology or VIP, factory20, prototype costs excluded from refit.',rows},null,2));
console.log(JSON.stringify(rows.filter(r=>r.unitId==='tank_t7')));`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
});
execFileSync(process.execPath, [out], { stdio: 'inherit' });
