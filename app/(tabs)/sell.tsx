import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '../../src/components/EmptyState';

export default function SellTabScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <EmptyState
        icon="cart-outline"
        title="Quick Sale & Checkout"
        description="The sales module will let you select products, calculate change, apply discounts, and commit sales with immediate inventory deduction."
        actionLabel="Go to Inventory"
        onAction={() => router.push('/(tabs)/inventory')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
