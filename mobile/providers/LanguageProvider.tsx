import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { DEFAULT_LANGUAGE, normalizeLanguagePreference, translate } from '@/constants/i18n';
import type { LanguagePreference, TranslationKey } from '@/constants/i18n';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type LanguageContextValue = {
  language: LanguagePreference;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  saveLanguage: (value: LanguagePreference) => Promise<boolean>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: PropsWithChildren) {
  const { profile, session, refreshProfile } = useAuth();
  const [language, setLanguage] = useState<LanguagePreference>(DEFAULT_LANGUAGE);

  useEffect(() => {
    if (profile) setLanguage(normalizeLanguagePreference(profile.language_preference));
  }, [profile]);

  const saveLanguage = useCallback(async (value: LanguagePreference): Promise<boolean> => {
    if (!session || !profile) return false;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ language_preference: value })
        .eq('id', session.user.id)
        .select('id')
        .single();
      if (error || !data) return false;
      const refreshed = await refreshProfile();
      if (!refreshed) return false;
      setLanguage(value);
      return true;
    } catch {
      return false;
    }
  }, [session, profile, refreshProfile]);

  const value = useMemo(() => ({ language, t: (key: TranslationKey, values?: Record<string, string | number>) => translate(language, key, values), saveLanguage }), [language, saveLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useI18n must be used inside LanguageProvider.');
  return context;
}
