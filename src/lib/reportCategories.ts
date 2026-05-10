export const REPORT_CATEGORY_IDS = [
  'harassment',
  'spam',
  'hate',
  'impersonation',
  'scam',
  'nsfw',
  'copyright',
  'other',
] as const;

export type ReportCategoryId = (typeof REPORT_CATEGORY_IDS)[number];

export const REPORT_CATEGORY_OPTIONS: { id: ReportCategoryId; label: string }[] = [
  { id: 'harassment', label: 'Harassment or abuse' },
  { id: 'spam', label: 'Spam or scams' },
  { id: 'hate', label: 'Hate or discrimination' },
  { id: 'impersonation', label: 'Impersonation' },
  { id: 'scam', label: 'Fraud / malicious links' },
  { id: 'nsfw', label: 'NSFW or graphic content' },
  { id: 'copyright', label: 'Copyright or IP' },
  { id: 'other', label: 'Other (explain below)' },
];

export function isReportCategoryId(v: string): v is ReportCategoryId {
  return (REPORT_CATEGORY_IDS as readonly string[]).includes(v);
}

export function reportCategoryLabel(id: string | null | undefined): string {
  if (!id) return '—';
  const o = REPORT_CATEGORY_OPTIONS.find((x) => x.id === id);
  return o?.label ?? id;
}
