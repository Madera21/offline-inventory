import { PreferencesProvider, useLabels } from '../src/store/PreferencesProvider';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator, Text, StyleSheet, StatusBar } from 'react-native';
import { getDatabase } from '../src/db/database';

export default function RootLayout() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        await getDatabase();
        setIsDbReady(true);
      } catch (err: any) {
        console.error('Database initialization error:', err);
        setDbError(err?.message || 'Failed to initialize database');
      }
    }
    init();
  }, []);

  if (dbError) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Database Initialization Failed</Text>
        <Text style={styles.errorMessage}>{dbError}</Text>
      </View>
    );
  }

  if (!isDbReady) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Initializing Offline Inventory...</Text>
      </View>
    );
  }

  return <ThemeProvider><PreferencesProvider><AppNavigator /></PreferencesProvider></ThemeProvider>;
}

function AppNavigator() {
  const { t } = useLabels();
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.paper} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '500' },
          contentStyle: { backgroundColor: colors.paper },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="stock/count" options={{ title: t('count') }} />
        <Stack.Screen name="stock/receive" options={{ title: t('receive') }} />
        <Stack.Screen name="stock/batches" options={{ title: t('batches') }} />
        <Stack.Screen name="shopping/index" options={{ title: t('shopping') }} />
        <Stack.Screen name="customers/index" options={{ title: t('credit') }} />
        <Stack.Screen name="closing/index" options={{ title: t('closing') }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="help" options={{ title: 'How to Use' }} />
        <Stack.Screen
          name="products/new"
          options={{ title: 'Add Product', presentation: 'card' }}
        />
        <Stack.Screen
          name="products/[id]"
          options={{ title: 'Product Details' }}
        />
        <Stack.Screen
          name="products/[id]/edit"
          options={{ title: 'Edit Product' }}
        />
        <Stack.Screen
          name="products/[id]/variants"
          options={{ title: 'Manage Variants' }}
        />
        <Stack.Screen
          name="stock/adjust"
          options={{ title: 'Stock Adjustment' }}
        />
        <Stack.Screen
          name="sales/[id]"
          options={{ title: 'Sale Receipt' }}
        />
        <Stack.Screen
          name="reports/index"
          options={{ title: 'Reports & Analytics' }}
        />
        <Stack.Screen
          name="backup/index"
          options={{ title: 'Backup & Restore' }}
        />
        <Stack.Screen
          name="categories/index"
          options={{ title: 'Manage Categories' }}
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F1E7',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#756F63',
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#DC2626',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#756F63',
    textAlign: 'center',
  },
});
