import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Refresh calendar-dependent labels while open and after returning to the app. */
export function useLocalDate(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = setInterval(refresh, 60000);
    const subscription = AppState.addEventListener('change', refresh);
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  return now;
}
