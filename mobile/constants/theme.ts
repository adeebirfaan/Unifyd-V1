export const colors = {
  brandBlue: '#007AFB', brandCyan: '#34C1FC',
  brandGradient: ['#007AFB', '#34C1FC'] as const,
  background: '#0B0B0F', surface: '#17171C', surfaceElevated: '#23232A',
  border: '#2E2E37', textPrimary: '#F8FAFC', textSecondary: '#98A2B3',
  textTertiary: '#667085', success: '#22C55E', warning: '#F59E0B',
  danger: '#EF4444', white: '#FFFFFF', black: '#000000',
} as const;

export const spacing = {
  space1: 4, space2: 8, space3: 12, space4: 16,
  space5: 20, space6: 24, space8: 32,
} as const;

export const radius = {
  radiusSm: 12, radiusMd: 16, radiusLg: 24, radiusFull: 999,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '700' },
  screenTitle: { fontSize: 26, fontWeight: '700' },
  sectionTitle: { fontSize: 19, fontWeight: '700' },
  body: { fontSize: 16, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '600' },
  numeric: { fontSize: 28, fontWeight: '700' },
} as const;
