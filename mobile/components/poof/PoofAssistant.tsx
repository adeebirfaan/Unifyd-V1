import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PoofAvatar } from '@/components/mascot/PoofAvatar';
import { PoofMascot } from '@/components/mascot/PoofMascot';
import { PoofMessage } from '@/components/poof/PoofMessage';
import type { PoofChatMessage, PoofReplyMessage } from '@/components/poof/PoofMessage';
import { PoofSummary } from '@/components/poof/PoofSummary';
import type { PoofSummaryState } from '@/components/poof/PoofSummary';
import type { TranslationKey } from '@/constants/i18n';
import { colors, radius, semanticThemes, spacing, typography } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { POOF_MESSAGE_MAX, requestPoofReply } from '@/lib/poofAi';
import { loadPoofFacts } from '@/lib/poofData';
import { answerQuestion, buildSummary, usesAi } from '@/lib/poofEngine';
import type { PoofActionId, PoofAnswer } from '@/lib/poofEngine';
import { poofAiPayload } from '@/lib/poofFacts';
import type { PoofFacts } from '@/lib/poofFacts';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

type FactsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; facts: PoofFacts };

const SUGGESTIONS = ['topSpending', 'canSpend', 'prioritise', 'overdue', 'improve', 'transport', 'deadline'] as const;
const greetedKey = (userId: string) => `unifyd:poof-greeted:${userId}`;

/** In-app destinations for Poof's suggestions. Every action only navigates; nothing is saved for the student. */
function openDestination(action: PoofActionId) {
  if (action === 'openWallet') router.navigate('/(tabs)/wallet');
  else if (action === 'setBudget') router.push({ pathname: '/set-budget', params: { period: 'weekly' } });
  else if (action === 'addExpense') router.push('/add-expense');
  else if (action === 'openPlanner') router.navigate('/(tabs)/planner');
  else if (action === 'addTask') router.push('/add-task');
  else if (action === 'mySemester') router.push('/my-semester');
  else if (action === 'openTimetable') router.push('/timetable');
  else if (action === 'openMind') router.navigate('/(tabs)/mind');
  else router.push('/edit-profile');
}

function Thinking({ reduceMotion }: { reduceMotion: boolean }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const [phase] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.timing(phase, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => loop.stop();
  }, [phase, reduceMotion]);
  const steps = [[1, 0.3, 0.3, 1], [0.3, 1, 0.3, 0.3], [0.3, 0.3, 1, 0.3]];
  return (
    <View testID="poof-thinking" style={styles.thinkingRow} accessible accessibilityLabel={t('poof.thinking')} accessibilityLiveRegion="polite">
      <PoofAvatar size={28} />
      <View style={[styles.thinkingBubble, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
        {reduceMotion
          ? <Text style={[styles.thinkingText, { color: tokens.cardMutedText }]}>{t('poof.thinking')}</Text>
          : steps.map((outputRange, index) => (
            <Animated.View key={index} style={[styles.thinkingDot, { backgroundColor: tokens.brandCyan, opacity: phase.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange }) }]} />
          ))}
      </View>
    </View>
  );
}

/**
 * Poof, the Unifyd chat assistant (Phase 1). It shows a summary of the student's
 * own data, answers questions about it, and suggests in-app screens. Read-only:
 * it never creates, changes, deletes, submits, or spends anything.
 */
export function PoofAssistant({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const { language, t } = useI18n();
  const { tokens } = useAppearance();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [factsState, setFactsState] = useState<FactsState>({ status: 'loading' });
  const [messages, setMessages] = useState<PoofChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const followLatest = useRef(false);
  const factsRequest = useRef(0);
  const nextId = useRef(0);
  const greeted = useRef(false);
  // The backdrop ignores taps until the sheet has finished opening, so a quick double tap on the launcher cannot close it again.
  const shown = useRef(false);
  const newId = () => String(++nextId.current);
  const ctx = useMemo(() => ({ t, language }), [t, language]);

  const loadFacts = useCallback(async (showLoading: boolean) => {
    if (!userId) return;
    const request = ++factsRequest.current;
    // A reopen refreshes quietly; a manual refresh or first load shows progress.
    if (showLoading) setFactsState({ status: 'loading' });
    else setFactsState((current) => current.status === 'ready' ? current : { status: 'loading' });
    try {
      const facts = await loadPoofFacts(userId, profile);
      if (request === factsRequest.current) setFactsState({ status: 'ready', facts });
    } catch {
      if (request === factsRequest.current) setFactsState({ status: 'error' });
    }
  }, [userId, profile]);

  // The full introduction plays once per account on this device; later visits get a short hello.
  function greet() {
    if (!userId || greeted.current) return;
    greeted.current = true;
    AsyncStorage.getItem(greetedKey(userId)).then((value) => value === '1').catch(() => false).then((seen) => {
      const greeting: PoofReplyMessage = { id: 'greeting', role: 'poof', text: t(seen ? 'poof.greetBack' : 'poof.greetFirst'), details: [], actions: [], notice: null, source: 'greeting' };
      setMessages((current) => [greeting, ...current]);
      if (!seen) AsyncStorage.setItem(greetedKey(userId), '1').catch(() => undefined);
    });
  }

  // Fresh data each time the chat opens, so changes made through an action are reflected.
  function handleShow() {
    shown.current = true;
    void loadFacts(false);
    greet();
  }

  const summary: PoofSummaryState = factsState.status === 'ready'
    ? { status: 'ready', insights: buildSummary(factsState.facts, ctx) }
    : factsState;

  function fromRules(answer: PoofAnswer): PoofReplyMessage {
    return { id: newId(), role: 'poof', text: answer.text, details: answer.details, actions: answer.actions, notice: answer.notice, source: 'rules' };
  }

  async function send(raw: string) {
    const text = raw.trim().replace(/\s+/g, ' ').slice(0, POOF_MESSAGE_MAX);
    if (!text || thinking || factsState.status !== 'ready') return;
    const { facts } = factsState;
    setInput('');
    followLatest.current = true;
    setMessages((current) => [...current, { id: newId(), role: 'user', text }]);
    const answer = answerQuestion(text, facts, ctx);
    let reply = fromRules(answer);
    if (usesAi(answer.intent)) {
      setThinking(true);
      const result = await requestPoofReply(text, poofAiPayload(facts), language);
      setThinking(false);
      if (result.source === 'ai') {
        // The AI writes the reply; verified details and safety notices still come from the on-device rules.
        reply = {
          ...reply,
          text: result.reply,
          source: 'ai',
          details: result.inScope ? answer.details : [],
          actions: result.inScope ? (result.actions.length ? result.actions : answer.actions) : [],
          notice: result.inScope ? (answer.notice === 'scope' ? null : answer.notice) : 'scope',
        };
      }
    }
    setMessages((current) => [...current, reply]);
    AccessibilityInfo.announceForAccessibility(reply.text);
  }

  function close() {
    shown.current = false;
    onClose();
  }

  function openAction(action: PoofActionId) {
    close();
    // Navigate after the sheet starts closing so the new screen is not hidden behind it.
    requestAnimationFrame(() => openDestination(action));
  }

  const ready = factsState.status === 'ready';
  const canSend = ready && !thinking && input.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? 'fade' : 'slide'} onShow={handleShow} onRequestClose={close} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: tokens.modalScrim }]} accessibilityLabel={t('poof.close')} onPress={() => { if (shown.current) close(); }} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.avoid} pointerEvents="box-none">
          <View testID="poof-assistant" accessibilityViewIsModal style={[styles.sheet, { backgroundColor: tokens.cardBackground, borderColor: tokens.border, marginTop: insets.top + spacing.space6 }]}>
            <View style={[styles.handle, { backgroundColor: tokens.border }]} />
            <View style={styles.header}>
              <View style={styles.mascotDisc}><PoofMascot variant="idle" size={40} /></View>
              <View style={styles.headerText}>
                <Text accessibilityRole="header" style={[styles.title, { color: tokens.cardText }]}>{t('poof.title')}</Text>
                <Text style={[styles.subtitle, { color: tokens.cardMutedText }]}>{t('poof.subtitle')}</Text>
              </View>
              <Pressable testID="poof-close" accessibilityRole="button" accessibilityLabel={t('poof.close')} onPress={close} hitSlop={6}
                style={({ pressed }) => [styles.close, { borderColor: tokens.border }, pressed && styles.pressed]}>
                <Ionicons name="close" size={22} color={tokens.cardText} />
              </Pressable>
            </View>

            <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => { if (followLatest.current) scrollRef.current?.scrollToEnd({ animated: !reduceMotion }); }}>
              {/* Poof says hello first, then shows the summary, then the conversation. */}
              {messages.filter((message) => message.id === 'greeting').map((message) => <PoofMessage key={message.id} message={message} onAction={openAction} />)}
              <PoofSummary state={summary} onRetry={() => { void loadFacts(true); }} onAction={openAction} />
              {messages.filter((message) => message.id !== 'greeting').map((message) => <PoofMessage key={message.id} message={message} onAction={openAction} />)}
              {thinking && <Thinking reduceMotion={reduceMotion} />}
            </ScrollView>

            <View style={[styles.composerArea, { borderColor: tokens.border, paddingBottom: Math.max(insets.bottom, spacing.space3) }]}>
              {ready && <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.suggestions}
                accessibilityLabel={t('poof.suggestTitle')}>
                {SUGGESTIONS.map((key) => {
                  const question = t(`poof.suggest.${key}` as TranslationKey);
                  return (
                    <Pressable key={key} accessibilityRole="button" disabled={thinking} onPress={() => { void send(question); }}
                      style={({ pressed }) => [styles.suggestion, { borderColor: tokens.border, backgroundColor: tokens.cardElevated }, (pressed || thinking) && styles.pressed]}>
                      <Text style={[styles.suggestionText, { color: tokens.cardText }]}>{question}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>}
              <View style={styles.composer}>
                <TextInput testID="poof-input" value={input} onChangeText={setInput} editable={ready && !thinking} maxLength={POOF_MESSAGE_MAX}
                  placeholder={ready ? t('poof.inputPlaceholder') : t('poof.inputWaiting')} placeholderTextColor={tokens.cardMutedText}
                  accessibilityLabel={t('poof.inputLabel')} returnKeyType="send" blurOnSubmit={false} onSubmitEditing={() => { void send(input); }}
                  style={[styles.input, { color: tokens.cardText, backgroundColor: tokens.cardElevated, borderColor: tokens.border }]} />
                <Pressable testID="poof-send" accessibilityRole="button" accessibilityLabel={t('poof.send')} accessibilityState={{ disabled: !canSend }} disabled={!canSend}
                  onPress={() => { void send(input); }} style={({ pressed }) => [styles.send, { backgroundColor: canSend ? tokens.brandBlue : tokens.cardElevated }, pressed && styles.pressed]}>
                  <Ionicons name="arrow-up" size={22} color={canSend ? colors.white : tokens.cardMutedText} />
                </Pressable>
              </View>
              <Text style={[styles.footer, { color: tokens.cardMutedText }]}>{t('poof.footer')}</Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  avoid: { flex: 1, justifyContent: 'flex-end' },
  flex: { flex: 1 },
  sheet: {
    flex: 1, width: '100%', maxWidth: 568, alignSelf: 'center', borderTopLeftRadius: radius.radiusLg, borderTopRightRadius: radius.radiusLg,
    borderWidth: 1, borderBottomWidth: 0, paddingTop: spacing.space3, overflow: 'hidden',
  },
  handle: { width: 40, height: 4, borderRadius: radius.radiusFull, alignSelf: 'center', marginBottom: spacing.space2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3, paddingHorizontal: spacing.space5, paddingBottom: spacing.space3 },
  // A light disc keeps Poof's dark outlines visible on the dark sheet in both themes.
  mascotDisc: { width: 52, height: 52, borderRadius: 26, backgroundColor: semanticThemes.dark.mascotBackdrop, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { ...typography.sectionTitle },
  subtitle: { ...typography.label, fontWeight: '500' },
  close: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  thread: { paddingHorizontal: spacing.space5, paddingBottom: spacing.space5, gap: spacing.space4 },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 },
  thinkingBubble: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.radiusMd, paddingHorizontal: spacing.space4, minHeight: 40 },
  thinkingDot: { width: 7, height: 7, borderRadius: 4 },
  thinkingText: { ...typography.label },
  composerArea: { borderTopWidth: 1, paddingTop: spacing.space3, gap: spacing.space2 },
  suggestions: { paddingHorizontal: spacing.space5, gap: spacing.space2 },
  suggestion: { minHeight: 36, borderWidth: 1, borderRadius: radius.radiusFull, paddingHorizontal: spacing.space3, justifyContent: 'center' },
  suggestionText: { ...typography.label, fontWeight: '500' },
  composer: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, paddingHorizontal: spacing.space5 },
  input: { flex: 1, minHeight: 48, borderRadius: radius.radiusFull, borderWidth: 1, paddingHorizontal: spacing.space4, ...typography.body },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  footer: { ...typography.label, fontWeight: '400', fontSize: 11, lineHeight: 15, paddingHorizontal: spacing.space5, textAlign: 'center' },
});
