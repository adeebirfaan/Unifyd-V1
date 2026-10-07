import { createContext, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { semanticThemes } from '@/constants/theme';
import type { ThemePreference } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type AppearanceContextValue = {
  preference: ThemePreference;
  mode: 'light' | 'dark';
  tokens: (typeof semanticThemes)['dark'] | (typeof semanticThemes)['light'];
  savePreference: (value: ThemePreference) => Promise<string | null>;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function AppearanceProvider({ children }: PropsWithChildren) {
  const { profile, session, refreshProfile } = useAuth();
  const systemScheme = useColorScheme();
  const [pendingPreference, setPendingPreference] = useState<ThemePreference | null>(null);
  const [lastPreference, setLastPreference] = useState<ThemePreference | null>(null);
  const savedPreference: ThemePreference = profile
    ? (isThemePreference(profile.theme_preference) ? profile.theme_preference : 'dark')
    : (lastPreference ?? 'system');
  const preference = pendingPreference ?? savedPreference;
  const mode = preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

  useEffect(() => {
    if (isThemePreference(profile?.theme_preference)) setLastPreference(profile.theme_preference);
    setPendingPreference(null);
  }, [profile?.id, profile?.theme_preference]);

  async function savePreference(value: ThemePreference): Promise<string | null> {
    if (!session || !profile) return 'Your profile is unavailable. Please try again.';
    setPendingPreference(value);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ theme_preference: value })
        .eq('id', session.user.id)
        .select('id')
        .single();
      if (error || !data) {
        setPendingPreference(null);
        return 'We could not save your appearance choice. Please try again.';
      }
      const refreshed = await refreshProfile();
      if (!refreshed) {
        setPendingPreference(null);
        return 'Your choice was saved, but we could not refresh your profile. Please try again.';
      }
      return null;
    } catch {
      setPendingPreference(null);
      return 'We could not save your appearance choice. Check your connection and try again.';
    }
  }

  const value = { preference, mode, tokens: semanticThemes[mode], savePreference };
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error('useAppearance must be used inside AppearanceProvider.');
  return value;
}
