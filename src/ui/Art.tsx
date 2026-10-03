import { useId } from 'react';
import type { UnitClass } from '../core/types';
export function TankArt({
  type = 'tank',
  tier = 1,
  enemy = false,
  className = '',
}: {
  type?: UnitClass;
  tier?: number;
  enemy?: boolean;
  className?: string;
}) {
  const id = useId().replaceAll(':', '');
  const body = enemy ? '#94775a' : tier === 3 ? '#9d9470' : tier === 2 ? '#7d8970' : '#75876b';
  return (
    <svg
      className={`tank-art ${className}`}
      viewBox="0 0 160 100"
      role="img"
      aria-label={`${enemy ? '敌方' : ''}${{ tank: '坦克', tank_destroyer: '歼击车', spg: '自行火炮', rocket: '火箭车' }[type]}`}
    >
      <defs>
        <linearGradient id={id} x2="0.2" y2="1">
          <stop stopColor="#c0c6a1" />
          <stop offset=".45" stopColor={body} />
          <stop offset="1" stopColor="#3c4a39" />
        </linearGradient>
        <filter id={`${id}s`}>
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity=".6" />
        </filter>
      </defs>
      <ellipse cx="78" cy="79" rx="65" ry="12" fill="#090d0b" opacity=".35" />
      <g filter={`url(#${id}s)`}>
        <path
          d="M23 39 111 34 132 51 123 77 33 83 16 65Z"
          fill="#222922"
          stroke="#121a13"
          strokeWidth="3"
        />
        {[28, 43, 58, 73, 88, 103, 117].map((x, i) => (
          <g key={x}>
            <circle
              cx={x}
              cy={67 - i * 0.45}
              r="9"
              fill="#50584a"
              stroke="#151d16"
              strokeWidth="3"
            />
            <circle cx={x} cy={67 - i * 0.45} r="3" fill="#a0a68a" />
          </g>
        ))}
        <path
          d="M18 46 99 29 134 42 127 57 42 72 17 61Z"
          fill={`url(#${id})`}
          stroke="#374332"
          strokeWidth="2"
        />
        <path d="M24 43 97 26 127 38 42 59Z" fill={body} stroke="#b2b59b" strokeWidth="1.3" />
        <path d="M44 61 128 42 127 51 44 70Z" fill="#47553e" />
        <path d="M29 46 43 49 99 34 87 30Z" fill="#293529" opacity=".7" />
        {type === 'rocket' ? (
          <g transform="translate(57 12) rotate(-12)">
            <path d="M-9 18 33 10 57 26 16 36Z" fill="#374c35" />
            {[0, 1, 2].map((row) =>
              [0, 1, 2, 3].map((col) => (
                <g key={`${row}${col}`}>
                  <path
                    d={`M${col * 8} ${row * 8 + 2} l29 -9 5 5 -29 9Z`}
                    fill="#829171"
                    stroke="#283727"
                  />
                  <ellipse
                    cx={col * 8 + 2}
                    cy={row * 8 + 5}
                    rx="3"
                    ry="4"
                    fill="#171e16"
                    stroke="#bfbd95"
                  />
                </g>
              )),
            )}
          </g>
        ) : (
          <>
            <path
              d={
                type === 'tank'
                  ? 'M48 36 74 27 100 35 93 49 66 55 45 45Z'
                  : type === 'tank_destroyer'
                    ? 'M40 41 68 25 99 33 104 44 61 57Z'
                    : 'M48 35 67 21 103 30 102 46 65 56 47 46Z'
              }
              fill={`url(#${id})`}
              stroke="#b0b398"
              strokeWidth="1.1"
            />
            <ellipse cx="71" cy="36" rx="10" ry="6" fill="#607456" stroke="#bac2a0" />
            <path
              d={`M${type === 'spg' ? 88 : 88} 39 L${type === 'tank' ? 144 : 155} ${type === 'spg' ? 8 : 27}`}
              stroke="#2d3c2c"
              strokeWidth={type === 'spg' ? 11 : 8}
            />
            <path
              d={`M88 37 L${type === 'tank' ? 144 : 155} ${type === 'spg' ? 6 : 25}`}
              stroke="#a5aa89"
              strokeWidth={type === 'spg' ? 5 : 3}
            />
            {type === 'spg' && <path d="m143 4 14-3 3 10-13 4Z" fill="#637157" stroke="#c0bd96" />}
          </>
        )}
        <path d="M53 37 54 12" stroke="#373c2c" strokeWidth="1" />
        <path d="M29 57 35 56M115 40 121 39" stroke="#f7db8c" strokeWidth="4" />
        <path d="m69 44 4-1 1 3-4 1Z" fill={enemy ? '#ec9e80' : '#ded6b0'} />
      </g>
    </svg>
  );
}
export function ResourceIcon({ resource }: { resource: string }) {
  return (
    <span className={`resource-icon ${resource}`} aria-hidden="true">
      {{ iron: '⬡', oil: '◕', lead: '▰', titanium: '◇', crystal: '◆', gold: '✦' }[resource] ?? '▣'}
    </span>
  );
}
