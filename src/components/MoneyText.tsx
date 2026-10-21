import React from 'react';
import { Text, TextStyle } from 'react-native';
import { formatMoney } from '../utils/currency';

interface MoneyTextProps {
  amountMinor: number | null | undefined;
  style?: TextStyle;
  currencySymbol?: string;
}

export const MoneyText: React.FC<MoneyTextProps> = ({
  amountMinor,
  style,
  currencySymbol = '₱',
}) => {
  return (
    <Text style={style}>
      {formatMoney(amountMinor, currencySymbol)}
    </Text>
  );
};
