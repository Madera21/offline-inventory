import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { stockRepository } from '../../src/db/repositories/stock.repository';
import { StockMovement } from '../../src/types';
import { formatDateTime } from '../../src/utils/dates';
import { EmptyState } from '../../src/components/EmptyState';

export default function HistoryTabScreen() {
  const [movements, setMovements] = useState<(StockMovement & { product_name: string; variant_label: string })[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadMovements = useCallback(async () => {
    try {
      const data = await stockRepository.getAllMovements(100);
      setMovements(data);
    } catch (err) {
      console.error('Failed to load stock movements:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMovements();
    }, [loadMovements])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMovements();
    setRefreshing(false);
  };

  const getMovementIcon = (type: string, delta: number) => {
    if (delta > 0) return { name: 'arrow-down-circle' as const, color: '#16A34A' };
    return { name: 'arrow-up-circle' as const, color: '#DC2626' };
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={movements}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const icon = getMovementIcon(item.movement_type, item.quantity_delta);
          const isPositive = item.quantity_delta > 0;
          return (
            <View style={styles.movementItem}>
              <Ionicons name={icon.name} size={28} color={icon.color} style={styles.icon} />
              <View style={styles.itemDetails}>
                <Text style={styles.productName}>{item.product_name}</Text>
                <Text style={styles.variantLabel}>
                  {item.variant_label} • {item.movement_type.replace('_', ' ')}
                </Text>
                {item.reason && <Text style={styles.reasonText}>Reason: {item.reason}</Text>}
                <Text style={styles.timestamp}>{formatDateTime(item.occurred_at)}</Text>
              </View>
              <View style={styles.deltaContainer}>
                <Text style={[styles.deltaText, isPositive ? styles.deltaPositive : styles.deltaNegative]}>
                  {isPositive ? `+${item.quantity_delta}` : item.quantity_delta}
                </Text>
              </View>
            </View>
          );
        }}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="time-outline"
              title="No Movement History"
              description="Stock adjustments, initial counts, sales, and returns will appear here in chronological order."
            />
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  listContent: {
    padding: 16,
  },
  movementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  icon: {
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  variantLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  reasonText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
    fontStyle: 'italic',
  },
  timestamp: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  deltaContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  deltaText: {
    fontSize: 18,
    fontWeight: '800',
  },
  deltaPositive: {
    color: '#16A34A',
  },
  deltaNegative: {
    color: '#DC2626',
  },
});
