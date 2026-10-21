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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { categoriesRepository } from '../../../src/db/repositories/categories.repository';
import { productsRepository } from '../../../src/db/repositories/products.repository';
import { Category, ProductWithDetails } from '../../../src/types';

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        }
      } catch (err) {
        console.error('Failed to load product for editing:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleSave = async () => {
    if (!id || !name.trim()) {
      Alert.alert('Validation Error', 'Product name is required.');
      return;
    }

    setSaving(true);
    try {
      await productsRepository.update(id, {
        name: name.trim(),
        category_id: categoryId,
        brand: brand.trim() || null,
        description: description.trim() || null,
        notes: notes.trim() || null,
      });

      router.back();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update product.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Product Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Product name"
          placeholderTextColor="#94A3B8"
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
          placeholderTextColor="#94A3B8"
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
          placeholderTextColor="#94A3B8"
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
          placeholderTextColor="#94A3B8"
        />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveBtnText}>Save Changes</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    color: '#334155',
    marginBottom: 6,
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
  saveBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
