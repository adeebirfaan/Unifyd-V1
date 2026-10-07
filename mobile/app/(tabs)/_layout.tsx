import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(outline: IconName, filled: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? filled : outline} size={24} color={color} />;
  };
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.shell}>
      <Tabs screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.brandCyan,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: { height: 68 + insets.bottom, paddingTop: 10, paddingBottom: insets.bottom + 10, backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1 },
        tabBarItemStyle: { minHeight: 44 },
      }}>
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarAccessibilityLabel: 'Home', tabBarIcon: tabIcon('home-outline', 'home') }} />
        <Tabs.Screen name="wallet" options={{ title: 'Wallet', tabBarAccessibilityLabel: 'Wallet', tabBarIcon: tabIcon('wallet-outline', 'wallet') }} />
        <Tabs.Screen name="planner" options={{ title: 'Planner', tabBarAccessibilityLabel: 'Planner', tabBarIcon: tabIcon('calendar-outline', 'calendar') }} />
        <Tabs.Screen name="mind" options={{ title: 'Mind', tabBarAccessibilityLabel: 'Mind', tabBarIcon: tabIcon('heart-outline', 'heart') }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarAccessibilityLabel: 'Profile', tabBarIcon: tabIcon('person-outline', 'person') }} />
      </Tabs>
      <Pressable accessibilityRole="button" accessibilityLabel="Add" accessibilityState={{ disabled: true }} disabled style={[styles.addButton, { bottom: 80 + insets.bottom }]}>
        <Ionicons name="add" size={30} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.background },
  addButton: { position: 'absolute', alignSelf: 'center', width: 58, height: 58, borderRadius: radius.radiusFull, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandBlue, borderWidth: 4, borderColor: colors.background, shadowColor: colors.brandBlue, shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
});
