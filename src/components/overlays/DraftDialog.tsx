import type { CSSProperties } from 'react';
import { useData } from '../../data/DataProvider';
import { useUi, type DraftState } from '../../ui/UiProvider';
import { mdy } from '../../lib/dates';
import type { Group } from '../../types';

function newId(prefix: string) {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${prefix}${Date.now()}`;
}

export default function DraftDialog() {
  const { data, addGroup, meName } = useData();
  const ui = useUi();
  const draft = ui.draft;
  if (!draft) return null;

  const set = (k: keyof DraftState, v: string) => ui.setDraft({ ...draft, [k]: v });

  const managers = data.people.filter((p) => p.role === 'Manager');
  const guides = data.people.filter((p) => p.role === 'Guide');

  const wide: CSSProperties = { gridColumn: '1 / -1' };

  function save() {
    const emp = Number(draft!.employees) || 0;
    const group: Group = {
      id: newId('g'),
      name: draft!.name || 'Untitled group',
      employees: emp,
      // Book-of-business fields come from the import; a group drafted in-app
      // starts blank and is filled in on the Details tab.
      enrollments: null,
      state: '',
      agent: '',
      type: draft!.type,
      effective: draft!.effective,
      originalEffective: draft!.effective,
      oeStart: '',
      oeEnd: '',
      format: draft!.format,
      guideId: draft!.guideId,
      managerId: draft!.managerId,
      specialists: [],
      status: 'Not scheduled',
      oeMode: 'Full',
      docs: {
        asa: { done: false, date: '', note: '' },
        census: { done: false, date: '', note: '' },
      },
      oeGuide: { complete: false, by: '', at: 0 },
      notes: '',
      info: {},
      tool: {},
      timeline: {},
      planRows: {},
      classes: [{ id: newId('c'), name: 'All employees' }],
      contrib: {},
      contribMode: '$',
      weekLoad: {},
      editedBy: meName,
      editedAt: Date.now(),
    };
    addGroup(group);
    ui.setSched({ gid: group.id, len: 2, start: draft!.prefillStart ?? null });
    ui.setDraft(null);
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(16,24,40,.34)',
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 18,
          width: 520,
          maxWidth: '92vw',
          padding: '24px 26px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <h4 style={{ margin: '0 0 2px' }}>New group</h4>
        <div style={{ fontSize: 12, color: 'color-mix(in srgb,var(--color-text) 58%,transparent)' }}>
          {draft.prefillStart
            ? `Step 1 of 2 — you'll land on the week of ${mdy(draft.prefillStart)} next.`
            : "Step 1 of 2 — you'll pick the OE window next."}
        </div>
        <hr className="hr" style={{ margin: '14px 0' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
          <div className="field" style={wide}>
            <label htmlFor="d-name">Group name</label>
            <input
              id="d-name"
              className="input"
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="d-emp">Employees</label>
            <input
              id="d-emp"
              className="input"
              type="number"
              value={draft.employees}
              onChange={(e) => set('employees', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="d-type">Type</label>
            <select
              id="d-type"
              className="input"
              value={draft.type}
              onChange={(e) => set('type', e.target.value)}
            >
              <option value="Renewal">Renewal</option>
              <option value="New">New</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="d-eff">Benefit effective date</label>
            <input
              id="d-eff"
              className="input"
              type="date"
              value={draft.effective}
              onChange={(e) => set('effective', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="d-fmt">OE format</label>
            <select
              id="d-fmt"
              className="input"
              value={draft.format}
              onChange={(e) => set('format', e.target.value)}
            >
              <option value="Virtual">Virtual</option>
              <option value="In-Person">In-Person</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="d-mgr">Benefit Manager</label>
            <select
              id="d-mgr"
              className="input"
              value={draft.managerId}
              onChange={(e) => set('managerId', e.target.value)}
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
            <label htmlFor="d-guide">Benefit Guide</label>
            <select
              id="d-guide"
              className="input"
              value={draft.guideId}
              onChange={(e) => set('guideId', e.target.value)}
            >
              <option value="">Unassigned</option>
              {guides.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={save}>
            Continue
          </button>
          <button
            className="btn btn-secondary"
            style={{ fontSize: 13 }}
            onClick={() => ui.setDraft(null)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
