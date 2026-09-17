import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../data/DataProvider';
import { EMPTY_FILTERS, useUi } from '../ui/UiProvider';
import { pillToggleStyle, tagStyle } from '../components/primitives';
import { STATUSES } from '../lib/constants';
import { md, monthLabel } from '../lib/dates';
import { docState, isLate, personName, specialistColor, specialistsOf } from '../lib/capacity';
import { buildGroupExport } from '../lib/exportGroup';
import { downloadGroupsSummaryPdf } from '../lib/exportPdf';
import { downloadCsv, groupsToCsvRows } from '../lib/exportCsv';
import type { Group } from '../types';

const COLUMNS: Array<[string, string]> = [
  ['name', 'Group'],
  ['emp', 'EE'],
  ['eff', 'Effective'],
  ['oe', 'OE window'],
  ['manager', 'Manager'],
  ['specs', 'Specialists'],
  ['docs', 'Docs'],
  ['guide', 'OE'],
  ['status', 'Status'],
];

export default function GroupsScreen() {
  const { data, me } = useData();
  const ui = useUi();
  const nav = useNavigate();
  const F = ui.filters;

  const rows = useMemo(() => {
    const inFilter = (g: Group) => {
      if (F.manager && g.managerId !== F.manager) return false;
      if (F.specialist && !g.specialists.some((a) => a.id === F.specialist)) return false;
      if (F.month && g.effective.slice(0, 7) !== F.month) return false;
      if (F.status && g.status !== F.status) return false;
      if (
        F.mine &&
        !(
          g.managerId === me?.id ||
          g.guideId === me?.id ||
          g.specialists.some((a) => a.id === me?.id)
        )
      ) {
        return false;
      }
      if (F.bucket) {
        const e = g.employees;
        if (F.bucket === '1-25' && !(e <= 25)) return false;
        if (F.bucket === '26-100' && !(e > 25 && e <= 100)) return false;
        if (F.bucket === '101-300' && !(e > 100 && e <= 300)) return false;
        if (F.bucket === '300+' && !(e > 300)) return false;
      }
      return true;
    };
    const val = (g: Group): string | number => {
      switch (ui.sort.k) {
        case 'name':
          return g.name.toLowerCase();
        case 'emp':
          return g.employees;
        case 'eff':
          return g.effective;
        case 'oe':
          return g.oeStart || 'zzz';
        case 'manager':
          return personName(data, g.managerId);
        case 'specs':
          return g.specialists.map((x) => personName(data, x.id)).join();
        case 'docs':
          return docState(g);
        case 'guide':
          return g.oeMode || 'Full';
        default:
          return g.status;
      }
    };
    return data.groups
      .filter(inFilter)
      .slice()
      .sort((a, b) => {
        const A = val(a);
        const B = val(b);
        return (A < B ? -1 : A > B ? 1 : 0) * ui.sort.d;
      });
  }, [data, F, ui.sort, me]);

  const monthsSet = Array.from(new Set(data.groups.map((g) => g.effective.slice(0, 7))))
    .filter(Boolean)
    .sort();

  const filterDefs: Array<{ key: keyof typeof F; blank: string; options: Array<[string, string]> }> = [
    {
      key: 'manager',
      blank: 'All managers',
      options: data.people.filter((p) => p.role === 'Manager').map((p) => [p.id, p.name]),
    },
    {
      key: 'specialist',
      blank: 'All specialists',
      options: specialistsOf(data).map((p) => [p.id, p.name]),
    },
    { key: 'month', blank: 'All months', options: monthsSet.map((m) => [m, monthLabel(m)]) },
    { key: 'status', blank: 'All statuses', options: STATUSES.map((s) => [s, s]) },
  ];

  const exportPdf = () => downloadGroupsSummaryPdf(rows.map((g) => buildGroupExport(data, g)), 'groups-export.pdf');
  const exportCsv = () => downloadCsv(groupsToCsvRows(rows.map((g) => buildGroupExport(data, g))), 'groups-export.csv');

  return (
    <div style={{ padding: '22px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Groups</h3>
        <div style={{ fontSize: 12, color: 'color-mix(in srgb,var(--color-text) 55%,transparent)' }}>
          {rows.length} of {data.groups.length} groups
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={exportPdf}>
          Export PDF
        </button>
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={exportCsv}>
          Export CSV
        </button>
        <button
          className="btn btn-primary"
          style={{ fontSize: 12 }}
          onClick={() =>
            ui.setDraft({
              name: '',
              employees: '',
              type: 'Renewal',
              effective: '',
              format: 'Virtual',
              managerId: '',
              guideId: '',
            })
          }
        >
          New group
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          paddingBottom: 14,
        }}
      >
        {filterDefs.map((f) => (
          <select
            key={f.key}
            className="input"
            value={String(F[f.key] ?? '')}
            onChange={(e) => ui.setFilters({ ...F, [f.key]: e.target.value })}
            style={{ width: 'auto', minWidth: 130 }}
          >
            <option value="">{f.blank}</option>
            {f.options.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        ))}
        <button
          onClick={() => ui.setFilters({ ...F, mine: !F.mine })}
          style={pillToggleStyle(F.mine)}
        >
          My groups
        </button>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12 }}
          onClick={() => ui.setFilters(EMPTY_FILTERS)}
        >
          Clear
        </button>
      </div>

      <table className="tbl">
        <thead>
          <tr>
            {COLUMNS.map(([k, label]) => (
              <th
                key={k}
                onClick={() => ui.setSort({ k, d: ui.sort.k === k ? ((-ui.sort.d) as 1 | -1) : 1 })}
                style={{
                  textAlign: k === 'emp' ? 'right' : 'left',
                  color:
                    ui.sort.k === k
                      ? 'var(--color-text)'
                      : 'color-mix(in srgb,var(--color-text) 62%,transparent)',
                }}
              >
                {label}
                {ui.sort.k === k ? (ui.sort.d > 0 ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => {
            const ds = docState(g);
            return (
              <tr key={g.id}>
                <td>
                  <button
                    onClick={() => nav(`/groups/${g.id}`)}
                    style={{
                      border: 0,
                      background: 'transparent',
                      padding: 0,
                      cursor: 'pointer',
                      font: '600 13px/1.3 var(--font-heading)',
                      color: 'var(--color-text)',
                      textAlign: 'left',
                    }}
                  >
                    {g.name}
                  </button>
                  <div
                    style={{
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                      color: 'var(--color-muted)',
                      marginTop: 2,
                    }}
                  >
                    {g.type} · {g.format}
                  </div>
                </td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {g.employees}
                </td>
                <td>{md(g.effective)}</td>
                <td>{g.oeStart ? `${md(g.oeStart)} – ${md(g.oeEnd)}` : '—'}</td>
                <td>{personName(data, g.managerId)}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {g.specialists.length ? (
                      g.specialists.map((a) => (
                        <span
                          key={a.id}
                          style={{
                            font: '600 11.5px/1 var(--font-heading)',
                            padding: '4px 10px',
                            borderRadius: 999,
                            background: specialistColor(data, a.id),
                            color: '#fff',
                          }}
                        >
                          {personName(data, a.id)} {a.share}
                        </span>
                      ))
                    ) : (
                      <span
                        style={{
                          font: '600 11.5px/1 var(--font-heading)',
                          padding: '4px 10px',
                          borderRadius: 999,
                          border: '1px dashed var(--color-neutral-400)',
                          color: 'var(--color-neutral-700)',
                        }}
                      >
                        Unassigned
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <span style={tagStyle(ds === 'ok' ? 'ok' : ds === 'asa' ? 'bad' : 'warn')}>
                    {ds === 'ok' ? 'In' : ds === 'asa' ? 'ASA out' : 'Census out'}
                  </span>
                </td>
                <td>
                  <span
                    style={tagStyle(g.oeGuide.complete && g.oeMode !== 'None' ? 'ok' : 'none')}
                  >
                    {g.oeMode === 'None'
                      ? 'No OE'
                      : g.oeMode === 'Passive'
                        ? 'Renewal'
                        : g.oeGuide.complete
                          ? 'Guide done'
                          : 'Full'}
                  </span>
                </td>
                <td>
                  <span style={tagStyle(isLate(data, g) ? 'warn' : 'none')}>{g.status}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
