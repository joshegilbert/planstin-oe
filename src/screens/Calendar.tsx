import { useMemo } from 'react';
import { useData } from '../data/DataProvider';
import { useUi } from '../ui/UiProvider';
import WeekBand from '../components/WeekBand';
import { pillToggleStyle, segStyle, Segmented } from '../components/primitives';
import { CAPACITY_CEILING } from '../lib/constants';
import { D, DOW, ISO, MON, MONL, addDays, md, sow, todayIso, weeksBetween } from '../lib/dates';
import {
  deadlineOf,
  specialistColor,
  specialistsOf,
  suggestOpening,
  teamWeek,
  windowOf,
} from '../lib/capacity';
import type { CalendarView } from '../types';

export default function CalendarScreen() {
  const { data } = useData();
  const ui = useUi();
  const today = todayIso();

  const monthAnchor = useMemo(() => {
    const d = D(addDays(ui.anchor, 10));
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, [ui.anchor]);

  const weekStarts = useMemo(() => {
    const out: string[] = [];
    if (ui.view === 'month') {
      let w = sow(ISO(monthAnchor));
      for (let i = 0; i < 6; i++) {
        out.push(w);
        w = addDays(w, 7);
      }
    } else {
      let w = ui.anchor;
      const n = ui.view === 'week' ? 1 : 2;
      for (let i = 0; i < n; i++) {
        out.push(w);
        w = addDays(w, 7);
      }
    }
    return out;
  }, [ui.view, ui.anchor, monthAnchor]);

  const rangeLabel = useMemo(() => {
    if (ui.view === 'month') return `${MONL[monthAnchor.getMonth()]} ${monthAnchor.getFullYear()}`;
    const n = ui.view === 'week' ? 1 : 2;
    const a = D(ui.anchor);
    const b = D(addDays(ui.anchor, 7 * n - 1));
    const crossMonth = a.getMonth() !== b.getMonth() ? `${MON[b.getMonth()]} ` : '';
    return `${MON[a.getMonth()]} ${a.getDate()} – ${crossMonth}${b.getDate()}, ${b.getFullYear()}`;
  }, [ui.view, ui.anchor, monthAnchor]);

  function page(n: number) {
    if (ui.view === 'month') {
      const t = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + n, 1);
      ui.setAnchor(sow(ISO(t)));
    } else {
      ui.setAnchor(addDays(ui.anchor, 7 * n * (ui.view === 'week' ? 1 : 2)));
    }
  }

  const showCapacityFooter = ui.view !== 'month' && !ui.lanes;
  const teamWeeks = weekStarts.map((w) => ({ w, t: teamWeek(data, w, undefined, ui.barDrag) }));
  const peak = teamWeeks.reduce(
    (a, x) => (x.t.pct > a.t.pct ? x : a),
    teamWeeks[0] ?? { w: '', t: { pct: 0, booked: 0, cap: 0 } },
  );
  const todayWeek = sow(today);

  const tone = (p: number) =>
    p > 1
      ? 'var(--color-accent-700)'
      : p >= CAPACITY_CEILING
        ? 'var(--color-accent-600)'
        : 'var(--color-open)';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '252px 1fr',
        minHeight: 'calc(100vh - 58px)',
      }}
    >
      <Sidebar />

      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 18px',
            borderBottom: '1px solid var(--color-divider)',
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={() => ui.setAnchor(sow(today))}
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            Today
          </button>
          <div style={{ display: 'flex' }}>
            <button
              onClick={() => page(-1)}
              style={{
                width: 32,
                height: 32,
                border: '1px solid var(--color-divider)',
                borderRadius: '9px 0 0 9px',
                background: '#fff',
                cursor: 'pointer',
                fontSize: 15,
                color: 'var(--color-text)',
              }}
            >
              ‹
            </button>
            <button
              onClick={() => page(1)}
              style={{
                width: 32,
                height: 32,
                border: '1px solid var(--color-divider)',
                borderLeft: 0,
                borderRadius: '0 9px 9px 0',
                background: '#fff',
                cursor: 'pointer',
                fontSize: 15,
                color: 'var(--color-text)',
              }}
            >
              ›
            </button>
          </div>
          <div
            style={{
              font: '600 23px/1 var(--font-heading)',
              letterSpacing: '-.02em',
              whiteSpace: 'nowrap',
              marginLeft: 4,
            }}
          >
            {rangeLabel}
          </div>
          <div style={{ flex: 1 }} />
          <input
            className="input"
            placeholder="Search groups"
            value={ui.search}
            onChange={(e) => ui.setSearch(e.target.value)}
            style={{ width: 190 }}
          />
          <button onClick={() => ui.setLanes(!ui.lanes)} style={pillToggleStyle(ui.lanes)}>
            By specialist
          </button>
          <Segmented>
            {(
              [
                ['week', 'Week'],
                ['2week', '2-Week'],
                ['month', 'Month'],
              ] as Array<[CalendarView, string]>
            ).map(([v, label]) => (
              <button key={v} onClick={() => ui.setView(v)} style={segStyle(ui.view === v)}>
                {label}
              </button>
            ))}
          </Segmented>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 26,
            padding: '11px 18px 13px',
            borderBottom: '1px solid var(--color-divider)',
            background: 'color-mix(in srgb,var(--color-text) 3%,transparent)',
          }}
        >
          <div style={{ flex: 'none', width: 150 }}>
            <div style={{ font: '600 12px/1 var(--font-heading)' }}>Team capacity</div>
            {teamWeeks.length > 1 && (
              <div
                style={{
                  font: '500 11.5px/1.3 var(--font-heading)',
                  marginTop: 3,
                  color:
                    peak.t.pct >= CAPACITY_CEILING
                      ? 'var(--color-accent-700)'
                      : 'color-mix(in srgb,var(--color-text) 50%,transparent)',
                }}
              >
                Busiest week of {md(peak.w)} — {peak.t.booked} of {peak.t.cap}
              </div>
            )}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.max(1, teamWeeks.length)},minmax(0,1fr))`,
              gap: 18,
              flex: 1,
              minWidth: 0,
            }}
          >
            {teamWeeks.map((x) => {
              const c = tone(x.t.pct);
              const isNow = x.w === todayWeek;
              return (
                <div key={x.w} style={{ minWidth: 0 }}>
                  <div
                    style={{
                      font: `${isNow ? 700 : 600} 10.5px/1 var(--font-heading)`,
                      letterSpacing: '.04em',
                      textTransform: 'uppercase',
                      color: isNow
                        ? 'var(--color-text)'
                        : 'color-mix(in srgb,var(--color-text) 45%,transparent)',
                    }}
                  >
                    {md(x.w)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 5 }}>
                    <span
                      style={{
                        font: '600 14px/1 var(--font-heading)',
                        letterSpacing: '-.02em',
                        color: x.t.booked ? c : 'color-mix(in srgb,var(--color-text) 35%,transparent)',
                      }}
                    >
                      {x.t.booked}
                    </span>
                    <span
                      style={{
                        font: '500 11px/1 var(--font-heading)',
                        color: 'color-mix(in srgb,var(--color-text) 40%,transparent)',
                      }}
                    >
                      / {x.t.cap}
                    </span>
                  </div>
                  <span
                    style={{
                      display: 'block',
                      height: 4,
                      borderRadius: 2,
                      marginTop: 7,
                      background: 'color-mix(in srgb,var(--color-text) 9%,transparent)',
                      overflow: 'hidden',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        height: 4,
                        borderRadius: 2,
                        width: `${Math.max(x.t.booked ? 2 : 0, Math.min(100, x.t.pct * 100))}%`,
                        background: c,
                      }}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {weekStarts.map((w) => (
            <WeekBand
              key={w}
              weekStart={w}
              maxRows={ui.view === 'month' ? 3 : 0}
              showCapacityFooter={showCapacityFooter}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Sidebar() {
  const { data } = useData();
  const ui = useUi();
  const today = todayIso();

  const monthAnchor = useMemo(() => {
    const d =
      ui.view === 'month' ? D(addDays(ui.anchor, 10)) : D(addDays(ui.anchor, 3));
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, [ui.view, ui.anchor]);

  const activeDays = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const g of data.groups) {
      const [s, e] = windowOf(g, null);
      if (!s) continue;
      let c = s;
      let guard = 0;
      while (c <= e && guard++ < 400) {
        map[c] = true;
        c = addDays(c, 1);
      }
    }
    return map;
  }, [data.groups]);

  const gridStart = sow(ISO(monthAnchor));
  const miniDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const unscheduled = useMemo(() => {
    const list = data.groups
      .filter((g) => !g.oeStart && g.oeMode !== 'None')
      .map((g) => ({ g, dl: deadlineOf(data, g) }))
      .sort((a, b) => ((a.dl ?? '9999') < (b.dl ?? '9999') ? -1 : 1));
    const reserve: Record<string, Record<string, number>> = {};
    return list.map((x) => ({ ...x, fit: suggestOpening(data, x.g, reserve) }));
  }, [data]);

  return (
    <div
      style={{
        borderRight: '1px solid var(--color-divider)',
        background: 'var(--color-neutral-100)',
        padding: '18px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        maxHeight: 'calc(100vh - 58px)',
        overflowY: 'auto',
      }}
    >
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <div style={{ font: '600 12px/1 var(--font-heading)' }}>
            {MONL[monthAnchor.getMonth()]} {monthAnchor.getFullYear()}
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <button
              onClick={() =>
                ui.setAnchor(
                  sow(ISO(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))),
                )
              }
              style={miniNavStyle}
            >
              ‹
            </button>
            <button
              onClick={() =>
                ui.setAnchor(
                  sow(ISO(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))),
                )
              }
              style={miniNavStyle}
            >
              ›
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1 }}>
          {DOW.map((d) => (
            <div
              key={d}
              style={{
                textAlign: 'center',
                font: '600 9px/18px var(--font-heading)',
                color: 'color-mix(in srgb,var(--color-text) 45%,transparent)',
              }}
            >
              {d[0]}
            </div>
          ))}
          {miniDays.map((iso) => {
            const dt = D(iso);
            const inMonth = dt.getMonth() === monthAnchor.getMonth();
            const isToday = iso === today;
            const selected = ui.view !== 'month' && sow(iso) === ui.anchor;
            const busy = activeDays[iso];
            return (
              <button
                key={iso}
                onClick={() => ui.setAnchor(sow(iso))}
                style={{
                  border: 0,
                  cursor: 'pointer',
                  padding: 0,
                  height: 26,
                  borderRadius: 8,
                  font: `${busy ? 800 : 400} 11px/24px var(--font-body)`,
                  color: !inMonth
                    ? 'color-mix(in srgb,var(--color-text) 28%,transparent)'
                    : isToday
                      ? 'var(--color-bg)'
                      : 'var(--color-text)',
                  background: isToday
                    ? 'var(--color-accent)'
                    : selected
                      ? 'color-mix(in srgb,var(--color-text) 10%,transparent)'
                      : 'transparent',
                  backgroundImage:
                    busy && inMonth && !isToday
                      ? 'radial-gradient(circle at 50% calc(100% - 3.5px),var(--color-neutral-400) 1.7px,transparent 1.8px)'
                      : 'none',
                }}
              >
                {dt.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ font: '600 11.5px/1 var(--font-heading)', marginBottom: 8 }}>Specialists</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {specialistsOf(data).map((p) => {
            const on = !ui.hidden[p.id];
            const c = specialistColor(data, p.id);
            return (
              <button
                key={p.id}
                onClick={() => ui.setHidden({ ...ui.hidden, [p.id]: on })}
                style={specRowStyle}
              >
                <span style={swatch(on, c, false)}>{on ? '✓' : ''}</span>
                <span style={specNameStyle(on)}>{p.name}</span>
                <span style={{ flex: 1 }} />
                <span
                  style={{ fontSize: 11, color: 'color-mix(in srgb,var(--color-text) 45%,transparent)' }}
                >
                  {p.capacity ?? 0} /wk
                </span>
              </button>
            );
          })}
          <button
            onClick={() => ui.setHidden({ ...ui.hidden, none: !ui.hidden.none })}
            style={specRowStyle}
          >
            <span style={swatch(!ui.hidden.none, 'var(--color-neutral-400)', true)}>
              {!ui.hidden.none ? '✓' : ''}
            </span>
            <span style={specNameStyle(!ui.hidden.none)}>Unassigned</span>
          </button>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <div style={{ font: '600 11.5px/1 var(--font-heading)' }}>Unscheduled</div>
          <div
            style={{
              font: '600 11px/18px var(--font-heading)',
              background: 'var(--color-accent)',
              color: '#fff',
              padding: '0 8px',
              borderRadius: 999,
            }}
          >
            {unscheduled.length}
          </div>
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: 'color-mix(in srgb,var(--color-text) 50%,transparent)',
            marginBottom: 8,
          }}
        >
          Click to see openings, or drag onto a week
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {unscheduled.map(({ g, dl, fit }) => (
            <div
              key={g.id}
              draggable
              onDragStart={(e) => {
                try {
                  e.dataTransfer.setData('text/plain', g.id);
                  e.dataTransfer.effectAllowed = 'move';
                } catch {
                  /* ignore */
                }
                ui.setDragChip(g.id);
              }}
              onDragEnd={() => {
                ui.setDragChip(null);
                ui.setDropIso(null);
              }}
              onClick={() => {
                const len = g.oeStart && g.oeEnd ? weeksBetween(g.oeStart, g.oeEnd).length : 2;
                ui.setSched({ gid: g.id, len, start: null });
              }}
              style={{
                border: '1px solid var(--color-divider)',
                borderRadius: 11,
                padding: '9px 11px',
                cursor: 'grab',
                background: '#fff',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div
                style={{
                  font: '600 12px/1.25 var(--font-heading)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {g.name}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: 'color-mix(in srgb,var(--color-text) 58%,transparent)',
                  display: 'flex',
                  gap: 6,
                  marginTop: 2,
                }}
              >
                <span>{g.employees} ee</span>
                <span>·</span>
                <span>eff {md(g.effective)}</span>
              </div>
              <div
                style={{
                  font: '600 11.5px/1.4 var(--font-heading)',
                  marginTop: 3,
                  color: dl ? 'var(--color-accent-700)' : 'var(--color-neutral-600)',
                }}
              >
                {dl ? `closeout ${md(dl)}` : 'closeout not configured'}
              </div>
              <div
                style={{
                  marginTop: 7,
                  borderRadius: 8,
                  display: 'block',
                  background: fit
                    ? 'color-mix(in srgb,var(--color-open) 10%,transparent)'
                    : 'var(--color-accent-100)',
                  color: fit ? 'var(--color-open)' : 'var(--color-accent-700)',
                  font: '600 11.5px/1.3 var(--font-heading)',
                  padding: '5px 8px',
                }}
              >
                {fit ? `First opening — week of ${md(fit.week)}` : 'No opening before closeout'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--color-divider)',
          paddingTop: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontSize: 11.5,
          color: 'color-mix(in srgb,var(--color-text) 55%,transparent)',
        }}
      >
        <span style={legendRow}>
          <span
            style={{
              width: 14,
              height: 0,
              borderTop: '2px dashed var(--color-accent)',
              display: 'inline-block',
            }}
          />
          eNav closeout
        </span>
        <span style={legendRow}>
          <span
            style={{
              width: 11,
              height: 11,
              border: '1px dashed var(--color-neutral-600)',
              background: 'var(--color-neutral-200)',
              display: 'inline-block',
            }}
          />
          Unassigned OE
        </span>
        <span style={legendRow}>
          <span style={{ color: 'var(--color-accent-700)', fontWeight: 600, fontSize: 9 }}>▲</span>
          Past eNav deadline
        </span>
        <span style={legendRow}>
          <span
            style={{
              width: 7,
              height: 7,
              background: 'var(--color-accent)',
              borderRadius: '50%',
              display: 'inline-block',
            }}
          />
          ASA outstanding
        </span>
        <span style={{ marginTop: 2 }}>T today · W week · M month · ← → page</span>
      </div>
    </div>
  );
}

const miniNavStyle = {
  width: 22,
  height: 22,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 13,
  color: 'var(--color-text)',
} as const;

const specRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  padding: '5px 4px',
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
} as const;

const legendRow = { display: 'inline-flex', alignItems: 'center', gap: 7 } as const;

function swatch(on: boolean, color: string, dashed: boolean) {
  return {
    width: 15,
    height: 15,
    borderRadius: 5,
    flex: 'none',
    background: on ? color : 'transparent',
    border: `2px ${dashed ? 'dashed var(--color-neutral-600)' : `solid ${color}`}`,
    color: '#fff',
    font: '600 9px/11px var(--font-heading)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const;
}

function specNameStyle(on: boolean) {
  return {
    font: '600 12.5px/1 var(--font-heading)',
    color: on ? 'var(--color-text)' : 'color-mix(in srgb,var(--color-text) 45%,transparent)',
  } as const;
}
