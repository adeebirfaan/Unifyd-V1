export const colors = {
  brandBlue: '#007AFB', brandCyan: '#34C1FC',
  brandGradient: ['#007AFB', '#34C1FC'] as const,
  background: '#0B0B0F', surface: '#17171C', surfaceElevated: '#23232A',
  border: '#2E2E37', textPrimary: '#F8FAFC', textSecondary: '#98A2B3',
  textTertiary: '#667085', success: '#22C55E', warning: '#F59E0B',
  danger: '#EF4444', white: '#FFFFFF', black: '#000000',
} as const;

export type ThemePreference = 'system' | 'light' | 'dark';

// The approved dark palette is preserved verbatim. Light changes only the page
// surface and colours that sit directly on that page.
export const semanticThemes = {
  dark: {
    screenBackground: colors.background,
    screenText: colors.textPrimary,
    mutedText: colors.textSecondary,
    subtleText: colors.textTertiary,
    pageAccent: colors.brandCyan,
    errorText: colors.danger,
    successText: colors.success,
    cardBackground: colors.surface,
    cardElevated: colors.surfaceElevated,
    cardText: colors.textPrimary,
    cardMutedText: colors.textSecondary,
    cardErrorText: colors.danger,
    modalScrim: 'rgba(0,0,0,0.7)',
    border: colors.border,
    navigationBackground: colors.surface,
    primaryButtonBorder: colors.white,
    primaryButtonBorderWidth: 0,
    actionInk: colors.background,
    homeAvatarOutline: colors.border,
    destructiveBackground: '#B42318',
    destructiveForeground: colors.white,
    brandBlue: colors.brandBlue,
    brandCyan: colors.brandCyan,
    brandGradient: colors.brandGradient,
  },
  light: {
    screenBackground: '#F7F8FA',
    screenText: '#17171C',
    mutedText: '#475467',
    subtleText: '#667085',
    pageAccent: '#0057B7',
    errorText: '#B42318',
    successText: '#027A48',
    cardBackground: colors.surface,
    cardElevated: colors.surfaceElevated,
    cardText: colors.textPrimary,
    cardMutedText: colors.textSecondary,
    cardErrorText: colors.danger,
    modalScrim: 'rgba(0,0,0,0.7)',
    border: colors.border,
    navigationBackground: colors.surface,
    primaryButtonBorder: colors.border,
    primaryButtonBorderWidth: 1,
    actionInk: colors.background,
    homeAvatarOutline: colors.textTertiary,
    destructiveBackground: '#B42318',
    destructiveForeground: colors.white,
    brandBlue: colors.brandBlue,
    brandCyan: colors.brandCyan,
    brandGradient: colors.brandGradient,
  },
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
