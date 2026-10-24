import { ThemeColors, useThemeStyles } from '../../src/theme/ThemeProvider';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { categoriesRepository } from '../../src/db/repositories/categories.repository';
import { Category, EntityStatus } from '../../src/types';
import { EmptyState } from '../../src/components/EmptyState';

export default function CategoriesScreen() {
  const { colors, styles } = useThemeStyles(createStyles);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statusFilter, setStatusFilter] = useState<EntityStatus>('ACTIVE');
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const data = await categoriesRepository.getAll(true);
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCategories();
    setRefreshing(false);
  };

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setCategoryNameInput('');
    setModalVisible(true);
  };

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
    setCategoryNameInput(category.name);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!categoryNameInput.trim()) {
      Alert.alert('Validation Error', 'Category name cannot be empty.');
      return;
    }

    try {
      if (editingCategory) {
        await categoriesRepository.update(editingCategory.id, categoryNameInput.trim());
      } else {
        await categoriesRepository.create(categoryNameInput.trim());
      }
      setModalVisible(false);
      setCategoryNameInput('');
      setEditingCategory(null);
      await loadCategories();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save category.');
    }
  };

  const handleToggleArchive = async (category: Category) => {
    const isArchived = category.status === 'ARCHIVED';
    const actionText = isArchived ? 'restore' : 'archive';
    Alert.alert(
      `${isArchived ? 'Restore' : 'Archive'} Category`,
      `Are you sure you want to ${actionText} "${category.name}"? Products under this category will remain safe.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isArchived ? 'Restore' : 'Archive',
          style: isArchived ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await categoriesRepository.setStatus(
                category.id,
                isArchived ? 'ACTIVE' : 'ARCHIVED'
              );
              await loadCategories();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to update category status.');
            }
          },
        },
      ]
    );
  };

  const filteredCategories = categories.filter((c) => c.status === statusFilter);

  return (
    <View style={styles.container}>
      {/* Status Filter */}
      <View style={styles.topBar}>
        <View style={styles.statusToggle}>
          <TouchableOpacity
            style={[styles.statusOption, statusFilter === 'ACTIVE' && styles.statusOptionActive]}
            onPress={() => setStatusFilter('ACTIVE')}
          >
            <Text style={[styles.statusOptionText, statusFilter === 'ACTIVE' && styles.statusOptionTextActive]}>
              Active ({categories.filter((c) => c.status === 'ACTIVE').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statusOption, statusFilter === 'ARCHIVED' && styles.statusOptionActive]}
            onPress={() => setStatusFilter('ARCHIVED')}
          >
            <Text style={[styles.statusOptionText, statusFilter === 'ARCHIVED' && styles.statusOptionTextActive]}>
              Archived ({categories.filter((c) => c.status === 'ARCHIVED').length})
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.addButton} onPress={handleOpenAdd} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color={colors.onAccent} />
          <Text style={styles.addButtonText}>New Category</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.categoryCard}>
            <View style={styles.categoryInfo}>
              <Ionicons name="folder-outline" size={22} color={colors.accent} style={styles.folderIcon} />
              <Text style={styles.categoryName}>{item.name}</Text>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity
                onPress={() => handleOpenEdit(item)}
                style={styles.iconButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="pencil-outline" size={18} color={colors.muted} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleToggleArchive(item)}
                style={styles.iconButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={item.status === 'ACTIVE' ? 'archive-outline' : 'refresh-outline'}
                  size={18}
                  color={item.status === 'ACTIVE' ? colors.warning : colors.success}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyState
            icon="folder-open-outline"
            title="No Categories"
            description={
              statusFilter === 'ACTIVE'
                ? 'Create categories to easily group and filter your products.'
                : 'No archived categories.'
            }
            actionLabel={statusFilter === 'ACTIVE' ? 'Create Category' : undefined}
            onAction={handleOpenAdd}
          />
        }
      />

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingCategory ? 'Edit Category' : 'Create Category'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Beverages, Tools, Electronics"
              placeholderTextColor={colors.muted}
              value={categoryNameInput}
              onChangeText={setCategoryNameInput}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleSave}>
                <Text style={styles.confirmButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  statusToggle: {
    flexDirection: 'row',
    backgroundColor: colors.line,
    borderRadius: 8,
    padding: 2,
  },
  statusOption: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  statusOptionActive: {
    backgroundColor: colors.surface,
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  statusOptionTextActive: {
    color: colors.ink,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: colors.onAccent,
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  folderIcon: {
    marginRight: 10,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    width: '100%',
    borderRadius: 7,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 20,
    color: colors.ink,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: colors.muted,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: colors.onAccent,
    fontWeight: '600',
  },
});
