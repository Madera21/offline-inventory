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

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#0F172A',
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },
});
