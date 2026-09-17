import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { useCallback } from 'react';
import { useData } from '../data/DataProvider';
import { useUi } from '../ui/UiProvider';
import type { Group } from '../types';
import { CAPACITY_CEILING } from '../lib/constants';
import { D, DOW, addDays, daysBetween, md, todayIso, weeksBetween } from '../lib/dates';
import {
  bookedByWeek,
  capacityOf,
  docState,
  fitWindow,
  isLate,
  loadFor,
  specialistColor,
  specialistsOf,
  teamWeek,
  windowOf,
} from '../lib/capacity';

const LANE_ROW_HEIGHT = 29;

interface Props {
  weekStart: string;
  /** Max stacked bar rows before collapsing into "+n more" (0 = unlimited). */
  maxRows: number;
  showCapacityFooter: boolean;
}

interface PlacedBar {
  group: Group;
  startCol: number;
  endCol: number;
}

/** One week strip: day headers, specialist lanes, booking bars, capacity footer. */
export default function WeekBand({ weekStart, maxRows, showCapacityFooter }: Props) {
  const { data, patchGroup } = useData();
  const ui = useUi();
  const weekEnd = addDays(weekStart, 6);
  const today = todayIso();

  // ---- which groups land in this week --------------------------------------
  const q = ui.search.trim().toLowerCase();
  const matches = useCallback(
    (g: Group) => {
      if (g.oeMode === 'None') return false;
      if (q && g.name.toLowerCase().indexOf(q) < 0) return false;
      const sp = g.specialists;
      if (sp.length === 0) return !ui.hidden['none'];
      return sp.some((a) => !ui.hidden[a.id]);
    },
    [q, ui.hidden],
  );

  const inWeek = data.groups
    .filter((g) => {
      const [s, e] = windowOf(g, ui.barDrag);
      return s && e && s <= weekEnd && e >= weekStart && matches(g);
    })
    .sort((a, b) => {
      const A = windowOf(a, ui.barDrag)[0];
      const B = windowOf(b, ui.barDrag)[0];
      return A < B ? -1 : A > B ? 1 : b.employees - a.employees;
    });

  let hiddenCount = 0;

  function pack(groups: Group[]): PlacedBar[][] {
    const rows: PlacedBar[][] = [];
    const occ: boolean[][] = [];
    for (const g of groups) {
      const [ds, de] = windowOf(g, ui.barDrag);
      const startCol = Math.max(0, daysBetween(weekStart, ds));
      const endCol = Math.min(6, daysBetween(weekStart, de));
      let r = 0;
      for (;;) {
        occ[r] ??= [];
        let free = true;
        for (let i = startCol; i <= endCol; i++) {
          if (occ[r][i]) {
            free = false;
            break;
          }
        }
        if (free) break;
        r++;
      }
      if (maxRows && r >= maxRows) {
        hiddenCount++;
        continue;
      }
      for (let i = startCol; i <= endCol; i++) occ[r][i] = true;
      rows[r] ??= [];
      rows[r].push({ group: g, startCol, endCol });
    }
    return rows.filter(Boolean);
  }

  // ---- lanes ---------------------------------------------------------------
  const bookedMap = bookedByWeek(data, weekStart, undefined, ui.barDrag);
  interface Lane {
    key: string;
    name: string;
    color: string;
    cap: number;
    rows: PlacedBar[][];
    booked: number;
  }
  let lanes: Lane[];
  if (!ui.lanes) {
    lanes = [{ key: '_all', name: '', color: '', cap: 0, rows: pack(inWeek), booked: 0 }];
  } else {
    const defs = specialistsOf(data)
      .filter((p) => !ui.hidden[p.id])
      .map((p) => ({
        key: p.id,
        name: p.name,
        color: specialistColor(data, p.id),
        cap: capacityOf(p, weekStart),
      }));
    if (!ui.hidden.none) {
      defs.push({ key: 'none', name: 'Unassigned', color: 'var(--color-neutral-400)', cap: 0 });
    }
    lanes = defs.map((L) => {
      const mine = inWeek.filter((g) =>
        L.key === 'none' ? g.specialists.length === 0 : g.specialists.some((a) => a.id === L.key),
      );
      const booked =
        L.key === 'none'
          ? Math.round(
              mine.reduce((t, g) => {
                const [s, e] = windowOf(g, ui.barDrag);
                return t + g.employees / Math.max(1, weeksBetween(s, e).length);
              }, 0),
            )
          : Math.round(bookedMap[L.key] ?? 0);
      return { ...L, rows: pack(mine), booked };
    });
  }

  // ---- drag / resize -------------------------------------------------------
  const startDrag = useCallback(
    (g: Group, mode: 'move' | 'start' | 'end', ev: ReactMouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      const grid = (ev.currentTarget as HTMLElement).closest('[data-daygrid]');
      const w = grid ? grid.getBoundingClientRect().width / 7 : 120;
      const x0 = ev.clientX;
      let moved = false;
      let lastDelta = 0;
      const onMove = (e: globalThis.MouseEvent) => {
        const delta = Math.round((e.clientX - x0) / w);
        if (Math.abs(e.clientX - x0) > 3) moved = true;
        if (delta !== lastDelta) {
          lastDelta = delta;
          ui.setBarDrag({ gid: g.id, mode, delta });
        }
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        if (moved && lastDelta !== 0) {
          const [s, e] = windowOf(g, { gid: g.id, mode, delta: lastDelta });
          patchGroup(g.id, {
            oeStart: s,
            oeEnd: e,
            status: g.status === 'Not scheduled' ? 'Scheduled' : g.status,
          });
        }
        ui.setBarDrag(null);
        suppressClick.current = moved;
        window.setTimeout(() => {
          suppressClick.current = false;
        }, 60);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [ui, patchGroup],
  );

  // ---- day columns ---------------------------------------------------------
  const dragGroup = ui.dragChip ? data.groups.find((x) => x.id === ui.dragChip) : undefined;
  let dragTint: string | null = null;
  if (dragGroup) {
    const f = fitWindow(data, dragGroup, weekStart, addDays(weekStart, 13));
    dragTint =
      f.past || f.over
        ? 'color-mix(in srgb,var(--color-accent) 16%,transparent)'
        : f.tight
          ? 'color-mix(in srgb,#e8a13a 20%,transparent)'
          : 'color-mix(in srgb,var(--color-open) 13%,transparent)';
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(weekStart, i);
    const d = D(iso);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    return {
      iso,
      i,
      dow: DOW[d.getDay()],
      num: d.getDate(),
      weekend,
      isToday: iso === today,
      closeout: data.closeouts[d.getMonth() + 1] === d.getDate(),
    };
  });

  const team = teamWeek(data, weekStart, undefined, ui.barDrag);

  const laneColStyle: CSSProperties = {
    width: 174,
    flex: 'none',
    display: ui.lanes ? 'block' : 'none',
    borderRight: '1px solid var(--color-divider)',
  };

  return (
    <div style={{ borderTop: '1px solid var(--color-divider)' }}>
      <div style={{ display: 'flex' }}>
        <div
          style={{
            width: 104,
            flex: 'none',
            padding: '10px 12px',
            borderRight: '1px solid var(--color-divider)',
            font: '600 11.5px/1.35 var(--font-heading)',
            color: 'var(--color-muted)',
          }}
        >
          <div>Wk of {md(weekStart)}</div>
          <div
            style={{
              font: '600 17px/1.15 var(--font-heading)',
              letterSpacing: '-.02em',
              marginTop: 6,
              whiteSpace: 'nowrap',
              color:
                team.pct > 1
                  ? 'var(--color-accent-700)'
                  : team.pct >= CAPACITY_CEILING
                    ? 'var(--color-accent-600)'
                    : 'var(--color-text)',
            }}
          >
            {team.booked} of {team.cap}
          </div>
          <div
            style={{
              height: 4,
              background: 'color-mix(in srgb,var(--color-text) 12%,transparent)',
              marginTop: 3,
            }}
          >
            <div
              style={{
                height: 4,
                borderRadius: 2,
                width: `${Math.min(100, team.pct * 100)}%`,
                background: team.pct > 1 ? 'var(--color-accent)' : 'var(--color-text)',
              }}
            />
          </div>
          <div style={{ font: '400 9.5px/1.3 var(--font-body)', marginTop: 4 }}>
            employees booked
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* day headers */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--color-divider)',
              position: 'sticky',
              top: 0,
              background: 'var(--color-bg)',
              zIndex: 12,
            }}
          >
            <div style={laneColStyle} />
            <div
              style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}
            >
              {days.map((day) => (
                <div
                  key={day.iso}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 2,
                    padding: '8px 10px 7px',
                    borderLeft: day.i
                      ? '1px solid color-mix(in srgb,var(--color-text) 8%,transparent)'
                      : 'none',
                    background: day.weekend
                      ? 'color-mix(in srgb,var(--color-text) 3%,transparent)'
                      : 'transparent',
                  }}
                >
                  <span style={{ font: '600 11.5px/1 var(--font-heading)', color: 'var(--color-muted)' }}>
                    {day.dow}
                  </span>
                  <span
                    style={
                      day.isToday
                        ? {
                            font: '600 14px/24px var(--font-heading)',
                            minWidth: 24,
                            height: 24,
                            textAlign: 'center',
                            borderRadius: '50%',
                            background: 'var(--color-accent)',
                            color: '#fff',
                          }
                        : { font: '600 18px/24px var(--font-heading)', letterSpacing: '-.02em' }
                    }
                  >
                    {day.num}
                  </span>
                  {day.closeout && (
                    <span
                      style={{
                        font: '600 10px/1 var(--font-heading)',
                        color: 'var(--color-accent)',
                        border: '1px solid var(--color-accent-300)',
                        borderRadius: 5,
                        padding: '2px 5px',
                      }}
                    >
                      eNav closeout
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* lanes + bars */}
          <div style={{ display: 'flex' }}>
            <div style={laneColStyle}>
              {ui.lanes &&
                lanes.map((L, li) => {
                  const pct = L.cap ? L.booked / L.cap : 0;
                  const h = Math.max(1, L.rows.length) * LANE_ROW_HEIGHT + 10;
                  return (
                    <div
                      key={L.key}
                      style={{
                        height: h,
                        boxSizing: 'border-box',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 7,
                        padding: '7px 10px 0',
                        borderTop: li ? '1px solid var(--color-divider)' : 'none',
                      }}
                    >
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 3,
                          flex: 'none',
                          background: L.color,
                          display: 'block',
                          marginTop: 4,
                        }}
                      />
                      <span
                        style={{
                          font: '600 12px/1.35 var(--font-heading)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {L.name}
                      </span>
                      <span style={{ flex: 1 }} />
                      <span
                        style={{
                          fontSize: 10.5,
                          whiteSpace: 'nowrap',
                          fontWeight: pct >= CAPACITY_CEILING ? 600 : 400,
                          color:
                            pct > 1
                              ? 'var(--color-accent-700)'
                              : pct >= CAPACITY_CEILING
                                ? 'var(--color-accent-600)'
                                : 'var(--color-muted)',
                        }}
                      >
                        {L.cap ? `${L.booked} of ${L.cap}` : L.booked ? `${L.booked} ee` : ''}
                      </span>
                    </div>
                  );
                })}
            </div>

            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              {/* droppable day columns */}
              <div
                data-daygrid
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7,1fr)',
                  zIndex: 0,
                }}
              >
                {days.map((day) => (
                  <div
                    key={day.iso}
                    onClick={() =>
                      ui.setDraft({
                        name: '',
                        employees: '',
                        type: 'Renewal',
                        effective: '',
                        format: 'Virtual',
                        managerId: '',
                        guideId: '',
                        prefillStart: day.iso,
                      })
                    }
                    onDragOver={(e) => {
                      e.preventDefault();
                      try {
                        e.dataTransfer.dropEffect = 'move';
                      } catch {
                        /* ignore */
                      }
                      if (ui.dragChip && ui.dropIso !== day.iso) ui.setDropIso(day.iso);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const gid = ui.dragChip;
                      ui.setDropIso(null);
                      ui.setDragChip(null);
                      if (gid) {
                        const g = data.groups.find((x) => x.id === gid);
                        const len = g?.oeStart && g?.oeEnd ? weeksBetween(g.oeStart, g.oeEnd).length : 2;
                        ui.setSched({ gid, len, start: weekStart });
                        ui.setPop(null);
                        ui.setDraft(null);
                      }
                    }}
                    style={{
                      borderLeft: day.i
                        ? '1px solid color-mix(in srgb,var(--color-text) 6%,transparent)'
                        : 'none',
                      background: day.weekend
                        ? 'color-mix(in srgb,var(--color-text) 3%,transparent)'
                        : 'transparent',
                      borderRight: day.closeout ? '2px dashed var(--color-accent-300)' : 'none',
                      cursor: 'copy',
                      boxShadow: ui.dropIso === day.iso ? 'inset 0 0 0 2px var(--color-text)' : 'none',
                      backgroundImage: dragTint ? `linear-gradient(0deg,${dragTint},${dragTint})` : 'none',
                    }}
                  />
                ))}
              </div>

              <div style={{ position: 'relative', zIndex: 1, pointerEvents: 'none' }}>
                {lanes.map((L, li) => {
                  const h = ui.lanes
                    ? Math.max(1, L.rows.length) * LANE_ROW_HEIGHT + 10
                    : undefined;
                  return (
                    <div
                      key={L.key}
                      style={
                        ui.lanes
                          ? {
                              height: h,
                              boxSizing: 'border-box',
                              padding: '5px 0 0',
                              borderTop: li ? '1px solid var(--color-divider)' : 'none',
                            }
                          : { padding: '5px 0', minHeight: 56 }
                      }
                    >
                      {L.rows.map((row, ri) => (
                        <div
                          key={ri}
                          data-daygrid
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(7,1fr)',
                            marginBottom: 3,
                          }}
                        >
                          {row.map((bar) => (
                            <BookingBar
                              key={bar.group.id}
                              bar={bar}
                              weekStart={weekStart}
                              weekEnd={weekEnd}
                              onDown={startDrag}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })}
                {hiddenCount > 0 && (
                  <button
                    onClick={() => {
                      ui.setView('week');
                      ui.setAnchor(weekStart);
                    }}
                    style={{
                      border: 0,
                      background: 'transparent',
                      color: 'var(--color-accent)',
                      font: '600 11.5px/1 var(--font-heading)',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      pointerEvents: 'auto',
                    }}
                  >
                    +{hiddenCount} more
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* per-specialist capacity footer */}
          {showCapacityFooter && (
            <CapacityFooter weekStart={weekStart} />
          )}
        </div>
      </div>
    </div>
  );
}

const suppressClick = { current: false };

function BookingBar({
  bar,
  weekStart,
  weekEnd,
  onDown,
}: {
  bar: PlacedBar;
  weekStart: string;
  weekEnd: string;
  onDown: (g: Group, mode: 'move' | 'start' | 'end', ev: ReactMouseEvent) => void;
}) {
  const { data } = useData();
  const ui = useUi();
  const g = bar.group;
  const [ds, de] = windowOf(g, ui.barDrag);
  const sp = g.specialists;
  const cols = sp.map((a) => specialistColor(data, a.id));

  let background = '';
  let color = '#fff';
  let border = '1px solid transparent';
  if (!sp.length) {
    background = 'var(--color-neutral-200)';
    color = 'var(--color-neutral-900)';
    border = '1px dashed var(--color-neutral-400)';
  } else if (cols.length === 1) {
    background = cols[0];
  } else {
    const tot = sp.reduce((t, a) => t + (Number(a.share) || 0), 0) || sp.length;
    let acc = 0;
    const stops: string[] = [];
    sp.forEach((a, i) => {
      const w = ((Number(a.share) || 0) || 1) / tot * 100;
      stops.push(`${cols[i]} ${acc}%`, `${cols[i]} ${acc + w}%`);
      acc += w;
    });
    background = `linear-gradient(90deg,${stops.join(',')})`;
  }

  const contL = ds < weekStart;
  const contR = de > weekEnd;
  const dragging = ui.barDrag?.gid === g.id;
  const late = isLate(data, g, ui.barDrag);
  const asaOut = docState(g) === 'asa';

  return (
    <div
      onMouseDown={(e) => {
        if (e.button === 0) onDown(g, 'move', e);
      }}
      onClick={(e) => {
        if (suppressClick.current) return;
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        ui.setPop({ gid: g.id, x: r.left, y: r.bottom + 6, ay: r.top });
      }}
      style={{
        gridColumn: `${bar.startCol + 1} / span ${bar.endCol - bar.startCol + 1}`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 9px',
        height: 26,
        background,
        color,
        border,
        cursor: dragging ? 'grabbing' : 'grab',
        margin: '0 2px',
        overflow: 'hidden',
        borderRadius: 8,
        boxShadow: dragging ? 'var(--shadow-md)' : 'none',
        opacity: dragging ? 0.85 : 1,
        userSelect: 'none',
        pointerEvents: 'auto',
      }}
    >
      {!contL && (
        <span
          onMouseDown={(e) => onDown(g, 'start', e)}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }}
        />
      )}
      {contL && <span style={{ font: '600 12px/1 var(--font-heading)', opacity: 0.8 }}>‹</span>}
      <span
        style={{
          font: '600 11.5px/1 var(--font-heading)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {contL ? `${g.name} (cont.)` : g.name}
      </span>
      {!contL && (
        <span style={{ fontSize: 11.5, opacity: 0.85, whiteSpace: 'nowrap' }}>{g.employees} ee</span>
      )}
      <span style={{ flex: 1 }} />
      {late && (
        <span
          title="Ends past the eNav closeout"
          style={{
            font: '600 9px/1 var(--font-heading)',
            color: sp.length ? '#fff' : 'var(--color-accent-700)',
          }}
        >
          ▲
        </span>
      )}
      {asaOut && (
        <span
          title="ASA outstanding"
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--color-accent)',
            boxShadow: '0 0 0 1.5px rgba(255,255,255,.75)',
          }}
        />
      )}
      {contR && <span style={{ font: '600 12px/1 var(--font-heading)', opacity: 0.8 }}>›</span>}
      {!contR && (
        <span
          onMouseDown={(e) => onDown(g, 'end', e)}
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }}
        />
      )}
    </div>
  );
}

function CapacityFooter({ weekStart }: { weekStart: string }) {
  const { data } = useData();
  const ui = useUi();
  const m = bookedByWeek(data, weekStart, undefined, ui.barDrag);
  const rows = specialistsOf(data).filter((p) => !ui.hidden[p.id]);
  if (!rows.length) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        borderTop: '1px solid var(--color-divider)',
        background: 'color-mix(in srgb,var(--color-text) 3%,transparent)',
      }}
    >
      {rows.map((p) => {
        const booked = Math.round(m[p.id] ?? 0);
        const cap = capacityOf(p, weekStart);
        const pct = cap ? booked / cap : 0;
        const over = pct > 1;
        const near = pct >= CAPACITY_CEILING && !over;
        return (
          <div
            key={p.id}
            style={{
              flex: '1 1 130px',
              minWidth: 120,
              padding: '8px 12px',
              borderRight: '1px solid color-mix(in srgb,var(--color-text) 8%,transparent)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  flex: 'none',
                  background: specialistColor(data, p.id),
                  display: 'inline-block',
                  borderRadius: 3,
                }}
              />
              <span style={{ font: '600 11px/1.2 var(--font-heading)' }}>{p.name}</span>
              <span
                style={{
                  font: '600 12px/1.2 var(--font-heading)',
                  color: over
                    ? 'var(--color-accent-700)'
                    : near
                      ? 'var(--color-accent-600)'
                      : 'var(--color-muted)',
                }}
              >
                {booked} of {cap}
              </span>
            </div>
            <div
              style={{
                height: 4,
                background: 'color-mix(in srgb,var(--color-text) 12%,transparent)',
                marginTop: 5,
              }}
            >
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  width: `${Math.min(100, pct * 100)}%`,
                  background: over
                    ? 'var(--color-accent)'
                    : near
                      ? 'var(--color-accent-500)'
                      : specialistColor(data, p.id),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { loadFor };
