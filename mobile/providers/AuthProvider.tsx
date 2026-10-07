import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  university: string;
  faculty: string | null;
  programme: string | null;
  study_year: number | null;
  avatar_id: string;
  default_reminder_timing?: string | null;
  theme_preference?: string | null;
  language_preference?: string | null;
  onboarding_completed: boolean;
};

type Gate = 'loading' | 'signedOut' | 'onboarding' | 'ready' | 'error';

type AuthContextValue = {
  gate: Gate;
  session: Session | null;
  profile: Profile | null;
  error: string | null;
  refreshProfile: () => Promise<boolean>;
  retry: () => Promise<void>;
  signOut: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileState, setProfileState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [profileError, setProfileError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const checkSession = useCallback(async () => {
    setSessionChecked(false);
    setSessionError(null);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      setSession(data.session);
    } catch {
      setSessionError('We could not check your session. Please try again.');
    } finally {
      setSessionChecked(true);
    }
  }, []);

  const loadProfile = useCallback(async (userId: string, background = false): Promise<boolean> => {
    const version = ++requestVersion.current;
    if (!background) setProfileState('loading');
    setProfileError(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (version !== requestVersion.current) return false;
      if (error || !data) {
        if (!background) {
          setProfile(null);
          setProfileError('We could not load your profile. Please try again.');
          setProfileState('error');
        }
        return false;
      }
      setProfile(data as Profile);
      setProfileState('ready');
      return true;
    } catch {
      if (version !== requestVersion.current) return false;
      if (!background) {
        setProfile(null);
        setProfileError('We could not load your profile. Please try again.');
        setProfileState('error');
      }
      return false;
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    void checkSession();
    return () => subscription.unsubscribe();
  }, [checkSession]);

  useEffect(() => {
    if (!sessionChecked) return;
    if (!session) {
      ++requestVersion.current;
      setProfile(null);
      setProfileState('idle');
      setProfileError(null);
      return;
    }
    void loadProfile(session.user.id);
    return () => { ++requestVersion.current; };
  }, [sessionChecked, session?.user.id, loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (!session) return false;
    return loadProfile(session.user.id, true);
  }, [session, loadProfile]);

  const retry = useCallback(async () => {
    if (sessionError || !sessionChecked) await checkSession();
    else await refreshProfile();
  }, [sessionError, sessionChecked, checkSession, refreshProfile]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return 'We could not sign you out. Please try again.';
    setSession(null);
    return null;
  }, []);

  const gate: Gate = !sessionChecked ? 'loading'
    : sessionError ? 'error'
    : !session ? 'signedOut'
    : profileState === 'error' ? 'error'
    : profileState !== 'ready' || profile?.id !== session.user.id ? 'loading'
    : profile.onboarding_completed ? 'ready' : 'onboarding';

  const value = useMemo(() => ({
    gate, session, profile, error: sessionError ?? profileError, refreshProfile, retry, signOut,
  }), [gate, session, profile, sessionError, profileError, refreshProfile, retry, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
