jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../src/db/repositories/store.repository', () => ({ storeRepository: { setting: jest.fn(), setSetting: jest.fn() } }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

import React from 'react';
import { TextInput, TouchableOpacity } from 'react-native';
import { TutorialPractice } from '../src/components/tutorial/TutorialPractice';
import TutorialScreen from '../src/components/tutorial/TutorialScreen';
import { LessonId, lessons, readTutorialProgress, TUTORIAL_PROGRESS_KEY } from '../src/components/tutorial/lessons';
import { storeRepository } from '../src/db/repositories/store.repository';
const { act, create } = require('react-test-renderer');
let tree: any;
const completed = jest.fn();
const button = (label: string) => tree.root.findAllByType(TouchableOpacity).find((node: any) => node.props.accessibilityLabel === label || node.findAll((child: any) => child.props.children === label).length);
async function press(label: string) {
  const node = button(label); expect(node).toBeDefined(); expect(node.props.disabled).not.toBe(true);
  await act(async () => { await node.props.onPress(); });
}
async function field(label: string, value: string) {
  await act(async () => tree.root.findAllByType(TextInput).find((node: any) => node.props.accessibilityLabel === label).props.onChangeText(value));
}
async function render(lesson: LessonId) { await act(async () => { tree = create(<TutorialPractice lesson={lesson} onComplete={completed} />); }); }
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; jest.clearAllMocks();
  (storeRepository.setting as jest.Mock).mockResolvedValue(null);
  (storeRepository.setSetting as jest.Mock).mockResolvedValue(undefined);
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; });

test.each<LessonId>(lessons.map(lesson => lesson.id))('%s has a working interactive practice task without inventory writes', async lesson => {
  await render(lesson);
  if (lesson === 'catalog') { await field('Sample product name', 'Juice'); await press('Save sample product'); expect(JSON.stringify(tree.toJSON())).toContain('Juice'); }
  if (lesson === 'photo') { await press('Choose sample photo'); await press('Choose green sample photo'); await press('Zoom sample photo'); await press('Save sample photo'); }
  if (lesson === 'sell') { await press('Add Milk to sample cart (0)'); await press('Open sample checkout'); await press('Use sample exact cash'); await press('Confirm sample sale'); expect(JSON.stringify(tree.toJSON())).toContain('9/10'); }
  if (lesson === 'delivery') { await press('Switch sample delivery to packs'); await press('Save sample delivery'); expect(JSON.stringify(tree.toJSON())).toContain('16/16'); }
  if (lesson === 'count') { await field('Sample counted quantity', '0'); await press('Save sample stock count'); expect(JSON.stringify(tree.toJSON())).toContain('0/10'); }
  if (lesson === 'expiry') { await press('Show expired sample stock'); await press('Inspect expired sample batch'); await press('Record sample damage'); }
  if (lesson === 'credit') { await press('Record sample utang for Ana'); await press('Record sample repayment'); expect(JSON.stringify(tree.toJSON())).toContain('10.00'); }
  if (lesson === 'shopping') { await press('Add Milk to sample shopping list'); await press('Mark sample Milk bought'); expect(JSON.stringify(tree.toJSON())).toContain('2/10'); await press('Receive sample shopping delivery'); }
  if (lesson === 'closing') { await field('Sample cash counted (₱)', '320'); await press('Save sample closing'); }
  if (lesson === 'backup') { await press('Create sample backup'); await press('Review sample restore'); expect(completed).not.toHaveBeenCalled(); await press('Confirm sample restore'); }
  expect(completed).toHaveBeenCalledTimes(1);
  expect(storeRepository.setSetting).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});

test('unfinished practice cannot be skipped, and completed lessons persist and resume', async () => {
  await act(async () => { tree = create(<TutorialScreen />); });
  await press('Start tutorial');
  expect(button('Next lesson').props.disabled).toBe(true);
  await press('Save sample product'); await press('Next lesson');
  expect(storeRepository.setSetting).toHaveBeenCalledWith(TUTORIAL_PROGRESS_KEY, '["catalog"]');
  await act(async () => tree.unmount()); tree = null;
  (storeRepository.setting as jest.Mock).mockResolvedValue('["catalog"]');
  await act(async () => { tree = create(<TutorialScreen />); });
  await press('Continue tutorial');
  expect(button('Choose sample photo')).toBeDefined();
});

test('tutorial progress accepts only known lesson IDs from stored settings', () => {
  expect(readTutorialProgress('bad JSON')).toEqual([]);
  expect(readTutorialProgress('{}')).toEqual([]);
  expect(readTutorialProgress('["sell","sell","unknown",0]')).toEqual(['sell']);
});
