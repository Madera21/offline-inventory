import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors, useThemeStyles } from '../theme/ThemeProvider';

interface Props {
  selectedDate: Date;
  onSelect: (date: Date) => void;
}

export function ReportCalendar({ selectedDate, onSelect }: Props) {
  const { colors, styles } = useThemeStyles(createStyles);
  const [month, setMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((month.getDay() + daysInMonth) / 7) * 7;
  const canGoNext = month.getFullYear() < today.getFullYear()
    || (month.getFullYear() === today.getFullYear() && month.getMonth() < today.getMonth());

  return (
    <View style={styles.calendar}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous month" style={styles.arrow}
          onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={styles.title}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next month" accessibilityState={{ disabled: !canGoNext }}
          disabled={!canGoNext} style={styles.arrow}
          onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          <Ionicons name="chevron-forward" size={22} color={canGoNext ? colors.ink : colors.line} />
        </TouchableOpacity>
      </View>
      <View style={styles.grid}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <Text key={day} style={styles.weekday}>{day}</Text>)}
        {Array.from({ length: cells }, (_, index) => {
          const day = index - month.getDay() + 1;
          if (day < 1 || day > daysInMonth) return <View key={index} style={styles.cell} />;
          const date = new Date(month.getFullYear(), month.getMonth(), day);
          const disabled = date > todayStart;
          const selected = date.toDateString() === selectedDate.toDateString();
          return (
            <TouchableOpacity key={index} accessibilityRole="button"
              accessibilityLabel={date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              accessibilityState={{ selected, disabled }} disabled={disabled}
              style={[styles.cell, selected && styles.selected]} onPress={() => onSelect(date)}>
              <Text style={[styles.day, disabled && styles.disabled, selected && styles.selectedText]}>{day}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  calendar: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 8, marginBottom: 16, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { padding: 12 },
  title: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.285714%', textAlign: 'center', color: colors.muted, paddingVertical: 8, fontSize: 12 },
  cell: { width: '14.285714%', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  day: { color: colors.ink, fontSize: 14 },
  disabled: { color: colors.muted, opacity: 0.4 },
  selected: { backgroundColor: colors.accent },
  selectedText: { color: colors.onAccent, fontWeight: '600' },
});
