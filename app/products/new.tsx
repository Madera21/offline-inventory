import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { categoriesRepository } from '../../src/db/repositories/categories.repository';
import { productsRepository } from '../../src/db/repositories/products.repository';
import {
  pickImageFromGallery,
  captureImageWithCamera,
  resolveImageUri,
  detectBarcodeFromImage,
} from '../../src/services/image.service';
import { BarcodeScannerModal } from '../../src/components/BarcodeScannerModal';
import { parseMoneyToMinor } from '../../src/utils/currency';
import { Category } from '../../src/types';

export default function NewProductScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ barcode?: string }>();

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

  // Scanner & image analysis state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);

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
              setImageRelativePath(path);
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
              setImageRelativePath(path);
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
    const initialStock = parseInt(openingStock, 10) || 0;
    const lowStock = lowStockThreshold.trim() ? parseInt(lowStockThreshold, 10) : null;

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
        unit_label: unitLabel.trim() || 'piece',
        sku: sku.trim() || null,
        barcode: barcode.trim() || null,
        low_stock_threshold: lowStock,
        image_relative_paths: imageRelativePath ? [imageRelativePath] : [],
      });

      router.back();
    } catch (err: any) {
      console.error('Error creating product:', err);
      Alert.alert('Save Error', err?.message || 'Failed to create product.');
    } finally {
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
              <Image source={{ uri: previewUri }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.removeImageBtn}
                onPress={() => setImageRelativePath(null)}
              >
                <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              {analyzingImage && (
                <View style={styles.analyzingBanner}>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.analyzingText}>Detecting barcodes in photo...</Text>
                </View>
              )}
            </View>
          ) : (
            <TouchableOpacity style={styles.photoPlaceholder} onPress={handlePickPhoto}>
              <Ionicons name="camera-outline" size={32} color="#64748B" />
              <Text style={styles.photoPlaceholderText}>Add Product Photo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Basic Info */}
        <Text style={styles.sectionHeader}>Basic Information</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Product Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. San Miguel Pale Pilsen 330ml"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
          />
        </View>

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
              placeholderTextColor="#94A3B8"
              value={brand}
              onChangeText={setBrand}
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Base Unit</Text>
            <TextInput
              style={styles.input}
              placeholder="piece, bottle, box, kg"
              placeholderTextColor="#94A3B8"
              value={unitLabel}
              onChangeText={setUnitLabel}
            />
          </View>
        </View>

        {/* Pricing & Stock */}
        <Text style={styles.sectionHeader}>Pricing & Inventory</Text>
        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Selling Price (₱) *</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              value={price}
              onChangeText={setPrice}
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Purchase Cost (₱)</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              value={cost}
              onChangeText={setCost}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Opening Stock</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              value={openingStock}
              onChangeText={setOpeningStock}
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Low Stock Limit</Text>
            <TextInput
              style={styles.input}
              placeholder="Alert limit (e.g. 5)"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              value={lowStockThreshold}
              onChangeText={setLowStockThreshold}
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
              placeholderTextColor="#94A3B8"
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
                <Ionicons name="barcode-outline" size={14} color="#0284C7" />
                <Text style={styles.scanLinkText}>Scan</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.barcodeInputWrapper}>
              <TextInput
                style={[styles.input, styles.barcodeInput]}
                placeholder="e.g. 480001234567"
                placeholderTextColor="#94A3B8"
                value={barcode}
                onChangeText={setBarcode}
              />
              <TouchableOpacity
                style={styles.barcodeIconBtn}
                onPress={() => setScannerOpen(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-outline" size={20} color="#0284C7" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Description / Notes */}
        <Text style={styles.sectionHeader}>Additional Details</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Product description..."
            placeholderTextColor="#94A3B8"
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
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={2}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Product</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(scannedCode) => {
          setBarcode(scannedCode);
        }}
        title="Scan Barcode for Product"
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoPlaceholderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  imagePreviewContainer: {
    width: '100%',
    height: 180,
    borderRadius: 12,
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
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
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
    color: '#334155',
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
    color: '#0284C7',
    fontWeight: '700',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
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
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  catChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  catChipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  catChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#2563EB',
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
