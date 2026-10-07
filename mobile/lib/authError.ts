import type { AuthError } from '@supabase/supabase-js';
import type { TranslationKey } from '@/constants/i18n';

export function authErrorKey(error: AuthError): TranslationKey {
  const message = error.message.toLowerCase();
  if (message.includes('invalid login credentials')) return 'auth.invalidCredentials';
  if (message.includes('email not confirmed')) return 'auth.emailNotConfirmed';
  if (message.includes('already registered')) return 'auth.alreadyRegistered';
  if (message.includes('rate limit') || message.includes('too many requests')) return 'auth.rateLimit';
  if (message.includes('password')) return 'auth.weakPassword';
  return 'auth.genericError';
}
