import { useLabels } from '../../src/store/PreferencesProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  const { colors } = useTheme();
  const { t } = useLabels();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.line,
          minHeight: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: colors.paper,
        },
        headerTitleStyle: {
          fontWeight: '500',
          color: colors.ink,
        },
        headerTintColor: colors.ink,
        sceneStyle: { backgroundColor: colors.paper },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home'),
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: t('stock'),
          headerTitle: t('stock'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: t('sell'),
          headerTitle: t('newSale'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('history'),
          headerTitle: 'Transaction History',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('more'),
          headerTitle: 'More & Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal-circle-outline" size={size} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}
