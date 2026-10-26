import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, DeviceEventEmitter, useColorScheme } from 'react-native';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import { getDatabase } from '../db/database';

export const lightColors = {
  paper: '#F6F1E7', surface: '#FFFDF7', ink: '#343D32', muted: '#756F63',
  line: '#DCD3C3', soft: '#E9E5D6', accent: '#A34E35', onAccent: '#FFF7E9',
  accentSoft: '#F3E2D7', success: '#42603B', successSoft: '#E5EBD9',
  warning: '#79592D', warningSoft: '#EEE5CF', danger: '#B33630', dangerSoft: '#F9E2DD',
};
export type ThemeColors = typeof lightColors;
const darkColors: ThemeColors = {
  paper: '#231E1A', surface: '#302923', ink: '#F6EDDC', muted: '#BDB1A0',
  line: '#51463A', soft: '#3A3C2F', accent: '#D88D6C', onAccent: '#28170F',
  accentSoft: '#493127', success: '#B4CF9E', successSoft: '#303C29',
  warning: '#E9C78F', warningSoft: '#423623', danger: '#F0A095', dangerSoft: '#492C28',
};
type Appearance = 'system' | 'light' | 'dark';
const ThemeContext = createContext({ colors: lightColors, isDark: false, appearance: 'system' as Appearance, setAppearance: async (_value: Appearance) => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [appearance, setMode] = useState<Appearance>('system');
  useEffect(() => {
    let active = true;
    const load = () => getDatabase().then(db => db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key = 'appearance'"))
      .then(row => { if (active) setMode(row?.value === 'light' || row?.value === 'dark' ? row.value : 'system'); })
      .catch(error => console.error('Could not load appearance:', error));
    void load();
    const listener = DeviceEventEmitter.addListener('inventory-restored', load);
    return () => { active = false; listener.remove(); };
  }, []);
  const setAppearance = async (value: Appearance) => {
    try {
      const db = await getDatabase();
      await db.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', 'appearance', value);
      setMode(value);
    } catch { Alert.alert('Appearance not saved', 'Please try again.'); }
  };
  const isDark = appearance === 'dark' || (appearance === 'system' && system === 'dark');
  return <ThemeContext.Provider value={{ colors: isDark ? darkColors : lightColors, isDark, appearance, setAppearance }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
export function useThemeStyles<T extends { [K in keyof T]: ViewStyle | TextStyle | ImageStyle }>(factory: (colors: ThemeColors) => T) {
  const theme = useTheme();
  const styles = useMemo(() => factory(theme.colors), [factory, theme.colors]);
  return { ...theme, styles };
}
