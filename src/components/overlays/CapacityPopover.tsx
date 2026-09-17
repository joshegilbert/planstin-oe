import { useNavigate } from 'react-router-dom';
import { useData } from '../../data/DataProvider';
import { useUi } from '../../ui/UiProvider';
import { anchorStyle } from '../primitives';
import { mdy } from '../../lib/dates';
import { personById, specialistColor, specialistsOf } from '../../lib/capacity';

export default function CapacityPopover() {
  const { data, setCapacityOverride } = useData();
  const ui = useUi();
  const nav = useNavigate();

  if (!ui.capPop) return null;
  const p = personById(data, ui.capPop.pid);
  if (!p) return null;
  const ws = ui.capPop.ws;
  const override = (p.capWeeks ?? {})[ws];
  const hasOverride = override !== undefined && override !== '';

  return (
    <>
      <div onClick={() => ui.setCapPop(null)} style={{ position: 'fixed', inset: 0, zIndex: 74 }} />
      <div
        style={{
          left: Math.max(12, Math.min(ui.capPop.x - 130, window.innerWidth - 272)),
          zIndex: 75,
          ...anchorStyle(ui.capPop, 260, 240),
          background: '#fff',
          border: '1px solid var(--color-divider)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-lg)',
          padding: '15px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 3,
              background: specialistColor(data, p.id),
              display: 'block',
            }}
          />
          <span style={{ font: '600 13.5px/1.2 var(--font-heading)' }}>{p.name}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', margin: '5px 0 13px' }}>
          Week of {mdy(ws)}
        </div>
        <div className="field">
          <label htmlFor="cap-week">Capacity this week</label>
          <input
            id="cap-week"
            className="input"
            type="number"
            placeholder={String(p.capacity ?? 0)}
            value={hasOverride ? String(override) : ''}
            onChange={(e) => setCapacityOverride(p.id, ws, e.target.value)}
          />
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 7 }}>
          {hasOverride
            ? `Overrides the standing ${p.capacity ?? 0} for this week only.`
            : `Using the standing ${p.capacity ?? 0} per week.`}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12, flex: 1 }}
            onClick={() => {
              const hid: Record<string, boolean> = { none: true };
              for (const x of specialistsOf(data)) if (x.id !== p.id) hid[x.id] = true;
              ui.setHidden(hid);
              ui.setView('week');
              ui.setAnchor(ws);
              ui.setCapPop(null);
              nav('/calendar');
            }}
          >
            Open this week
          </button>
          <button
            onClick={() => setCapacityOverride(p.id, ws, '')}
            style={{
              border: '1px solid var(--color-divider)',
              borderRadius: 999,
              background: '#fff',
              cursor: 'pointer',
              padding: '9px 14px',
              font: '600 12px/1 var(--font-heading)',
              color: 'var(--color-muted)',
            }}
          >
            Reset
          </button>
        </div>
      </div>
    </>
  );
}
