jest.mock('../src/db/repositories/products.repository', () => ({ productsRepository: { getByIdWithDetails: jest.fn(), update: jest.fn() } }));
jest.mock('../src/db/repositories/categories.repository', () => ({ categoriesRepository: { getAll: jest.fn().mockResolvedValue([]) } }));
jest.mock('../src/services/image.service', () => ({ pickImageFromGallery: jest.fn(), captureImageWithCamera: jest.fn(), deleteImageFile: jest.fn().mockResolvedValue(undefined), resolveImageUri: (value: string) => value }));
jest.mock('../src/components/FramedProductImage', () => ({ FramedProductImage: (props: any) => require('react').createElement('PhotoPreview', props) }));
jest.mock('../src/components/ImageFrameEditor', () => ({ ImageFrameEditor: (props: any) => require('react').createElement('FrameEditor', props) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'p1' }), useRouter: () => ({ back: mockBack }) }));

import React from 'react';
import { Alert, TouchableOpacity } from 'react-native';
import EditProductScreen from '../app/products/[id]/edit';
import { productsRepository } from '../src/db/repositories/products.repository';
import { deleteImageFile, pickImageFromGallery } from '../src/services/image.service';
const { act, create } = require('react-test-renderer');
let tree: any;
let alert: jest.SpyInstance;
const button = (label: string) => tree.root.findAllByType(TouchableOpacity).find((node: any) => node.props.accessibilityLabel === label || node.findAll((child: any) => child.props.children === label).length);
async function press(label: string) { await act(async () => { await button(label).props.onPress(); }); }
async function render() { await act(async () => { tree = create(<EditProductScreen />); }); }
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (productsRepository.getByIdWithDetails as jest.Mock).mockResolvedValue({ name: 'Milk', category_id: null, images: [{ id: 'i1', relative_path: 'images/original.jpg', frame_json: null }] });
  (productsRepository.update as jest.Mock).mockResolvedValue(undefined);
  (pickImageFromGallery as jest.Mock).mockResolvedValue('images/replacement.jpg');
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; alert.mockRestore(); });

test('replaces and reframes a saved photo only when Save Changes succeeds', async () => {
  await render(); await press('Replace photo'); await press('Adjust photo framing');
  await act(async () => tree.root.findByType('FrameEditor').props.onSave({ zoom: 2, x: 0.2, y: 0 }));
  expect(productsRepository.update).not.toHaveBeenCalled();
  await press('Save Changes');
  expect(productsRepository.update).toHaveBeenCalledWith('p1', expect.objectContaining({ primary_image: { relative_path: 'images/replacement.jpg', frame_json: '{"zoom":2,"x":0.2,"y":0}' } }));
  expect(mockBack).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount()); tree = null;
  expect(deleteImageFile).not.toHaveBeenCalledWith('images/replacement.jpg');
  expect(deleteImageFile).not.toHaveBeenCalledWith('images/original.jpg');
});

test('cancelling a picker keeps the original photo and leaving discards only staged files', async () => {
  await render(); (pickImageFromGallery as jest.Mock).mockResolvedValueOnce(null);
  await press('Replace photo');
  expect(tree.root.findByType('PhotoPreview').props.uri).toBe('images/original.jpg');
  await press('Replace photo'); await act(async () => tree.unmount()); tree = null;
  expect(productsRepository.update).not.toHaveBeenCalled();
  expect(deleteImageFile).toHaveBeenCalledWith('images/replacement.jpg');
  expect(deleteImageFile).not.toHaveBeenCalledWith('images/original.jpg');
});

test('a failed save keeps the replacement available for retry', async () => {
  await render(); await press('Replace photo');
  (productsRepository.update as jest.Mock).mockRejectedValueOnce(new Error('Write failed'));
  await press('Save Changes');
  expect(mockBack).not.toHaveBeenCalled();
  expect(deleteImageFile).not.toHaveBeenCalledWith('images/replacement.jpg');
  expect(tree.root.findByType('PhotoPreview').props.uri).toBe('images/replacement.jpg');
  await press('Save Changes'); expect(mockBack).toHaveBeenCalledTimes(1);
});

test('leaving during a save preserves a photo that commits and does not navigate back twice', async () => {
  await render(); await press('Replace photo');
  let resolveSave!: () => void;
  (productsRepository.update as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => { resolveSave = resolve; }));
  let saving: Promise<void>;
  await act(async () => { saving = button('Save Changes').props.onPress(); });
  await act(async () => tree.unmount()); tree = null;
  expect(deleteImageFile).not.toHaveBeenCalledWith('images/replacement.jpg');
  await act(async () => { resolveSave(); await saving!; });
  expect(deleteImageFile).not.toHaveBeenCalledWith('images/replacement.jpg');
  expect(mockBack).not.toHaveBeenCalled();
});

test('removes a saved photo without touching its file before the database save', async () => {
  await render(); await press('Remove photo'); await press('Save Changes');
  expect(productsRepository.update).toHaveBeenCalledWith('p1', expect.objectContaining({ primary_image: null }));
  expect(deleteImageFile).not.toHaveBeenCalledWith('images/original.jpg');
});
