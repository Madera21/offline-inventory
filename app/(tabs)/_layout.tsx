import { useTheme } from '../../src/theme/ThemeProvider';
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  const { colors } = useTheme();
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
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Stock',
          headerTitle: 'On the shelves',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: 'Sell',
          headerTitle: 'New sale',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          headerTitle: 'Transaction History',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          headerTitle: 'More & Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal-circle-outline" size={size} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}
