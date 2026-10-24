import { ThemeColors, useThemeStyles } from '../../src/theme/ThemeProvider';
import { ExpirationDateField } from '../../src/components/ExpirationDateField';
import { useLabels } from '../../src/store/PreferencesProvider';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { categoriesRepository } from '../../src/db/repositories/categories.repository';
import { productsRepository, DuplicateBarcodeError } from '../../src/db/repositories/products.repository';
import {
  pickImageFromGallery,
  captureImageWithCamera,
  resolveImageUri,
  detectBarcodeFromImage,
} from '../../src/services/image.service';
import { BarcodeScannerModal } from '../../src/components/BarcodeScannerModal';
import { parseMoneyToMinor } from '../../src/utils/currency';
import { lookupProductByBarcodeOnline } from '../../src/services/productLookup.service';
import { downloadAndSaveRemoteImage } from '../../src/services/image.service';
import { wholeQuantity } from '../../src/utils/quantities';
import { Category } from '../../src/types';
import { FramedProductImage } from '../../src/components/FramedProductImage';
import { ImageFrameEditor } from '../../src/components/ImageFrameEditor';
import { DEFAULT_IMAGE_FRAME } from '../../src/utils/imageFrame';

export default function NewProductScreen() {
  const { colors, styles } = useThemeStyles(createStyles);
  const router = useRouter();
  const [expirationDate, setExpirationDate] = useState('');
  const [moreDetails, setMoreDetails] = useState(false);
  const { t } = useLabels();
  const params = useLocalSearchParams<{ barcode?: string; lookup?: string }>();
  const [lookingUpOnline, setLookingUpOnline] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [openingStock, setOpeningStock] = useState('0');
  const [unitLabel, setUnitLabel] = useState('piece');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState(params.barcode || '');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [imageRelativePath, setImageRelativePath] = useState<string | null>(null);
  const [downloadingImage, setDownloadingImage] = useState(false);
  const [imageFrame, setImageFrame] = useState(DEFAULT_IMAGE_FRAME);
  const [editingFrame, setEditingFrame] = useState(false);
  const photoRevision = React.useRef(0);
  const replacePhoto = (path: string | null) => {
    photoRevision.current++;
    setImageRelativePath(path);
    setImageFrame(DEFAULT_IMAGE_FRAME);
  };

  // Scanner & image analysis state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const saveInProgress = React.useRef(false);

  const showExistingProduct = (productId: string, message: string) => {
    Alert.alert('Product Already Exists', message, [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Open Product', onPress: () => router.replace(`/products/${productId}`) },
    ]);
  };

  const checkExistingBarcode = async (code: string): Promise<boolean> => {
    const existing = await productsRepository.findExistingBarcode(code);
    if (!existing) return false;
    showExistingProduct(existing.product_id, `This barcode already belongs to "${existing.product_name}". Open it to edit the product or add stock.`);
    return true;
  };

  useEffect(() => {
    async function loadCats() {
      try {
        const cats = await categoriesRepository.getAll();
        setCategories(cats);
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    }
    loadCats();
  }, []);

  const handleOnlineLookup = async (codeToLookup?: string) => {
    const code = (codeToLookup || barcode).trim();
    if (!code) {
      Alert.alert('Barcode Required', 'Please enter or scan a barcode first.');
      return;
    }

    setLookingUpOnline(true);
    const revision = photoRevision.current;
    try {
      if (await checkExistingBarcode(code)) return;
      const result = await lookupProductByBarcodeOnline(code);
      if (result) {
        setName(result.name);
        if (result.brand) setBrand(result.brand);
        if (result.description) setDescription(result.description);
        if (result.unitLabel) setUnitLabel(result.unitLabel);
        if (result.barcode) setBarcode(result.barcode);

        if (result.categoryName) {
          const matched = categories.find(
            (c) => c.name.toLowerCase() === result.categoryName?.toLowerCase()
          );
          if (matched) {
            setCategoryId(matched.id);
          } else {
            try {
              const newCat = await categoriesRepository.create(result.categoryName);
              setCategories((prev) => [...prev, newCat]);
              setCategoryId(newCat.id);
            } catch (err) {
              console.warn('Could not auto-create category:', err);
            }
          }
        }

        if (result.imageUrl && !imageRelativePath) {
          setDownloadingImage(true);
          const path = await downloadAndSaveRemoteImage(result.imageUrl);
          if (path && revision === photoRevision.current) replacePhoto(path);
        }

        Alert.alert(
          'Product Identified Online!',
          `Found "${result.name}" on ${result.source}.\n\nReview the product details and photo. Use Edit Framing to adjust the visible area, or Change Photo to choose your own.`,
          [{ text: 'Review Product' }]
        );
      } else {
        Alert.alert(
          'Not Found Online',
          `No catalog match found for barcode "${code}". You can continue filling details manually.`
        );
      }
    } catch (err: any) {
      Alert.alert('Online Lookup', err?.message || 'Failed to lookup product online.');
    } finally {
      setLookingUpOnline(false);
      setDownloadingImage(false);
    }
  };

  useEffect(() => {
    if (params.lookup === '1' && params.barcode) {
      handleOnlineLookup(params.barcode);
    }
  }, [params.lookup, params.barcode]);

  const checkImageForBarcode = async (path: string) => {
    try {
      setAnalyzingImage(true);
      const detected = await detectBarcodeFromImage(path);
      if (detected) {
        Alert.alert(
          'Barcode Detected in Image!',
          `Found barcode: "${detected}". Would you like to use this for the product?`,
          [
            { text: 'Keep Current', style: 'cancel' },
            {
              text: 'Use Barcode',
              onPress: () => setBarcode(detected),
            },
          ]
        );
      }
    } catch (err) {
      console.warn('Failed to detect barcode from image:', err);
    } finally {
      setAnalyzingImage(false);
    }
  };

  const handlePickPhoto = () => {
    Alert.alert('Add Product Photo', 'Choose photo source', [
      {
        text: 'Take Photo',
        onPress: async () => {
          try {
            const path = await captureImageWithCamera();
            if (path) {
              replacePhoto(path);
              checkImageForBarcode(path);
            }
          } catch (err: any) {
            Alert.alert('Camera Error', err?.message || 'Failed to capture photo.');
          }
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          try {
            const path = await pickImageFromGallery();
            if (path) {
              replacePhoto(path);
              checkImageForBarcode(path);
            }
          } catch (err: any) {
            Alert.alert('Gallery Error', err?.message || 'Failed to pick photo.');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    if (downloadingImage || lookingUpOnline || loading || saveInProgress.current) return;
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Product name is required.');
      return;
    }

    const priceMinor = parseMoneyToMinor(price);
    if (priceMinor <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid selling price greater than 0.');
      return;
    }

    const costMinor = cost.trim() ? parseMoneyToMinor(cost) : null;
    let initialStock: number;
    try { initialStock = wholeQuantity(openingStock || '0', true); }
    catch (error: any) { Alert.alert('Starting quantity', error.message); return; }
    const lowStock = lowStockThreshold.trim() ? parseInt(lowStockThreshold, 10) : null;

    saveInProgress.current = true;
    setLoading(true);
    try {
      await productsRepository.create({
        name: name.trim(),
        category_id: categoryId,
        brand: brand.trim() || null,
        description: description.trim() || null,
        notes: notes.trim() || null,
        price_minor: priceMinor,
        cost_minor: costMinor,
        opening_stock: initialStock,
        expiration_date: expirationDate,
        unit_label: unitLabel.trim() || 'piece',
        sku: sku.trim() || null,
        barcode: barcode.trim() || null,
        low_stock_threshold: lowStock,
        image_relative_paths: imageRelativePath ? [imageRelativePath] : [],
        image_frame_json: JSON.stringify(imageFrame),
      });

      router.back();
    } catch (err: any) {
      if (err instanceof DuplicateBarcodeError) {
        showExistingProduct(err.productId, err.message);
      } else {
        console.error('Error creating product:', err);
        Alert.alert('Save Error', err?.message || 'Failed to create product.');
      }
    } finally {
      saveInProgress.current = false;
      setLoading(false);
    }
  };

  const previewUri = resolveImageUri(imageRelativePath);

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Photo Picker */}
        <View style={styles.imageSection}>
          {previewUri ? (
            <View style={styles.imagePreviewContainer}>
              <FramedProductImage uri={previewUri} frame={imageFrame} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.removeImageBtn}
                accessibilityLabel="Remove product photo"
                disabled={downloadingImage || loading}
                onPress={() => replacePhoto(null)}
              >
                <Ionicons name="trash-outline" size={18} color={colors.onAccent} />
              </TouchableOpacity>
              {analyzingImage && (
                <View style={styles.analyzingBanner}>
                  <ActivityIndicator size="small" color={colors.onAccent} style={{ marginRight: 6 }} />
                  <Text style={styles.analyzingText}>Detecting barcodes in photo...</Text>
                </View>
              )}
            </View>
          ) : (
            <TouchableOpacity style={styles.photoPlaceholder} onPress={handlePickPhoto} disabled={downloadingImage || loading}>
              <Ionicons name="camera-outline" size={32} color={colors.muted} />
              <Text style={styles.photoPlaceholderText}>Add Product Photo</Text>
            </TouchableOpacity>
          )}
          {previewUri && (
            <TouchableOpacity style={styles.autoFillBtn} onPress={handlePickPhoto} disabled={downloadingImage || loading}>
              <Text style={styles.autoFillBtnText}>Change Photo</Text>
            </TouchableOpacity>
          )}
          {previewUri && (
            <TouchableOpacity
              style={styles.autoFillBtn}
              onPress={() => setEditingFrame(true)}
              disabled={downloadingImage || lookingUpOnline || loading}
            >
              {downloadingImage ? (
                <ActivityIndicator size="small" color={colors.onAccent} />
              ) : (
                <Text style={styles.autoFillBtnText}>Edit Framing</Text>
              )}
            </TouchableOpacity>
          )}
          {previewUri && editingFrame && <ImageFrameEditor uri={previewUri} initialFrame={imageFrame} onClose={() => setEditingFrame(false)} onSave={setImageFrame} />}
        </View>

        {/* Basic Info */}
        <Text style={styles.sectionHeader}>Basic Information</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('productName')} *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. San Miguel Pale Pilsen 330ml"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('price')} (₱) *</Text>
          <TextInput accessibilityLabel="Selling price" style={styles.input} keyboardType="decimal-pad" value={price} onChangeText={setPrice} placeholder="0.00" placeholderTextColor={colors.muted} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('startingStock')}</Text>
          <TextInput accessibilityLabel="Starting quantity" style={styles.input} keyboardType="number-pad" value={openingStock} onChangeText={setOpeningStock} />
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: moreDetails }} style={styles.autoFillBtn} onPress={() => setMoreDetails(!moreDetails)}>
          <Text style={styles.autoFillBtnText}>{moreDetails ? '−' : '+'} {t('details')}</Text>
        </TouchableOpacity>
        {(moreDetails || params.barcode) && <>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('cost')} (₱)</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={cost} onChangeText={setCost} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Low stock alert at</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={lowStockThreshold} onChangeText={setLowStockThreshold} />
        </View>
        <ExpirationDateField value={expirationDate} onChangeText={setExpirationDate} />
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPicker}>
            <TouchableOpacity
              style={[styles.catChip, categoryId === null && styles.catChipActive]}
              onPress={() => setCategoryId(null)}
            >
              <Text style={[styles.catChipText, categoryId === null && styles.catChipTextActive]}>
                Uncategorized
              </Text>
            </TouchableOpacity>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.catChip, categoryId === c.id && styles.catChipActive]}
                onPress={() => setCategoryId(c.id)}
              >
                <Text style={[styles.catChipText, categoryId === c.id && styles.catChipTextActive]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Brand</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. San Miguel"
              placeholderTextColor={colors.muted}
              value={brand}
              onChangeText={setBrand}
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Base Unit</Text>
            <TextInput
              style={styles.input}
              placeholder="piece, bottle, box, kg"
              placeholderTextColor={colors.muted}
              value={unitLabel}
              onChangeText={setUnitLabel}
            />
          </View>
        </View>

        {/* Barcode & Identifiers */}
        <Text style={styles.sectionHeader}>Identifiers (Optional)</Text>
        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>SKU</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. BEV-001"
              placeholderTextColor={colors.muted}
              value={sku}
              onChangeText={setSku}
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1 }]}>
            <View style={styles.labelWithAction}>
              <Text style={styles.label}>Barcode</Text>
              <TouchableOpacity
                style={styles.scanLink}
                onPress={() => setScannerOpen(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="barcode-outline" size={14} color={colors.accent} />
                <Text style={styles.scanLinkText}>Scan</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.barcodeInputWrapper}>
              <TextInput
                style={[styles.input, styles.barcodeInput]}
                placeholder="e.g. 480001234567"
                placeholderTextColor={colors.muted}
                value={barcode}
                onChangeText={setBarcode}
              />
              <TouchableOpacity
                style={styles.barcodeIconBtn}
                onPress={() => setScannerOpen(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-outline" size={20} color={colors.accent} />
              </TouchableOpacity>
            </View>
            {barcode.trim().length >= 6 && (
              <TouchableOpacity
                style={[styles.autoFillBtn, lookingUpOnline && styles.autoFillBtnDisabled]}
                onPress={() => handleOnlineLookup()}
                disabled={lookingUpOnline || downloadingImage || loading}
                activeOpacity={0.8}
              >
                {lookingUpOnline ? (
                  <ActivityIndicator size="small" color={colors.onAccent} />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={13} color={colors.warning} style={{ marginRight: 4 }} />
                    <Text style={styles.autoFillBtnText}>Auto-Fill from Web</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Description / Notes */}
        <Text style={styles.sectionHeader}>Additional Details</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Product description..."
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={3}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Notes / Supplier Info</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Private supplier notes or remarks..."
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={2}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        </>}
        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.saveButton, (loading || lookingUpOnline || downloadingImage) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading || lookingUpOnline || downloadingImage}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.saveButtonText}>Save Product</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={async (scannedCode) => {
          setBarcode(scannedCode);
          setScannerOpen(false);
          try {
            if (await checkExistingBarcode(scannedCode)) return;
          } catch {
            Alert.alert('Lookup Failed', 'Could not check the local catalog. Please try scanning again.');
            return;
          }
          Alert.alert(
            'Barcode Scanned!',
            `Barcode: ${scannedCode}\n\nIdentify and auto-fill product details from the internet?`,
            [
              { text: 'Fill Manually', style: 'cancel' },
              {
                text: '⚡ Identify Online',
                onPress: () => handleOnlineLookup(scannedCode),
              },
            ]
          );
        }}
        title="Scan Barcode for Product"
      />
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  imageSection: {
    alignItems: 'center',
    marginVertical: 12,
  },
  photoPlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoPlaceholderText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  imagePreviewContainer: {
    width: '100%',
    height: 180,
    borderRadius: 7,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingBanner: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingText: {
    color: '#FFF7E9',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 10,
  },
  inputGroup: {
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 6,
  },
  labelWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scanLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  scanLinkText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '500',
  },
  barcodeInputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  barcodeInput: {
    paddingRight: 40,
  },
  barcodeIconBtn: {
    position: 'absolute',
    right: 10,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
  },
  textArea: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  categoryPicker: {
    flexDirection: 'row',
    marginTop: 4,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: colors.soft,
    borderWidth: 1,
    borderColor: colors.line,
    marginRight: 8,
  },
  catChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  catChipText: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '500',
  },
  catChipTextActive: {
    color: colors.onAccent,
    fontWeight: '600',
  },
  autoFillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  autoFillBtnDisabled: {
    opacity: 0.6,
  },
  autoFillBtnText: {
    color: colors.onAccent,
    fontSize: 12,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '500',
  },
});
