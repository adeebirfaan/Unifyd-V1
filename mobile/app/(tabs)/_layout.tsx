import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(outline: IconName, filled: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? filled : outline} size={24} color={color} />;
  };
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { tokens } = useAppearance();
  const { t } = useI18n();
  return (
    <View style={[styles.shell, { backgroundColor: tokens.screenBackground }]}>
      <Tabs screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.brandCyan,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: { height: 68 + insets.bottom, paddingTop: 10, paddingBottom: insets.bottom + 10, backgroundColor: tokens.navigationBackground, borderTopColor: tokens.border, borderTopWidth: 1 },
        tabBarItemStyle: { minHeight: 44 },
      }}>
        <Tabs.Screen name="index" options={{ title: t('tab.home'), tabBarAccessibilityLabel: t('tab.home'), tabBarIcon: tabIcon('home-outline', 'home') }} />
        <Tabs.Screen name="wallet" options={{ title: t('tab.wallet'), tabBarAccessibilityLabel: t('tab.wallet'), tabBarIcon: tabIcon('wallet-outline', 'wallet') }} />
        <Tabs.Screen name="planner" options={{ title: t('tab.planner'), tabBarAccessibilityLabel: t('tab.planner'), tabBarIcon: tabIcon('calendar-outline', 'calendar') }} />
        <Tabs.Screen name="mind" options={{ title: t('tab.mind'), tabBarAccessibilityLabel: t('tab.mind'), tabBarIcon: tabIcon('heart-outline', 'heart') }} />
        <Tabs.Screen name="profile" options={{ title: t('tab.profile'), tabBarAccessibilityLabel: t('tab.profile'), tabBarIcon: tabIcon('person-outline', 'person') }} />
      </Tabs>
      <Pressable accessibilityRole="button" accessibilityLabel={t('tab.add')} accessibilityState={{ disabled: true }} disabled style={[styles.addButton, { bottom: 80 + insets.bottom }]}>
        <Ionicons name="add" size={30} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.background },
  addButton: { position: 'absolute', alignSelf: 'center', width: 58, height: 58, borderRadius: radius.radiusFull, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandBlue, borderWidth: 4, borderColor: colors.background, shadowColor: colors.brandBlue, shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
});
