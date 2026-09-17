import { useNavigate } from 'react-router-dom';
import { useData } from '../../data/DataProvider';
import { useUi } from '../../ui/UiProvider';
import { anchorStyle } from '../primitives';
import { md, mdy } from '../../lib/dates';
import { deadlineOf, docState, isLate, personName, windowOf } from '../../lib/capacity';

export default function BookingPopover() {
  const { data, patchGroup } = useData();
  const ui = useUi();
  const nav = useNavigate();

  if (!ui.pop) return null;
  const g = data.groups.find((x) => x.id === ui.pop!.gid);
  if (!g) return null;

  const [s, e] = windowOf(g, null);
  const dl = deadlineOf(data, g);
  const late = isLate(data, g);
  const ds = docState(g);

  const rows: Array<{ k: string; v: string; accent?: boolean }> = [
    { k: 'Employees', v: `${g.employees} · ${g.type}` },
    { k: 'Manager', v: personName(data, g.managerId) },
    { k: 'Guide', v: personName(data, g.guideId) },
    {
      k: 'Specialists',
      v: g.specialists.length
        ? g.specialists.map((a) => `${personName(data, a.id)} ${a.share}`).join(' · ')
        : 'Unassigned',
    },
    {
      k: 'eNav',
      v: dl ? (late ? `Past closeout ${md(dl)}` : `Closeout ${md(dl)}`) : 'Closeout not configured',
      accent: late,
    },
    {
      k: 'Docs',
      v: ds === 'ok' ? 'ASA + Census in' : ds === 'asa' ? 'ASA outstanding' : 'Census outstanding',
      accent: ds !== 'ok',
    },
    { k: 'Status', v: g.status },
  ];

  return (
    <>
      <div onClick={() => ui.setPop(null)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
      <div
        style={{
          left: Math.max(12, Math.min(ui.pop.x, window.innerWidth - 330)),
          zIndex: 70,
          ...anchorStyle(ui.pop, 310, 300),
          background: '#fff',
          border: '1px solid var(--color-divider)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-lg)',
          padding: '16px 18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ font: '600 17px/1.15 var(--font-heading)', flex: 1 }}>{g.name}</div>
          <button
            onClick={() => ui.setPop(null)}
            style={{
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 15,
              lineHeight: 1,
              color: 'var(--color-text)',
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'color-mix(in srgb,var(--color-text) 60%,transparent)',
            marginTop: 3,
          }}
        >
          {mdy(s)} – {mdy(e)} · {g.format}
        </div>
        <hr className="hr" style={{ margin: '11px 0' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
          {rows.map((r) => (
            <div key={r.k} style={{ display: 'flex', gap: 10 }}>
              <span
                style={{
                  width: 74,
                  flex: 'none',
                  font: '600 11.5px/1.5 var(--font-heading)',
                  color: 'color-mix(in srgb,var(--color-text) 50%,transparent)',
                }}
              >
                {r.k}
              </span>
              <span
                style={{
                  color: r.accent ? 'var(--color-accent-700)' : 'inherit',
                  fontWeight: r.accent ? 700 : 400,
                }}
              >
                {r.v}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            className="btn btn-primary"
            style={{ fontSize: 12 }}
            onClick={() => {
              ui.setPop(null);
              nav(`/groups/${g.id}`);
            }}
          >
            Open group
          </button>
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12 }}
            onClick={() => {
              patchGroup(g.id, { oeStart: '', oeEnd: '', status: 'Not scheduled', weekLoad: {} });
              ui.setPop(null);
            }}
          >
            Unschedule
          </button>
        </div>
      </div>
    </>
  );
}
