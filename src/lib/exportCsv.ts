/**
 * CSV rendering for group exports — built off the same `GroupExportModel`
 * shape as exportPdf.ts, kept as flat tables so the file is Excel-friendly.
 */
import type { GroupExportModel } from './exportGroup';

const TIER_COLS = ['EE', 'ES', 'EC', 'EF'] as const;

export function toCsv(rows: string[][]): string {
  const esc = (v: string): string => {
    const s = v ?? '';
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((row) => row.map(esc).join(',')).join('\r\n');
}

export function downloadCsv(rows: string[][], filename: string): void {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** One row per plan x employee class — the natural flat join of pricing and contributions. */
export function groupToCsvRows(model: GroupExportModel): string[][] {
  const header = [
    'Plan',
    'Version',
    'RX',
    'Rate EE',
    'Rate ES',
    'Rate EC',
    'Rate EF',
    'Class',
    'Contrib EE',
    'Contrib ES',
    'Contrib EC',
    'Contrib EF',
  ];
  const rows: string[][] = [header];
  const contribByPlan = new Map(model.contributions.map((c) => [c.plan, c.classes]));

  for (const p of model.plans) {
    const rateCols = TIER_COLS.map((t) => p.rates[t]);
    const classes = contribByPlan.get(p.name) ?? [];
    if (classes.length === 0) {
      rows.push([p.name, p.version, p.rx, ...rateCols, '', '', '', '', '']);
      continue;
    }
    for (const cl of classes) {
      rows.push([p.name, p.version, p.rx, ...rateCols, cl.className, ...TIER_COLS.map((t) => cl.tiers[t])]);
    }
  }
  return rows;
}

/** One row per group — a roster snapshot, matching the bulk PDF summary's columns. */
export function groupsToCsvRows(models: GroupExportModel[]): string[][] {
  const header = ['Group', 'Status', 'Type', 'Manager', 'Guide', 'Effective', 'OE window', 'EEs', 'Plans offered', 'OE Guide'];
  const rows: string[][] = [header];
  for (const m of models) {
    rows.push([
      m.group.name,
      m.group.status,
      m.group.type,
      m.group.manager,
      m.group.guide,
      m.group.effective,
      m.group.oeWindow,
      String(m.group.employees),
      String(m.plans.length),
      m.guide.complete ? 'Complete' : 'In progress',
    ]);
  }
  return rows;
}
