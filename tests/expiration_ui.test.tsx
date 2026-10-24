jest.mock('../src/db/repositories/products.repository', () => ({ productsRepository: { updateVariantExpiration: jest.fn() } }));
import React from 'react';
import { Alert, TextInput, TouchableOpacity } from 'react-native';
import { ExpirationDateEditor } from '../src/components/ExpirationDateEditor';
import { ExpirationBadge } from '../src/components/ExpirationBadge';
import { productsRepository } from '../src/db/repositories/products.repository';
import { ProductVariant } from '../src/types';

const { act, create } = require('react-test-renderer');
const variant = { id: 'v1', label: 'Bottle', expiration_date: '2026-11-01' } as ProductVariant;
let tree: any;
const content = () => JSON.stringify(tree.toJSON());
async function press(label: string) {
  const button = tree.root.findAllByType(TouchableOpacity).find((node: any) => node.findAll((child: any) => child.props.children === label).length > 0);
  await act(async () => { await button.props.onPress(); });
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks(); jest.useFakeTimers(); jest.setSystemTime(new Date(2026, 9, 24, 12));
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.useRealTimers(); });

test('date editor loads, saves and clears an existing variant date', async () => {
  const saved = jest.fn().mockResolvedValue(undefined);
  await act(async () => { tree = create(<ExpirationDateEditor variant={variant} onSaved={saved} />); });
  await press('Edit expiration date');
  expect(tree.root.findByType(TextInput).props.value).toBe('2026-11-01');
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('2026-12-15'));
  await press('Save date');
  expect(productsRepository.updateVariantExpiration).toHaveBeenLastCalledWith('v1', '2026-12-15');
  expect(saved).toHaveBeenCalledTimes(1);
  await press('Edit expiration date');
  await act(async () => tree.root.findByType(TextInput).props.onChangeText(''));
  await press('Save date');
  expect(productsRepository.updateVariantExpiration).toHaveBeenLastCalledWith('v1', '');
});

test('keeps the editor open and shows save failures', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (productsRepository.updateVariantExpiration as jest.Mock).mockRejectedValueOnce(new Error('Enter a valid expiration date.'));
  const saved = jest.fn();
  await act(async () => { tree = create(<ExpirationDateEditor variant={variant} onSaved={saved} />); });
  await press('Edit expiration date');
  await press('Save date');
  expect(alert).toHaveBeenCalledWith('Expiration date', 'Enter a valid expiration date.');
  expect(saved).not.toHaveBeenCalled();
  expect(tree.root.findByType(TextInput)).toBeTruthy();
  alert.mockRestore();
});

test('status label refreshes after the local date changes while app stays open', async () => {
  await act(async () => { tree = create(<ExpirationBadge date="2026-10-24" />); });
  expect(content()).toContain('Expires today');
  await act(async () => { jest.setSystemTime(new Date(2026, 9, 25, 0, 1)); jest.advanceTimersByTime(60000); });
  expect(content()).toContain('Expired');
});
