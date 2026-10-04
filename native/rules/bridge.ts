import { archiveRows } from '../../src/core/archive';
import { protectionLedger } from '../../src/core/protection';
import { MAX_PRODUCTION_BATCH } from '../../src/core/growth';
import {
  enableResearch,
  researchRequirements,
  materialCost,
  researchEffect,
} from '../../src/core/research';
import { restPreview, coreBudget, progression } from '../../src/core/planning';
import {
  enableCommander,
  leadershipQuote,
  prestigeLevel,
  prestigeOverview,
} from '../../src/core/commander';
import { arrangedFormation, powerOverview, armyPower } from '../../src/core/power';
import { attributeSheet } from '../../src/core/attributes';
import { dispatchOverview } from '../../src/core/dispatch';
import { fieldLibrary } from '../../src/core/library';
import { dungeonBlock, dungeonArmy, coreChapters, repairAllQuote } from '../../src/core/arsenal';
import {
  inventoryView,
  battleSummary,
  transportStatus,
  progressSummary,
} from '../../src/core/overview';
import { createServer } from 'node:http';
import {
  enableIndustry,
  facilityNames,
  facilityLevel,
  facilityBlock,
  INDUSTRY_UNLOCK,
  productionFacilities,
} from '../../src/core/industry';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  readdirSync,
  openSync,
  closeSync,
  fsyncSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import {
  allJobs,
  vipBenefits,
  vipLevels,
  queueStatus,
  queueView,
  buildingDuration,
  researchDuration,
  marchQuote,
  queueWait,
  effectiveTime,
  unitLoad,
  baseUnitLoad,
} from '../../src/core/vip';
import {
  advance,
  execute,
  newGame,
  assertState,
  capacity,
  commanderLevel,
  commanderRank,
  leadershipCap,
  rate,
  upgradeBlock,
  facilityUpgradeQuote,
  maxFormation,
  usableFormation,
  formationAvailability,
} from '../../src/core/engine';
import * as content from '../../src/core/content';
import {
  coreList,
  coreNames,
  dungeons,
  enableArsenal,
  productionQuote,
} from '../../src/core/arsenal';
import { exportSave, parseSave } from '../../src/core/storage';
import { resources, type GameState } from '../../src/core/types';
import { commanderStats, army } from '../../src/core/battle';
import {
  mineCapacity,
  npcCapacity,
  npcProtected,
  NPC_CAPACITY,
  NPC_PROTECTED,
  WORLD_INTERVAL,
  guardArmy,
  scoutCost,
} from '../../src/core/world';

// Same deterministic rules as the original prototype; the client is entirely Godot.
export class NativeStore {
  state!: GameState;
  recovered = '';
  private closed = false;
  private dirty = false;
  private lastFlush = 0;
  private rootUntil = 0;
  private rootFailures = 0;
  private rootRetryAt = 0;
  private requireRoot() {
    if (Date.now() >= this.rootUntil) throw Error('请先输入 root 密码解锁管理入口');
  }
  private setRootPassword(password: string) {
    if (typeof password !== 'string' || password.length < 8 || password.length > 64)
      throw Error('密码长度应为 8 至 64 字符');
    const salt = randomBytes(16).toString('hex');
    this.atomic(
      join(this.root, 'root-access.cfg'),
      JSON.stringify({ salt, hash: scryptSync(password, salt, 32).toString('hex') }),
    );
  }
  private rootLogin(password: string) {
    if (Date.now() < this.rootRetryAt) throw Error('密码多次错误，请 1 分钟后重试');
    if (typeof password !== 'string' || password.length > 64) throw Error('密码格式无效');
    const path = join(this.root, 'root-access.cfg');
    if (!existsSync(path)) this.setRootPassword('TankStorm2026!');
    const { salt, hash } = JSON.parse(readFileSync(path, 'utf8'));
    const expected = Buffer.from(hash, 'hex');
    const actual = scryptSync(password, salt, 32);
    if (expected.length !== actual.length || !timingSafeEqual(actual, expected)) {
      this.rootFailures++;
      if (this.rootFailures >= 5) {
        this.rootRetryAt = Date.now() + 60000;
        this.rootFailures = 0;
      }
      throw Error('root 密码错误');
    }
    this.rootUntil = Date.now() + 20 * 60000;
    this.rootFailures = 0;
  }
  constructor(public root: string) {
    mkdirSync(root, { recursive: true });
    const lock = join(root, 'session.lock');
    if (existsSync(lock)) {
      const pid = Number(readFileSync(lock, 'utf8'));
      let alive = false;
      try {
        process.kill(pid, 0);
        alive = true;
      } catch {}
      if (alive) throw Error('游戏已在运行，请切换到已打开的窗口。');
      unlinkSync(lock);
    }
    closeSync(openSync(lock, 'wx'));
    writeFileSync(lock, String(process.pid));
  }
  path(id: string, suffix = '.json') {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw Error('存档编号无效');
    return join(this.root, id + suffix);
  }
  atomic(path: string, text: string) {
    const tmp = path + '.tmp';
    const fd = openSync(tmp, 'w');
    try {
      writeFileSync(fd, text);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, path);
  }
  read(id: string, backup = false): GameState {
    const s = JSON.parse(readFileSync(this.path(id, backup ? '.backup' : '.json'), 'utf8'));
    assertState(s);
    if (s.id !== id) throw Error('存档身份不一致');
    enableArsenal(s);
    enableIndustry(s);
    enableResearch(s);
    enableCommander(s);
    assertState(s);
    return s;
  }
  list() {
    const ids = new Set(
      readdirSync(this.root)
        .filter((n) => (n.endsWith('.json') && n !== 'active.json') || n.endsWith('.backup'))
        .map((n) => n.replace(/\.(json|backup)$/, '')),
    );
    return [...ids]
      .flatMap((id) => {
        const summary = (s: GameState, backup = false) => ({
          id: s.id,
          nickname: s.nickname,
          protection: {
            ...protectionLedger(0, capacity(s), s.buildings.warehouse),
            nextBps: protectionLedger(0, capacity(s), s.buildings.warehouse + 1).bps,
            resources: Object.fromEntries(
              resources.map((r) => [
                r,
                protectionLedger(s.wallet[r], capacity(s), s.buildings.warehouse),
              ]),
            ),
          },
          siteProtection: Object.fromEntries(
            s.world
              .filter((site) => site.kind === 'npc')
              .map((site) => [
                site.id,
                Object.fromEntries(
                  resources.map((r) => [
                    r,
                    { capacity: npcCapacity(site, r), limit: npcProtected(site, r) },
                  ]),
                ),
              ]),
          ),
          level: commanderLevel(s),
          at: s.now,
          savedAt: Math.floor(statSync(this.path(id, backup ? '.backup' : '.json')).mtimeMs),
          hq: s.buildings.hq,
          cleared: s.cleared.length,
          recoverable: backup,
        });
        try {
          return [summary(this.read(id))];
        } catch {
          try {
            return [summary(this.read(id, true), true)];
          } catch {
            return [];
          }
        }
      })
      .sort((a, b) => b.savedAt - a.savedAt || a.id.localeCompare(b.id));
  }
  activate(s: GameState) {
    assertState(s);
    this.atomic(join(this.root, 'active.json'), JSON.stringify({ id: s.id }));
    this.state = s;
    return s;
  }
  create(nickname = '指挥官', seed = 2601001) {
    if (!nickname.trim() || nickname.length > 16) throw Error('昵称应为 1 至 16 个字符');
    const s = newGame(randomUUID(), nickname.trim(), Date.now(), seed);
    return this.install(s);
  }
  private install(s: GameState) {
    assertState(s);
    const primary = this.path(s.id),
      backup = this.path(s.id, '.backup');
    if (existsSync(primary) || existsSync(backup)) throw Error('存档编号已存在');
    try {
      this.atomic(primary, JSON.stringify(s));
      this.atomic(backup, JSON.stringify(s));
      this.activate(s);
      this.dirty = false;
      this.lastFlush = Date.now();
      return s;
    } catch (error) {
      // Only remove this operation's new slot. Existing saves and active pointer survive.
      for (const file of [primary, backup, primary + '.tmp', backup + '.tmp']) {
        try {
          unlinkSync(file);
        } catch {}
      }
      throw error;
    }
  }
  load(id: string) {
    this.flush();
    let s: GameState;
    try {
      s = this.read(id);
    } catch {
      s = this.read(id, true);
      this.recovered = '主存档损坏，已从上一次操作备份恢复';
    }
    const now = Date.now() + (s.timeOffset ?? 0);
    const elapsed = Math.max(0, now - s.now);
    const next = advance(s, now);
    assertState(next);
    this.atomic(this.path(next.id), JSON.stringify(next));
    this.activate(next);
    this.dirty = false;
    this.lastFlush = Date.now();
    return elapsed;
  }
  boot() {
    const active = join(this.root, 'active.json');
    if (existsSync(active)) {
      try {
        const { id } = JSON.parse(readFileSync(active, 'utf8'));
        return this.load(id);
      } catch {
        this.recovered = '原档案无法读取，已保留文件并载入其他可用基地';
      }
    }
    const saves = this.list();
    if (saves.length) return this.load(saves[0].id);
    this.create();
    return 0;
  }
  commit(s: GameState) {
    assertState(s);
    this.atomic(this.path(this.state.id, '.backup'), JSON.stringify(this.state));
    this.atomic(this.path(s.id), JSON.stringify(s));
    this.state = s;
    this.dirty = false;
    this.lastFlush = Date.now();
  }
  tick(now = Date.now()) {
    this.state = advance(this.state, now + (this.state.timeOffset ?? 0));
    this.dirty = true;
    if (Date.now() - this.lastFlush >= 10000) this.flush();
  }
  flush() {
    if (this.state && this.dirty) {
      this.atomic(this.path(this.state.id), JSON.stringify(this.state));
      this.dirty = false;
      this.lastFlush = Date.now();
    }
  }
  view() {
    const s = this.state;
    // Historical event streams are requested only for replay, avoiding large polling payloads.
    const { receipts, reports, ...state } = s;
    return {
      state: {
        ...state,
        reports: reports.map(({ events, initial, final, actions, ...r }) => ({
          ...r,
          transport: transportStatus(s, r as any),
        })),
      },
      info: {
        archive: archiveRows(s).map((r) =>
          r.mode === 'world' ? { ...r, transport: transportStatus(s, r as any) } : r,
        ),
        commanderStats: commanderStats(s.tech, s.commander),
        dispatch: dispatchOverview(s),
        progression: progression(s),
        inventory: inventoryView(s),
        repairAll: repairAllQuote(s),
        dungeonStatus: dungeons.map((d) => ({
          id: d.id,
          block: dungeonBlock(s, d),
          cleared: s.arsenal?.cleared.includes(d.id) ?? false,
        })),
        attributes: attributeSheet(s, usableFormation(s)),
        vip: {
          ...vipBenefits(s),
          paidGold: s.vip?.paidGold ?? 0,
          nextThreshold: vipLevels[vipBenefits(s).level + 1]?.threshold ?? null,
          dailyAvailable:
            vipBenefits(s).level > 0 &&
            Math.floor((s.now + 28800000) / 86400000) > (s.vip?.lastDaily ?? -1),
        },
        rootUnlocked: Date.now() < this.rootUntil,
        queues: Object.fromEntries(
          (['building', 'production', 'research', 'repair'] as const).map((kind) => {
            const q = queueStatus(s, kind);
            return [
              kind,
              {
                active: q.active.length,
                waiting: q.waiting.length,
                slots: q.slots,
                waitingSlots: q.waitingSlots,
                full: q.full,
              },
            ];
          }),
        ),
        jobs: queueView(s),
        facilities: Object.fromEntries(
          productionFacilities.map((id) => {
            const q = queueStatus(s, 'production', id);
            return [
              id,
              {
                id,
                name: facilityNames[id],
                level: facilityLevel(s, id),
                block: facilityBlock(s, id),
                unlock: id === 'factory' ? 1 : INDUSTRY_UNLOCK,
                active: q.active.length,
                waiting: q.waiting.length,
                waitingSlots: q.waitingSlots,
                upgrade: {
                  ...facilityUpgradeQuote(s, id),
                  waitMs: queueWait(s, 'building'),
                  booked:
                    queueView(s).find((j) => j.kind === 'building' && j.target === id) ?? null,
                },
              },
            ];
          }),
        ),
        repairSummary: {
          damaged: Object.values(s.damaged).reduce((n, v) => n + v, 0),
          repairing: allJobs(s)
            .filter((j) => j.kind === 'repair')
            .reduce((n, j) => n + j.total - j.completed, 0),
          destroyed: Object.values(s.destroyedUnits).reduce((n, v) => n + v, 0),
        },
        stageStatus: content.stageNames.map((_, i) => ({
          cleared: s.cleared.includes(i),
          unlocked: i === 0 || s.cleared.includes(i - 1),
        })),
        construction: [...Object.keys(content.buildingNames), 'factory2', 'refit'].map((id) => {
          const extra = id === 'factory2' || id === 'refit';
          const b = id as keyof typeof s.buildings;
          const quote = extra ? facilityUpgradeQuote(s, id) : null;
          return {
            id,
            name: extra ? facilityNames[id] : content.buildingNames[b],
            level: extra ? quote!.level : s.buildings[b],
            cost: extra ? quote!.unitCost : materialCost(s, content.upgradeCost(b, s.buildings[b])),
            duration: effectiveTime(s, extra ? quote!.duration : buildingDuration(s, b)),
            block: extra ? quote!.block : (upgradeBlock(s, b) ?? ''),
            booked: queueView(s).find((j) => j.kind === 'building' && j.target === id) ?? null,
          };
        }),
        buildingBenefits: Object.fromEntries(
          Object.keys(content.buildingNames).map((id) => {
            const b = id as keyof typeof s.buildings;
            const level = s.buildings[b],
              next = Math.min(content.MAX_LEVEL, level + 1);
            const upgraded = { ...s, buildings: { ...s.buildings, [b]: next } };
            const resource = resources.find((r) => r === id);
            return [
              b,
              {
                level,
                next,
                rate: resource ? rate(s, resource) : 0,
                nextRate: resource ? rate(upgraded, resource) : 0,
                capacity: capacity(s),
                nextCapacity: capacity(upgraded),
              },
            ];
          }),
        ),
        buildingTimes: Object.fromEntries(
          Object.keys(content.buildingNames).map((b) => [
            b,
            effectiveTime(s, buildingDuration(s, b as any)),
          ]),
        ),
        buildingCosts: Object.fromEntries(
          Object.keys(content.buildingNames).map((b) => [
            b,
            materialCost(
              s,
              content.upgradeCost(b as any, s.buildings[b as keyof typeof s.buildings]),
            ),
          ]),
        ),
        researchQuotes: Object.fromEntries(
          Object.keys(content.techNames).map((t) => [
            t,
            {
              ...researchRequirements(s, t as any),
              effectCurrent: researchEffect(t as any, s.tech[t as keyof typeof s.tech]),
              effectNext: researchEffect(
                t as any,
                Math.min(content.MAX_LEVEL, s.tech[t as keyof typeof s.tech] + 1),
              ),
              unitCost: content.researchCost(s.tech[t as keyof typeof s.tech]),
              duration: effectiveTime(s, researchDuration(s, t as any)),
              rawDuration: researchDuration(s, t as any),
              waitMs: queueWait(s, 'research'),
              duplicate: allJobs(s).some((j) => j.kind === 'research' && j.target === t),
              booked: queueView(s).find((j) => j.kind === 'research' && j.target === t) ?? null,
            },
          ]),
        ),
        marchQuotes: Object.fromEntries(
          s.world.map((site) => {
            const q = marchQuote(s, site, usableFormation(s));
            const localRate = rate(s, site.resource);
            return [
              site.id,
              {
                ...q,
                scoutCost: scoutCost(site),
                localRate,
                localEquivalentHours: localRate ? q.amount / localRate : 0,
                tripMultiple:
                  localRate && q.totalMs ? (q.amount * 3600000) / (localRate * q.totalMs) : 0,
              },
            ];
          }),
        ),
        knownGuardStats: Object.fromEntries(
          s.world
            .filter((site) => s.intel[site.id])
            .map((site) => [site.id, guardArmy(site, s.intel[site.id].guards)]),
        ),
        savedAt: this.lastFlush,
        hasBackup: existsSync(this.path(s.id, '.backup')),
        capacity: capacity(s),
        protection: {
          ...protectionLedger(0, capacity(s), s.buildings.warehouse),
          nextBps: protectionLedger(0, capacity(s), s.buildings.warehouse + 1).bps,
          resources: Object.fromEntries(
            resources.map((r) => [
              r,
              protectionLedger(s.wallet[r], capacity(s), s.buildings.warehouse),
            ]),
          ),
        },
        siteProtection: Object.fromEntries(
          s.world
            .filter((site) => site.kind === 'npc')
            .map((site) => [
              site.id,
              Object.fromEntries(
                resources.map((r) => [
                  r,
                  { capacity: npcCapacity(site, r), limit: npcProtected(site, r) },
                ]),
              ),
            ]),
        ),
        level: commanderLevel(s),
        rank: commanderRank(s),
        leadership: leadershipCap(s),
        leadershipQuote: leadershipQuote(s),
        prestigeLevel: prestigeLevel(s),
        prestige: prestigeOverview(s),
        power: powerOverview(s, usableFormation(s)),
        formationPlans: {
          power: arrangedFormation(s, 'power'),
          tier: arrangedFormation(s, 'tier'),
        },
        rates: Object.fromEntries(resources.map((r) => [r, rate(s, r)])),
        blocks: Object.fromEntries(
          Object.keys(content.buildingNames).map((b) => [b, upgradeBlock(s, b as any) ?? '']),
        ),
        usable: usableFormation(s),
        suggestedFormation: maxFormation(s),
        presetLoads: s.presets.map((p) => ({
          name: p.name,
          ...formationAvailability(s, p.formation),
        })),
        worldInterval: WORLD_INTERVAL,
        npcCapacity: NPC_CAPACITY,
        npcProtected: NPC_PROTECTED,
        mineCaps: Object.fromEntries(s.world.map((site) => [site.id, mineCapacity(site)])),
        unitStats: Object.fromEntries(
          content.unitList.map((u) => {
            const st = army(
              [{ unitId: u.unitId, count: 1 }, null, null, null, null, null],
              s.tech,
              s.commander.attackSkill,
              s.commander,
            )[0];
            return [
              u.unitId,
              {
                produce: productionQuote(s, u.unitId),
                produce2: productionQuote(s, u.unitId, 'produce', 'factory2'),
                refit: productionQuote(s, u.unitId, 'refit'),
                repair: productionQuote(s, u.unitId, 'repair'),
                attack: Math.floor((st.attack * (st.attackBonus ?? 10000)) / 10000),
                hp: st.hp,

                load: unitLoad(s, u.unitId),
                baseLoad: Math.floor(baseUnitLoad(u.unitId)),
                marching: s.marches.reduce(
                  (n, m) =>
                    n + m.troops.reduce((a, t) => a + (t?.unitId === u.unitId ? t.count : 0), 0),
                  0,
                ),
                repairing: allJobs(s).reduce(
                  (n, j) =>
                    n + (j.kind === 'repair' && j.target === u.unitId ? j.total - j.completed : 0),
                  0,
                ),
              },
            ];
          }),
        ),
      },
      recovered: this.recovered,
    };
  }
  async handle(r: any) {
    let message = '',
      extra: any = {};
    if (r.op === 'boot') {
      const elapsed = this.boot();
      extra = {
        catalog: {
          ...content,
          productionBatchLimit: MAX_PRODUCTION_BATCH,
          coreList,
          coreChapters,
          coreNames,
          dungeons: dungeons.map((d) => ({
            ...d,
            power: armyPower(
              dungeonArmy(d),
              commanderStats({ march: d.guardTech, ballistics: d.guardTech }),
            ),
          })),
          vipLevels,
          fieldLibrary,
          stages: content.stageNames.map((name, i) => ({
            name,
            hint: content.stageHints[i],
            formation: content.stageFormation(i),
            reward: content.stageReward(i, true),
            repeatReward: content.stageReward(i, false),
            growth: content.stageGrowth(i, true),
            repeatGrowth: content.stageGrowth(i, false),
            chapter: Math.floor(i / 16),
            number: (i % 16) + 1,
          })),
        },
        elapsed,
        saves: this.list(),
      };
    } else {
      if (!this.state) throw Error('请先加载存档');
      switch (r.op) {
        case 'tick':
          this.tick();
          break;
        case 'command': {
          if (r.command?.type === 'vipRecharge') this.requireRoot();
          const before = this.state.reports[0]?.id;
          const beforeState = this.state;
          const result = execute(
            this.state,
            r.command,
            Date.now() + (this.state.timeOffset ?? 0),
            r.id ?? randomUUID(),
          );
          this.commit(result.state);
          message = result.result;
          if (r.command?.type === 'presetLoad') {
            const p = this.state.presets[r.command.index];
            extra.presetLoad = { name: p.name, ...formationAvailability(this.state, p.formation) };
          }
          if (r.command?.type === 'rest')
            extra.progress = { ...progressSummary(beforeState, this.state), ...result.accounting };
          if (r.command?.type === 'battle' || r.command?.type === 'dungeon') {
            // Receipt replay must reopen the original battle, never fight twice.
            extra.report = this.state.reports.find((report) => report.id === result.result);
          } else if (r.command?.type !== 'rest' && this.state.reports[0]?.id !== before)
            extra.report = this.state.reports[0];
          break;
        }
        case 'rootLogin':
          this.rootLogin(r.password);
          message = 'root 管理已解锁（20 分钟），仅用于本机模拟';
          break;
        case 'rootLogout':
          this.rootUntil = 0;
          message = 'root 管理已锁定';
          break;
        case 'rootPassword':
          this.requireRoot();
          this.setRootPassword(r.password);
          this.rootUntil = 0;
          message = 'root 密码已更新，请重新登录';
          break;
        case 'autoFormation': {
          if (r.mode !== undefined && !['balanced', 'power', 'tier'].includes(r.mode))
            throw Error('未知排布方案');
          const result = execute(
            this.state,
            {
              type: 'formation',
              slots:
                r.mode === 'power' || r.mode === 'tier'
                  ? arrangedFormation(this.state, r.mode)
                  : maxFormation(this.state),
            },
            Date.now() + (this.state.timeOffset ?? 0),
            randomUUID(),
          );
          this.commit(result.state);
          message = result.result;
          break;
        }
        case 'previewRest':
          extra.restPreview = restPreview(this.state, r.minutes);
          break;
        case 'coreBudget':
          extra.coreBudget = coreBudget(this.state, r.classId, r.tier, r.count, r.factory);
          break;
        case 'report':
          extra.report = this.state.reports.find((x) => x.id === r.id);
          if (!extra.report) throw Error('战报不存在');
          break;
        case 'list':
          extra.saves = this.list();
          break;
        case 'save':
          if (r.formation !== undefined) {
            const saved = execute(
              this.state,
              { type: 'formation', slots: r.formation },
              Date.now() + (this.state.timeOffset ?? 0),
              randomUUID(),
            );
            this.commit(saved.state);
            extra.formationSaved = true;
          } else this.tick();
          this.flush();
          extra.saves = this.list();
          message = '当前存档已保存';
          break;
        case 'copy': {
          if (typeof r.nickname !== 'string' || !r.nickname.trim() || r.nickname.length > 16)
            throw Error('存档名称应为 1 至 16 个字符');
          this.tick();
          this.flush();
          const copy =
            r.formation === undefined
              ? structuredClone(this.state)
              : execute(
                  this.state,
                  { type: 'formation', slots: r.formation },
                  Date.now() + (this.state.timeOffset ?? 0),
                  randomUUID(),
                ).state;
          copy.id = randomUUID();
          copy.nickname = r.nickname.trim();
          this.install(copy);
          extra.saves = this.list();
          message = '当前进度已另存为独立存档，原档保留';
          break;
        }
        case 'new':
          this.flush();
          this.create(r.nickname, r.seed);
          extra.saves = this.list();
          message = '新基地已建立';
          break;
        case 'load':
          extra.elapsed = this.load(r.id);
          extra.saves = this.list();
          message = '存档已载入';
          break;
        case 'restore': {
          const backup = this.read(this.state.id, true);
          const restored = advance(backup, Date.now() + (backup.timeOffset ?? 0));
          assertState(restored);
          // Prepare completely before replacing the current primary file.
          this.atomic(this.path(restored.id), JSON.stringify(restored));
          this.state = restored;
          this.dirty = false;
          this.lastFlush = Date.now();
          extra.saves = this.list();
          message = '已恢复最近一次操作前的存档';
          break;
        }
        case 'export':
          this.tick();
          this.flush();
          extra.text = await exportSave(this.state);
          message = '存档已导出';
          break;
        case 'import': {
          this.flush();
          const s = await parseSave(r.text);
          s.id = randomUUID();
          this.install(advance(s, Date.now() + (s.timeOffset ?? 0)));
          extra.saves = this.list();
          message = '已导入为独立存档';
          break;
        }
        default:
          throw Error('未知请求');
      }
    }
    if (extra.report) {
      extra.settlement = battleSummary(extra.report);
      extra.report = { ...extra.report, transport: transportStatus(this.state, extra.report) };
    }
    const response = { ok: true, ...this.view(), ...extra, message };
    this.recovered = '';
    return response;
  }
  close() {
    if (this.closed) return;
    this.flush();
    this.closed = true;
    try {
      unlinkSync(join(this.root, 'session.lock'));
    } catch {}
  }
}

export async function serve(root: string, ready: string, token: string, parent: number) {
  const store = new NativeStore(root);
  let queue = Promise.resolve();
  const server = createServer((req, res) => {
    if (
      req.method !== 'POST' ||
      req.url !== '/rpc' ||
      req.headers.authorization !== `Bearer ${token}` ||
      req.headers.origin
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    let body = '',
      size = 0;
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > 280000000) {
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      queue = queue.then(async () => {
        try {
          const data = await store.handle(JSON.parse(body));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        } catch (e) {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: (e as Error).message }));
        }
      });
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  store.atomic(ready, JSON.stringify({ port: (server.address() as any).port, pid: process.pid }));
  const shutdown = () => {
    store.close();
    try {
      unlinkSync(ready);
    } catch {}
    server.close();
  };
  const timer = setInterval(() => {
    try {
      process.kill(parent, 0);
    } catch {
      clearInterval(timer);
      shutdown();
    }
  }, 1000);
  timer.unref();
  process.on('SIGTERM', () => {
    shutdown();
    process.exit(0);
  });
  process.on('exit', () => store.close());
  return { store, server, shutdown };
}
if (process.argv.includes('--serve')) {
  const [, , , root, ready, token, parent] = process.argv;
  serve(root, ready, token, Number(parent)).catch((e) => {
    try {
      writeFileSync(ready, JSON.stringify({ error: e.message }));
    } catch {}
    process.exitCode = 1;
  });
}
