import type { TranslationKey } from '@/constants/i18n';

// Malaysian support lines, shared by Poof's crisis card and Get help so the numbers have one source.
// Tapping one opens the phone dialler; nothing is called automatically.
export const SUPPORT_LINES = [
  { key: 'poof.crisis.emergency', tel: '999' },
  { key: 'poof.crisis.befrienders', tel: '0376272929' },
  { key: 'poof.crisis.heal', tel: '15555' },
] as const satisfies readonly { key: TranslationKey; tel: string }[];

// UMPSA Pusat Sejahtera (counselling), from its official site (checked 2026-11-15).
// Students book through MyGading; the site's booking button links to this login page.
export const UMPSA_COUNSELLING = {
  tel: '094316999',
  bookingUrl: 'https://gading.ump.edu.my/ump/r/student/sppa-portal/login-page',
  counsellorsUrl: 'https://sites.google.com/umpsa.edu.my/pusatsejahteraumpsa/about-us/counsellor-by-faculty',
} as const;
