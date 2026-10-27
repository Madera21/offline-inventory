import { ThemeColors, useThemeStyles } from '../../../src/theme/ThemeProvider';
import React, { useState, useEffect, useRef } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { categoriesRepository } from '../../../src/db/repositories/categories.repository';
import { productsRepository } from '../../../src/db/repositories/products.repository';
import { Category, ProductWithDetails } from '../../../src/types';
import { ProductPhotoDraft, ProductPhotoEditor } from '../../../src/components/ProductPhotoEditor';
import { deleteImageFile } from '../../../src/services/image.service';
import { KeyboardAwareScrollView } from '../../../src/components/KeyboardAwareScrollView';

export default function EditProductScreen() {
  const { colors, styles } = useThemeStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<ProductPhotoDraft>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const pendingPhotos = useRef(new Set<string>());
  const saveLock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (!saveLock.current) pendingPhotos.current.forEach(path => { void deleteImageFile(path); });
    };
  }, []);

  // Form state
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const [cats, prod] = await Promise.all([
          categoriesRepository.getAll(),
          productsRepository.getByIdWithDetails(id),
        ]);
        setCategories(cats);
        if (prod) {
          setName(prod.name);
          setCategoryId(prod.category_id);
          setBrand(prod.brand || '');
          setDescription(prod.description || '');
          setNotes(prod.notes || '');
          setPhoto(prod.images[0] ? { relative_path: prod.images[0].relative_path, frame_json: prod.images[0].frame_json ?? null } : null);
        } else {
          setLoadError(true);
        }
      } catch (err) {
        console.error('Failed to load product for editing:', err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleSave = async () => {
    if (saveLock.current || photoBusy || loadError) return;
    if (!id || !name.trim()) {
      Alert.alert('Validation Error', 'Product name is required.');
      return;
    }

    saveLock.current = true;
    setSaving(true);
    try {
      await productsRepository.update(id, {
        name: name.trim(),
        category_id: categoryId,
        brand: brand.trim() || null,
        description: description.trim() || null,
        notes: notes.trim() || null,
        ...(photoChanged ? { primary_image: photo } : {}),
      });
      if (photo) pendingPhotos.current.delete(photo.relative_path);
      if (mounted.current) router.back();
    } catch (err: any) {
      if (mounted.current) Alert.alert('Error', err?.message || 'Failed to update product.');
    } finally {
      saveLock.current = false;
      if (mounted.current) setSaving(false);
      else pendingPhotos.current.forEach(path => { void deleteImageFile(path); });
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (loadError) return <View style={styles.center}><Text style={{ color: colors.ink }}>Could not load this product. Go back and try again.</Text></View>;

  return (
    <KeyboardAwareScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ProductPhotoEditor value={photo} disabled={saving} onBusyChange={setPhotoBusy}
        onCreated={path => pendingPhotos.current.add(path)}
        onChange={value => { setPhoto(value); setPhotoChanged(true); }} />
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Product Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Product name"
          placeholderTextColor={colors.muted}
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

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Brand</Text>
        <TextInput
          style={styles.input}
          value={brand}
          onChangeText={setBrand}
          placeholder="Brand name"
          placeholderTextColor={colors.muted}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          numberOfLines={3}
          value={description}
          onChangeText={setDescription}
          placeholder="Description"
          placeholderTextColor={colors.muted}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Internal Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
          placeholder="Private supplier notes"
          placeholderTextColor={colors.muted}
        />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving || photoBusy}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={styles.saveBtnText}>Save Changes</Text>
        )}
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 6,
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
    minHeight: 80,
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
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '500',
  },
});
