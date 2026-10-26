jest.mock('../src/db/repositories/products.repository', () => ({ productsRepository: { getAllWithDetails: jest.fn() } }));
jest.mock('../src/db/repositories/store.repository', () => ({ storeRepository: {
  countStock: jest.fn(), receive: jest.fn(), shopping: jest.fn(), shopItem: jest.fn(), removeShopping: jest.fn(),
  customers: jest.fn(), addCustomer: jest.fn(), creditHistory: jest.fn(), repay: jest.fn(), closing: jest.fn(), setting: jest.fn(), setSetting: jest.fn(), expense: jest.fn(),
} }));
jest.mock('../src/db/repositories/reports.repository', () => ({ reportsRepository: { getSalesReport: jest.fn() } }));
jest.mock('../src/services/backup.service', () => ({ backupService: { restoreBackup: jest.fn(), createFullBackup: jest.fn() } }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ readAsStringAsync: jest.fn(), EncodingType: { UTF8: 'utf8' } }));
jest.mock('expo-sharing', () => ({}));
jest.mock('../src/components/BarcodeScannerModal', () => ({ BarcodeScannerModal: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]) }));

import React from 'react';
import { Alert, TextInput, TouchableOpacity } from 'react-native';
import CountScreen from '../app/stock/count';
import ReceiveScreen from '../app/stock/receive';
import CustomerScreen from '../app/customers/index';
import ClosingScreen from '../app/closing/index';
import BackupScreen from '../app/backup/index';
import { productsRepository } from '../src/db/repositories/products.repository';
import { storeRepository } from '../src/db/repositories/store.repository';
import { reportsRepository } from '../src/db/repositories/reports.repository';
import { backupService } from '../src/services/backup.service';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

const { act, create } = require('react-test-renderer');
let tree: any;
let alert: jest.SpyInstance;
async function render(Component: any) { await act(async () => { tree = create(<Component />); }); }
async function field(label: string, value: string) {
  const node = tree.root.findAllByType(TextInput).find((item: any) => item.props.accessibilityLabel === label);
  await act(async () => node.props.onChangeText(value));
}
async function press(label: string) {
  const node = tree.root.findAllByType(TouchableOpacity).find((item: any) => item.props.accessibilityLabel === label || item.findAll((child: any) => child.props.children === label).length);
  await act(async () => { await node.props.onPress(); });
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (productsRepository.getAllWithDetails as jest.Mock).mockResolvedValue([{ id: 'p1', name: 'Milk', variants: [{ id: 'v1', label: 'Bottle', stock_quantity: 10, pack_size: 6, cost_minor: 500, status: 'ACTIVE', unit_label: 'bottle' }] }]);
  (storeRepository.setting as jest.Mock).mockResolvedValue(null);
  (storeRepository.countStock as jest.Mock).mockResolvedValue(undefined);
  (storeRepository.receive as jest.Mock).mockResolvedValue(undefined);
  (storeRepository.customers as jest.Mock).mockResolvedValue([{ id: 'c1', name: 'Ana', balance_minor: 2000 }]);
  (storeRepository.creditHistory as jest.Mock).mockResolvedValue([]);
  (storeRepository.closing as jest.Mock).mockResolvedValue({ cash: 10000, cashPayments: 1000, cashExpenses: 500, wallet: 2000, credit: 3000, other: 0, expenses: 500, payments: 1000 });
  (reportsRepository.getSalesReport as jest.Mock).mockResolvedValue({ estimatedGrossProfitMinor: 4000, incompleteCostCount: 0 });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); alert.mockRestore(); });

test('counting accepts zero and sends the observed starting balance for conflict detection', async () => {
  await render(CountScreen); await field('Counted Milk Bottle', '0'); await press('Save stock count');
  expect(storeRepository.countStock).toHaveBeenCalledWith([{ variantId: 'v1', counted: 0, expected: 10 }]);
});

test('receiving converts boxes into pieces and keeps an independent expiration date per row', async () => {
  await render(ReceiveScreen); await field('Search products', 'Milk'); await press('Add Milk · Bottle');
  await press('Receive packs (6 pieces each)'); await field('Number of packs / boxes', '2');
  await field('Expiration date', '2026-12-01'); await field('Supplier (optional)', 'Local supplier');
  await press('Save delivery (1 items)');
  expect(storeRepository.receive).toHaveBeenCalledWith('Local supplier', [{ variantId: 'v1', quantity: 12, unitCostMinor: 500, expirationDate: '2026-12-01' }]);
});

test('receiving rejects malformed quantities and money without saving', async () => {
  await render(ReceiveScreen); await field('Search products', 'Milk'); await press('Add Milk · Bottle');
  await field('Pieces received', '1.5'); await press('Save delivery (1 items)');
  expect(storeRepository.receive).not.toHaveBeenCalled();
  await field('Pieces received', '1'); await field('Cost per piece (₱, optional)', 'abc'); await press('Save delivery (1 items)');
  expect(storeRepository.receive).not.toHaveBeenCalled(); expect(alert).toHaveBeenCalled();
});

test('customer repayments retain the selected payment method', async () => {
  await render(CustomerScreen); await press('Ana · ₱20.00 owed'); await field('Payment received (₱)', '5.25');
  await press('Payment method: Cash · Tap to change'); await press('Record payment');
  expect(storeRepository.repay).toHaveBeenCalledWith('c1', 525, 'E-WALLET');
});

test('daily closing saves counts in minor units and records stock purchases separately from expenses', async () => {
  await render(ClosingScreen); await field('Opening cash / float (₱)', '50'); await field('Cash counted at closing (₱)', '155');
  await press('Save closing counts');
  expect(storeRepository.setSetting).toHaveBeenCalledWith(expect.stringContaining('opening:'), '5000');
  expect(storeRepository.setSetting).toHaveBeenCalledWith(expect.stringContaining('counted:'), '15500');
  await press('Type: OPERATING · Tap to change'); await field('Expense description', 'Bought stock'); await field('Amount (₱)', '20'); await press('Save expense');
  expect(storeRepository.expense).toHaveBeenCalledWith('Bought stock', 2000, 'CASH', 'STOCK_PURCHASE');
});

test('backup restore reads the selected external file and waits for explicit replacement confirmation', async () => {
  const payload = { manifest: { format_version: 1, created_at: '2026-10-24', record_counts: { products: 1, sales: 0 } }, data: {} };
  (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///selected/backup.json', name: 'backup.json' }] });
  (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(JSON.stringify(payload));
  (backupService.restoreBackup as jest.Mock).mockResolvedValue(payload.manifest);
  await render(BackupScreen); await press('Restore Backup');
  expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith('file:///selected/backup.json', expect.any(Object));
  expect(backupService.restoreBackup).not.toHaveBeenCalled();
  const buttons = alert.mock.calls.find(call => call[0] === 'Replace current records?')![2];
  await act(async () => { await buttons[1].onPress(); });
  expect(backupService.restoreBackup).toHaveBeenCalledWith(JSON.stringify(payload));
});
