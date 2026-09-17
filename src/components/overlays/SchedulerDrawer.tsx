import { useMemo } from 'react';
import { useData } from '../../data/DataProvider';
import { useUi } from '../../ui/UiProvider';
import { CAPACITY_CEILING } from '../../lib/constants';
import { addDays, daysBetween, md, mdy, sow, todayIso, weeksBetween } from '../../lib/dates';
import {
  bookedByWeek,
  capacityOf,
  deadlineOf,
  fitWindow,
  loadFor,
  specialistColor,
  specialistsOf,
  type WindowFit,
} from '../../lib/capacity';
import { toggleSpecialist } from '../../lib/groupActions';
import type { GroupStatus } from '../../types';

interface Candidate {
  s: string;
  e: string;
  f: WindowFit;
}

export default function SchedulerDrawer() {
  const { data, patchGroup } = useData();
  const ui = useUi();
  const sched = ui.sched;
  const g = sched ? data.groups.find((x) => x.id === sched.gid) : undefined;

  const len = sched?.len ?? 2;

  const candidates = useMemo<Candidate[]>(() => {
    if (!g || !sched) return [];
    const today = todayIso();
    let w = sow(today);
    if (w < today) w = addDays(w, 7);
    if (sched.start && sched.start < w) w = sched.start;
    let cur = sched.start ?? w;
    const out: Candidate[] = [];
    for (let i = 0; i < 26 && out.length < 40; i++) {
      const s = cur;
      const e = addDays(cur, len * 7 - 3);
      out.push({ s, e, f: fitWindow(data, g, s, e) });
      cur = addDays(cur, 7);
    }
    return out;
  }, [data, g, sched, len]);

  if (!sched || !g) return null;

  const dl = deadlineOf(data, g);
  const hasWindow = !!(g.oeStart && g.oeEnd);
  const nextStatus = (s: GroupStatus): GroupStatus => (s === 'Not scheduled' ? 'Scheduled' : s);
  const setWindow = (s: string, e: string) =>
    patchGroup(g.id, { oeStart: s, oeEnd: e, status: nextStatus(g.status), weekLoad: {} });

  const shown = candidates.filter((c) => !c.f.past).slice(0, 5);
  const ranked = shown
    .slice()
    .sort((a, b) => a.f.pct - b.f.pct)
    .map((c) => c.s);

  const windowWeeks = hasWindow ? weeksBetween(g.oeStart, g.oeEnd) : [];
  const loadTotal = Math.round(windowWeeks.reduce((a, ws) => a + loadFor(g, ws), 0));
  const shareTotal = g.specialists.reduce((a, x) => a + (Number(x.share) || 0), 0);

  const currentFit = hasWindow ? fitWindow(data, g, g.oeStart, g.oeEnd) : null;
  const verdict = !currentFit
    ? 'Pick an opening above, or type both dates.'
    : `${
        currentFit.over
          ? `Over capacity — busiest week runs ${currentFit.at.booked} of ${currentFit.at.cap}.`
          : currentFit.tight
            ? `Tight — busiest week is ${currentFit.at.booked} of ${currentFit.at.cap}.`
            : `Fits — busiest week is ${currentFit.at.booked} of ${currentFit.at.cap}.`
      }${currentFit.past ? ' Ends after the eNav closeout.' : ''}`;
  const verdictColor = !currentFit
    ? 'var(--color-muted)'
    : currentFit.over || currentFit.past
      ? 'var(--color-accent-700)'
      : currentFit.tight
        ? 'var(--color-accent-600)'
        : 'var(--color-open)';

  const close = () => ui.setSched(null);

  return (
    <>
      <div
        onClick={close}
        style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.28)', zIndex: 85 }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 460,
          maxWidth: '94vw',
          background: 'var(--color-neutral-100)',
          zIndex: 86,
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '20px 22px 16px',
            background: '#fff',
            borderBottom: '1px solid var(--color-divider)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                font: '600 11.5px/1 var(--font-heading)',
                color: 'var(--color-muted)',
                marginBottom: 6,
              }}
            >
              Schedule open enrollment
            </div>
            <h3 style={{ margin: 0, fontSize: 21 }}>{g.name}</h3>
            <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 5 }}>
              {g.employees} employees · effective {mdy(g.effective)} · {g.format}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={close}
            style={{
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 20,
              lineHeight: 1,
              padding: '2px 4px',
              color: 'var(--color-muted)',
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 22px 26px',
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
          }}
        >
          <div
            style={{
              background: dl ? 'var(--color-accent-100)' : 'var(--color-neutral-200)',
              border: `1px solid ${dl ? 'var(--color-accent-300)' : 'var(--color-divider)'}`,
              borderRadius: 11,
              padding: '11px 14px',
              fontSize: 12.5,
              color: dl ? 'var(--color-accent-900)' : 'var(--color-muted)',
            }}
          >
            {dl
              ? `eNav closeout ${mdy(dl)} — the window has to finish by then.`
              : 'No eNav closeout configured for the month before this effective date. Set it in Settings.'}
          </div>

          <div>
            <div style={{ font: '600 12.5px/1 var(--font-heading)', marginBottom: 9 }}>
              How many weeks?
            </div>
            <div
              style={{
                display: 'flex',
                gap: 2,
                background: 'var(--color-neutral-200)',
                borderRadius: 10,
                padding: 3,
                width: 'fit-content',
              }}
            >
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => ui.setSched({ ...sched, len: n })}
                  style={{
                    border: 0,
                    borderRadius: 8,
                    padding: '7px 15px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    font: '600 12.5px/1 var(--font-heading)',
                    background: len === n ? '#fff' : 'transparent',
                    color: len === n ? 'var(--color-text)' : 'var(--color-muted)',
                    boxShadow: len === n ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  {n} {n === 1 ? 'week' : 'weeks'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 9 }}>
              <div style={{ font: '600 12.5px/1 var(--font-heading)' }}>Openings</div>
              <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>
                busiest week in each window, this group included
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {shown.map((c) => {
                const best = ranked.indexOf(c.s) === 0;
                const days = dl ? daysBetween(c.e, dl) : null;
                const chosen = hasWindow && g.oeStart === c.s && g.oeEnd === c.e;
                const badge = chosen
                  ? 'Current'
                  : c.f.over
                    ? 'Over capacity'
                    : c.f.tight
                      ? 'Tight'
                      : best
                        ? 'Most room'
                        : '';
                return (
                  <button
                    key={c.s}
                    onClick={() => setWindow(c.s, c.e)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      width: '100%',
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: '11px 14px',
                      borderRadius: 12,
                      background: '#fff',
                      border: `1px solid ${chosen ? 'var(--color-text)' : 'var(--color-divider)'}`,
                      boxShadow: chosen ? 'none' : 'var(--shadow-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%' }}>
                      <span style={{ font: '600 13.5px/1.2 var(--font-heading)' }}>
                        {md(c.s)} – {md(c.e)}
                      </span>
                      <div style={{ flex: 1 }} />
                      {badge && (
                        <span
                          style={{
                            borderRadius: 999,
                            padding: '3px 9px',
                            font: '600 11px/1.35 var(--font-heading)',
                            background: chosen
                              ? 'var(--color-text)'
                              : c.f.over
                                ? 'var(--color-accent)'
                                : c.f.tight
                                  ? '#e8a13a'
                                  : 'color-mix(in srgb,var(--color-open) 14%,transparent)',
                            color: chosen || c.f.over || c.f.tight ? '#fff' : 'var(--color-open)',
                          }}
                        >
                          {badge}
                        </span>
                      )}
                    </div>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', marginTop: 5 }}
                    >
                      <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>
                        {days !== null
                          ? `${days} day${days === 1 ? '' : 's'} before closeout`
                          : 'closeout not set'}
                      </span>
                      <div style={{ flex: 1 }} />
                      <span
                        style={{
                          font: '600 12px/1 var(--font-heading)',
                          whiteSpace: 'nowrap',
                          color: c.f.over
                            ? 'var(--color-accent-700)'
                            : c.f.tight
                              ? 'var(--color-accent-600)'
                              : 'var(--color-text)',
                        }}
                      >
                        {c.f.at.booked} of {c.f.at.cap}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {shown.length === 0 && (
              <div
                style={{
                  background: '#fff',
                  border: '1px solid var(--color-divider)',
                  borderRadius: 12,
                  padding: 18,
                  fontSize: 12.5,
                  color: 'var(--color-muted)',
                }}
              >
                Every window of this length runs past the eNav closeout. Try a shorter window, or set
                exact dates below and accept the overrun.
              </div>
            )}
          </div>

          <div>
            <div style={{ font: '600 12.5px/1 var(--font-heading)', marginBottom: 9 }}>
              Or set exact dates
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field">
                <label htmlFor="sched-start">Start</label>
                <input
                  id="sched-start"
                  className="input"
                  type="date"
                  value={g.oeStart}
                  onChange={(e) =>
                    patchGroup(g.id, {
                      oeStart: e.target.value,
                      oeEnd: g.oeEnd || (e.target.value ? addDays(e.target.value, 11) : ''),
                      status: nextStatus(g.status),
                      weekLoad: {},
                    })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="sched-end">End</label>
                <input
                  id="sched-end"
                  className="input"
                  type="date"
                  value={g.oeEnd}
                  onChange={(e) => patchGroup(g.id, { oeEnd: e.target.value, weekLoad: {} })}
                />
              </div>
            </div>
            <div
              style={{
                marginTop: 9,
                fontSize: currentFit ? 12.5 : 12,
                fontWeight: currentFit ? 600 : 400,
                color: verdictColor,
              }}
            >
              {verdict}
            </div>
          </div>

          {hasWindow && (
            <>
              <div>
                <div style={{ font: '600 12.5px/1 var(--font-heading)', marginBottom: 4 }}>
                  Effort per week
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginBottom: 9 }}>
                  Split evenly by default. Change a week if this group front-loads or trails off.
                </div>
                <div
                  style={{
                    background: '#fff',
                    border: '1px solid var(--color-divider)',
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  {windowWeeks.map((ws, i) => (
                    <div
                      key={ws}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px 6px 14px',
                        borderTop: i ? '1px solid var(--color-divider)' : 'none',
                      }}
                    >
                      <span style={{ font: '500 12.5px/1.3 var(--font-heading)' }}>
                        Week of {md(ws)}
                      </span>
                      <div style={{ flex: 1 }} />
                      <input
                        className="input"
                        type="number"
                        value={Math.round(loadFor(g, ws))}
                        onChange={(e) =>
                          patchGroup(g.id, { weekLoad: { ...g.weekLoad, [ws]: e.target.value } })
                        }
                        style={{
                          width: 78,
                          textAlign: 'right',
                          border: 0,
                          background: 'transparent',
                          fontSize: 12.5,
                        }}
                      />
                      <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>ee</span>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color:
                      loadTotal === g.employees ? 'var(--color-muted)' : 'var(--color-accent-700)',
                  }}
                >
                  {loadTotal === g.employees
                    ? `Totals ${loadTotal} of ${g.employees} employees`
                    : `Totals ${loadTotal} — group has ${g.employees} employees`}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <div style={{ font: '600 12.5px/1 var(--font-heading)' }}>Who runs it?</div>
                  <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>
                    optional — you can assign later
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginBottom: 9 }}>
                  Numbers are that specialist&rsquo;s busiest week inside this window, with this group
                  added.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {specialistsOf(data).map((p) => {
                    const on = g.specialists.some((a) => a.id === p.id);
                    let worst: { booked: number; cap: number; pct: number } | null = null;
                    for (const ws of windowWeeks) {
                      const m = bookedByWeek(data, ws, g.id);
                      const add = on ? 0 : loadFor(g, ws);
                      const booked = Math.round((m[p.id] ?? 0) + add);
                      const cap = capacityOf(p, ws);
                      const pct = cap ? booked / cap : 0;
                      if (!worst || pct > worst.pct) worst = { booked, cap, pct };
                    }
                    const wpct = worst?.pct ?? 0;
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleSpecialist(g, p.id, patchGroup)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          width: '100%',
                          cursor: 'pointer',
                          textAlign: 'left',
                          padding: '10px 13px',
                          borderRadius: 11,
                          background: '#fff',
                          border: `1px solid ${on ? 'var(--color-text)' : 'var(--color-divider)'}`,
                        }}
                      >
                        <span
                          style={{
                            width: 17,
                            height: 17,
                            flex: 'none',
                            borderRadius: 5,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            color: '#fff',
                            border: `1.5px solid ${on ? 'var(--color-text)' : 'var(--color-neutral-400)'}`,
                            background: on ? 'var(--color-text)' : '#fff',
                          }}
                        >
                          {on ? '✓' : ''}
                        </span>
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
                        <span style={{ font: '600 13px/1.2 var(--font-heading)' }}>{p.name}</span>
                        <div style={{ flex: 1 }} />
                        <span
                          style={{
                            font: '600 12px/1 var(--font-heading)',
                            whiteSpace: 'nowrap',
                            color:
                              wpct > 1
                                ? 'var(--color-accent-700)'
                                : wpct >= CAPACITY_CEILING
                                  ? 'var(--color-accent-600)'
                                  : 'var(--color-muted)',
                          }}
                        >
                          {worst ? `${worst.booked} of ${worst.cap}` : '—'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div
                  style={{
                    marginTop: 9,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: g.specialists.length ? 'var(--color-muted)' : 'var(--color-accent-700)',
                  }}
                >
                  {!g.specialists.length
                    ? 'No specialist yet — the group shows as unassigned on the calendar.'
                    : shareTotal === g.employees
                      ? `Shares total ${shareTotal} of ${g.employees} employees`
                      : `Shares total ${shareTotal} of ${g.employees} — adjust on the group page`}
                </div>
              </div>
            </>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 22px',
            background: '#fff',
            borderTop: '1px solid var(--color-divider)',
          }}
        >
          {hasWindow && (
            <button
              onClick={() =>
                patchGroup(g.id, {
                  oeStart: '',
                  oeEnd: '',
                  status: 'Not scheduled',
                  weekLoad: {},
                })
              }
              style={{
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                font: '600 12.5px/1 var(--font-heading)',
                color: 'var(--color-muted)',
                padding: '8px 4px',
              }}
            >
              Unschedule
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={close}>
            Done
          </button>
        </div>
      </div>
    </>
  );
}
