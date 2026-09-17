/**
 * PDF rendering for group exports — builds a jsPDF document off the plain
 * `GroupExportModel` shape from exportGroup.ts, so this file only deals with
 * layout, never with reaching back into `Group`/`AppData`.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { GroupExportModel } from './exportGroup';

const TIER_COLS = ['EE', 'ES', 'EC', 'EF'] as const;
const MARGIN = 40;
const PAGE_H = 792; // US Letter, pt

function finalY(doc: jsPDF, fallback: number): number {
  const t = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return t?.finalY ?? fallback;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= PAGE_H - MARGIN) return y;
  doc.addPage();
  return MARGIN;
}

function sectionTitle(doc: jsPDF, y: number, label: string): number {
  y = ensureSpace(doc, y, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(label, MARGIN, y);
  return y + 14;
}

function money(v: string): string {
  return v ? `$${v}` : '—';
}

export function renderGroupPdf(model: GroupExportModel): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const { group } = model;
  let y = MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(group.name, MARGIN, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(
    `${group.status} · ${group.type} · ${group.format} · ${group.employees} eligible employees`,
    MARGIN,
    y,
  );
  y += 20;
  doc.setTextColor(0);

  y = sectionTitle(doc, y, 'Group details');
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 140 } },
    body: [
      ['Effective date', group.effective],
      ['Open enrollment', group.oeWindow],
      ['Benefit manager', group.manager],
      ['Benefit guide', group.guide],
      ...model.info.filter(([, v]) => v).map(([label, v]) => [label, v]),
    ],
  });
  y = finalY(doc, y) + 20;

  y = sectionTitle(doc, y, 'Documents');
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Document', 'Status', 'Date', 'Note']],
    body: model.docs.map((d) => [d.label, d.status, d.date || '—', d.note || '']),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [240, 240, 240], textColor: 20 },
  });
  y = finalY(doc, y) + 20;

  y = sectionTitle(doc, y, `OE Guide — ${model.guide.complete ? 'Complete' : 'In progress'}`);
  if (model.guide.completedBy) {
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`Completed by ${model.guide.completedBy}`, MARGIN, y);
    doc.setTextColor(0);
    y += 14;
  }
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Enrollment tool build', 'Done', 'Note']],
    body: model.guide.tool.map((t) => [t.label, t.done ? '✓' : '', t.detail]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [240, 240, 240], textColor: 20 },
    columnStyles: { 1: { cellWidth: 40, halign: 'center' } },
  });
  y = finalY(doc, y) + 16;

  y = ensureSpace(doc, y, 40);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Open enrollment timeline', 'Done', 'Date']],
    body: model.guide.timeline.map((t) => [t.label, t.done ? '✓' : '', t.detail]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [240, 240, 240], textColor: 20 },
    columnStyles: { 1: { cellWidth: 40, halign: 'center' } },
  });
  y = finalY(doc, y) + 20;

  y = sectionTitle(doc, y, 'Plan options');
  if (model.plans.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text('No plans marked as offered.', MARGIN, y);
    doc.setTextColor(0);
    y += 18;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Plan', 'Version', 'RX', ...TIER_COLS.map((t) => `${t} /mo`)]],
      body: model.plans.map((p) => [
        p.name,
        p.version || '—',
        p.rx || '—',
        ...TIER_COLS.map((t) => money(p.rates[t])),
      ]),
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: [240, 240, 240], textColor: 20 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
    });
    y = finalY(doc, y) + 20;
  }

  y = sectionTitle(
    doc,
    y,
    `Contributions (${model.contribMode === '%' ? '% of premium' : 'dollar amount /mo'})`,
  );
  if (model.contributions.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text('No offered plans to show contributions for.', MARGIN, y);
    doc.setTextColor(0);
  } else {
    for (const c of model.contributions) {
      y = ensureSpace(doc, y, 40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(c.plan, MARGIN, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [['Class', ...TIER_COLS]],
        body: c.classes.map((cl) => [
          cl.className,
          ...TIER_COLS.map((t) =>
            cl.tiers[t] ? (model.contribMode === '%' ? `${cl.tiers[t]}%` : money(cl.tiers[t])) : '—',
          ),
        ]),
        styles: { fontSize: 8.5, cellPadding: 4 },
        headStyles: { fillColor: [248, 248, 248], textColor: 20 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      });
      y = finalY(doc, y) + 16;
    }
  }

  return doc;
}

export function downloadGroupPdf(model: GroupExportModel, filename: string): void {
  renderGroupPdf(model).save(filename);
}

export function renderGroupsSummaryPdf(models: GroupExportModel[]): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Groups export', MARGIN, MARGIN);

  autoTable(doc, {
    startY: MARGIN + 16,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Group', 'Status', 'Type', 'Manager', 'Guide', 'Effective', 'OE window', 'EEs', 'Plans offered', 'OE Guide']],
    body: models.map((m) => [
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
    ]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [240, 240, 240], textColor: 20 },
    columnStyles: { 7: { halign: 'right' }, 8: { halign: 'right' } },
  });

  return doc;
}

export function downloadGroupsSummaryPdf(models: GroupExportModel[], filename: string): void {
  renderGroupsSummaryPdf(models).save(filename);
}
