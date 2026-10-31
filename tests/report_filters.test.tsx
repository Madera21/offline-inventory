jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]) }));
jest.mock('../src/db/repositories/reports.repository', () => ({ reportsRepository: {
  getSalesReport: jest.fn(), getInventoryValuation: jest.fn(), getBestSellers: jest.fn(), generateSalesCsv: jest.fn(), generateProductsCsv: jest.fn(),
} }));
jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///app/', writeAsStringAsync: jest.fn(), EncodingType: { UTF8: 'utf8' } }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn() }));
jest.mock('../src/components/ReportCalendar', () => ({ ReportCalendar: () => null }));

import React from 'react';
import { Alert, TouchableOpacity } from 'react-native';
import ReportsScreen from '../app/reports/index';
import { ReportCalendar } from '../src/components/ReportCalendar';
import { reportsRepository } from '../src/db/repositories/reports.repository';
import { getDayStartAndEndIso } from '../src/utils/dates';

const { act, create } = require('react-test-renderer');
jest.setTimeout(30000);
let tree: any;
let alert: jest.SpyInstance;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (reportsRepository.getSalesReport as jest.Mock).mockResolvedValue({ totalRevenueMinor: 1000, transactionCount: 1, unitsSold: 1, estimatedGrossProfitMinor: 500, incompleteCostCount: 0 });
  (reportsRepository.getInventoryValuation as jest.Mock).mockResolvedValue({});
  (reportsRepository.getBestSellers as jest.Mock).mockResolvedValue([]);
  (reportsRepository.generateSalesCsv as jest.Mock).mockResolvedValue('Receipt,Date\n');
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; alert.mockRestore(); });
async function press(label: string) {
  const node = tree.root.findAllByType(TouchableOpacity).find((item: any) => item.props.accessibilityLabel === label || item.findAll((child: any) => child.props.children === label).length);
  expect(node).toBeDefined();
  await act(async () => { await node.props.onPress(); });
}
async function select(date: Date) { await act(async () => tree.root.findByType(ReportCalendar).props.onSelect(date)); }
async function render() { await act(async () => { tree = create(<ReportsScreen />); }); }

test('sales exports use exactly the loaded report range and offer an explicit all-sales export', async () => {
  await render(); await press('Yesterday');
  const [start, end] = (reportsRepository.getSalesReport as jest.Mock).mock.calls.at(-1);
  expect(reportsRepository.getBestSellers).toHaveBeenLastCalledWith(5, start, false, end);
  await press('Export CSV Report');
  await act(async () => alert.mock.calls.at(-1)![2].find((button: any) => button.text === 'Sales Ledger CSV').onPress());
  const options = alert.mock.calls.at(-1)![2];
  await act(async () => { options.find((button: any) => button.text === 'Export selected period').onPress(); });
  expect(reportsRepository.generateSalesCsv).toHaveBeenLastCalledWith(start, end);
  await act(async () => { options.find((button: any) => button.text === 'Export all sales').onPress(); });
  expect(reportsRepository.generateSalesCsv).toHaveBeenLastCalledWith(undefined, undefined);
});

test('custom dates apply only after confirmation and reversed dates leave the report unchanged', async () => {
  await render();
  const initialCalls = (reportsRepository.getSalesReport as jest.Mock).mock.calls.length;
  const start = new Date(2024, 1, 29);
  const end = new Date(2024, 2, 2);
  await press('Custom date range'); await select(end); await select(start);
  await press('Apply date range');
  expect(alert).toHaveBeenLastCalledWith('Invalid date range', expect.any(String));
  expect(reportsRepository.getSalesReport).toHaveBeenCalledTimes(initialCalls);
  await press('Choose start date'); await select(start); await select(end);
  await press('Apply date range');
  expect(reportsRepository.getSalesReport).toHaveBeenLastCalledWith(getDayStartAndEndIso(start).start, getDayStartAndEndIso(end).end);
});
