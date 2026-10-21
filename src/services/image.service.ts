import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { Camera } from 'expo-camera';

const IMAGES_SUBDIRECTORY = 'images/';

export async function ensureImagesDirectoryExists(): Promise<string> {
  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error('FileSystem documentDirectory is not available.');
  }
  const imagesDir = `${baseDir}${IMAGES_SUBDIRECTORY}`;
  const dirInfo = await FileSystem.getInfoAsync(imagesDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(imagesDir, { intermediates: true });
  }
  return imagesDir;
}

export function resolveImageUri(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null;
  if (relativePath.startsWith('file://') || relativePath.startsWith('content://') || relativePath.startsWith('http')) {
    return relativePath;
  }
  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) return null;
  return `${baseDir}${relativePath}`;
}

export async function pickImageFromGallery(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permission to access photos was denied.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.8,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  return saveAndOptimizeImage(result.assets[0].uri);
}

export async function captureImageWithCamera(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permission to access camera was denied.');
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.8,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  return saveAndOptimizeImage(result.assets[0].uri);
}

/**
 * Optimizes an image (resizes to max 1200x1200, compresses as JPEG),
 * copies it to app persistent storage, and returns the relative path (e.g., 'images/<uuid>.jpg').
 */
export async function saveAndOptimizeImage(sourceUri: string): Promise<string> {
  await ensureImagesDirectoryExists();
  const baseDir = FileSystem.documentDirectory;

  // Resize and compress
  const manipResult = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: 1200 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );

  const filename = `${Crypto.randomUUID()}.jpg`;
  const relativePath = `${IMAGES_SUBDIRECTORY}${filename}`;
  const destinationUri = `${baseDir}${relativePath}`;

  await FileSystem.copyAsync({
    from: manipResult.uri,
    to: destinationUri,
  });

  return relativePath;
}

export async function deleteImageFile(relativePath: string): Promise<void> {
  try {
    const fullUri = resolveImageUri(relativePath);
    if (fullUri) {
      const info = await FileSystem.getInfoAsync(fullUri);
      if (info.exists) {
        await FileSystem.deleteAsync(fullUri, { idempotent: true });
      }
    }
  } catch (error) {
    console.warn('[ImageService] Failed to delete image file:', error);
  }
}

/**
 * Downloads a remote image (e.g. from Open Food Facts or online lookup),
 * optimizes it, saves it to persistent app storage, and returns the relative path.
 */
export async function downloadAndSaveRemoteImage(remoteUrl: string): Promise<string | null> {
  try {
    const tempUri = `${FileSystem.cacheDirectory}${Crypto.randomUUID()}.jpg`;
    const downloadRes = await FileSystem.downloadAsync(remoteUrl, tempUri);
    if (downloadRes && downloadRes.status === 200) {
      const savedPath = await saveAndOptimizeImage(downloadRes.uri);
      await FileSystem.deleteAsync(downloadRes.uri, { idempotent: true });
      return savedPath;
    }
    return null;
  } catch (error) {
    console.warn('[ImageService] Failed to download remote image:', error);
    return null;
  }
}

/**
 * Scans an image file (local full URI or relative path) to identify any embedded 1D/2D barcode offline.
 * Returns the decoded barcode string, or null if no barcode is found.
 */
export async function detectBarcodeFromImage(imagePathOrUri: string): Promise<string | null> {
  try {
    const fullUri = resolveImageUri(imagePathOrUri) || imagePathOrUri;
    const results = await Camera.scanFromURLAsync(fullUri);
    if (results && results.length > 0 && results[0]?.data) {
      return results[0].data;
    }
    return null;
  } catch (error) {
    console.warn('[ImageService] Failed to detect barcode from image:', error);
    return null;
  }
}
