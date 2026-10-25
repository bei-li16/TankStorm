import { build } from 'esbuild';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '../..');
const temp = join(root, 'tmp/design-docs');
mkdirSync(temp, { recursive: true });
const bundle = join(temp, 'evidence.cjs');
await build({ stdin: { contents: `
export * from './src/core/content.ts';
export * from './src/core/research.ts';
export * from './src/core/commander.ts';
export * from './src/core/arsenal.ts';
export * from './src/core/engine.ts';
export * from './src/core/vip.ts';
export * from './src/core/growth.ts';
export * from './src/core/world.ts';
export * from './src/core/library.ts';
export * from './src/core/cargo.ts';
`, resolveDir: root, sourcefile: 'design-evidence.ts', loader: 'ts' }, outfile: bundle, bundle: true, platform: 'node', format: 'cjs', target: 'node24', logLevel: 'silent' });
const api = createRequire(import.meta.url)(bundle);
const esc = (value) => String(value).replace(/[\\&%$#_{}~^]/g, (c) => ({ '\\':'\\textbackslash{}','&':'\\&','%':'\\%','$':'\\$','#':'\\#','_':'\\_','{':'\\{','}':'\\}','~':'\\textasciitilde{}','^':'\\textasciicircum{}' }[c]));
const code = (s) => `\\code{${s}}`;
const row = (cells) => cells.join(' & ') + ' \\\\\n';
const number = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const table = (spec, headings, rows) => `\\begin{small}\n\\begin{longtable}{@{}${spec}@{}}\n\\toprule ${row(headings)}\\midrule\\endhead\n${rows.map(row).join('')}\\bottomrule\n\\end{longtable}\n\\end{small}\n`;
const write = (folder, file, text) => { mkdirSync(join(root, 'docs', folder, 'generated'), { recursive: true }); writeFileSync(join(root, 'docs', folder, 'generated', file), text, 'utf8'); };
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const paths = [
 ...readdirSync(join(root, 'src/core')).filter(p => p.endsWith('.ts')).map(p => 'src/core/'+p),
 ...readdirSync(join(root, 'src/client')).filter(p => p.endsWith('.ts')).map(p => 'src/client/'+p),
 'native/rules/bridge.ts', 'native/scripts/game.gd', 'native/scripts/construction_list.gd',
 'native/scripts/research_list.gd', 'native/scripts/rest_summary.gd', 'native/scripts/quantity_format.gd',
 'native/build.mjs', 'native/dev.mjs', 'native/project.godot', 'design/classic-prototype-rules.json', 'package.json',
];
const inventory = paths.map((path) => {
 const text = readFileSync(join(root, path), 'utf8');
 const symbols = text.split(/\r?\n/).flatMap((line, i) => {
  const m = line.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^export\s+class\s+(\w+)|^func\s+(\w+)/);
  return m ? [{ name: m[1]??m[2]??m[3], line:i+1 }] : [];
 });
 return {path,lines:text.split(/\r?\n/).length,sha256:createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex'),symbols};
});
const tests = JSON.parse(readFileSync(join(temp, 'tests.json'), 'utf8'));
const counts = { application: JSON.parse(readFileSync(join(root,'package.json'))).version, commit,
 sourceFiles: inventory.length, testFiles: tests.testResults.length, tests:tests.numTotalTests,
 passed:tests.numPassedTests, failed:tests.numFailedTests, units:api.unitList.length,
 research:api.researchTree.length, mainChapters:api.chapters.length, mainStages:api.stageNames.length,
 coreChapters:api.coreChapters.length, coreStages:api.dungeons.length,
 libraryEntries:api.fieldLibrary.entries.length };
write('70-architecture-design','baseline.json',JSON.stringify({documentDate:'2026-10-23',...counts,inventory},null,2)+'\n');
let source = '\\chapter{源码定位与核对基线}\n本表按当前工作树自动提取；路径均相对工程根目录。行号用于定位，函数名比后续变动的行号更稳定。完整SHA-256与符号清单保存在同目录的\\code{baseline.json}。\n';
source += `\\section{核对规模}\n当前版本${counts.application}，${counts.units}款车、${counts.research}项科技、${counts.mainChapters}章${counts.mainStages}关主线、${counts.coreChapters}章${counts.coreStages}关核心、${counts.libraryEntries}篇手册。文档任务实际执行${counts.testFiles}个测试文件、${counts.tests}项测试，通过${counts.passed}项，失败${counts.failed}项。此结果仅代表该源码基线。\n`;
source += table('P{63mm}rP{66mm}', ['文件','行数','主要符号（起始行）'],inventory.map(f=>[code(f.path),number(f.lines),f.symbols.slice(0,f.path.endsWith('game.gd')?5:4).map(s=>code(s.name)+':'+s.line).join('；') || '配置或数据']));
source += '\\clearpage\n\\section{常用问题定位}\n';
const wanted = {'src/core/engine.ts':['execute','advance','advanceInPlace','startJob','finishJob','resolveArrival','formationAvailability','assertState'],'src/core/battle.ts':['army','commanderStats','attackSlots','extraFireChance','simulate'],'src/core/arsenal.ts':['productionQuote','repairAllQuote','dungeonArmy','dungeonBlock'],'src/core/storage.ts':['canonical','parseSave','updateSave'],'native/scripts/game.gd':['_start_runtime','request','command','_response','_navigate','_battle_step','_next_fire_interval','_research36_seek']};
source += table('P{57mm}P{70mm}r',['文件','符号','行'],inventory.flatMap(f=>(wanted[f.path]??[]).map(name=>{const s=f.symbols.find(s=>s.name===name);return [code(f.path),code(name),String(s?.line??'见方法体')]})));
write('70-architecture-design','source-map.tex',source);

let rulesTex = '\\chapter{从源码生成的规则附表}\n本附录来自当前规则模块的实际导出值，不从历史需求文档抄录。大数保留精确整数；时间表中的生产秒数为未应用科技、车间与VIP前的单辆基础工时。\n';
rulesTex += '\\section{28款车辆的基础战斗参数}\n基础载重为baseUnitLoad换算基准，小数显示两位；实际unitLoad应用科技后逐车向下取整。\n';
rulesTex += table('P{35mm}P{24mm}rrrrr',['车型ID','名称','攻击','生命','防御','基础载重','解锁级'],api.unitList.map(u=>[code(u.unitId),esc(u.name),number(u.attack),number(u.hp),number(u.defense),number(api.baseUnitLoad(u.unitId)),String(u.unlock.factoryLevel)]));
rulesTex += '\\clearpage\n\\section{制造配方与单辆基础工时}\n费用列依次为铁、油、铅、钛；制造不另外收取水晶。实际费用再应用材料利用科技，实际工时见正文。改装收相邻阶成本差额，高阶核心另计。\n';
rulesTex += table('P{32mm}rrrrr',['车型ID','铁','油','铅','钛','生产秒'],api.unitList.map(u=>[code(u.unitId),...['iron','oil','lead','titanium'].map(r=>number(u.cost[r]??0)),number(u.productionSeconds)]));
rulesTex += '\\clearpage\n\\section{维修配方和单辆基础工时}\n以下为规则文件的维修原价；材料节省影响实际资源费，高阶车维修不另耗核心。\n';
rulesTex += table('P{32mm}rrrrrr',['车型ID','铁','油','铅','钛','水晶','维修秒'],api.unitList.map(u=>[code(u.unitId),...['iron','oil','lead','titanium','crystal'].map(r=>number(u.repairCost[r]??0)),number(u.repairSeconds)]));
rulesTex += '\\clearpage\n\\section{27项科技节点及前置}\n目标等级为n时，实验室最低要求为max(表中实验室,n)；每条前置最低为max(表中等级,ceil(n/2))。玩家科研上限120。效果公式见正文。\n';
rulesTex += table('P{24mm}P{30mm}P{18mm}rP{50mm}',['名称','ID','分支','实验室','初始前置'],api.researchTree.map(t=>[esc(t.name),code(t.id),esc(({economy:'经济',industry:'工业',logistics:'后勤',combat:'战斗'})[t.branch]),String(t.lab),t.prerequisites.map(p=>code(p.id)+' '+p.level).join('；')||'无']));
rulesTex += '\\clearpage\n\\section{普通与核心章节目录}\n主线每章16关；核心每章16关。第7阶是车辆上限，不是核心敌军科研与兵力上限。\n';
rulesTex += '{\\renewcommand{\\arraystretch}{1.1}\n';
rulesTex += table('rP{48mm}P{24mm}P{48mm}',['章','普通战役','核心副本','核心每格兵力 / 科技区间'],api.chapters.map((c,i)=>[String(i+1),esc(c.name),esc(api.coreChapters[i]??'--'),api.coreCurves[i]?`${api.coreCurves[i].count.join('--')} / ${api.coreCurves[i].tech.join('--')}`:'--']));
rulesTex += '}\n';
rulesTex += '\\clearpage\n\\section{基础经济曲线采样}\n资源建筑与仓库分别处于表列等级；无经济科技与VIP，钛产率另要求HQ6。此表不代表同一存档自动具有这些等级。\n';
rulesTex += table('rrrrrrr',['等级','铁/时','油/时','铅/时','钛/时','晶/时','单资源仓容'],[1,20,40,60,80,100,119,120].map(l=>[String(l),...['iron','oil','lead','titanium','crystal'].map(r=>number(Math.floor(api.rules.economy.baseRatePerHour[r]*api.rateCurve[l]/10000))),number(api.storageCurve[l])]));
rulesTex += '\\Needspace{80mm}\n\\section{升级工时锚点}\n等级为当前等级，下一等级工时从当前锚点求值；120级的曲线数据仅用于连续性定义，实际玩家升级已封顶。项目系数、可变工序加速、VIP免费时长另算。锚点之间为对数插值，小时辅助列显示两位小数。\n';
rulesTex += table('rrrrr',['当前等级','建筑毫秒','科研毫秒','建筑小时','科研小时'],[0,1,6,12,20,40,60,80,100,119,120].map(l=>[String(l),number(api.buildingBaseTime(l)),number(api.researchBaseTime(l)),number(api.buildingBaseTime(l)/3600000),number(api.researchBaseTime(l)/3600000)]));
rulesTex += '\\Needspace{85mm}\n\\section{VIP工位与免费时长}\n工业、科研、维修等待位固定为3，VIP不额外增加这些等待位。其余速度、经验与仓容增益由源码VIP表派生。\n';
rulesTex += table('rrrrrr',['VIP','累计模拟金币','建筑并行','远征队数','免费分钟','每日金币'],api.vipLevels.map(v=>[v.level,number(v.threshold),v.building,v.marches,v.freeMinutes,v.dailyGold].map(String)));
write('71-detailed-design','rules-tables.tex',rulesTex);
console.log(JSON.stringify(counts,null,2));
