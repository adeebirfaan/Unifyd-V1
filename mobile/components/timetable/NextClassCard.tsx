import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { dayKey } from '@/components/timetable/ClassFields';
import { radius, spacing, typography } from '@/constants/theme';
import { nextClass, shortTime } from '@/lib/timetable';
import type { TimetableEntry } from '@/lib/timetable';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

/** The next saved class by the device's local time, or a neutral note when nothing is upcoming. */
export function NextClassCard({ entries, now, testID = 'next-class' }: { entries: readonly TimetableEntry[]; now?: Date; testID?: string }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const next = nextClass(entries, now);
  if (!next) return <View testID={testID} style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    <View style={styles.row}><Ionicons name="time-outline" size={20} color={tokens.cardMutedText} /><Text style={[styles.meta, { color: tokens.cardMutedText }]}>{t('timetable.noUpcoming')}</Text></View>
  </View>;
  const { entry, daysAhead } = next;
  const time = `${shortTime(entry.start_time)}–${shortTime(entry.end_time)}`;
  const day = t(dayKey(entry.day_of_week));
  const when = daysAhead === 0 ? t('timetable.nextToday', { time }) : daysAhead === 1 ? t('timetable.nextTomorrow', { time })
    : daysAhead === 7 ? t('timetable.nextWeek', { day, time }) : t('timetable.nextDay', { day, time });
  const name = entry.course_code ? `${entry.course_code} · ${entry.course_name}` : entry.course_name;
  return <View testID={testID} accessible accessibilityLabel={`${t('timetable.nextClass')}: ${name}, ${when}${entry.location ? `, ${entry.location}` : ''}`}
    style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    <View style={styles.row}><Ionicons name="time-outline" size={20} color={tokens.brandCyan} /><Text style={[styles.label, { color: tokens.brandCyan }]}>{t('timetable.nextClass')}</Text></View>
    <Text style={[styles.name, { color: tokens.cardText }]} numberOfLines={2}>{name}</Text>
    <Text style={[styles.meta, { color: tokens.cardMutedText }]}>{when}{entry.location ? ` · ${entry.location}` : ''}</Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space4, gap: spacing.space1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 }, label: { ...typography.label },
  name: { ...typography.body, fontWeight: '700', lineHeight: 22 }, meta: { ...typography.body, lineHeight: 22 },
});
