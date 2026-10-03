import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { X, Clock, FastForward, Square } from 'lucide-react';
import { buildingNames, resourceNames, techNames, units } from '../core/content';
import { capacity, rate } from '../core/engine';
import type { Resource } from '../core/types';
import { ResourceIcon } from './Art';
import type { Cost, GameState, Job, JobKind, Building, Technology } from '../core/types';
export const number = (n: number) =>
  n >= 100000 ? `${(n / 10000).toFixed(1)}万` : Math.floor(n).toLocaleString('zh-CN');
export function time(n: number) {
  n = Math.max(0, Math.ceil(n / 1000));
  if (n >= 3600) return `${Math.floor(n / 3600)}时 ${Math.floor((n % 3600) / 60)}分`;
  return n >= 60 ? `${Math.floor(n / 60)}分 ${n % 60}秒` : `${n}秒`;
}
export function CostView({ cost, small = false }: { cost: Cost; small?: boolean }) {
  return (
    <span className={`cost ${small ? 'small' : ''}`}>
      {Object.entries(cost)
        .filter(([, n]) => n > 0)
        .map(([r, n]) => (
          <span key={r} title={resourceNames[r as keyof typeof resourceNames]}>
            <ResourceIcon resource={r} />
            {number(n)}
          </span>
        ))}
    </span>
  );
}
export const NoticeContext = createContext('');
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const notice = useContext(NoticeContext);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      prior?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="关闭窗口">
          <X size={20} />
        </button>
      </div>
      {children}
      {notice && (
        <div className="modal-notice" role="status">
          {notice}
        </div>
      )}
    </dialog>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </header>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Square size={28} />
      <p>{children}</p>
    </div>
  );
}
export const jobNames: Record<JobKind, string> = {
  building: '建造队列',
  research: '科研队列',
  production: '生产队列',
  repair: '修复队列',
};
export function jobTitle(j: Job) {
  return j.kind === 'building'
    ? buildingNames[j.target as Building]
    : j.kind === 'research'
      ? techNames[j.target as Technology]
      : units[j.target]?.name;
}
export function QueueCard({
  job,
  kind,
  now,
  onCancel,
  onAccelerate,
}: {
  job?: Job;
  kind: JobKind;
  now: number;
  onCancel: () => void;
  onAccelerate: () => void;
}) {
  return (
    <div className={`queue-card ${job ? 'working' : ''}`}>
      <div className="card-label">
        <Clock size={14} />
        {jobNames[kind]}
        <span className="tag">{job ? '进行中' : '空闲'}</span>
      </div>
      {job ? (
        <>
          <div className="queue-title">
            {jobTitle(job)}{' '}
            {job.total > 1 && (
              <span>
                {job.completed}/{job.total}
              </span>
            )}
          </div>
          <div className="progress">
            <i
              style={{
                width: `${Math.min(100, Math.max(0, ((now - job.startedAt) / job.duration) * 100))}%`,
              }}
            />
          </div>
          <div className="queue-foot">
            <span>
              {time(job.dueAt - now)}
              {job.total > 1 ? ' / 下一辆' : ''}
            </span>
            <button title="取消未完成任务" aria-label={`取消${jobNames[kind]}`} onClick={onCancel}>
              取消
            </button>
            <button
              title="使用金币立即完成"
              aria-label={`加速${jobNames[kind]}`}
              onClick={onAccelerate}
            >
              <FastForward size={13} />
              加速
            </button>
          </div>
        </>
      ) : (
        <p className="muted">等待指挥官下达指令</p>
      )}
    </div>
  );
}
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
export function ResourceBar({ state }: { state: GameState }) {
  return (
    <div className="resource-bar">
      {Object.entries(state.wallet).map(([r, n]) => (
        <div
          className="resource-item"
          key={r}
          title={
            r === 'gold'
              ? '用于立即完成队列，可从战役和任务获取'
              : `${resourceNames[r as keyof typeof resourceNames]}：每小时 +${rate(state, r as Resource)} · 自然产出上限 ${number(capacity(state))}`
          }
          tabIndex={0}
        >
          <ResourceIcon resource={r} />
          <div>
            <small>{resourceNames[r as keyof typeof resourceNames]}</small>
            <strong>{number(n)}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}
