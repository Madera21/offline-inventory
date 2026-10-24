jest.mock('../src/db/database', () => ({ getDatabase: jest.fn() }));

import React from 'react';
import { Alert, Text } from 'react-native';
import { getDatabase } from '../src/db/database';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';

const { act, create } = require('react-test-renderer');

describe('Saved app appearance', () => {
  let theme: ReturnType<typeof useTheme>;
  let tree: any;
  const db = { getFirstAsync: jest.fn(), runAsync: jest.fn() };
  function Probe() {
    theme = useTheme();
    return <Text>{theme.appearance}</Text>;
  }
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.clearAllMocks();
    db.getFirstAsync.mockResolvedValue(null);
    db.runAsync.mockResolvedValue(undefined);
    (getDatabase as jest.Mock).mockResolvedValue(db);
  });
  afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

  test('restores dark appearance and saves a switch to light', async () => {
    db.getFirstAsync.mockResolvedValue({ value: 'dark' });
    await act(async () => { tree = create(<ThemeProvider><Probe /></ThemeProvider>); });
    expect(theme!.isDark).toBe(true);
    const darkPaper = theme!.colors.paper;
    await act(async () => { await theme!.setAppearance('light'); });
    expect(theme!.isDark).toBe(false);
    expect(theme!.colors.paper).not.toBe(darkPaper);
    expect(db.runAsync).toHaveBeenCalledWith(expect.any(String), 'appearance', 'light');
  });

  test('keeps the saved theme when persistence fails', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    db.getFirstAsync.mockResolvedValue({ value: 'light' });
    await act(async () => { tree = create(<ThemeProvider><Probe /></ThemeProvider>); });
    db.runAsync.mockRejectedValueOnce(new Error('disk full'));
    await act(async () => { await theme!.setAppearance('dark'); });
    expect(theme!.appearance).toBe('light');
    expect(alert).toHaveBeenCalled();
    alert.mockRestore();
  });
});
