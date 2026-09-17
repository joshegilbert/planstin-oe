import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../data/DataProvider';
import { useUi } from '../ui/UiProvider';
import { BOARD_WEEKS, CAPACITY_CEILING } from '../lib/constants';
import { D, MONL, addDays, md, mdy, sow, todayIso } from '../lib/dates';
import {
  bookedByWeek,
  capacityOf,
  loadFor,
  specialistColor,
  specialistsOf,
  teamCapacityOf,
} from '../lib/capacity';

const CW = 82;

export default function BoardScreen() {
  const { data } = useData();
  const ui = useUi();
  const nav = useNavigate();
  const todayWeek = sow(todayIso());
  const start = ui.boardAnchor || todayWeek;
  const [sortByLoad, setSortByLoad] = useState(false);

  const weeks = useMemo(() => {
    const out: string[] = [];
    let w = start;
    for (let i = 0; i < BOARD_WEEKS; i++) {
      out.push(w);
      w = addDays(w, 7);
    }
    return out;
  }, [start]);

  const activeIn = (ws: string) => {
    const we = addDays(ws, 6);
    return data.groups.filter(
      (g) => g.oeMode !== 'None' && g.oeStart && g.oeEnd && g.oeStart <= we && g.oeEnd >= ws,
    );
  };

  const maps = weeks.map((ws) => bookedByWeek(data, ws));
  const specs = specialistsOf(data);

  const teamBookedAt = (i: number) => specs.reduce((t, p) => t + (maps[i][p.id] ?? 0), 0);
  const weeksOverCapacity = weeks.filter((ws, i) => {
    const cap = teamCapacityOf(data, ws);
    return cap > 0 && teamBookedAt(i) / cap >= CAPACITY_CEILING;
  }).length;
  const unscheduledCount = data.groups.filter(
    (g) => g.oeMode !== 'None' && (!g.oeStart || !g.oeEnd),
  ).length;

  const totalBooked = (pid: string) => maps.reduce((t, m) => t + (m[pid] ?? 0), 0);
  const sortedSpecs = sortByLoad
    ? specs.slice().sort((a, b) => totalBooked(b.id) - totalBooked(a.id))
    : specs;

  const months: Array<{ key: string; n: number; label: string }> = [];
  for (const ws of weeks) {
    const d = D(addDays(ws, 3));
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const last = months[months.length - 1];
    if (last && last.key === key) last.n++;
    else months.push({ key, n: 1, label: `${MONL[d.getMonth()]} ${d.getFullYear()}` });
  }

  function cell(
    bookedRaw: number,
    cap: number,
    ws: string,
    pid: string | null,
    big: boolean,
    key: string,
  ) {
    const booked = Math.round(bookedRaw);
    const pct = cap ? booked / cap : 0;
    let bg = '#fff';
    let col = 'var(--color-text)';
    let sub = 'var(--color-muted)';
    if (!cap) {
      bg = 'var(--color-neutral-100)';
      col = 'var(--color-muted)';
    } else if (pct > 1) {
      bg = 'var(--color-accent)';
      col = '#fff';
      sub = 'rgba(255,255,255,.92)';
    } else if (pct >= CAPACITY_CEILING) {
      bg = 'color-mix(in srgb,var(--color-accent) 58%,transparent)';
      col = '#fff';
      sub = 'rgba(255,255,255,.92)';
    } else if (pct >= CAPACITY_CEILING * 0.7) {
      bg = 'color-mix(in srgb,var(--color-accent) 24%,transparent)';
    } else if (pct >= CAPACITY_CEILING * 0.35) {
      bg = 'color-mix(in srgb,var(--color-accent) 9%,transparent)';
    }
    return (
      <button
        key={key}
        onClick={(ev) => {
          if (!pid) {
            ui.setHidden({});
            ui.setView('week');
            ui.setAnchor(ws);
            ui.setPop(null);
            nav('/calendar');
            return;
          }
          const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
          ui.setCapPop({ pid, ws, x: r.left + r.width / 2, y: r.bottom + 8, ay: r.top });
        }}
        style={{
          width: CW,
          flex: 'none',
          border: 0,
          borderLeft: '1px solid var(--color-divider)',
          background: bg,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          padding: '12px 4px',
          cursor: 'pointer',
        }}
      >
        <span style={{ font: `600 ${big ? 17 : 15.5}px/1 var(--font-heading)`, color: col }}>
          {booked || '—'}
        </span>
        <span style={{ fontSize: 11, fontWeight: 500, color: sub }}>
          {!cap ? (booked ? 'no owner' : '') : `of ${cap}`}
        </span>
      </button>
    );
  }

  const headStyle: CSSProperties = {
    width: 186,
    flex: 'none',
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderRight: '1px solid var(--color-divider)',
  };

  return (
    <div style={{ padding: '22px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 6 }}>
        <h3 style={{ margin: 0 }}>Capacity board</h3>
        <div style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>
          {md(weeks[0])} – {mdy(addDays(weeks[weeks.length - 1], 6))} ·{' '}
          {Math.round(CAPACITY_CEILING * 100)}% ceiling
        </div>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-secondary"
          style={{ fontSize: 12 }}
          onClick={() => ui.setBoardAnchor(addDays(start, -28))}
        >
          ‹ Earlier
        </button>
        <button
          className="btn btn-secondary"
          style={{ fontSize: 12 }}
          onClick={() => ui.setBoardAnchor(todayWeek)}
        >
          This week
        </button>
        <button
          className="btn btn-secondary"
          style={{ fontSize: 12 }}
          onClick={() => ui.setBoardAnchor(addDays(start, 28))}
        >
          Later ›
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, margin: '10px 0 2px' }}>
        <Stat label="specialists" value={specs.length} />
        <Stat
          label={unscheduledCount === 1 ? 'group unscheduled' : 'groups unscheduled'}
          value={unscheduledCount}
          warn={unscheduledCount > 0}
        />
        <Stat
          label={weeksOverCapacity === 1 ? 'week over capacity' : 'weeks over capacity'}
          value={weeksOverCapacity}
          warn={weeksOverCapacity > 0}
        />
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 16,
          margin: '12px 0 16px',
          fontSize: 12,
          color: 'var(--color-muted)',
        }}
      >
        <Legend swatch={{ border: '1px solid var(--color-divider)', background: '#fff' }}>
          Room to book
        </Legend>
        <Legend swatch={{ background: 'color-mix(in srgb,var(--color-accent) 24%,transparent)' }}>
          Filling up
        </Legend>
        <Legend swatch={{ background: 'color-mix(in srgb,var(--color-accent) 58%,transparent)' }}>
          At the {Math.round(CAPACITY_CEILING * 100)}% ceiling
        </Legend>
        <Legend swatch={{ background: 'var(--color-accent)' }}>Over capacity</Legend>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span style={{ font: '600 12px/1 var(--font-heading)' }}>155</span>
          <span style={{ color: 'var(--color-neutral-500)' }}>of 300</span>
          employees booked that week
        </span>
      </div>

      <div
        style={{
          overflowX: 'auto',
          background: '#fff',
          border: '1px solid var(--color-divider)',
          borderRadius: 14,
        }}
      >
        <div style={{ minWidth: 'max-content' }}>
          <div style={{ display: 'flex', background: 'var(--color-neutral-100)' }}>
            <div style={{ width: 186, flex: 'none' }} />
            {months.map((m) => (
              <div
                key={m.key}
                style={{
                  width: m.n * CW,
                  flex: 'none',
                  padding: '9px 10px',
                  font: '600 12px/1 var(--font-heading)',
                  color: 'var(--color-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  borderLeft: '1px solid var(--color-divider)',
                }}
              >
                {m.label}
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--color-divider)',
              background: 'var(--color-neutral-100)',
            }}
          >
            <button
              onClick={() => setSortByLoad((v) => !v)}
              title="Sort specialists by current load"
              style={{
                width: 186,
                flex: 'none',
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                padding: '8px 14px 10px',
                fontSize: 12,
                fontWeight: 600,
                color: sortByLoad ? 'var(--color-accent)' : 'var(--color-muted)',
              }}
            >
              Specialist{sortByLoad ? ' · busiest first' : ''}
            </button>
            {weeks.map((ws) => {
              const cnt = activeIn(ws).length;
              return (
                <div
                  key={ws}
                  style={{
                    width: CW,
                    flex: 'none',
                    padding: '8px 6px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    alignItems: 'center',
                    borderLeft: '1px solid var(--color-divider)',
                    background: ws === todayWeek ? 'var(--color-accent-100)' : 'transparent',
                  }}
                >
                  <span
                    style={{
                      font: '600 12.5px/1.2 var(--font-heading)',
                      color: ws === todayWeek ? 'var(--color-accent)' : undefined,
                    }}
                  >
                    {md(ws)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                    {cnt ? `${cnt} ${cnt === 1 ? 'group' : 'groups'}` : '—'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* all specialists */}
          <div
            style={{
              display: 'flex',
              borderBottom: '2px solid var(--color-divider)',
              background: 'var(--color-neutral-100)',
            }}
          >
            <div style={headStyle}>
              <span style={{ font: '600 13.5px/1.2 var(--font-heading)' }}>All specialists</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11.5, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                {teamCapacityOf(data, weeks[0])} /wk
              </span>
            </div>
            {weeks.map((ws, i) =>
              cell(teamBookedAt(i), teamCapacityOf(data, ws), ws, null, true, `all-${ws}`),
            )}
          </div>

          {sortedSpecs.map((p) => {
            const overWeeks = weeks.filter((ws, i) => {
              const cap = capacityOf(p, ws);
              return cap > 0 && (maps[i][p.id] ?? 0) / cap >= CAPACITY_CEILING;
            }).length;
            return (
              <div
                key={p.id}
                style={{ display: 'flex', borderBottom: '1px solid var(--color-divider)' }}
              >
                <div style={headStyle}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 3,
                      flex: 'none',
                      background: specialistColor(data, p.id),
                      display: 'block',
                    }}
                  />
                  <span style={{ font: '600 13.5px/1.2 var(--font-heading)' }}>{p.name}</span>
                  {overWeeks > 0 && (
                    <span
                      style={{
                        borderRadius: 999,
                        padding: '2px 7px',
                        font: '600 10px/1.4 var(--font-heading)',
                        background: 'color-mix(in srgb,var(--color-accent) 16%,transparent)',
                        color: 'var(--color-accent-700)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {overWeeks} over
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11.5, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                    {p.capacity ?? 0} /wk
                  </span>
                </div>
                {weeks.map((ws, i) =>
                  cell(maps[i][p.id] ?? 0, capacityOf(p, ws), ws, p.id, false, `${p.id}-${ws}`),
                )}
              </div>
            );
          })}

          {(() => {
            const unassignedAt = weeks.map((ws) =>
              activeIn(ws)
                .filter((g) => !g.specialists.length)
                .reduce((t, g) => t + loadFor(g, ws), 0),
            );
            const hasUnassigned = unassignedAt.some((n) => n > 0);
            return (
              <div
                style={{
                  display: 'flex',
                  background: hasUnassigned
                    ? 'color-mix(in srgb,var(--color-accent) 6%,transparent)'
                    : undefined,
                }}
              >
                <div style={headStyle}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 3,
                      flex: 'none',
                      background: hasUnassigned ? 'var(--color-accent)' : 'var(--color-neutral-400)',
                      display: 'block',
                    }}
                  />
                  <span
                    style={{
                      font: '600 13.5px/1.2 var(--font-heading)',
                      color: hasUnassigned ? 'var(--color-accent-700)' : 'var(--color-muted)',
                    }}
                  >
                    Unassigned OE
                  </span>
                  <span style={{ flex: 1 }} />
                  <span
                    style={{
                      fontSize: 11.5,
                      whiteSpace: 'nowrap',
                      fontWeight: hasUnassigned ? 600 : 400,
                      color: hasUnassigned ? 'var(--color-accent-700)' : 'var(--color-muted)',
                    }}
                  >
                    needs an owner
                  </span>
                </div>
                {weeks.map((ws, i) => cell(unassignedAt[i], 0, ws, null, false, `none-${ws}`))}
              </div>
            );
          })()}
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: 'var(--color-muted)', maxWidth: '78ch' }}>
        Numbers are employees booked that week against that week&rsquo;s capacity. Click a
        specialist&rsquo;s cell to adjust their capacity for that week or jump to it in the calendar.
      </div>
    </div>
  );
}

function Legend({ swatch, children }: { swatch: CSSProperties; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <span style={{ width: 14, height: 14, borderRadius: 4, display: 'inline-block', ...swatch }} />
      {children}
    </span>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
      <span
        style={{
          font: '600 15px/1 var(--font-heading)',
          color: warn ? 'var(--color-accent-700)' : 'var(--color-text)',
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{label}</span>
    </span>
  );
}
