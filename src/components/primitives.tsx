import type { CSSProperties, ReactNode } from 'react';
import type { Anchored } from '../ui/UiProvider';

export type TagKind = 'bad' | 'warn' | 'ok' | 'none';

/** Pill used for doc status, guide status and group status. */
export function tagStyle(kind: TagKind): CSSProperties {
  return {
    display: 'inline-block',
    font: '600 11.5px/1 var(--font-heading)',
    padding: '5px 10px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
    background:
      kind === 'bad'
        ? 'var(--color-accent)'
        : kind === 'warn'
          ? 'var(--color-accent-200)'
          : kind === 'ok'
            ? 'color-mix(in srgb,var(--color-text) 10%,transparent)'
            : 'transparent',
    color:
      kind === 'bad'
        ? 'var(--color-bg)'
        : kind === 'warn'
          ? 'var(--color-accent-900)'
          : 'var(--color-text)',
    border: kind === 'none' ? '1px solid var(--color-divider)' : 0,
  };
}

export function Tag({ kind, children }: { kind: TagKind; children: ReactNode }) {
  return <span style={tagStyle(kind)}>{children}</span>;
}

/** Segmented-control button style. */
export function segStyle(on: boolean): CSSProperties {
  return {
    border: 0,
    borderRadius: 8,
    padding: '6px 13px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    font: '600 12.5px/1 var(--font-heading)',
    background: on ? '#fff' : 'transparent',
    color: on ? 'var(--color-text)' : 'var(--color-muted)',
    boxShadow: on ? 'var(--shadow-sm)' : 'none',
  };
}

export function Segmented({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        background: 'var(--color-neutral-200)',
        borderRadius: 10,
        padding: 3,
      }}
    >
      {children}
    </div>
  );
}

/** Accent checkbox used across the guide / plan checklists. */
export function CheckBox({
  on,
  onClick,
  size = 18,
  accent = true,
  title,
}: {
  on: boolean;
  onClick: () => void;
  size?: number;
  accent?: boolean;
  title?: string;
}) {
  const active = accent ? 'var(--color-accent)' : 'var(--color-text)';
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        flex: 'none',
        cursor: 'pointer',
        padding: 0,
        lineHeight: `${size - 2}px`,
        textAlign: 'center',
        fontSize: 12,
        border: `1.5px solid ${on ? active : 'var(--color-neutral-400)'}`,
        borderRadius: 5,
        background: on ? active : '#fff',
        color: '#fff',
      }}
    >
      {on ? '✓' : ''}
    </button>
  );
}

/** Outlined pill toggle ("By specialist", "My groups"). */
export function pillToggleStyle(on: boolean): CSSProperties {
  return {
    border: `1px solid ${on ? 'var(--color-text)' : 'var(--color-divider)'}`,
    borderRadius: 999,
    padding: '8px 15px',
    cursor: 'pointer',
    font: '600 12.5px/1 var(--font-heading)',
    whiteSpace: 'nowrap',
    background: on ? 'var(--color-text)' : '#fff',
    color: on ? '#fff' : 'var(--color-text)',
  };
}

export function cardStyle(): CSSProperties {
  return {
    background: '#fff',
    border: '1px solid var(--color-divider)',
    borderRadius: 16,
    padding: 18,
    boxShadow: 'var(--shadow-sm)',
  };
}

/**
 * Position a popover under its anchor, flipping above when there is not enough
 * room below. Mirrors the mockup's anchorSt().
 */
export function anchorStyle(a: Anchored, width: number, min: number): CSSProperties {
  const vh = window.innerHeight;
  const below = vh - a.y - 12;
  const above = (a.ay || a.y) - 18;
  const flip = below < min && above > below;
  return flip
    ? {
        position: 'fixed',
        bottom: vh - (a.ay || a.y) + 6,
        maxHeight: Math.max(120, above),
        overflowY: 'auto',
        width,
      }
    : {
        position: 'fixed',
        top: Math.max(12, a.y),
        maxHeight: Math.max(120, below),
        overflowY: 'auto',
        width,
      };
}

export function SectionHeading({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <h6 style={style}>{children}</h6>;
}
