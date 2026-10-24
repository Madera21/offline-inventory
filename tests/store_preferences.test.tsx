jest.mock('../src/db/repositories/store.repository', () => ({ storeRepository: { setting: jest.fn(), setSetting: jest.fn() } }));
jest.mock('../src/db/database', () => ({ getDatabase: jest.fn() }));
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { PreferencesProvider, useLabels } from '../src/store/PreferencesProvider';
import { storeRepository } from '../src/db/repositories/store.repository';
import { getDatabase } from '../src/db/database';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { StoreButton } from '../src/components/StoreForm';
import { parseStoreAmount, wholeQuantity } from '../src/utils/quantities';

const { act, create } = require('react-test-renderer');
let tree: any;
let preferences: ReturnType<typeof useLabels>;
function Probe() { preferences = useLabels(); return <StoreButton label="Save stock count" onPress={() => {}} />; }
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  (storeRepository.setting as jest.Mock).mockResolvedValue('fil');
  (storeRepository.setSetting as jest.Mock).mockResolvedValue(undefined);
  (getDatabase as jest.Mock).mockResolvedValue({ getFirstAsync: jest.fn().mockResolvedValue({ value: 'dark' }) });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test('restores saved Filipino core labels and persists switching to English', async () => {
  await act(async () => { tree = create(<PreferencesProvider><Probe /></PreferencesProvider>); });
  expect(preferences.t('receive')).toBe('Tumanggap ng paninda');
  expect(tree.root.findByType(TouchableOpacity).props.accessibilityLabel).toBe('I-save ang bilang');
  await act(async () => { await preferences.setLanguage('en'); });
  expect(storeRepository.setSetting).toHaveBeenCalledWith('language', 'en');
  expect(preferences.t('receive')).toBe('Receive delivery');
});

test('failed language save keeps the existing language', async () => {
  await act(async () => { tree = create(<PreferencesProvider><Probe /></PreferencesProvider>); });
  (storeRepository.setSetting as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
  await act(async () => { await expect(preferences.setLanguage('en')).rejects.toThrow(); });
  expect(preferences.language).toBe('fil');
});

test('new workflow buttons use the existing dark Market theme colors', async () => {
  await act(async () => { tree = create(<ThemeProvider><PreferencesProvider><Probe /></PreferencesProvider></ThemeProvider>); });
  expect(tree.root.findByType(TouchableOpacity).props.style.backgroundColor).toBe('#D88D6C');
});

test.each(['-1', '1.001', '1abc', '', 'NaN', '1e3'])('rejects ambiguous or negative money input %s', value => {
  expect(() => parseStoreAmount(value)).toThrow();
});

test('money and quantities are represented exactly in minor units and whole pieces', () => {
  expect(parseStoreAmount('12.05')).toBe(1205); expect(parseStoreAmount('0')).toBe(0);
  expect(wholeQuantity('0', true)).toBe(0); expect(() => wholeQuantity('1.5')).toThrow();
  expect(() => wholeQuantity(Number.MAX_SAFE_INTEGER + 1)).toThrow();
});
