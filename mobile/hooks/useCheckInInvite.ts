import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { checkInInvite } from '@/lib/checkInInvite';

/**
 * Daily check-in invite (SRS-FR-1104), decided each time the screen gains focus.
 * An invite already shown today stays until dismissed; a check-in today hides it.
 */
export function useCheckInInvite(userId: string | undefined): [boolean, () => void] {
  const [visible, setVisible] = useState(false);
  useFocusEffect(useCallback(() => {
    if (!userId) return;
    let active = true;
    checkInInvite(userId).then((decision) => {
      if (active && decision !== 'keep') setVisible(decision === 'show');
    }).catch(() => undefined);
    return () => { active = false; };
  }, [userId]));
  const dismiss = useCallback(() => setVisible(false), []);
  return [visible, dismiss];
}
