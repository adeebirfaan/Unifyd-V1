import type { PropsWithChildren } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';

export function AuthScaffold({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle: string }>) {
  const insets = useSafeAreaInsets();
  const { tokens } = useAppearance();
  return (
    <KeyboardAvoidingView style={[styles.fill, { backgroundColor: tokens.screenBackground }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={[styles.fill, { backgroundColor: tokens.screenBackground }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space8, paddingBottom: insets.bottom + spacing.space8 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner}>
          <View style={styles.brand}>
            <Image source={require('../../assets/brand/unifyd-logo.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="Unifyd logo" />
            <Text style={[styles.wordmark, { color: tokens.screenText }]}>unifyd</Text>
          </View>
          <Text style={[styles.title, { color: tokens.screenText }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: tokens.mutedText }]}>{subtitle}</Text>
          <View style={styles.body}>{children}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.space6 },
  inner: { width: '100%', maxWidth: 430, alignSelf: 'center' },
  brand: { alignItems: 'center', marginBottom: spacing.space8 },
  logo: { width: 100, height: 100 },
  wordmark: { ...typography.sectionTitle, color: colors.textPrimary, marginTop: spacing.space2 },
  title: { ...typography.display, color: colors.textPrimary, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 23, marginTop: spacing.space2 },
  body: { gap: spacing.space4, marginTop: spacing.space8 },
});
