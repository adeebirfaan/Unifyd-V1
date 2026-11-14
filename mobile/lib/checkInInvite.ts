import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { checkInInviteDecision, localDateKey, startOfLocalDay } from '@/lib/wellbeing';
import type { CheckInInviteDecision } from '@/lib/wellbeing';

// Daily check-in invite (SRS-FR-1104). The last day it was shown is a device preference per student.
const inviteKey = (userId: string) => `unifyd:checkin-invite:${userId}`;

/** Decides the Home invite. Any read failure keeps the invite away rather than nagging. */
export async function checkInInvite(userId: string, now = new Date()): Promise<CheckInInviteDecision> {
  try {
    const today = localDateKey(now);
    const [stored, todays] = await Promise.all([
      AsyncStorage.getItem(inviteKey(userId)),
      supabase.from('mood_entries').select('id').eq('user_id', userId).gte('recorded_at', startOfLocalDay(now).toISOString()).limit(1),
    ]);
    if (todays.error) return 'keep';
    const decision = checkInInviteDecision((todays.data ?? []).length > 0, stored, today);
    if (decision === 'show') await AsyncStorage.setItem(inviteKey(userId), today);
    return decision;
  } catch {
    return 'keep';
  }
}
