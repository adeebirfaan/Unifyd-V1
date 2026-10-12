import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** True when the device asks for reduced motion; false until the setting is known. */
export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (active) setReduceMotion(enabled); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduceMotion;
}
