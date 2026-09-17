/** Checklist / plan vocabularies carried over from the mockup. */
import type { Role } from '../types';

/** Display labels for the three business roles — stored DB values stay the
 * short scheduling-era names (Guide/Manager/Specialist) so the RLS logic and
 * existing data keyed on them don't need to change. */
export const ROLE_LABELS: Record<Role, string> = {
  Guide: 'Benefit Guide',
  Manager: 'Benefit Manager',
  Specialist: 'Benefit Specialist',
  Employee: 'Employee',
};

export const ROLES: Role[] = ['Guide', 'Manager', 'Specialist', 'Employee'];

export const SPECIALIST_PALETTE = [
  '#0072B2',
  '#E69F00',
  '#009E73',
  '#CC79A7',
  '#56B4E9',
  '#8C6D1F',
];

export const TOOL_ITEMS = [
  'Built Out',
  'Audit',
  'HSA Contribution',
  'Attachements / Links',
  'Quote',
  'Renewal Rates',
  'ASA',
  'Section 125',
  'Internal Announcement',
  'Landing Page',
  'English Flyer',
  'Spanish Flyer',
  'Video Presentation',
  'Employee Census',
  'SalesForce',
  'Final Underwriting',
  'Outreach',
  'DPC Request',
  'Education Game Plan',
];

export const TIMELINE_ITEMS = [
  'Onboarding Call',
  'Open Enrollment',
  'Processing',
  'Invoice Audit',
  'ID Cards',
  'Underwriting',
  'Invoice Paid',
  'Open Enrollment Follow Up Meeting',
  'Monthly/Quarterly Check-Ins',
  'Reoccuring New Hire Orientation',
  'Employee Navigator Walk-Through',
];

export const PLANS = [
  'Preventive Core',
  'Preventive HSA',
  'Preventive Copay',
  'Care+ Core',
  'Care+ HSA',
  'Care+ Direct',
  'Care+ 1500',
  'Care+ 2500',
  'Care+ 3500',
  'Guided Ethos',
  'Guided Align',
  'Zion HealthShare $1250 IUA',
  'Zion HealthShare $2500 IUA',
  'Zion HealthShare $5000 IUA',
  'Dental Elite',
  'Dental Care',
  'Vision',
  'Primestin Virtual Care',
  'Primestin DPC',
  'Giving Accident (not available in NM)',
  'Giving Critical Illness (not available in NM)',
  'Hospital Indemnity (not available in NM)',
  'Life',
  'Short-Term Disability',
  'Long-Term Disability',
  '401k',
];

/** [key, label, placeholder] — free-text group info fields on the Details tab. */
export const INFO_FIELDS: Array<[string, string, string]> = [
  ['enrollmentTool', 'Enrollment tool', 'Employee Navigator'],
  ['incentive', 'Incentive', ''],
  ['language', 'Language needs', 'English only'],
  ['waiting', 'Waiting period', '1st of month after 30 days'],
  ['lowestPaid', 'Lowest paid employee', '$/hr'],
  ['payroll', 'Payroll information', 'Provider & frequency'],
  ['dpc', 'DPC network', ''],
];

export const TIERS: Array<['EE' | 'ES' | 'EC' | 'EF', string]> = [
  ['EE', 'Employee only'],
  ['ES', '+ Spouse'],
  ['EC', '+ Children'],
  ['EF', 'Family'],
];

export const STATUSES = ['Not scheduled', 'Scheduled', 'In progress', 'Complete'] as const;

/** Fraction of a specialist's weekly capacity treated as "at the ceiling". */
export const CAPACITY_CEILING = 0.9;
/** Number of weeks shown across the capacity board. */
export const BOARD_WEEKS = 13;
export const WEEK_STARTS_ON: 0 | 1 = 0;
