jest.mock('../src/db/repositories/products.repository', () => ({ productsRepository: { getAllWithDetails: jest.fn(), findByBarcodeOrSku: jest.fn() } }));
jest.mock('../src/db/repositories/store.repository', () => ({ storeRepository: { customers: jest.fn() } }));
jest.mock('../src/services/sales.service', () => ({ salesService: { commitSale: jest.fn() } }));
jest.mock('../src/services/image.service', () => ({ resolveImageUri: () => null }));
jest.mock('../src/services/productLookup.service', () => ({ lookupProductByBarcodeOnline: jest.fn() }));
jest.mock('../src/components/BarcodeScannerModal', () => ({ BarcodeScannerModal: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]) }));

import React from 'react';
import { FlatList, TouchableOpacity } from 'react-native';
import SellScreen from '../app/(tabs)/sell';
import { productsRepository } from '../src/db/repositories/products.repository';
import { storeRepository } from '../src/db/repositories/store.repository';
import { salesService } from '../src/services/sales.service';
import { cartStore } from '../src/store/cart.store';

const { act, create } = require('react-test-renderer');
let tree: any;
const catalog = (pack = 1) => [
  { id: 'p1', name: 'Milk', images: [], total_stock: 10, primary_price_minor: 1000, has_multiple_variants: false,
    variants: [{ id: 'v1', label: 'Bottle', favorite: 1, pack_size: pack, stock_quantity: 10, price_minor: 1000, cost_minor: 500, unit_label: 'bottle', status: 'ACTIVE' }] },
  { id: 'p2', name: 'Bread', images: [], total_stock: 2, primary_price_minor: 2000, has_multiple_variants: false,
    variants: [{ id: 'v2', label: 'Standard', favorite: 0, stock_quantity: 2, price_minor: 2000, cost_minor: 1000, status: 'ACTIVE' }] },
];
async function press(label: string) {
  const node = tree.root.findAllByType(TouchableOpacity).find((item: any) => item.props.accessibilityLabel === label || item.findAll((child: any) => child.props.children === label).length);
  await act(async () => { await node.props.onPress(); });
}
async function render() { await act(async () => { tree = create(<SellScreen />); }); }
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks(); cartStore.clear();
  (productsRepository.getAllWithDetails as jest.Mock).mockResolvedValue(catalog());
  (storeRepository.customers as jest.Mock).mockResolvedValue([{ id: 'c1', name: 'Ana', balance_minor: 0 }]);
  (salesService.commitSale as jest.Mock).mockResolvedValue({ id: 's1', total_minor: 1000, receipt_number: 'REC-1', payment_method: 'CASH' });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); cartStore.clear(); });

test('favorites filters the shelf to pinned products', async () => {
  await render(); await press('Favorites');
  expect(tree.root.findByType(FlatList).props.data.map((item: any) => item.id)).toEqual(['p1']);
});

test('pack and single-piece shortcuts share the same cart line and stock limit', async () => {
  (productsRepository.getAllWithDetails as jest.Mock).mockResolvedValue(catalog(6));
  await render(); await press('Milk'); await press('Add pack (6)');
  expect(cartStore.getState().items).toHaveLength(1); expect(cartStore.getState().items[0].quantity).toBe(6);
  await press('Milk');
  const pack = tree.root.findAllByType(TouchableOpacity).find((item: any) => item.props.accessibilityLabel === 'Add pack (6)');
  expect(pack.props.disabled).toBe(true);
  await press('Add piece'); expect(cartStore.getState().items[0].quantity).toBe(7);
});

test('exact cash fills checkout and submits the amount for server-side verification', async () => {
  await render(); await press('Milk'); await press('Checkout'); await press('Exact cash');
  expect(cartStore.getState().cashReceivedMinor).toBe(1000);
  await press('Save');
  expect(salesService.commitSale).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod: 'CASH', cashReceivedMinor: 1000 }));
  expect(cartStore.getState().items).toHaveLength(0);
});

test('utang checkout records the selected customer and shows a credit receipt', async () => {
  (salesService.commitSale as jest.Mock).mockResolvedValue({ id: 's1', total_minor: 1000, receipt_number: 'REC-1', payment_method: 'CREDIT' });
  await render(); await press('Milk'); await press('Checkout'); await press('Pay later / Utang'); await press('Ana · ₱0.00 owed'); await press('Save');
  expect(salesService.commitSale).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod: 'CREDIT', customerId: 'c1' }));
  expect(JSON.stringify(tree.toJSON())).toContain('Added to utang');
});
