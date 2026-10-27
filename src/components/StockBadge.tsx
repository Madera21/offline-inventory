import { ThemeColors, useThemeStyles } from '../theme/ThemeProvider';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StockBadgeProps {
  quantity: number;
  totalStocked?: number;
  lowStockThreshold?: number | null;
  unitLabel?: string;
}

export const StockBadge: React.FC<StockBadgeProps> = ({
  quantity,
  totalStocked,
  lowStockThreshold,
  unitLabel = 'units',
}) => {
  const { colors, styles } = useThemeStyles(createStyles);
  let badgeStyle = styles.inStock;
  let textStyle = styles.inStockText;
  const count = totalStocked === undefined ? String(quantity) : `${quantity}/${Math.max(quantity, totalStocked)}`;
  let label = `${count} ${unitLabel}`;

  if (quantity <= 0) {
    badgeStyle = styles.outOfStock;
    textStyle = styles.outOfStockText;
    label = `Out of stock (${count} ${unitLabel})`;
  } else if (lowStockThreshold !== null && lowStockThreshold !== undefined && quantity <= lowStockThreshold) {
    badgeStyle = styles.lowStock;
    textStyle = styles.lowStockText;
    label = `Low stock: ${count} ${unitLabel}`;
  }

  return (
    <View style={[styles.badge, badgeStyle]} accessibilityLabel={totalStocked === undefined ? label : `${quantity} ${unitLabel} remaining out of ${Math.max(quantity, totalStocked)} stocked`}>
      <Text style={[styles.text, textStyle]}>{label}</Text>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    backgroundColor: colors.successSoft,
  },
  inStockText: {
    color: colors.success,
  },
  lowStock: {
    backgroundColor: colors.warningSoft,
  },
  lowStockText: {
    color: colors.warning,
  },
  outOfStock: {
    backgroundColor: colors.dangerSoft,
  },
  outOfStockText: {
    color: colors.danger,
  },
});
