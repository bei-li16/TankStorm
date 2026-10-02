import { reportBattleFrames } from '../client/diagnostics';
import { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ArmyStack, BattleReport, UnitClass } from '../core/types';
import { units } from '../core/content';
import { CostView, Modal, number } from './components';
import { TankArt } from './Art';
let audioContext: AudioContext | undefined;
function shot() {
  try {
    audioContext ??= new AudioContext();
    void audioContext.resume();
    const o = audioContext.createOscillator(),
      g = audioContext.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(85, audioContext.currentTime);
    o.frequency.exponentialRampToValueAtTime(25, audioContext.currentTime + 0.12);
    g.gain.setValueAtTime(0.08, audioContext.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
    o.connect(g);
    g.connect(audioContext.destination);
    o.start();
    o.stop(audioContext.currentTime + 0.16);
  } catch {
    /* Audio is optional. */
  }
}
export function BattleModal({ report, onClose }: { report: BattleReport; onClose: () => void }) {
  useEffect(() => {
    reportBattleFrames();
  }, [report.id]);
  const [cursor, setCursor] = useState(0),
    [speed, setSpeed] = useState(1),
    [paused, setPaused] = useState(false),
    [sound, setSound] = useState(false),
    [log, setLog] = useState(false);
  const finished = cursor >= report.events.length;
  useEffect(() => {
    if (finished || paused) return;
    const id = setInterval(
      () => setCursor((i) => Math.min(report.events.length, i + 1)),
      600 / speed,
    );
    return () => clearInterval(id);
  }, [finished, paused, speed, report.events.length]);
  useEffect(() => {
    if (sound && cursor > 0) shot();
  }, [cursor, sound]);
  const teams = useMemo(() => {
    const t = structuredClone(report.initial);
    for (const e of report.events.slice(0, cursor)) {
      const target = t[1 - e.side].find((s) => s.slot === e.to);
      if (target) target.totalHp = e.hp;
    }
    return t;
  }, [cursor, report]);
  const event = cursor ? report.events[cursor - 1] : undefined;
  const renderStack = (side: 0 | 1, slot: number) => {
    const s = teams[side].find((s) => s.slot === slot);
    const target = event && event.side !== side && event.to === slot,
      source = event && event.side === side && event.from === slot;
    return (
      <div
        key={slot}
        className={`battle-stack ${s?.totalHp ? '' : 'dead'} ${target ? 'hit' : ''} ${source ? 'firing' : ''}`}
      >
        <span className="battle-slot-number">{slot}</span>
        {s ? (
          <>
            <TankArt type={s.classId as UnitClass} tier={units[s.unitId].tier} enemy={side === 1} />
            <span className="battle-count">×{Math.ceil(s.totalHp / s.hp)}</span>
            <div className="hp-bar">
              <i style={{ width: `${(s.totalHp / (s.count * s.hp)) * 100}%` }} />
            </div>
            {target && (
              <span key={cursor} className={`damage ${event.critical ? 'critical' : ''}`}>
                {event.miss ? '闪避' : `${event.critical ? '暴击 ' : ''}−${number(event.damage)}`}
              </span>
            )}
          </>
        ) : (
          <span className="vacant">—</span>
        )}
      </div>
    );
  };
  return (
    <Modal title={report.title} onClose={onClose} wide>
      <div className="battle-toolbar">
        <span className="tag">{report.mode === 'training' ? '无损演习' : '正式战斗'}</span>
        <span>
          回合 {event?.round ?? 1} / {report.rounds}
        </span>
        <div className="battle-playback">
          <button aria-label={paused ? '继续回放' : '暂停回放'} onClick={() => setPaused(!paused)}>
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button onClick={() => setSpeed(speed === 4 ? 1 : speed * 2)}>{speed}×</button>
          <button aria-label="跳过战斗回放" onClick={() => setCursor(report.events.length)}>
            <SkipForward size={17} />
          </button>
          <button
            aria-label="重新播放"
            onClick={() => {
              setCursor(0);
              setPaused(false);
            }}
          >
            <RotateCcw size={15} />
          </button>
          <button
            aria-label={sound ? '关闭战斗音效' : '开启战斗音效'}
            onClick={() => setSound(!sound)}
          >
            {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      </div>
      <div className="battlefield">
        <div className="battle-team friendly">
          <span className="team-label">我方部队</span>
          <div className="battle-columns">
            <div>{[4, 5, 6].map((s) => renderStack(0, s))}</div>
            <div>{[1, 2, 3].map((s) => renderStack(0, s))}</div>
          </div>
        </div>
        <div className="battle-divider">
          <Swords size={24} />
          <span>VS</span>
        </div>
        <div className="battle-team hostile">
          <span className="team-label">敌方部队</span>
          <div className="battle-columns">
            <div>{[1, 2, 3].map((s) => renderStack(1, s))}</div>
            <div>{[4, 5, 6].map((s) => renderStack(1, s))}</div>
          </div>
        </div>
      </div>
      <div className="battle-event-line">
        {event
          ? `${event.side === 0 ? '我方' : '敌方'} ${event.from} 号位 → ${event.to} 号位：${event.miss ? '攻击被闪避' : `${event.critical ? '暴击，' : ''}造成 ${number(event.damage)} 点伤害`}`
          : '部队已集结，准备交火。'}
      </div>
      <div className="progress">
        <i style={{ width: `${(cursor / Math.max(1, report.events.length)) * 100}%` }} />
      </div>
      {finished && (
        <div className={`battle-result ${report.winner === 0 ? 'victory' : 'defeat'}`}>
          <Trophy size={30} />
          <div>
            <h2>{report.winner === 0 ? '战斗胜利' : '暂时受挫'}</h2>
            <p>
              {report.mode === 'training'
                ? '演习结束，战车库存保持不变。'
                : report.winner === 0
                  ? '阵地已突破。检查战损，准备下一次行动。'
                  : '修复部队、研究科技，再次向前线出发。'}
            </p>
          </div>
        </div>
      )}
      {finished && (
        <>
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>参战兵种</th>
                  <th>投入</th>
                  <th>存活</th>
                  <th>可修复</th>
                  <th>永久损失</th>
                </tr>
              </thead>
              <tbody>
                {report.casualties.map((c) => (
                  <tr key={c.unitId}>
                    <td>{units[c.unitId].name}</td>
                    <td>{c.sent}</td>
                    <td>{c.survived}</td>
                    <td>{report.mode === 'training' ? '—' : c.repairable}</td>
                    <td>{report.mode === 'training' ? '—' : c.destroyed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {Object.values(report.rewards).some((n) => n > 0) && (
            <div className="report-reward">
              <span>{report.mode === 'world' ? '装载货物 · 回城入库' : '战利品'}</span>
              <CostView cost={report.rewards} />
            </div>
          )}
          {report.growth && (
            <p className="hint">
              成长奖励：经验 +{report.growth.xp} · 声望 +{report.growth.prestige} · 统率书 +
              {report.growth.books} · 技能点 +{report.growth.skillPoints}
            </p>
          )}
        </>
      )}
      <button className="text-button" onClick={() => setLog(!log)}>
        查看战斗事件记录（{report.events.length}）<ChevronRight size={13} />
      </button>
      {log && (
        <div className="battle-log">
          {report.events.map((e, i) => (
            <p key={i}>
              [{e.round}] {e.side === 0 ? '我方' : '敌方'} {e.from} → {e.to} ·{' '}
              {e.miss ? '闪避' : `${e.critical ? '暴击 ' : ''}${e.damage} 伤害`} · 剩余{' '}
              {e.remaining} 辆
            </p>
          ))}
          <p className="muted">
            规则 {report.ruleset} · 种子 {report.seed}
          </p>
        </div>
      )}
    </Modal>
  );
}
