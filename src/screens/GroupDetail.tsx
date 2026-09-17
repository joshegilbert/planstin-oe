/**
 * Group detail — the four sub-tabs from the mockup's `isDetail` screen:
 * Details, OE Guide, Plan options and Contributions.
 */
import { useMemo, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../data/DataProvider';
import { useUi, type DetailTab } from '../ui/UiProvider';
import { CheckBox, Segmented, cardStyle, segStyle, tagStyle } from '../components/primitives';
import {
  INFO_FIELDS,
  PLANS,
  STATUSES,
  TIERS,
  TIMELINE_ITEMS,
  TOOL_ITEMS,
} from '../lib/constants';
import { md, mdy, todayIso, weeksBetween } from '../lib/dates';
import {
  bufferDays,
  deadlineOf,
  isLate,
  specialistColor,
  specialistsOf,
} from '../lib/capacity';
import { setEmployeeCount, setSpecialistShare, toggleSpecialist } from '../lib/groupActions';
import { buildGroupExport } from '../lib/exportGroup';
import { downloadGroupPdf } from '../lib/exportPdf';
import { downloadCsv, groupToCsvRows } from '../lib/exportCsv';
import type {
  Contributions,
  Group,
  GroupStatus,
  OeFormat,
  OeMode,
  PlanRow,
  Tier,
} from '../types';

const MODES: Array<[OeMode, string]> = [
  ['Full', 'Full OE'],
  ['Passive', 'Renewal OE'],
  ['None', 'No OE'],
];

const MODE_HELP: Record<OeMode, string> = {
  None:
    'No open enrollment for this group — it is off the calendar, the capacity board and the ' +
    'unscheduled queue. Switching back to Full or Renewal returns it to the queue so you can ' +
    'reschedule it.',
  Passive: 'Renewal OE — elections roll over. Still scheduled, but no full guide is required.',
  Full: 'Full OE — scheduled on the calendar and counted against specialist capacity.',
};

const CHECKLIST_ROW = (i: number): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '2px 12px 2px 14px',
  minHeight: 38,
  borderTop: i ? '1px solid var(--color-divider)' : 'none',
});

const strikeLabel = (done: boolean): CSSProperties => ({
  font: '500 13px/1.3 var(--font-heading)',
  color: done ? 'var(--color-muted)' : 'var(--color-text)',
  textDecoration: done ? 'line-through' : 'none',
});

const panelStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid var(--color-divider)',
  borderRadius: 14,
  overflow: 'hidden',
};

const bareInput: CSSProperties = {
  border: 0,
  background: 'transparent',
  padding: '4px 6px',
  fontSize: 12.5,
};

const PLAN_GRID = 'minmax(190px,1.5fr) minmax(56px,0.55fr) minmax(56px,0.55fr) repeat(4,minmax(72px,0.85fr))';
const CONTRIB_GRID = 'minmax(160px,1.4fr) repeat(4,minmax(0,1fr))';

export default function GroupDetailScreen() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const ui = useUi();
  const { data, patchGroup, meName } = useData();

  const group = data.groups.find((g) => g.id === id);

  const specialists = useMemo(() => specialistsOf(data), [data]);
  const managers = useMemo(() => data.people.filter((p) => p.role === 'Manager'), [data.people]);
  const guides = useMemo(() => data.people.filter((p) => p.role === 'Guide'), [data.people]);

  if (!group) {
    return (
      <div style={{ padding: '22px 26px' }}>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => nav('/groups')}>
          ← All groups
        </button>
        <h3 style={{ marginTop: 10 }}>Group not found</h3>
        <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
          This group may have been removed, or the link points at a different workspace.
        </p>
      </div>
    );
  }

  const g = group;
  const patch = (p: Partial<Group>) => patchGroup(g.id, p);

  const oeOn = g.oeMode !== 'None';
  const openScheduler = () => {
    const len = g.oeStart && g.oeEnd ? weeksBetween(g.oeStart, g.oeEnd).length : 2;
    ui.setSched({ gid: g.id, len, start: null });
  };
  // The OE Guide tab only exists while the group actually has an OE.
  const tab: DetailTab = ui.detailTab === 'guide' && !oeOn ? 'details' : ui.detailTab;
  const late = isLate(data, g);
  const dl = deadlineOf(data, g);
  const buf = bufferDays(data, g);

  const subTabs: Array<[DetailTab, string]> = [
    ['details', 'Details'],
    ...(oeOn ? ([['guide', 'OE Guide']] as Array<[DetailTab, string]>) : []),
    ['plans', 'Plan options'],
    ['contrib', 'Contributions'],
  ];

  const offered = PLANS.filter((p) => g.planRows[p]?.offering);
  const planList = ui.onlyOffered ? offered : PLANS;
  const toolDone = TOOL_ITEMS.filter((t) => g.tool[t]?.done).length;
  const tlDone = TIMELINE_ITEMS.filter((t) => g.timeline[t]?.done).length;
  const totalShare = g.specialists.reduce((t, a) => t + (Number(a.share) || 0), 0);

  const setPlanRow = (plan: string, p: Partial<PlanRow>) =>
    patch({ planRows: { ...g.planRows, [plan]: { ...(g.planRows[plan] ?? {}), ...p } } });

  const setPlanRate = (plan: string, tier: Tier, value: string) =>
    setPlanRow(plan, { rates: { ...(g.planRows[plan]?.rates ?? {}), [tier]: value } });

  const exportFilename = g.name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'group';
  const downloadPdf = () => downloadGroupPdf(buildGroupExport(data, g), `${exportFilename}.pdf`);
  const downloadGroupCsv = () =>
    downloadCsv(groupToCsvRows(buildGroupExport(data, g)), `${exportFilename}.csv`);

  const setContrib = (plan: string, classId: string, tier: Tier, value: string) => {
    const next: Contributions = { ...g.contrib };
    const byPlan = { ...(next[plan] ?? {}) };
    byPlan[classId] = { ...(byPlan[classId] ?? {}), [tier]: value };
    next[plan] = byPlan;
    patch({ contrib: next });
  };

  return (
    <div style={{ padding: '22px 26px', maxWidth: 1180 }}>
      <button
        className="btn btn-ghost"
        onClick={() => nav('/groups')}
        style={{ fontSize: 12, marginBottom: 10 }}
      >
        ← All groups
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{g.name}</h2>
        <span style={tagStyle(late ? 'warn' : 'none')}>{g.status}</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={downloadPdf}>
          Download PDF
        </button>
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={downloadGroupCsv}>
          Download CSV
        </button>
        {oeOn && (
          <button className="btn btn-primary" onClick={openScheduler}>
            {g.oeStart ? 'Change window' : 'Schedule OE'}
          </button>
        )}
        <Segmented>
          {MODES.map(([mode, label]) => (
            <button
              key={mode}
              style={segStyle(g.oeMode === mode)}
              onClick={() =>
                patch(
                  mode === 'None'
                    ? {
                        oeMode: 'None',
                        oeStart: '',
                        oeEnd: '',
                        specialists: [],
                        status: 'Not scheduled',
                      }
                    : { oeMode: mode },
                )
              }
            >
              {label}
            </button>
          ))}
        </Segmented>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 8 }}>
        {MODE_HELP[g.oeMode]}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 24,
          borderBottom: '1px solid var(--color-divider)',
          margin: '16px 0 22px',
        }}
      >
        {subTabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => ui.setDetailTab(k)}
            style={{
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              padding: '0 0 10px',
              font: '600 13.5px/1 var(--font-heading)',
              color: tab === k ? 'var(--color-text)' : 'var(--color-muted)',
              borderBottom: `2px solid ${tab === k ? 'var(--color-accent)' : 'transparent'}`,
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {late && dl && (
        <div
          style={{
            border: '1px solid var(--color-accent-300)',
            background: 'var(--color-accent-100)',
            borderRadius: 12,
            padding: '13px 16px',
            marginBottom: 18,
            display: 'flex',
            gap: 10,
            alignItems: 'baseline',
          }}
        >
          <span style={{ color: 'var(--color-accent-700)', fontWeight: 600 }}>▲</span>
          <div style={{ fontSize: 13, color: 'var(--color-accent-900)' }}>
            OE ends {md(g.oeEnd)}, after the eNav closeout on {md(dl)}. Shorten the window or move it
            earlier — saving is not blocked.
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- Details */}
      {tab === 'details' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 34 }}>
          <div>
            <h6>Group information</h6>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
                gap: '14px 20px',
                marginBottom: 8,
              }}
            >
              <div className="field">
                <label>Group name</label>
                <input
                  className="input"
                  value={g.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </div>
              <div className="field">
                <label># of eligible employees</label>
                <input
                  className="input"
                  type="number"
                  value={g.employees}
                  onChange={(e) => setEmployeeCount(g, e.target.value, patchGroup)}
                />
              </div>
              <div className="field">
                <label>Benefit manager</label>
                <select
                  className="input"
                  value={g.managerId}
                  onChange={(e) => patch({ managerId: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {managers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Benefit guide</label>
                <select
                  className="input"
                  value={g.guideId}
                  onChange={(e) => patch({ guideId: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {guides.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Effective date</label>
                <input
                  className="input"
                  type="date"
                  value={g.effective}
                  onChange={(e) => patch({ effective: e.target.value })}
                />
              </div>
              {oeOn && (
                <div className="field">
                  <label>Open enrollment window</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 34 }}>
                    <span style={{ font: '500 13px/1.3 var(--font-heading)' }}>
                      {g.oeStart && g.oeEnd ? `${md(g.oeStart)} – ${md(g.oeEnd)}` : 'Not scheduled'}
                    </span>
                    <button
                      onClick={openScheduler}
                      style={{
                        border: 0,
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: 0,
                        font: '600 12px/1 var(--font-heading)',
                        color: 'var(--color-accent)',
                      }}
                    >
                      {g.oeStart ? 'Change' : 'Schedule'}
                    </button>
                  </div>
                </div>
              )}
              <div className="field">
                <label>Group type</label>
                <select
                  className="input"
                  value={g.type}
                  onChange={(e) => patch({ type: e.target.value as Group['type'] })}
                >
                  <option value="New">New</option>
                  <option value="Renewal">Renewal</option>
                </select>
              </div>
              <div className="field">
                <label>OE format</label>
                <select
                  className="input"
                  value={g.format}
                  onChange={(e) => patch({ format: e.target.value as OeFormat })}
                >
                  {(['Virtual', 'In-Person', 'Hybrid'] as OeFormat[]).map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Status</label>
                <select
                  className="input"
                  value={g.status}
                  onChange={(e) => patch({ status: e.target.value as GroupStatus })}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {INFO_FIELDS.map(([key, label, ph]) => (
                <div className="field" key={key}>
                  <label>{label}</label>
                  <input
                    className="input"
                    placeholder={ph}
                    value={g.info[key] ?? ''}
                    onChange={(e) => patch({ info: { ...g.info, [key]: e.target.value } })}
                  />
                </div>
              ))}
            </div>

            <hr className="hr" />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
              <h6 style={{ margin: 0 }}>Employee classes</h6>
              <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>
                Contributions are set per class on the Contributions tab
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {g.classes.map((c) => {
                const removable = g.classes.length > 1;
                return (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      border: '1px solid var(--color-divider)',
                      borderRadius: 999,
                      background: '#fff',
                      padding: '4px 6px 4px 12px',
                    }}
                  >
                    <input
                      className="input"
                      placeholder="Class name"
                      value={c.name}
                      onChange={(e) =>
                        patch({
                          classes: g.classes.map((x) =>
                            x.id === c.id ? { ...x, name: e.target.value } : x,
                          ),
                        })
                      }
                      style={{
                        border: 0,
                        background: 'transparent',
                        padding: '3px 2px',
                        fontSize: 13,
                        fontWeight: 600,
                        width: `${Math.max(9, (c.name || 'Class name').length + 1)}ch`,
                      }}
                    />
                    <button
                      title={removable ? 'Remove class' : 'A group needs at least one class'}
                      onClick={() => {
                        if (!removable) return;
                        // Drop this class's contribution column from every plan.
                        const contrib: Contributions = {};
                        for (const [plan, byClass] of Object.entries(g.contrib)) {
                          const copy = { ...byClass };
                          delete copy[c.id];
                          contrib[plan] = copy;
                        }
                        patch({ classes: g.classes.filter((x) => x.id !== c.id), contrib });
                      }}
                      style={{
                        border: 0,
                        background: 'transparent',
                        cursor: removable ? 'pointer' : 'not-allowed',
                        fontSize: 16,
                        lineHeight: 1,
                        padding: '2px 6px',
                        color: removable ? 'var(--color-neutral-500)' : 'var(--color-neutral-300)',
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              <button
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '7px 14px' }}
                onClick={() =>
                  patch({ classes: [...g.classes, { id: `c${Date.now()}`, name: '' }] })
                }
              >
                + Add class
              </button>
            </div>

            <hr className="hr" />
            <h6>Benefit specialists &amp; employee shares</h6>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {specialists.map((p) => {
                const a = g.specialists.find((x) => x.id === p.id);
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 12px',
                      border: '1px solid var(--color-divider)',
                      borderRadius: 11,
                      background: '#fff',
                    }}
                  >
                    <CheckBox
                      on={!!a}
                      size={16}
                      accent={false}
                      onClick={() => toggleSpecialist(g, p.id, patchGroup)}
                    />
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        flex: 'none',
                        borderRadius: 999,
                        background: specialistColor(data, p.id),
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ font: '600 13px/1 var(--font-heading)', minWidth: 78 }}>
                      {p.name}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                      cap {p.capacity ?? 0}/wk
                    </span>
                    <div style={{ flex: 1 }} />
                    {a && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          className="input"
                          type="number"
                          value={a.share}
                          onChange={(e) =>
                            setSpecialistShare(g, p.id, e.target.value, patchGroup)
                          }
                          style={{ width: 78, textAlign: 'right' }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>ee</span>
                        <span
                          style={{
                            font: '600 9px/1 var(--font-heading)',
                            color: 'var(--color-neutral-600)',
                            visibility: a.manual ? 'visible' : 'hidden',
                          }}
                        >
                          manual
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div
              style={{
                font: '600 11.5px/1.4 var(--font-heading)',
                marginTop: 8,
                color:
                  totalShare !== g.employees
                    ? 'var(--color-accent-700)'
                    : 'color-mix(in srgb,var(--color-text) 55%,transparent)',
              }}
            >
              Shares total {totalShare} of {g.employees} employees
              {totalShare !== g.employees ? ' — does not match' : ''}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {oeOn && (
              <div style={cardStyle()}>
                <h6 style={{ marginBottom: 6 }}>eNav deadline</h6>
                <div
                  style={{
                    font: '600 24px/1.1 var(--font-heading)',
                    letterSpacing: '-.02em',
                    color: late ? 'var(--color-accent-700)' : undefined,
                  }}
                >
                  {dl ? mdy(dl) : 'Not configured'}
                </div>
                <div style={{ fontSize: 12, marginTop: 6, color: 'var(--color-muted)' }}>
                  {!dl
                    ? 'Closeout date not configured for the month before this effective date.'
                    : !g.oeEnd
                      ? 'No OE dates set yet.'
                      : (buf ?? 0) >= 0
                        ? `OE must be complete by ${md(dl)} — ${buf} days of buffer.`
                        : `OE ends ${Math.abs(buf ?? 0)} days past the closeout.`}
                </div>
              </div>
            )}

            <div style={cardStyle()}>
              <h6 style={{ marginBottom: 8 }}>Documents</h6>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(['asa', 'census'] as const).map((k) => {
                  const doc = g.docs[k];
                  const setDoc = (p: Partial<typeof doc>) =>
                    patch({ docs: { ...g.docs, [k]: { ...doc, ...p } } });
                  return (
                    <div key={k}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <CheckBox
                          on={doc.done}
                          accent={false}
                          onClick={() =>
                            setDoc({
                              done: !doc.done,
                              date: !doc.done && !doc.date ? todayIso() : doc.date,
                            })
                          }
                        />
                        <span style={{ font: '600 13px/1 var(--font-heading)' }}>
                          {k === 'asa' ? 'ASA' : 'Census'}
                        </span>
                        <div style={{ flex: 1 }} />
                        <span style={tagStyle(doc.done ? 'ok' : 'bad')}>
                          {doc.done ? 'Received' : 'Outstanding'}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '112px minmax(0,1fr)',
                          gap: 6,
                          marginTop: 6,
                        }}
                      >
                        <input
                          className="input"
                          type="date"
                          value={doc.date}
                          onChange={(e) => setDoc({ date: e.target.value })}
                        />
                        <input
                          className="input"
                          placeholder="Note"
                          value={doc.note}
                          onChange={(e) => setDoc({ note: e.target.value })}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={cardStyle()}>
              <h6 style={{ marginBottom: 8 }}>Notes</h6>
              <textarea
                className="input"
                rows={5}
                value={g.notes}
                onChange={(e) => patch({ notes: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- OE Guide */}
      {tab === 'guide' && oeOn && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))',
              gap: 32,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                <h6 style={{ margin: 0 }}>Enrollment tool build</h6>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>
                  {toolDone} of {TOOL_ITEMS.length} done
                </span>
              </div>
              <div style={panelStyle}>
                {TOOL_ITEMS.map((t, i) => {
                  const item = g.tool[t] ?? { done: false, note: '' };
                  return (
                    <div key={t} style={CHECKLIST_ROW(i)}>
                      <CheckBox
                        on={item.done}
                        onClick={() =>
                          patch({ tool: { ...g.tool, [t]: { ...item, done: !item.done } } })
                        }
                      />
                      <span style={strikeLabel(item.done)}>{t}</span>
                      <div style={{ flex: 1 }} />
                      <input
                        className="input"
                        placeholder="Note"
                        value={item.note}
                        onChange={(e) =>
                          patch({ tool: { ...g.tool, [t]: { ...item, note: e.target.value } } })
                        }
                        style={{ ...bareInput, width: 120, fontSize: 12, textAlign: 'right' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                <h6 style={{ margin: 0 }}>Open enrollment timeline</h6>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>
                  {tlDone} of {TIMELINE_ITEMS.length} done
                </span>
              </div>
              <div style={panelStyle}>
                {TIMELINE_ITEMS.map((t, i) => {
                  const item = g.timeline[t] ?? { done: false, date: '' };
                  return (
                    <div key={t} style={CHECKLIST_ROW(i)}>
                      <CheckBox
                        on={item.done}
                        onClick={() =>
                          patch({ timeline: { ...g.timeline, [t]: { ...item, done: !item.done } } })
                        }
                      />
                      <span style={strikeLabel(item.done)}>{t}</span>
                      <div style={{ flex: 1 }} />
                      <input
                        className="input"
                        type="date"
                        value={item.date}
                        onChange={(e) =>
                          patch({
                            timeline: { ...g.timeline, [t]: { ...item, date: e.target.value } },
                          })
                        }
                        style={{ ...bareInput, width: 132, fontSize: 12 }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 22 }}>
            <button
              onClick={() =>
                patch({
                  oeGuide: g.oeGuide.complete
                    ? { complete: false, by: '', at: 0 }
                    : { complete: true, by: meName, at: Date.now() },
                })
              }
              style={{
                border: `1px solid ${g.oeGuide.complete ? 'var(--color-text)' : 'var(--color-divider)'}`,
                borderRadius: 999,
                padding: '10px 18px',
                cursor: 'pointer',
                font: '600 13px/1 var(--font-heading)',
                background: g.oeGuide.complete ? 'var(--color-text)' : 'transparent',
                color: g.oeGuide.complete ? 'var(--color-bg)' : 'var(--color-text)',
              }}
            >
              {g.oeGuide.complete ? '✓ OE Guide complete' : 'Mark OE Guide complete'}
            </button>
            <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>
              {g.oeGuide.complete && g.oeGuide.by
                ? `Completed by ${g.oeGuide.by} on ${new Date(g.oeGuide.at).toLocaleDateString()}`
                : ''}
            </span>
          </div>
        </>
      )}

      {/* ------------------------------------------------------ Plan options */}
      {tab === 'plans' && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 12 }}>
            <h6 style={{ margin: 0 }}>Plan options</h6>
            <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>
              {offered.length} offered of {PLANS.length}
            </span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => ui.setOnlyOffered((v) => !v)}
              style={{
                border: '1px solid var(--color-divider)',
                borderRadius: 999,
                background: '#fff',
                cursor: 'pointer',
                padding: '7px 14px',
                font: '600 12px/1 var(--font-heading)',
                color: 'var(--color-text)',
              }}
            >
              {ui.onlyOffered ? 'Show all plans' : 'Show offered only'}
            </button>
          </div>

          <div style={panelStyle}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: PLAN_GRID,
                background: 'var(--color-neutral-100)',
                borderBottom: '1px solid var(--color-divider)',
              }}
            >
              {(['Plan', 'Version', 'RX version'] as const).map((label, i) => (
                <div
                  key={label}
                  style={{
                    padding: '10px 14px',
                    font: '600 12px/1 var(--font-heading)',
                    color: 'var(--color-muted)',
                    borderLeft: i ? '1px solid var(--color-divider)' : 'none',
                  }}
                >
                  {label}
                </div>
              ))}
              {TIERS.map(([tier, label]) => (
                <div
                  key={tier}
                  style={{
                    padding: '9px 14px',
                    font: '600 12px/1.3 var(--font-heading)',
                    color: 'var(--color-muted)',
                    textAlign: 'right',
                    borderLeft: '1px solid var(--color-divider)',
                  }}
                >
                  <div>{tier}</div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 400,
                      marginTop: 1,
                      color: 'var(--color-neutral-500)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {planList.length === 0 && (
              <div
                style={{
                  padding: '26px 16px',
                  textAlign: 'center',
                  fontSize: 13,
                  color: 'var(--color-muted)',
                }}
              >
                No plans marked as offered yet. Choose{' '}
                <strong style={{ fontWeight: 600 }}>Show all plans</strong> and tick the ones this
                group is offering.
              </div>
            )}

            {planList.map((p, i) => {
              const row = g.planRows[p] ?? {};
              const on = !!row.offering;
              return (
                <div
                  key={p}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: PLAN_GRID,
                    borderTop: i ? '1px solid var(--color-divider)' : 'none',
                    background: on ? 'transparent' : 'var(--color-neutral-100)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 14px',
                      minWidth: 0,
                    }}
                  >
                    <CheckBox on={on} onClick={() => setPlanRow(p, { offering: !on })} />
                    <span
                      style={{
                        font: '500 13px/1.3 var(--font-heading)',
                        color: on ? 'var(--color-text)' : 'var(--color-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={p}
                    >
                      {p}
                    </span>
                  </div>

                  <PlanCell>
                    <input
                      className="input"
                      placeholder="—"
                      value={row.version ?? ''}
                      onChange={(e) => setPlanRow(p, { version: e.target.value })}
                      style={bareInput}
                    />
                  </PlanCell>
                  <PlanCell>
                    <input
                      className="input"
                      placeholder="—"
                      value={row.rx ?? ''}
                      onChange={(e) => setPlanRow(p, { rx: e.target.value })}
                      style={bareInput}
                    />
                  </PlanCell>

                  {TIERS.map(([tier]) => {
                    const val = row.rates?.[tier] ?? '';
                    return (
                      <div
                        key={tier}
                        style={{
                          padding: '6px 8px',
                          borderLeft: '1px solid var(--color-divider)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 2,
                        }}
                      >
                        <span
                          style={{ fontSize: 12, color: val ? 'var(--color-muted)' : 'transparent' }}
                        >
                          $
                        </span>
                        <input
                          className="input"
                          placeholder="0.00"
                          value={val}
                          onChange={(e) => setPlanRate(p, tier, e.target.value)}
                          style={{
                            border: 0,
                            background: 'transparent',
                            padding: '5px 4px',
                            fontSize: 12.5,
                            width: '100%',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {offered.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-muted)' }}>
              Offered plan EE rates total $
              {offered
                .reduce((t, p) => t + (Number(g.planRows[p]?.rates?.EE) || 0), 0)
                .toFixed(2)}{' '}
              /mo · contributions are set per class on the Contributions tab
            </div>
          )}
        </>
      )}

      {/* ---------------------------------------------------- Contributions */}
      {tab === 'contrib' && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 6 }}>
            <h6 style={{ margin: 0 }}>Employer contributions</h6>
            <div style={{ flex: 1 }} />
            <Segmented>
              {(
                [
                  ['$', 'Dollar amount'],
                  ['%', '% of premium'],
                ] as Array<[Group['contribMode'], string]>
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  style={segStyle(g.contribMode === mode)}
                  onClick={() => patch({ contribMode: mode })}
                >
                  {label}
                </button>
              ))}
            </Segmented>
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-muted)',
              marginBottom: 18,
              maxWidth: '76ch',
            }}
          >
            Contributions can differ by plan, by employee class and by tier. Classes are named on
            the Details tab.{' '}
            {g.contribMode === '%'
              ? 'Values are the share of premium the employer covers.'
              : 'Amounts are what the employer pays per month.'}
          </div>

          {offered.length === 0 ? (
            <div
              style={{
                background: '#fff',
                border: '1px solid var(--color-divider)',
                borderRadius: 14,
                padding: '28px 20px',
                textAlign: 'center',
                fontSize: 13,
                color: 'var(--color-muted)',
              }}
            >
              Mark the plans this group is offering on the{' '}
              <strong style={{ fontWeight: 600 }}>Plan options</strong> tab and they will appear
              here for contribution amounts.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {offered.map((p) => {
                const rate = Number(g.planRows[p]?.rates?.EE) || 0;
                const pct = g.contribMode === '%';
                return (
                  <div key={p} style={panelStyle}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--color-divider)',
                      }}
                    >
                      <span style={{ font: '600 13.5px/1.2 var(--font-heading)' }}>{p}</span>
                      {rate > 0 && (
                        <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>
                          ${rate.toFixed(2)} /mo EE
                        </span>
                      )}
                      <div style={{ flex: 1 }} />
                      {offered.length > 1 && (
                        <button
                          onClick={() => {
                            const src = g.contrib[p] ?? {};
                            const next: Contributions = { ...g.contrib };
                            for (const q of offered) {
                              next[q] = JSON.parse(JSON.stringify(src)) as Contributions[string];
                            }
                            patch({ contrib: next });
                          }}
                          style={{
                            border: '1px solid var(--color-divider)',
                            borderRadius: 999,
                            background: '#fff',
                            cursor: 'pointer',
                            padding: '6px 12px',
                            font: '600 11.5px/1 var(--font-heading)',
                            color: 'var(--color-muted)',
                          }}
                        >
                          Copy to all plans
                        </button>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: CONTRIB_GRID,
                        background: 'var(--color-neutral-100)',
                        borderBottom: '1px solid var(--color-divider)',
                      }}
                    >
                      {([['Class', ''], ...TIERS] as Array<[string, string]>).map(
                        ([label, sub], i) => (
                          <div
                            key={label}
                            style={{
                              padding: '9px 14px',
                              font: '600 12px/1.3 var(--font-heading)',
                              color: 'var(--color-muted)',
                              textAlign: i ? 'right' : 'left',
                              borderLeft: i ? '1px solid var(--color-divider)' : 'none',
                            }}
                          >
                            <div>{label}</div>
                            <div
                              style={{
                                fontSize: 10.5,
                                fontWeight: 400,
                                marginTop: 2,
                                color: 'var(--color-neutral-500)',
                              }}
                            >
                              {sub}
                            </div>
                          </div>
                        ),
                      )}
                    </div>

                    {g.classes.map((c, i) => (
                      <div
                        key={c.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: CONTRIB_GRID,
                          borderTop: i ? '1px solid var(--color-divider)' : 'none',
                        }}
                      >
                        <div
                          style={{
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            font: '500 13px/1.3 var(--font-heading)',
                            minWidth: 0,
                          }}
                        >
                          {c.name || 'Untitled class'}
                        </div>
                        {TIERS.map(([tier]) => {
                          const val = g.contrib[p]?.[c.id]?.[tier] ?? '';
                          const affix: CSSProperties = {
                            fontSize: 12,
                            color: val ? 'var(--color-muted)' : 'transparent',
                          };
                          return (
                            <div
                              key={tier}
                              style={{
                                padding: '6px 8px',
                                borderLeft: '1px solid var(--color-divider)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: 2,
                              }}
                            >
                              {!pct && <span style={affix}>$</span>}
                              <input
                                className="input"
                                placeholder={pct ? '0' : '0.00'}
                                value={val}
                                onChange={(e) => setContrib(p, c.id, tier, e.target.value)}
                                style={{
                                  border: 0,
                                  background: 'transparent',
                                  padding: '5px 4px',
                                  fontSize: 12.5,
                                  textAlign: 'right',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              />
                              {pct && <span style={affix}>%</span>}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PlanCell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '6px 8px',
        borderLeft: '1px solid var(--color-divider)',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      {children}
    </div>
  );
}
