jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

import React from 'react';
import { TouchableOpacity } from 'react-native';
import { ReportCalendar } from '../src/components/ReportCalendar';
import { getDayStartAndEndIso } from '../src/utils/dates';

const { act, create } = require('react-test-renderer');
jest.setTimeout(30000);
let tree: any;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = null;
});

test.each([new Date(2026, 9, 31, 15), new Date(2024, 1, 29), new Date(2026, 11, 31)])('day range covers the complete local date %s', date => {
  const { start, end } = getDayStartAndEndIso(date);
  expect(new Date(start)).toEqual(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
  expect(new Date(end)).toEqual(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999));
});

test('calendar navigates months and selects a past day without changing the date until tapped', async () => {
  const onSelect = jest.fn();
  const today = new Date();
  await act(async () => { tree = create(<ReportCalendar selectedDate={today} onSelect={onSelect} />); });
  const button = (label: string) => tree.root.findAllByType(TouchableOpacity).find((node: any) => node.props.accessibilityLabel === label);
  expect(button('Next month').props.disabled).toBe(true);
  await act(async () => button('Previous month').props.onPress());
  expect(onSelect).not.toHaveBeenCalled();
  const date = new Date(today.getFullYear(), today.getMonth() - 1, 15);
  await act(async () => button(date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })).props.onPress());
  expect(onSelect).toHaveBeenCalledWith(date);
  expect(button('Next month').props.disabled).toBe(false);
});

test('calendar disables future dates and marks the selected day', async () => {
  const today = new Date();
  await act(async () => { tree = create(<ReportCalendar selectedDate={today} onSelect={jest.fn()} />); });
  const days = tree.root.findAllByType(TouchableOpacity);
  expect(days.filter((node: any) => node.props.accessibilityState?.selected)).toHaveLength(1);
  const remainingDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate();
  expect(days.filter((node: any) => node.props.disabled && node.props.accessibilityLabel !== 'Next month')).toHaveLength(remainingDays);
});
