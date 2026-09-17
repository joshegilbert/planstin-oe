/**
 * Shapes one group's data into a plain, renderer-agnostic model so the PDF
 * and CSV exports (src/lib/exportPdf.ts, src/lib/exportCsv.ts) build off the
 * same source instead of each re-deriving it from `Group`.
 */
import type { AppData, Group, Tier } from '../types';
import { personName } from './capacity';
import { md, mdy } from './dates';
import { INFO_FIELDS, PLANS, TIERS, TIMELINE_ITEMS, TOOL_ITEMS } from './constants';

export interface GroupExportInfo {
  name: string;
  status: string;
  type: string;
  format: string;
  effective: string;
  oeWindow: string;
  manager: string;
  guide: string;
  employees: number;
}

export interface GroupExportDoc {
  label: string;
  status: string;
  date: string;
  note: string;
}

export interface GroupExportChecklistItem {
  label: string;
  done: boolean;
  detail: string;
}

export interface GroupExportGuide {
  complete: boolean;
  completedBy: string;
  tool: GroupExportChecklistItem[];
  timeline: GroupExportChecklistItem[];
}

export interface GroupExportPlan {
  name: string;
  version: string;
  rx: string;
  rates: Record<Tier, string>;
}

export interface GroupExportContribClass {
  className: string;
  tiers: Record<Tier, string>;
}

export interface GroupExportContribution {
  plan: string;
  classes: GroupExportContribClass[];
}

export interface GroupExportModel {
  group: GroupExportInfo;
  info: Array<[string, string]>;
  docs: GroupExportDoc[];
  guide: GroupExportGuide;
  plans: GroupExportPlan[];
  contribMode: '$' | '%';
  contributions: GroupExportContribution[];
}

const emptyTierRow = (): Record<Tier, string> => ({ EE: '', ES: '', EC: '', EF: '' });

export function buildGroupExport(data: AppData, g: Group): GroupExportModel {
  const group: GroupExportInfo = {
    name: g.name,
    status: g.status,
    type: g.type,
    format: g.format,
    effective: mdy(g.effective),
    oeWindow: g.oeStart && g.oeEnd ? `${md(g.oeStart)} – ${md(g.oeEnd)}` : '—',
    manager: personName(data, g.managerId),
    guide: personName(data, g.guideId),
    employees: g.employees,
  };

  const info: Array<[string, string]> = INFO_FIELDS.map(([key, label]) => [label, g.info[key] ?? '']);

  const docs: GroupExportDoc[] = (['asa', 'census'] as const).map((k) => {
    const d = g.docs[k];
    return {
      label: k === 'asa' ? 'ASA' : 'Census',
      status: d.done ? 'Received' : 'Outstanding',
      date: d.date ? mdy(d.date) : '',
      note: d.note,
    };
  });

  const guide: GroupExportGuide = {
    complete: g.oeGuide.complete,
    completedBy:
      g.oeGuide.complete && g.oeGuide.by
        ? `${g.oeGuide.by} on ${new Date(g.oeGuide.at).toLocaleDateString()}`
        : '',
    tool: TOOL_ITEMS.map((t) => {
      const item = g.tool[t] ?? { done: false, note: '' };
      return { label: t, done: item.done, detail: item.note };
    }),
    timeline: TIMELINE_ITEMS.map((t) => {
      const item = g.timeline[t] ?? { done: false, date: '' };
      return { label: t, done: item.done, detail: item.date ? mdy(item.date) : '' };
    }),
  };

  const offered = PLANS.filter((p) => g.planRows[p]?.offering);

  const plans: GroupExportPlan[] = offered.map((p) => {
    const row = g.planRows[p] ?? {};
    const rates = emptyTierRow();
    for (const [tier] of TIERS) rates[tier] = row.rates?.[tier] ?? '';
    return { name: p, version: row.version ?? '', rx: row.rx ?? '', rates };
  });

  const contributions: GroupExportContribution[] = offered.map((p) => ({
    plan: p,
    classes: g.classes.map((c) => {
      const tiers = emptyTierRow();
      for (const [tier] of TIERS) tiers[tier] = g.contrib[p]?.[c.id]?.[tier] ?? '';
      return { className: c.name || 'Untitled class', tiers };
    }),
  }));

  return { group, info, docs, guide, plans, contribMode: g.contribMode, contributions };
}
