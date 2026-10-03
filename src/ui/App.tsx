import { reportReady } from '../client/diagnostics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  Crosshair,
  Download,
  Flag,
  FolderOpen,
  House,
  LoaderCircle,
  Map,
  Menu,
  Plus,
  Radio,
  ScrollText,
  Settings,
  Shield,
  Swords,
  Target,
  Upload,
  UserRound,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import type { Building, Command, GameState, JobKind } from '../core/types';
import {
  advance,
  commanderLevel,
  commanderRank,
  execute,
  newGame,
  scaleCost,
  usableFormation,
} from '../core/engine';
import { buildingNames, quests, units } from '../core/content';
import {
  createSave,
  exportSave,
  listSaves,
  loadSave,
  parseSave,
  restoreBackup,
  advanceSave,
  commandSave,
} from '../client/local';
import {
  BaseScreen,
  BuildingModal,
  CampaignScreen,
  CommanderScreen,
  FactoryScreen,
  FormationScreen,
  Quests,
  ResearchScreen,
  WorldScreen,
} from './screens';
import { BattleModal } from './Battle';
import {
  CostView,
  Empty,
  Modal,
  NoticeContext,
  PageHeading,
  QueueCard,
  ResourceBar,
  Stat,
  jobNames,
  number,
  time,
} from './components';
const navigation = [
  ['base', '基地总览', House],
  ['formation', '作战编队', Users],
  ['campaign', '经典战役', Crosshair],
  ['world', '世界地图', Map],
  ['factory', '军备工厂', Wrench],
  ['research', '科研中心', Target],
  ['commander', '指挥官', UserRound],
  ['reports', '作战记录', ScrollText],
] as const;
interface Confirmation {
  title: string;
  text: string;
  action: () => Promise<unknown>;
  cost?: Record<string, number>;
}
export default function App() {
  const [setup, setSetup] = useState(false),
    [newDialog, setNewDialog] = useState(false),
    [newName, setNewName] = useState('归来的指挥官'),
    [worldSeed, setWorldSeed] = useState('2601001'),
    [state, setState] = useState<GameState>(),
    [page, setPage] = useState('base'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [building, setBuilding] = useState<Building>(),
    [questOpen, setQuestOpen] = useState(false),
    [settings, setSettings] = useState(false),
    [reportId, setReportId] = useState<string>(),
    [confirmation, setConfirmation] = useState<Confirmation>(),
    [menu, setMenu] = useState(false),
    [runningOpen, setRunningOpen] = useState(false),
    [saves, setSaves] = useState<GameState[]>([]),
    [rename, setRename] = useState(''),
    [reportFilter, setReportFilter] = useState('all'),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (state) reportReady();
  }, [!!state]);
  const stateRef = useRef(state),
    busyRef = useRef(false),
    inputRef = useRef<HTMLInputElement>(null),
    noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  stateRef.current = state;
  const toast = useCallback((s: string) => {
    setMessage(s);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setMessage(''), 5000);
  }, []);
  const activate = useCallback(
    async (id: string) => {
      const saved = await loadSave(id);
      if (!saved) throw Error('存档不存在');
      const gap = Date.now() - saved.now;
      const next = await advanceSave(id, Date.now());
      localStorage.setItem('tankstorm-active', id);
      setState(next.state);
      setRename(next.state.nickname);
      setError('');
      if (gap > 60000) toast(`欢迎回来，已结算离线 ${time(gap)} 的生产与行军。`);
    },
    [toast],
  );
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let saved = await listSaves();
        if (cancelled) return;
        const current = localStorage.getItem('tankstorm-active');
        let selected = saved.find((s) => s.id === current) ?? saved[0];
        if (!selected) {
          setSetup(true);
          return;
        }
        if (!cancelled) await activate(selected.id);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activate]);
  useEffect(() => {
    const timer = setInterval(async () => {
      setNow(Date.now());
      const current = stateRef.current;
      if (!current || busyRef.current) return;
      busyRef.current = true;
      try {
        const out = await advanceSave(current.id, Date.now());
        setState((prev) => (prev?.id === out.state.id ? out.state : prev));
      } catch (e) {
        setError(`自动存档失败：${(e as Error).message}`);
      } finally {
        busyRef.current = false;
      }
    }, 2000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const changed = (e: StorageEvent) => {
      if (e.key === 'tankstorm-active' && e.newValue && e.newValue !== stateRef.current?.id)
        void activate(e.newValue).catch((e) => setError(e.message));
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [activate]);
  const run = useCallback(
    async (command: Command) => {
      if (busyRef.current) {
        toast('正在保存，请稍后重试');
        return;
      }
      const s = stateRef.current;
      if (!s) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const id = crypto.randomUUID();
        const output = await commandSave(s.id, command, Date.now(), id);
        setState(output.state);
        if (!output.result.startsWith('report-')) toast(output.result);
        return output.result;
      } catch (e) {
        toast((e as Error).message);
        return undefined;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [toast],
  );
  useEffect(() => {
    if (!menu) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menu]);
  const changePage = (p: string) => {
    setPage(p);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const refreshSaves = async () => setSaves(await listSaves());
  const openSettings = async () => {
    setMenu(false);
    if (state) setRename(state.nickname);
    await refreshSaves();
    setSettings(true);
  };
  const exportCurrent = async () => {
    try {
      const s = stateRef.current;
      if (!s) return;
      const text = await exportSave(s);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `坦克风云-${s.nickname}-${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('存档已导出');
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const startNew = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const seed = Number(worldSeed);
      if (!newName.trim() || newName.length > 16) throw Error('请输入 1 至 16 个字符的名称');
      const s = newGame(crypto.randomUUID(), newName, Date.now(), seed);
      await createSave(s);
      await activate(s.id);
      await refreshSaves();
      setSetup(false);
      setNewDialog(false);
      setSettings(false);
      setMenu(false);
      setPage('base');
      toast('欢迎归队，前往成长任务领取首批补给');
    } catch (e) {
      setError((e as Error).message);
      toast((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const loaded = await parseSave(await file.text());
      loaded.id = crypto.randomUUID();
      await createSave(loaded);
      await activate(loaded.id);
      await refreshSaves();
      toast('已导入为独立存档，原存档已保留');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };
  const cancel = (kind: JobKind) => {
    const j = state?.jobs[kind];
    if (!j) return;
    setConfirmation({
      title: `取消${jobNames[kind]}`,
      text: `保留已完成部分，退还 ${j.total - j.completed} 份未完成任务的资源。正在进行的一份也将取消。`,
      cost: scaleCost(j.unitCost, j.total - j.completed),
      action: () => run({ type: 'cancel', kind }),
    });
  };
  const accelerate = (kind: JobKind) => {
    const j = state?.jobs[kind];
    if (!j) return;
    const cost = Math.max(
      1,
      Math.ceil((j.dueAt - Date.now() + (j.total - j.completed - 1) * j.duration) / 60000),
    );
    setConfirmation({
      title: '立即完成队列',
      text: `使用 ${cost} 金币立即完成所有剩余任务。实际扣费以确认时剩余时间为准。`,
      action: () => run({ type: 'accelerate', kind }),
    });
  };
  const report = state?.reports.find((r) => r.id === reportId);
  const pending = state
    ? quests.filter(
        (q) => !state.claimed.includes(q.id) && (state.counters[q.counter] ?? 0) >= q.target,
      ).length
    : 0;
  if (!state && setup)
    return (
      <div className="welcome">
        <div className="welcome-art" />
        <div className="welcome-panel">
          <Shield size={42} />
          <span className="eyebrow">TANK STORM / CLASSIC FRONT</span>
          <h1>指挥官，欢迎归队</h1>
          <p>重建基地，集结战车，在熟悉的六格战场上再次出发。</p>
          <label className="field">
            指挥官名称
            <input value={newName} maxLength={16} onChange={(e) => setNewName(e.target.value)} />
          </label>
          <label className="field">
            世界种子
            <input
              type="number"
              min={1}
              max={4294967295}
              value={worldSeed}
              onChange={(e) => setWorldSeed(e.target.value)}
            />
          </label>
          <p className="hint">相同种子生成相同地图。进度自动保存在这台设备，不需要注册。</p>
          {error && <p className="error-text">{error}</p>}
          <button className="primary full" disabled={busy} onClick={startNew}>
            建立指挥部 <ArrowRight size={16} />
          </button>
          <small>经典框架 · 原创美术 · 独立单人世界</small>
        </div>
      </div>
    );
  if (!state)
    return (
      <div className="loading">
        <Shield size={52} />
        <h1>坦克风云</h1>
        <p>{error || '正在连接指挥部…'}</p>
        {error && (
          <>
            <button
              className="primary"
              onClick={async () => {
                const id = localStorage.getItem('tankstorm-active');
                if (id)
                  try {
                    await restoreBackup(id);
                    await activate(id);
                  } catch (e) {
                    setError((e as Error).message);
                  }
              }}
            >
              尝试恢复自动备份
            </button>
            <button
              className="secondary"
              onClick={async () => {
                try {
                  const s = newGame(crypto.randomUUID(), '新指挥官', Date.now());
                  await createSave(s);
                  await activate(s.id);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              保留旧档并创建新存档
            </button>
          </>
        )}
      </div>
    );
  const props = { state, run, busy, toast };
  return (
    <NoticeContext.Provider value={message}>
      <div className="app-shell">
        <aside className={`sidebar ${menu ? 'open' : ''}`}>
          <button className="brand" onClick={() => changePage('base')}>
            <Shield size={34} />
            <span>
              坦克风云<small>CLASSIC FRONT</small>
            </span>
          </button>
          <div className="edition">
            <i />
            经典战线 · 单人档案
          </div>
          <div className="nav-label">指挥中心</div>
          <nav>
            {navigation.map(([id, label, Icon]) => (
              <button
                key={id}
                className={page === id ? 'active' : ''}
                onClick={() => changePage(id)}
              >
                <Icon size={19} />
                {label}
                {id === 'world' && state.marches.length > 0 && (
                  <small>{state.marches.length}</small>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button onClick={() => setQuestOpen(true)}>
              <BookOpen size={18} />
              成长任务{pending > 0 && <b>{pending}</b>}
            </button>
            <button onClick={openSettings}>
              <Settings size={18} />
              设置与存档
            </button>
            <div className="profile">
              <div className="avatar">
                <UserRound size={22} />
              </div>
              <div>
                <strong>{state.nickname}</strong>
                <small>
                  LV.{commanderLevel(state)} · {commanderRank(state)}档案
                </small>
              </div>
              <span className="live-dot" />
            </div>
          </div>
        </aside>
        {menu && (
          <button className="nav-scrim" aria-label="关闭导航" onClick={() => setMenu(false)} />
        )}
        <div className="workspace" inert={menu ? true : undefined}>
          <header className="topbar">
            <button
              className="mobile-menu icon-button"
              aria-label="打开导航"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <ResourceBar state={state} />
            <button
              className="ops-toggle"
              aria-label="打开基地动态"
              onClick={() => setRunningOpen(true)}
            >
              <Radio size={18} />
              <span>{Object.keys(state.jobs).length + state.marches.length}</span>
            </button>
            <button
              className="notification-button"
              aria-label="打开成长任务"
              onClick={() => setQuestOpen(true)}
            >
              <Bell size={20} />
              {pending > 0 && <i />}
            </button>
          </header>
          <div className="workspace-content">
            <main className={`main-content page-${page}`}>
              {error && (
                <div role="alert" className="error-banner">
                  {error}
                  <button onClick={() => setError('')} aria-label="关闭错误提示">
                    <X size={14} />
                  </button>
                </div>
              )}
              {page === 'base' && (
                <BaseScreen state={state} onBuilding={setBuilding} onPage={changePage} />
              )}
              {page === 'factory' && <FactoryScreen {...props} />}
              {page === 'formation' && <FormationScreen key={state.id} {...props} />}
              {page === 'campaign' && <CampaignScreen {...props} onReport={setReportId} />}
              {page === 'world' && <WorldScreen {...props} />}
              {page === 'research' && <ResearchScreen {...props} />}
              {page === 'commander' && <CommanderScreen {...props} />}
              {page === 'reports' && (
                <>
                  <PageHeading
                    eyebrow="OPERATIONS / ARCHIVE"
                    title="作战记录"
                    description="每一场战斗都有据可查。回放只重现已结算的战斗，不会再次发放奖励。"
                  >
                    <select
                      aria-label="筛选战报"
                      value={reportFilter}
                      onChange={(e) => setReportFilter(e.target.value)}
                    >
                      <option value="all">全部记录</option>
                      <option value="stage">经典战役</option>
                      <option value="world">世界战斗</option>
                      <option value="training">战术演习</option>
                    </select>
                  </PageHeading>
                  {state.reports.filter((r) => reportFilter === 'all' || r.mode === reportFilter)
                    .length === 0 ? (
                    <Empty>暂无战报。前往经典战役，打响第一战。</Empty>
                  ) : (
                    <div className="report-list">
                      {state.reports
                        .filter((r) => reportFilter === 'all' || r.mode === reportFilter)
                        .map((r) => (
                          <button key={r.id} onClick={() => setReportId(r.id)}>
                            <div className={`report-badge ${r.winner === 0 ? 'win' : ''}`}>
                              <Swords size={24} />
                            </div>
                            <div>
                              <h3>{r.title}</h3>
                              <p>
                                {new Date(r.at).toLocaleString('zh-CN')} · {r.rounds} 回合 ·{' '}
                                {r.mode === 'training'
                                  ? '演习无损'
                                  : `损失 ${r.casualties.reduce((n, c) => n + c.lost, 0)} 辆`}
                              </p>
                            </div>
                            <span className={r.winner === 0 ? 'success-text' : 'error-text'}>
                              {r.winner === 0 ? '胜利' : '失利'}
                            </span>
                            <ChevronRight size={18} />
                          </button>
                        ))}
                    </div>
                  )}
                </>
              )}
              <footer className="main-footer">
                <span>
                  <span className="live-dot" />
                  本地自动存档
                </span>
                <span>经典玩法复刻 · 原创美术与自拟平衡数值</span>
              </footer>
            </main>
            <aside className="operations">
              <div className="operations-heading">
                <span>基地动态</span>
                <Radio size={17} />
              </div>
              <div className="ops-summary">
                <span className="eyebrow">ARMY STATUS</span>
                <div>
                  <strong>
                    {number(Object.values(state.available).reduce((a, b) => a + b, 0))}
                  </strong>
                  <span>辆战车待命</span>
                </div>
                <button onClick={() => changePage('formation')}>
                  查看作战编队 <ArrowRight size={13} />
                </button>
              </div>
              <div className="queues">
                {(['building', 'research', 'production', 'repair'] as JobKind[]).map((k) => (
                  <QueueCard
                    key={k}
                    kind={k}
                    job={state.jobs[k]}
                    now={Math.max(now, state.now)}
                    onCancel={() => cancel(k)}
                    onAccelerate={() => accelerate(k)}
                  />
                ))}
              </div>
              <div className="ops-section-heading">
                远征部队 <span>{state.marches.length} / 2</span>
              </div>
              {state.marches.length === 0 ? (
                <p className="muted ops-empty">所有部队均已归营</p>
              ) : (
                state.marches.map((m) => (
                  <div className="march-card" key={m.id}>
                    <div>
                      <Flag size={14} />
                      <strong>{state.world.find((t) => t.id === m.targetId)?.name}</strong>
                      <span className="tag">
                        {{ outbound: '行军', gathering: '采集', returning: '返航' }[m.phase]}
                      </span>
                    </div>
                    <p>
                      {time(m.dueAt - Math.max(now, state.now))} · 已装载{' '}
                      {number(Object.values(m.cargo).reduce((a, b) => a + b, 0))}
                    </p>
                    {m.phase !== 'returning' && (
                      <button
                        onClick={() =>
                          setConfirmation({
                            title: '召回远征部队',
                            text: '部队将携带已采集的物资返航，抵达基地后统一入库。',
                            action: () => run({ type: 'recall', marchId: m.id }),
                          })
                        }
                      >
                        召回部队
                      </button>
                    )}
                  </div>
                ))
              )}
              <div className="ops-section-heading">指挥日志</div>
              <div className="notice-list">
                {state.notices.slice(0, 5).map((n) => (
                  <div key={n.id}>
                    <span />
                    <p>
                      {n.text}
                      <small>
                        {new Date(n.at).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </small>
                    </p>
                  </div>
                ))}
              </div>
              <button className="task-prompt" onClick={() => setQuestOpen(true)}>
                <Flag size={20} />
                <span>
                  <strong>指挥官的新征程</strong>
                  <small>{pending ? `${pending} 项奖励等待领取` : '查看成长任务与补给'}</small>
                </span>
                <ChevronRight size={16} />
              </button>
            </aside>
          </div>
        </div>
        {runningOpen && (
          <Modal title="基地动态" onClose={() => setRunningOpen(false)}>
            {(['building', 'research', 'production', 'repair'] as JobKind[]).map((k) => (
              <QueueCard
                key={k}
                kind={k}
                job={state.jobs[k]}
                now={Math.max(now, state.now)}
                onCancel={() => cancel(k)}
                onAccelerate={() => accelerate(k)}
              />
            ))}
            <h3>远征部队 {state.marches.length} / 2</h3>
            {state.marches.length === 0 ? (
              <p className="muted">所有部队均已归营</p>
            ) : (
              state.marches.map((m) => (
                <div className="march-card" key={m.id}>
                  <div>
                    <Flag size={14} />
                    <strong>{state.world.find((t) => t.id === m.targetId)?.name}</strong>
                    <span className="tag">
                      {{ outbound: '行军', gathering: '采集', returning: '返航' }[m.phase]}
                    </span>
                  </div>
                  <p>
                    {time(m.dueAt - Math.max(now, state.now))} · 已装载{' '}
                    {number(Object.values(m.cargo).reduce((a, b) => a + b, 0))}
                  </p>
                  {m.phase !== 'returning' && (
                    <button
                      onClick={() =>
                        setConfirmation({
                          title: '召回远征部队',
                          text: '部队将携带已采集的物资返航，抵达基地后统一入库。',
                          action: () => run({ type: 'recall', marchId: m.id }),
                        })
                      }
                    >
                      召回部队
                    </button>
                  )}
                </div>
              ))
            )}
          </Modal>
        )}
        {building && (
          <BuildingModal
            {...props}
            building={building}
            onSelect={setBuilding}
            onClose={() => setBuilding(undefined)}
          />
        )}
        {questOpen && <Quests {...props} onClose={() => setQuestOpen(false)} />}
        {report && (
          <BattleModal key={report.id} report={report} onClose={() => setReportId(undefined)} />
        )}
        {confirmation && (
          <Modal title={confirmation.title} onClose={() => setConfirmation(undefined)}>
            <p>{confirmation.text}</p>
            {confirmation.cost && <CostView cost={confirmation.cost} />}
            <div className="button-row end">
              <button className="secondary" onClick={() => setConfirmation(undefined)}>
                取消
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  const result = await confirmation.action();
                  if (result) setConfirmation(undefined);
                }}
              >
                确认
              </button>
            </div>
          </Modal>
        )}
        {settings && (
          <Modal title="设置与存档" onClose={() => setSettings(false)}>
            <p className="hint">
              进度保存在当前浏览器。导出文件可迁移到另一台设备；清理浏览器数据前请先备份。
              世界种子：{state.worldSeed ?? '旧档未记录'}。
            </p>
            <label className="field">
              指挥官名称
              <input value={rename} maxLength={16} onChange={(e) => setRename(e.target.value)} />
            </label>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => run({ type: 'rename', nickname: rename })}
            >
              保存名称
            </button>
            <h3>存档管理</h3>
            <div className="button-row">
              <button className="primary" onClick={exportCurrent}>
                <Download size={16} />
                导出存档
              </button>
              <button className="secondary" onClick={() => inputRef.current?.click()}>
                <Upload size={16} />
                导入存档
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => importFile(e.target.files?.[0])}
              />
            </div>
            <p className="muted">导入会创建独立档案，现有存档会保留。</p>
            <div className="save-list">
              {saves.map((s) => (
                <button
                  className={s.id === state.id ? 'active' : ''}
                  key={s.id}
                  onClick={async () => {
                    try {
                      await activate(s.id);
                      setSettings(false);
                    } catch (e) {
                      toast((e as Error).message);
                    }
                  }}
                >
                  <FolderOpen size={18} />
                  <span>
                    <strong>{s.id === state.id ? state.nickname : s.nickname}</strong>
                    <small>
                      指挥中心 {s.buildings.hq} 级 · {s.cleared.length}/12 战役
                    </small>
                  </span>
                  {s.id === state.id ? <Check size={16} /> : <ChevronRight size={16} />}
                </button>
              ))}
            </div>
            <button
              className="secondary full"
              onClick={() => {
                setNewName('归来的指挥官');
                setWorldSeed('2601001');
                setNewDialog(true);
              }}
            >
              <Plus size={16} />
              创建新的指挥官档案
            </button>
            <details>
              <summary>关于这个版本</summary>
              <p>
                这是基于早期《坦克风云》公开玩法资料独立制作的单人复刻。经典框架包括基地经营、四兵种生产、六格自动战斗与世界采集。美术为原创生成，具体数值为复刻设计。
              </p>
              <p>当前没有真实玩家对战或军团联网。规则版本：{state.ruleset}。</p>
            </details>
          </Modal>
        )}
        {newDialog && (
          <Modal title="建立新的指挥部" onClose={() => setNewDialog(false)}>
            <p className="hint">现有档案会保留。选择你的名字与地图种子。</p>
            <label className="field">
              新指挥官名称
              <input value={newName} maxLength={16} onChange={(e) => setNewName(e.target.value)} />
            </label>
            <label className="field">
              世界种子
              <input
                type="number"
                min={1}
                max={4294967295}
                value={worldSeed}
                onChange={(e) => setWorldSeed(e.target.value)}
              />
            </label>
            <button className="primary full" disabled={busy} onClick={startNew}>
              建立指挥部
            </button>
          </Modal>
        )}
        {message && (
          <div className="toast" role="status">
            <Check size={16} />
            {message}
            <button aria-label="关闭消息" onClick={() => setMessage('')}>
              <X size={14} />
            </button>
          </div>
        )}
        {busy && (
          <div className="busy-indicator">
            <LoaderCircle size={14} />
            保存中
          </div>
        )}
      </div>
    </NoticeContext.Provider>
  );
}
