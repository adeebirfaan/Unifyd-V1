import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Animated, BackHandler, Easing, Platform, StyleSheet, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QuickActionsButton, QuickActionsSheet } from '@/components/QuickActions';
import { colors } from '@/constants/theme';
import { DEFAULT_QUICK_ACTIONS, parseQuickActions, quickActionsStorageKey, sortQuickActions } from '@/lib/quickActions';
import type { QuickActionId } from '@/lib/quickActions';
import { useAuth } from '@/providers/AuthProvider';
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
  const [quickOpen, setQuickOpen] = useState(false);
  // The sheet stays mounted only while open or closing, so hidden actions never
  // remain on screen for touch, screen readers, or tests.
  const [sheetMounted, setSheetMounted] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const { session } = useAuth();
  const userId = session?.user.id;
  // Each student's shortcut choice is kept on this device; the defaults apply until they change it.
  const [actions, setActions] = useState<QuickActionId[]>([...DEFAULT_QUICK_ACTIONS]);
  const barHeight = 68 + insets.bottom;

  const setQuick = useCallback((next: boolean) => {
    setQuickOpen(next);
    if (next) setSheetMounted(true);
    Animated.timing(progress, {
      toValue: next ? 1 : 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => { if (finished && !next) setSheetMounted(false); });
  }, [progress]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    AsyncStorage.getItem(quickActionsStorageKey(userId))
      .then((raw) => { if (active) setActions(parseQuickActions(raw)); })
      .catch(() => { if (active) setActions([...DEFAULT_QUICK_ACTIONS]); });
    return () => { active = false; };
  }, [userId]);

  function saveActions(ids: QuickActionId[]) {
    const next = sortQuickActions(ids);
    setActions(next);
    // A storage failure keeps the choice for this session rather than blocking the student.
    if (userId) AsyncStorage.setItem(quickActionsStorageKey(userId), JSON.stringify(next)).catch(() => undefined);
  }

  useEffect(() => {
    if (!quickOpen) return;
    // Android back closes the sheet before leaving the screen.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setQuick(false); return true; });
    return () => subscription.remove();
  }, [quickOpen, setQuick]);

  function selectAction(id: QuickActionId) {
    setQuick(false);
    if (id === 'addExpense') router.push('/add-expense');
    else if (id === 'scanReceipt') router.push('/scan-receipt');
    else if (id === 'setBudget') router.push('/set-budget');
    else if (id === 'addTask') router.push('/add-task');
    else if (id === 'reminders') router.push('/reminders');
    else if (id === 'mySemester') router.push('/my-semester');
    else router.navigate('/(tabs)/mind');
  }

  return (
    <View style={[styles.shell, { backgroundColor: tokens.screenBackground }]}>
      <Tabs screenListeners={{ tabPress: () => { if (quickOpen) setQuick(false); } }} screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.brandCyan,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: { height: barHeight, paddingTop: 10, paddingBottom: insets.bottom + 10, backgroundColor: tokens.navigationBackground, borderTopColor: tokens.border, borderTopWidth: 1 },
        tabBarItemStyle: { minHeight: 44 },
      }}>
        <Tabs.Screen name="index" options={{ title: t('tab.home'), tabBarAccessibilityLabel: t('tab.home'), tabBarIcon: tabIcon('home-outline', 'home') }} />
        <Tabs.Screen name="wallet" options={{ title: t('tab.wallet'), tabBarAccessibilityLabel: t('tab.wallet'), tabBarIcon: tabIcon('wallet-outline', 'wallet') }} />
        <Tabs.Screen name="quick" options={{
          title: t('quick.title'),
          tabBarButton: () => <QuickActionsButton open={quickOpen} progress={progress} onPress={() => setQuick(!quickOpen)} />,
        }} />
        <Tabs.Screen name="planner" options={{ title: t('tab.planner'), tabBarAccessibilityLabel: t('tab.planner'), tabBarIcon: tabIcon('calendar-outline', 'calendar') }} />
        <Tabs.Screen name="mind" options={{ title: t('tab.mind'), tabBarAccessibilityLabel: t('tab.mind'), tabBarIcon: tabIcon('heart-outline', 'heart') }} />
        {/* Profile opens from the Home avatar; hiding it keeps the bar balanced around the centre action. */}
        <Tabs.Screen name="profile" options={{ title: t('tab.profile'), href: null }} />
      </Tabs>
      {sheetMounted && <QuickActionsSheet open={quickOpen} progress={progress} bottom={barHeight} actions={actions} onClose={() => setQuick(false)} onSelect={selectAction} onSave={saveActions} />}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.background },
});
