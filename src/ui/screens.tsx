import { useState } from 'react';
import {
  ArrowRight,
  ChevronRight,
  Flag,
  Lock,
  Plus,
  Radio,
  Shield,
  Target,
  Truck,
  Users,
  Crosshair,
  Check,
  BookOpen,
  Save,
  ArrowLeftRight,
  Wrench,
  LocateFixed,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import {
  buildingDescriptions,
  buildingNames,
  classDescriptions,
  classNames,
  quests,
  resourceNames,
  researchCost,
  stageFormation,
  stageHints,
  stageNames,
  stageReward,
  techDescriptions,
  techNames,
  unitList,
  units,
  upgradeCost,
} from '../core/content';
import {
  afford,
  capacity,
  commanderLevel,
  leadershipCap,
  maxFormation,
  protectedAmount,
  rate,
  scaleCost,
  upgradeBlock,
  usableFormation,
} from '../core/engine';
import {
  resources,
  type Building,
  type Command,
  type Formation,
  type GameState,
  type Technology,
  type UnitClass,
  type WorldSite,
} from '../core/types';
import { CostView, Empty, Modal, PageHeading, Stat, number, time } from './components';
import { ResourceIcon, TankArt } from './Art';
export interface ScreenProps {
  state: GameState;
  run: (c: Command) => Promise<string | undefined>;
  busy: boolean;
  toast: (s: string) => void;
}
export function BaseScreen({
  state,
  onBuilding,
  onPage,
}: {
  state: GameState;
  onBuilding: (b: Building) => void;
  onPage: (s: string) => void;
}) {
  const buildings: [Building, number, number][] = [
    ['hq', 50, 29],
    ['lab', 21, 40],
    ['factory', 78, 48],
    ['warehouse', 47, 73],
    ['oil', 14, 69],
    ['iron', 82, 80],
  ];
  return (
    <>
      <PageHeading
        eyebrow="HOME BASE / SECTOR 16"
        title="重返指挥部"
        description="引擎已预热。你的钢铁军团，正等待新的命令。"
      >
        <span className="coordinate">
          <LocateFixed size={14} />
          X: {state.home.x} · Y: {state.home.y}
        </span>
      </PageHeading>
      <div className="base-scene">
        <img
          src="/art/base.png"
          alt="松林间的军事基地，指挥中心、工厂、科研中心与资源建筑由道路相连"
        />
        <div className="scene-vignette" />
        <div className="scene-status">
          <span className="live-dot" />
          基地运行正常 <span>晴 · 22°C</span>
        </div>
        {buildings.map(([b, x, y]) => (
          <button
            key={b}
            className={`building-label ${state.jobs.building?.target === b ? 'upgrading' : ''}`}
            style={{ left: `${x}%`, top: `${y}%` }}
            onClick={() => onBuilding(b)}
          >
            <span className="building-pin">
              {b === 'hq' ? <Flag size={17} /> : <Plus size={14} />}
            </span>
            <span>
              {buildingNames[b]}
              <small>
                LV. {state.buildings[b]} {state.jobs.building?.target === b ? ' · 建设中' : ''}
              </small>
            </span>
            <ChevronRight size={14} />
          </button>
        ))}
        <div className="scene-bottom">
          <span>
            <Radio size={13} /> 指挥频道已连接
          </span>
          <button onClick={() => onPage('world')}>
            前往世界地图 <ArrowRight size={15} />
          </button>
        </div>
      </div>
      <div className="base-shortcuts">
        <button onClick={() => onPage('formation')}>
          <Users />
          <span>
            <strong>整备部队</strong>
            <small>{Object.values(state.available).reduce((a, b) => a + b, 0)} 辆战车待命</small>
          </span>
          <ArrowRight size={17} />
        </button>
        <button onClick={() => onPage('campaign')}>
          <Crosshair />
          <span>
            <strong>经典战役</strong>
            <small>{state.cleared.length} / 12 战役已完成</small>
          </span>
          <ArrowRight size={17} />
        </button>
        <button onClick={() => onBuilding('lead')}>
          <ResourceIcon resource="lead" />
          <span>
            <strong>资源生产</strong>
            <small>查看全部资源建筑</small>
          </span>
          <ArrowRight size={17} />
        </button>
      </div>
    </>
  );
}
export function BuildingModal({
  state,
  run,
  busy,
  building,
  onClose,
  onSelect,
}: { building: Building; onClose: () => void; onSelect: (b: Building) => void } & ScreenProps) {
  const b = building,
    block = upgradeBlock(state, b),
    cost = upgradeCost(b, state.buildings[b]);
  return (
    <Modal title={buildingNames[b]} onClose={onClose}>
      <div className="building-tabs">
        {(Object.keys(buildingNames) as Building[]).map((k) => (
          <button className={k === b ? 'active' : ''} key={k} onClick={() => onSelect(k)}>
            {buildingNames[k]}
          </button>
        ))}
      </div>
      {(resources.includes(b as (typeof resources)[number]) || b === 'warehouse') && (
        <div className="resource-overview">
          {resources.map((r) => (
            <div key={r}>
              <span>
                <ResourceIcon resource={r} />
                {resourceNames[r]}
              </span>
              <strong>
                {number(state.wallet[r])} / {number(capacity(state))}
              </strong>
              <small>
                +{rate(state, r)}/时{' '}
                {state.wallet[r] >= capacity(state)
                  ? '· 产出已暂停'
                  : r === 'titanium' && state.buildings.hq < 8
                    ? '· 8级解锁'
                    : ''}
              </small>
            </div>
          ))}
        </div>
      )}
      <div className="building-detail">
        <div className="building-emblem">
          <Flag size={48} />
          <span>LV. {state.buildings[b]}</span>
        </div>
        <div>
          <h3>{buildingNames[b]}</h3>
          <p>{buildingDescriptions[b]}</p>
        </div>
      </div>
      <div className="stats-row">
        <Stat label="当前等级" value={state.buildings[b]} />
        <Stat label="升级至" value={Math.min(20, state.buildings[b] + 1)} />
        <Stat
          label={
            resources.includes(b as (typeof resources)[number]) ? '当前产量 / 小时' : '最高等级'
          }
          value={
            resources.includes(b as (typeof resources)[number])
              ? rate(state, b as (typeof resources)[number])
              : 20
          }
        />
      </div>
      {b === 'warehouse' && (
        <p className="hint">
          自然产出上限 {number(capacity(state))} / 每项 · 基础保护 {number(protectedAmount(state))}{' '}
          / 每项。带回的资源可超过产出上限。
        </p>
      )}
      <div className="purchase-row">
        <div>
          <small>升级消耗</small>
          <CostView cost={cost} />
        </div>
        <button
          className="primary"
          disabled={busy || !!block || !afford(state, cost)}
          onClick={() => run({ type: 'upgrade', building: b })}
        >
          {block ?? '开始升级'}
        </button>
      </div>
      {!block && !afford(state, cost) && <p className="error-text">资源不足，请补充物资。</p>}
    </Modal>
  );
}
export function FactoryScreen({ state, run, busy, toast }: ScreenProps) {
  const [tier, setTier] = useState(1),
    [mode, setMode] = useState<'produce' | 'repair'>('produce'),
    [selected, setSelected] = useState<string>(),
    [quantity, setQuantity] = useState(10);
  const u = selected ? units[selected] : undefined;
  return (
    <>
      <PageHeading
        eyebrow="ARMORY / PRODUCTION"
        title="钢铁军备"
        description="四大兵种各有所长。生产、补充、修复，让部队保持战斗力。"
      >
        <div className="segmented">
          <button className={mode === 'produce' ? 'active' : ''} onClick={() => setMode('produce')}>
            生产战车
          </button>
          <button className={mode === 'repair' ? 'active' : ''} onClick={() => setMode('repair')}>
            修复中心 <span>{Object.values(state.damaged).reduce((a, b) => a + b, 0)}</span>
          </button>
        </div>
      </PageHeading>
      <div className="tabs">
        {[1, 2, 3].map((t) => (
          <button key={t} className={tier === t ? 'active' : ''} onClick={() => setTier(t)}>
            {['', '轻型军备', '中型军备', '重型军备'][t]} <small>T{t}</small>
          </button>
        ))}
        <span className="muted">工厂 LV.{state.buildings.factory}</span>
      </div>
      <div className="unit-grid">
        {unitList
          .filter((u) => u.tier === tier)
          .map((u) => {
            const locked = state.buildings.factory < u.unlock.factoryLevel;
            return (
              <article
                className={`unit-card ${locked && mode === 'produce' ? 'locked' : ''}`}
                key={u.unitId}
              >
                <div className="unit-art-wrap">
                  <span className="unit-code">
                    {u.classId === 'tank_destroyer' ? 'TD' : u.classId.toUpperCase()} · 0{tier}
                  </span>
                  <span className="unit-tier">{'★'.repeat(tier)}</span>
                  <TankArt type={u.classId as UnitClass} tier={tier} />
                </div>
                <div className="unit-body">
                  <h3>{u.name}</h3>
                  <p>{classDescriptions[u.classId as UnitClass]}</p>
                  <div className="stats-row">
                    <Stat label="攻击" value={u.attack} />
                    <Stat label="生命" value={u.hp} />
                    <Stat label="防御" value={u.defense} />
                    <Stat label="载重" value={u.load} />
                  </div>
                  <div className="stock-line">
                    <span>
                      待命 <strong>{state.available[u.unitId]}</strong>
                    </span>
                    <span>
                      待修复 <strong>{state.damaged[u.unitId]}</strong>
                    </span>
                  </div>
                  <details className="stock-detail">
                    <summary>兵力去向与实战属性</summary>
                    <p>
                      出征{' '}
                      {state.marches.reduce(
                        (n, m) =>
                          n +
                          m.troops.reduce((a, t) => a + (t?.unitId === u.unitId ? t.count : 0), 0),
                        0,
                      )}{' '}
                      · 修复中{' '}
                      {state.jobs.repair?.target === u.unitId
                        ? state.jobs.repair.total - state.jobs.repair.completed
                        : 0}{' '}
                      · 永久损失 {state.destroyedUnits[u.unitId]}
                    </p>
                    <p>
                      当前生命 {Math.floor(u.hp * (1 + state.tech.hp * 0.05))} · 攻击加成 +
                      {state.tech.attack * 5 + state.commander.attackSkill * 2}% · 当前防御{' '}
                      {Math.floor(u.defense * (1 + (state.tech.armorPlating ?? 0) * 0.02))}
                    </p>
                    <p>
                      单辆生产{' '}
                      {time((u.productionSeconds * 1000) / (1 + state.tech.production * 0.05))} ·
                      光环在战斗开始时根据在场兵种生效
                    </p>
                  </details>
                  <CostView cost={mode === 'repair' ? u.repairCost : u.cost} small />
                  <button
                    className="secondary full"
                    disabled={busy || (mode === 'produce' ? locked : state.damaged[u.unitId] === 0)}
                    onClick={() => {
                      setQuantity(mode === 'repair' ? Math.min(10, state.damaged[u.unitId]) : 10);
                      setSelected(u.unitId);
                    }}
                  >
                    {locked && mode === 'produce' ? (
                      <>
                        <Lock size={14} />
                        工厂 {u.unlock.factoryLevel} 级解锁
                      </>
                    ) : mode === 'repair' ? (
                      <>
                        <Wrench size={14} />
                        修复战车
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        安排生产
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
      </div>
      <div className="info-strip">
        <Shield size={20} />
        <p>生产按辆完成，完成的战车立即入库。取消时，退还全部未完成数量的资源。</p>
      </div>
      {u && (
        <Modal
          title={`${mode === 'repair' ? '修复' : '生产'}${u.name}`}
          onClose={() => setSelected(undefined)}
        >
          <TankArt className="modal-tank" type={u.classId as UnitClass} tier={u.tier} />
          <label className="field">
            数量
            <input
              type="number"
              min={1}
              max={mode === 'repair' ? state.damaged[u.unitId] : 10000}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <div className="quick-amounts">
            {[1, 10, 20, 50].map((n) => (
              <button key={n} onClick={() => setQuantity(n)}>
                {n} 辆
              </button>
            ))}
          </div>
          <div className="purchase-row">
            <div>
              <small>总计消耗</small>
              <CostView
                cost={scaleCost(mode === 'repair' ? u.repairCost : u.cost, Math.max(0, quantity))}
              />
              <p className="muted">
                预计{' '}
                {time(
                  (quantity * (mode === 'repair' ? u.repairSeconds : u.productionSeconds) * 1000) /
                    (1 + state.tech.production * 0.05),
                )}
              </p>
            </div>
            <button
              className="primary"
              disabled={busy || !Number.isInteger(quantity) || quantity < 1}
              onClick={async () => {
                const result = await run({ type: mode, unitId: u.unitId, count: quantity });
                if (result) {
                  setSelected(undefined);
                  toast(result);
                }
              }}
            >
              确认{mode === 'repair' ? '修复' : '生产'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function FormationScreen({ state, run, busy, toast }: ScreenProps) {
  const [draft, setDraft] = useState<Formation>(() => usableFormation(state)),
    [slot, setSlot] = useState<number>(),
    [swap, setSwap] = useState<number>(),
    [unitId, setUnitId] = useState('tank_t1'),
    [qty, setQty] = useState(1);
  const total = draft.reduce((n, t) => n + (t?.count ?? 0), 0);
  const save = () => run({ type: 'formation', slots: draft });
  return (
    <>
      <PageHeading
        eyebrow="BATTLE FORMATION / SIX SLOTS"
        title="战前部署"
        description="前排承受火力，后排提供支援。相同兵种的团队光环只生效一次。"
      >
        <button
          className="secondary"
          onClick={() => {
            setDraft(maxFormation(state));
            toast('已按库存填充，请检查并保存编队');
          }}
        >
          一键填充
        </button>
        <button className="primary" disabled={busy} onClick={save}>
          <Save size={16} />
          保存编队
        </button>
      </PageHeading>
      <div className="formation-layout">
        <div className="formation-board">
          <div className="front-direction">
            <ChevronUp />
            敌军方向
            <ChevronUp />
          </div>
          {[0, 1].map((row) => (
            <div key={row} className="formation-row">
              <span className="row-label">{row === 0 ? '前排' : '后排'}</span>
              {[0, 1, 2].map((col) => {
                const i = row * 3 + col,
                  t = draft[i],
                  u = t ? units[t.unitId] : null;
                return (
                  <div className={`formation-slot ${swap === i ? 'swap' : ''}`} key={i}>
                    <button
                      className="slot-main"
                      onClick={() => {
                        if (swap !== undefined) {
                          const next = [...draft];
                          [next[swap], next[i]] = [next[i], next[swap]];
                          setDraft(next);
                          setSwap(undefined);
                          return;
                        }
                        setSlot(i);
                        setUnitId(t?.unitId ?? 'tank_t1');
                        setQty(t?.count ?? Math.min(leadershipCap(state), state.available.tank_t1));
                      }}
                    >
                      <span className="slot-number">0{i + 1}</span>
                      {u ? (
                        <>
                          <TankArt type={u.classId as UnitClass} tier={u.tier} />
                          <strong>{u.name}</strong>
                          <span className="slot-count">
                            {t!.count}
                            <small> / {leadershipCap(state)}</small>
                          </span>
                        </>
                      ) : (
                        <span className="slot-empty">
                          <Plus size={28} />
                          部署战车
                        </span>
                      )}
                    </button>
                    {t && (
                      <div className="slot-actions">
                        <button onClick={() => setSwap(swap === i ? undefined : i)}>
                          <ArrowLeftRight size={12} />
                          {swap === i ? '取消' : '交换'}
                        </button>
                        <button onClick={() => setDraft(draft.map((s, j) => (i === j ? null : s)))}>
                          撤下
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <p className="hint">
            {swap !== undefined
              ? '选择另一个阵位以交换位置。'
              : '每个阵位只容纳一种战车；保存编队不会锁定库存。'}
          </p>
        </div>
        <aside className="panel">
          <h3>部署概况</h3>
          <Stat label="当前总兵力" value={`${total} 辆`} />
          <Stat label="单格带兵上限" value={`${leadershipCap(state)} 辆`} />
          <Stat
            label="可用载重"
            value={draft.reduce((n, t) => n + (t ? units[t.unitId].load * t.count : 0), 0)}
          />
          <h4>兵种协同</h4>
          {(Object.keys(classNames) as UnitClass[]).map((c) => (
            <div
              className={`aura ${draft.some((t) => t && units[t.unitId].classId === c) ? 'enabled' : ''}`}
              key={c}
            >
              <Check size={15} />
              <span>{classDescriptions[c]}</span>
            </div>
          ))}
          <h4>编队预设</h4>
          {state.presets.map((p, i) => (
            <button
              className="preset"
              key={i}
              onClick={async () => {
                if (await run({ type: 'presetLoad', index: i }))
                  setDraft(structuredClone(p.formation));
              }}
            >
              {p.name}
              <ChevronRight size={14} />
            </button>
          ))}
          <button
            className="secondary full"
            disabled={busy || state.presets.length >= 5}
            onClick={async () => {
              if (await save())
                await run({ type: 'presetSave', name: `编队 ${state.presets.length + 1}` });
            }}
          >
            保存为预设
          </button>
        </aside>
      </div>
      {slot !== undefined && (
        <Modal title={`部署阵位 ${slot + 1}`} onClose={() => setSlot(undefined)}>
          <label className="field">
            选择战车
            <select
              value={unitId}
              onChange={(e) => {
                setUnitId(e.target.value);
                const used = draft.reduce(
                  (n, t, i) => n + (i !== slot && t?.unitId === e.target.value ? t.count : 0),
                  0,
                );
                setQty(
                  Math.max(
                    1,
                    Math.min(leadershipCap(state), state.available[e.target.value] - used),
                  ),
                );
              }}
            >
              {unitList.map((u) => (
                <option key={u.unitId} value={u.unitId}>
                  {u.name} · 库存 {state.available[u.unitId]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            部署数量（每格最多 {leadershipCap(state)}）
            <input
              type="number"
              min="1"
              max={leadershipCap(state)}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </label>
          <button
            className="primary full"
            onClick={() => {
              const used = draft.reduce(
                (n, t, i) => n + (i !== slot && t?.unitId === unitId ? t.count : 0),
                0,
              );
              if (
                !Number.isInteger(qty) ||
                qty < 1 ||
                qty > leadershipCap(state) ||
                qty + used > state.available[unitId]
              ) {
                toast('数量超出可用库存或统率上限');
                return;
              }
              setDraft(draft.map((t, i) => (i === slot ? { unitId, count: qty } : t)));
              setSlot(undefined);
            }}
          >
            部署至阵位
          </button>
        </Modal>
      )}
    </>
  );
}
export function ResearchScreen({ state, run, busy }: ScreenProps) {
  return (
    <>
      <PageHeading
        eyebrow="RESEARCH & DEVELOPMENT"
        title="战场的技术优势"
        description="科技永久生效。正在进行的生产任务会保留开始时的速度。"
      />
      <div className="tech-grid">
        {(Object.keys(techNames) as Technology[]).map((t, i) => {
          const level = state.tech[t],
            locked = level >= state.buildings.lab,
            cost = researchCost(level);
          return (
            <article className="panel tech-card" key={t}>
              <div className="tech-icon">
                {[<Crosshair />, <Shield />, <Wrench />, <Flag />, <Truck />][i]}
              </div>
              <span className="eyebrow">TECH / 0{i + 1}</span>
              <h3>
                {techNames[t]} <small>LV. {level}</small>
              </h3>
              <p>{techDescriptions[t]}</p>
              <div className="tech-levels">
                {Array.from({ length: 20 }, (_, n) => (
                  <i key={n} className={n < level ? 'filled' : ''} />
                ))}
              </div>
              <div className="tech-benefit">
                <span>当前 +{level * 5}%</span>
                <ArrowRight size={14} />
                <strong>下级 +{Math.min(20, level + 1) * 5}%</strong>
              </div>
              <CostView cost={cost} />
              <button
                className="secondary full"
                disabled={busy || locked || !!state.jobs.research || !afford(state, cost)}
                onClick={() => run({ type: 'research', tech: t })}
              >
                {level === 20
                  ? '已达最高等级'
                  : locked
                    ? '请先升级科研中心'
                    : state.jobs.research
                      ? '研究队列占用中'
                      : '开始研究'}
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
}
export function CampaignScreen({
  state,
  run,
  busy,
  onReport,
}: ScreenProps & { onReport: (id: string) => void }) {
  const [selected, setSelected] = useState(Math.min(11, state.cleared.length));
  const unlocked = selected === 0 || state.cleared.includes(selected - 1);
  return (
    <>
      <PageHeading
        eyebrow="CAMPAIGN / BORDER OPERATIONS"
        title="经典战线"
        description="从边境哨卡，到最后的防线。十二场战役，重新找回运筹帷幄的感觉。"
      >
        <span className="tag">{state.cleared.length} / 12 已完成</span>
      </PageHeading>
      <div className="campaign-layout">
        <div className="stage-list">
          {stageNames.map((n, i) => (
            <button
              key={n}
              className={`stage-item ${selected === i ? 'selected' : ''} ${state.cleared.includes(i) ? 'cleared' : ''}`}
              onClick={() => setSelected(i)}
            >
              <span className="stage-no">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <strong>{n}</strong>
                <small>
                  {state.cleared.includes(i)
                    ? '已占领'
                    : i === 0 || state.cleared.includes(i - 1)
                      ? '可进攻'
                      : '待解锁'}
                </small>
              </div>
              {state.cleared.includes(i) ? (
                <Check size={18} />
              ) : i > 0 && !state.cleared.includes(i - 1) ? (
                <Lock size={16} />
              ) : (
                <ChevronRight size={18} />
              )}
            </button>
          ))}
        </div>
        <article className="stage-detail panel">
          <div className="battle-preview">
            <div className="cross-grid" />
            <Target size={100} />
            <span>OPERATION {String(selected + 1).padStart(2, '0')}</span>
          </div>
          <div className="stage-content">
            <span className="eyebrow">行动简报</span>
            <h2>{stageNames[selected]}</h2>
            <p>{stageHints[selected]}</p>
            <h4>敌方部署</h4>
            <div className="enemy-preview">
              {stageFormation(selected).map((t, i) => (
                <div key={i}>
                  {t ? (
                    <>
                      <TankArt type={units[t.unitId].classId as UnitClass} enemy />
                      <small>{units[t.unitId].name}</small>
                      <b>×{t.count}</b>
                    </>
                  ) : (
                    <span>空阵位</span>
                  )}
                </div>
              ))}
            </div>
            <h4>{state.cleared.includes(selected) ? '重复通关奖励' : '首次通关奖励'}</h4>
            <CostView cost={stageReward(selected, !state.cleared.includes(selected))} />
            <p className="hint">正式出击会产生战损；演习不消耗战车，也不发放奖励。</p>
            <div className="button-row">
              <button
                className="secondary"
                disabled={busy}
                onClick={async () => {
                  const id = await run({ type: 'battle', stage: selected, training: true });
                  if (id) onReport(id);
                }}
              >
                战术演习
              </button>
              <button
                className="primary"
                disabled={busy || !unlocked}
                onClick={async () => {
                  const id = await run({ type: 'battle', stage: selected });
                  if (id) onReport(id);
                }}
              >
                {unlocked ? '正式出击' : '通过上一战役解锁'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </article>
      </div>
    </>
  );
}
export function CommanderScreen({ state, run, busy }: ScreenProps) {
  const c = state.commander;
  return (
    <>
      <PageHeading
        eyebrow="COMMANDER / PERSONNEL FILE"
        title={state.nickname}
        description="统率决定规模，科技决定实力。你的每一次胜利，都将被记录。"
      />
      <div className="commander-banner">
        <div className="commander-badge">
          <Shield size={72} />
          <span>★</span>
        </div>
        <div>
          <span className="eyebrow">指挥官档案 · CLASSIC FRONT</span>
          <h2>
            LV. {commanderLevel(state)}{' '}
            <small>
              {c.prestige >= 500
                ? '少校'
                : c.prestige >= 200
                  ? '上尉'
                  : c.prestige >= 50
                    ? '中尉'
                    : '少尉'}
            </small>
          </h2>
          <p>
            累计经验 {number(c.xp)} · 声望 {number(c.prestige)}
          </p>
        </div>
        <button
          className="primary"
          disabled={busy || Math.floor((state.now + 28800000) / 86400000) <= state.lastDaily}
          onClick={() => run({ type: 'daily' })}
        >
          领取每日补给
        </button>
      </div>
      <div className="tech-grid">
        <div className="panel">
          <Users className="accent" />
          <h3>统率等级 {c.leadership}</h3>
          <p>单格携带上限 {leadershipCap(state)} 辆</p>
          <p className="muted">
            持有 {c.books} 本统率书 · 下级需要 {c.leadership} 本
          </p>
          <button
            className="secondary full"
            disabled={busy || c.books < c.leadership || c.leadership >= 20}
            onClick={() => run({ type: 'leadership' })}
          >
            提升统率 · 上限 +5
          </button>
        </div>
        <div className="panel">
          <Crosshair className="accent" />
          <h3>战术指挥 {c.attackSkill}</h3>
          <p>全队攻击 +{c.attackSkill * 2}%</p>
          <p className="muted">可用技能点 {c.skillPoints} · 首次通关获得技能点</p>
          <button
            className="secondary full"
            disabled={busy || !c.skillPoints || c.attackSkill >= 20}
            onClick={() => run({ type: 'skill' })}
          >
            提升技能 · 攻击 +2%
          </button>
        </div>
        <div className="panel">
          <BookOpen className="accent" />
          <h3>成长记录</h3>
          <Stat label="累计生产" value={state.counters.produce ?? 0} />
          <Stat label="战斗胜利" value={state.counters.victory ?? 0} />
          <Stat label="运回物资" value={state.counters.cargo ?? 0} />
        </div>
      </div>
      <p className="hint">每日补给在北京时间 00:00 刷新。初始奖励与成长数值为本复刻版本的设计。</p>
    </>
  );
}
export function Quests({ state, run, busy, onClose }: ScreenProps & { onClose: () => void }) {
  return (
    <Modal title="成长任务" onClose={onClose} wide>
      <p className="muted">循着任务重建基地，每项奖励只能领取一次。</p>
      <div className="quest-list">
        {quests.map((q) => {
          const done = state.claimed.includes(q.id),
            progress = state.counters[q.counter] ?? 0,
            ready = progress >= q.target;
          return (
            <div className={`quest-row ${done ? 'done' : ''}`} key={q.id}>
              <span className="quest-icon">{done ? <Check size={20} /> : <Flag size={20} />}</span>
              <div>
                <h3>{q.name}</h3>
                <p>
                  {q.description}{' '}
                  <b>
                    {Math.min(progress, q.target)}/{q.target}
                  </b>
                </p>
                <CostView cost={q.reward} small />
                {q.books && <small className="muted"> · 统率书 ×{q.books}</small>}
              </div>
              <button
                className={ready && !done ? 'primary' : 'secondary'}
                disabled={busy || done || !ready}
                onClick={() => run({ type: 'claim', questId: q.id })}
              >
                {done ? '已领取' : ready ? '领取奖励' : '进行中'}
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
export function WorldScreen({ state, run, busy, toast }: ScreenProps) {
  const [center, setCenter] = useState({ x: 16, y: 16 }),
    [selected, setSelected] = useState<string>('site-0'),
    [coords, setCoords] = useState({ x: 16, y: 16 });
  const site = state.world.find((s) => s.id === selected),
    intel = site ? state.intel[site.id] : undefined;
  const move = (x: number, y: number) =>
    setCenter((c) => ({
      x: Math.max(5, Math.min(26, c.x + x)),
      y: Math.max(5, Math.min(26, c.y + y)),
    }));
  const travel = site
    ? Math.ceil(Math.hypot(site.x - state.home.x, site.y - state.home.y) * 8) * 1000
    : 0;
  const drawCell = (x: number, y: number) => {
    const t = state.world.find((t) => t.x === x && t.y === y),
      home = x === state.home.x && y === state.home.y,
      marching = state.marches.some((m) => m.targetId === t?.id);
    return (
      <button
        key={`${x},${y}`}
        aria-label={`${x},${y} ${home ? '基地' : t ? `${t.name} 等级${t.level}` : '荒地'}`}
        className={`map-cell terrain-${(x * 13 + y * 7) % 5} ${home ? 'home' : ''} ${t?.id === selected ? 'selected' : ''} ${marching ? 'marching' : ''}`}
        onClick={() => {
          setCoords({ x, y });
          if (t) setSelected(t.id);
          else {
            setSelected('');
            if (home) toast('这里是你的基地');
          }
        }}
      >
        {home ? (
          <Flag size={21} />
        ) : t ? (
          <>
            <span className={`map-site ${t.kind}`}>
              {t.kind === 'npc' ? <Shield size={19} /> : <ResourceIcon resource={t.resource} />}
            </span>
            <small>{t.level}</small>
          </>
        ) : (
          <span className="terrain-mark">{(x + y) % 7 === 0 ? '♠' : ''}</span>
        )}
      </button>
    );
  };
  return (
    <>
      <PageHeading
        eyebrow="WORLD MAP / EXPEDITION"
        title="前线之外"
        description="侦察、占领、采集。物资随部队返回基地后才会入库。"
      >
        <button className="secondary" onClick={() => setCenter({ x: 16, y: 16 })}>
          <LocateFixed size={15} />
          定位基地
        </button>
      </PageHeading>
      <div className="world-layout">
        <div className="world-frame">
          <div className="map-coordinates">
            <span>边境地区 · 32 × 32</span>
            <span>
              X:{center.x} Y:{center.y}
            </span>
          </div>
          <div className="world-grid">
            {Array.from({ length: 11 }, (_, row) =>
              Array.from({ length: 11 }, (_, col) =>
                drawCell(center.x - 5 + col, center.y - 5 + row),
              ),
            )}
          </div>
          <div className="map-controls">
            <button aria-label="地图向左" onClick={() => move(-5, 0)}>
              <ChevronLeft />
            </button>
            <button aria-label="地图向上" onClick={() => move(0, -5)}>
              <ChevronUp />
            </button>
            <button aria-label="地图向下" onClick={() => move(0, 5)}>
              <ChevronDown />
            </button>
            <button aria-label="地图向右" onClick={() => move(5, 0)}>
              <ChevronRight />
            </button>
            <span>坐标</span>
            <input
              aria-label="目标 X 坐标"
              type="number"
              min={0}
              max={31}
              value={coords.x}
              onChange={(e) => setCoords({ ...coords, x: Number(e.target.value) })}
            />
            <input
              aria-label="目标 Y 坐标"
              type="number"
              min={0}
              max={31}
              value={coords.y}
              onChange={(e) => setCoords({ ...coords, y: Number(e.target.value) })}
            />
            <button
              onClick={() => {
                if (
                  !Number.isInteger(coords.x) ||
                  !Number.isInteger(coords.y) ||
                  coords.x < 0 ||
                  coords.x > 31 ||
                  coords.y < 0 ||
                  coords.y > 31
                ) {
                  toast('坐标范围为 0 至 31');
                  return;
                }
                setCenter({
                  x: Math.max(5, Math.min(26, coords.x)),
                  y: Math.max(5, Math.min(26, coords.y)),
                });
                setSelected(
                  state.world.find((t) => t.x === coords.x && t.y === coords.y)?.id ?? '',
                );
              }}
            >
              定位
            </button>
          </div>
        </div>
        <aside className="panel target-panel">
          {site ? (
            <>
              <span className="eyebrow">
                目标档案 / X:{site.x} Y:{site.y}
              </span>
              <div className="target-symbol">
                {site.kind === 'npc' ? (
                  <Shield size={55} />
                ) : (
                  <ResourceIcon resource={site.resource} />
                )}
              </div>
              <h2>
                {site.name} <small>LV.{site.level}</small>
              </h2>
              <Stat label="单程行军" value={time(travel)} />
              <Stat label="任务类型" value={site.kind === 'mine' ? '占领采集' : '据点掠夺'} />
              {intel ? (
                <>
                  <div className="intel">
                    <span>
                      <Radio size={14} />
                      侦察情报
                    </span>
                    <small>{new Date(intel.at).toLocaleTimeString('zh-CN')}</small>
                  </div>
                  <p>
                    守军 {intel.guards.reduce((n, t) => n + (t?.count ?? 0), 0)} 辆{' '}
                    {site.kind === 'mine' ? `· 储量 ${number(intel.reserve)}` : ''}
                  </p>
                  <div className="mini-guards">
                    {intel.guards.filter(Boolean).map((t, i) => (
                      <span key={i}>
                        {units[t!.unitId].name} ×{t!.count}
                      </span>
                    ))}
                  </div>
                  <p className="hint">情报为侦察时的快照，抵达时以实际守军为准。</p>
                </>
              ) : (
                <p className="hint">守军与物资尚不明确，建议先侦察目标。</p>
              )}
              <button
                className="secondary full"
                disabled={busy || state.wallet.crystal < 3}
                onClick={() => run({ type: 'scout', targetId: site.id })}
              >
                <Radio size={15} />
                侦察 · 3 水晶
              </button>
              <button
                className="primary full"
                disabled={busy || state.marches.length >= 2}
                onClick={() =>
                  run({
                    type: 'march',
                    targetId: site.id,
                    mission: site.kind === 'mine' ? 'gather' : 'raid',
                  })
                }
              >
                {site.kind === 'mine' ? '出征采集' : '出征掠夺'}
                <ArrowRight size={16} />
              </button>
              <p className="hint">
                使用已保存编队中的可用兵力。
                {site.kind === 'mine'
                  ? '满载或矿点枯竭后自动返航。'
                  : '只能掠夺超过每项 1000 保护量的物资。'}
              </p>
            </>
          ) : (
            <Empty>选择地图上的矿点或据点。</Empty>
          )}
        </aside>
      </div>
      <div className="map-legend">
        <span>
          <Flag size={15} />
          我方基地
        </span>
        <span>
          <ResourceIcon resource="iron" />
          资源矿点
        </span>
        <span>
          <Shield size={15} />
          敌方据点
        </span>
        <span className="muted">矿点暂不刷新，远征拓展新的补给线。</span>
      </div>
    </>
  );
}
