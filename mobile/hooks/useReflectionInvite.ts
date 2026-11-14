import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { localDateKey } from '@/lib/wellbeing';

// Reflection invitation snooze (SRS-FR-1106): the local date of the last Not now, per student, on the device.
const snoozeKey = (userId: string) => `unifyd:reflection-invite:${userId}`;

/**
 * Returns the stored Not now date (undefined until read, so nothing shows early) and a snooze action.
 * A read failure counts as snoozed, so the invitation never nags.
 */
export function useReflectionInvite(userId: string | undefined): [string | null | undefined, () => void] {
  const [notNowDate, setNotNowDate] = useState<string | null | undefined>(undefined);
  useFocusEffect(useCallback(() => {
    if (!userId) return;
    let active = true;
    AsyncStorage.getItem(snoozeKey(userId))
      .then((stored) => { if (active) setNotNowDate(stored); })
      .catch(() => { if (active) setNotNowDate(localDateKey(new Date())); });
    return () => { active = false; };
  }, [userId]));
  const snooze = useCallback(() => {
    const today = localDateKey(new Date());
    setNotNowDate(today);
    if (userId) AsyncStorage.setItem(snoozeKey(userId), today).catch(() => undefined);
  }, [userId]);
  return [notNowDate, snooze];
}
