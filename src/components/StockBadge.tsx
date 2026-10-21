import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StockBadgeProps {
  quantity: number;
  lowStockThreshold?: number | null;
  unitLabel?: string;
}

export const StockBadge: React.FC<StockBadgeProps> = ({
  quantity,
  lowStockThreshold,
  unitLabel = 'units',
}) => {
  let badgeStyle = styles.inStock;
  let textStyle = styles.inStockText;
  let label = `${quantity} ${unitLabel}`;

  if (quantity <= 0) {
    badgeStyle = styles.outOfStock;
    textStyle = styles.outOfStockText;
    label = `Out of stock (0 ${unitLabel})`;
  } else if (lowStockThreshold !== null && lowStockThreshold !== undefined && quantity <= lowStockThreshold) {
    badgeStyle = styles.lowStock;
    textStyle = styles.lowStockText;
    label = `Low stock: ${quantity} ${unitLabel}`;
  }

  return (
    <View style={[styles.badge, badgeStyle]}>
      <Text style={[styles.text, textStyle]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  inStock: {
    backgroundColor: '#DCFCE7',
  },
  inStockText: {
    color: '#166534',
  },
  lowStock: {
    backgroundColor: '#FEF3C7',
  },
  lowStockText: {
    color: '#92400E',
  },
  outOfStock: {
    backgroundColor: '#FEE2E2',
  },
  outOfStockText: {
    color: '#991B1B',
  },
});
