jest.mock('../src/db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../src/db/repositories/products.repository', () => ({ productsRepository: { getDashboardSummary: jest.fn(), getAllWithDetails: jest.fn() } }));
jest.mock('../src/db/repositories/reports.repository', () => ({ reportsRepository: { getBestSellers: jest.fn(), getCounterTotals: jest.fn() } }));
jest.mock('../src/services/image.service', () => ({ resolveImageUri: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));

import React from 'react';
import DashboardScreen from '../app/(tabs)/index';
import { getDatabase } from '../src/db/database';
import { productsRepository } from '../src/db/repositories/products.repository';
import { reportsRepository } from '../src/db/repositories/reports.repository';
import { cartStore } from '../src/store/cart.store';

const { act, create } = require('react-test-renderer');
jest.setTimeout(20000);
const texts = (tree: any) => tree.root.findAll((node: any) => typeof node.props.children === 'string').map((node: any) => node.props.children).join(' ');

describe('Market counter recommendations', () => {
  let tree: any;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.clearAllMocks(); cartStore.clear();
    (getDatabase as jest.Mock).mockResolvedValue({ getFirstAsync: jest.fn().mockResolvedValue({ total: 124000, count: 28 }) });
    (reportsRepository.getCounterTotals as jest.Mock).mockResolvedValue({ total: 124000, count: 28 });
    (productsRepository.getAllWithDetails as jest.Mock).mockResolvedValue([
      { id: 'egg', name: 'Egg', images: [], variants: [{ id: 'egg-piece', label: 'Piece', status: 'ACTIVE', stock_quantity: 30, unit_label: 'pieces', price_minor: 900, cost_minor: 600 }] },
      { id: 'water', name: 'Water', images: [], variants: [{ id: 'water-bottle', status: 'ACTIVE', stock_quantity: 0 }] },
      { id: 'soap', name: 'Soap', images: [], variants: [{ id: 'soap-bar', status: 'ARCHIVED', stock_quantity: 5 }] },
    ]);
    (reportsRepository.getBestSellers as jest.Mock).mockResolvedValue([
      { variant_id: 'egg-piece', total_quantity: 84 }, { variant_id: 'water-bottle', total_quantity: 72 },
      { variant_id: 'soap-bar', total_quantity: 50 }, { variant_id: 'missing', total_quantity: 20 },
    ]);
  });
  afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

  test('shows real sales, excludes unavailable items, and adds the exact recommended variant', async () => {
    await act(async () => { tree = create(<DashboardScreen />); });
    const json = texts(tree);
    expect(json).toContain('1,240.00');
    expect(tree.root.findAll((node: any) => node.props.accessibilityLabel?.startsWith('Add Water'))).toHaveLength(0);
    expect(tree.root.findAll((node: any) => node.props.accessibilityLabel?.startsWith('Add Soap'))).toHaveLength(0);
    await act(async () => { tree.root.findAllByProps({ accessibilityLabel: 'Add Egg, Piece, to sale' })[0].props.onPress(); });
    expect(cartStore.getState().items[0]).toMatchObject({ variant_id: 'egg-piece', quantity: 1, unit_price_minor: 900 });
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/sell');
  });

  test('shows a useful empty shelf without inventing recommendations', async () => {
    (reportsRepository.getBestSellers as jest.Mock).mockResolvedValue([]);
    await act(async () => { tree = create(<DashboardScreen />); });
    expect(texts(tree)).toContain('Your shelf starts here');
    expect(texts(tree)).toContain('Add a product manually');
  });
});
