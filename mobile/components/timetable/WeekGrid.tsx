import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { dayKey, dayShortKey } from '@/components/timetable/ClassFields';
import { radius, spacing, typography } from '@/constants/theme';
import { shortTime, toMinutes } from '@/lib/timetable';
import type { TimetableEntry } from '@/lib/timetable';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

const HOUR_HEIGHT = 68;
const TIME_COLUMN = 44;
const MIN_DAY_WIDTH = 62;

// Course colours: each course keeps one colour so its sessions are easy to spot across the week.
const PALETTE = {
  light: [
    { background: '#FDE4EE', text: '#C2255C', edge: '#E64980' }, { background: '#E3F5D8', text: '#4B8A12', edge: '#74B816' },
    { background: '#ECE5FC', text: '#7048E8', edge: '#845EF7' }, { background: '#DFF1FD', text: '#1971C2', edge: '#339AF0' },
    { background: '#FFEBD6', text: '#D9480F', edge: '#FD7E14' }, { background: '#D9F5EF', text: '#0B7A6A', edge: '#20C997' },
  ],
  dark: [
    { background: '#4A1E33', text: '#FFB3CF', edge: '#F06595' }, { background: '#253D17', text: '#B9EC8F', edge: '#94D82D' },
    { background: '#2F2654', text: '#CDBEFF', edge: '#9775FA' }, { background: '#16344F', text: '#A5D8FF', edge: '#4DABF7' },
    { background: '#4A2C14', text: '#FFD3A8', edge: '#FFA94D' }, { background: '#15403A', text: '#9FF0DC', edge: '#38D9A9' },
  ],
} as const;

function colourIndex(key: string) {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % PALETTE.light.length;
}

type Placed = { entry: TimetableEntry; start: number; end: number; lane: number; lanes: number };

/** Side-by-side lanes for classes that overlap on the same day (clashes stay visible, never hidden). */
function placeDay(entries: readonly TimetableEntry[]): Placed[] {
  const items = entries.map((entry) => ({ entry, start: toMinutes(entry.start_time) ?? 0, end: toMinutes(entry.end_time) ?? 0 }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const placed: Placed[] = [];
  let group: Placed[] = [];
  let groupEnd = -1;
  const close = () => { const lanes = Math.max(...group.map((item) => item.lane)) + 1; for (const item of group) item.lanes = lanes; group = []; };
  for (const item of items) {
    if (group.length && item.start >= groupEnd) close();
    const busy = new Set(group.filter((other) => other.end > item.start).map((other) => other.lane));
    let lane = 0;
    while (busy.has(lane)) lane += 1;
    const next = { ...item, lane, lanes: 1 };
    group.push(next); placed.push(next);
    groupEnd = Math.max(groupEnd, item.end);
  }
  if (group.length) close();
  return placed;
}

/**
 * A weekly grid: days across, hours down, each class as a block sized by its times.
 * Free hours show a + button to add a class there. Weekends appear only when used,
 * and empty days are simply blank.
 */
export function WeekGrid({ entries, clashing, onOpen, onAdd }: {
  entries: readonly TimetableEntry[];
  clashing: ReadonlySet<string>;
  onOpen: (entry: TimetableEntry) => void;
  onAdd: (day: number, hour: number) => void;
}) {
  const { mode, tokens } = useAppearance();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const days = [1, 2, 3, 4, 5, ...[6, 7].filter((day) => entries.some((entry) => entry.day_of_week === day))];
  const starts = entries.map((entry) => toMinutes(entry.start_time) ?? 0);
  const ends = entries.map((entry) => toMinutes(entry.end_time) ?? 0);
  const firstHour = Math.min(7, ...starts.map((minutes) => Math.floor(minutes / 60)));
  const lastHour = Math.max(18, ...ends.map((minutes) => Math.ceil(minutes / 60)));
  const hours = Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index);
  const available = Math.min(width, 568) - spacing.space4 * 2 - TIME_COLUMN - 2;
  const dayWidth = Math.max(MIN_DAY_WIDTH, Math.floor(available / days.length));
  const palette = PALETTE[mode];

  return <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} testID="week-grid">
    <View style={[styles.grid, { borderColor: tokens.border, backgroundColor: tokens.cardBackground }]}>
      <View style={[styles.header, { borderBottomColor: tokens.border }]}>
        <View style={{ width: TIME_COLUMN }} />
        {days.map((day) => {
          const count = entries.filter((entry) => entry.day_of_week === day).length;
          return <View key={day} style={[styles.dayHeader, { width: dayWidth, borderLeftColor: tokens.border }]} accessible accessibilityRole="header" accessibilityLabel={`${t(dayKey(day))}, ${count}`}>
            <Text style={[styles.dayName, { color: tokens.brandCyan }]}>{t(dayShortKey(day))}</Text>
            <View style={[styles.count, { backgroundColor: count ? tokens.brandBlue : tokens.cardElevated }]}><Text style={[styles.countText, { color: count ? '#FFFFFF' : tokens.cardMutedText }]}>{count}</Text></View>
          </View>;
        })}
      </View>
      <View style={styles.body}>
        <View style={{ width: TIME_COLUMN }}>
          {hours.map((hour) => <Text key={hour} style={[styles.hour, { color: tokens.cardMutedText, height: HOUR_HEIGHT }]}>{`${String(hour).padStart(2, '0')}:00`}</Text>)}
        </View>
        {days.map((day) => {
          const placed = placeDay(entries.filter((entry) => entry.day_of_week === day));
          return <View key={day} style={[styles.column, { width: dayWidth, height: hours.length * HOUR_HEIGHT, borderLeftColor: tokens.border }]}>
            {hours.map((hour) => {
              const covered = placed.some((item) => item.start < (hour + 1) * 60 && item.end > hour * 60);
              return <View key={hour} style={[styles.cell, { top: (hour - firstHour) * HOUR_HEIGHT, height: HOUR_HEIGHT, borderTopColor: tokens.border }]}>
                {!covered && <Pressable accessibilityRole="button" accessibilityLabel={t('timetable.addAt', { day: t(dayKey(day)), time: `${String(hour).padStart(2, '0')}:00` })} onPress={() => onAdd(day, hour)}
                  style={({ pressed }) => [styles.add, { backgroundColor: tokens.cardElevated, opacity: pressed ? 0.6 : 1 }]}>
                  <Ionicons name="add" size={18} color={tokens.brandCyan} />
                </Pressable>}
              </View>;
            })}
            {placed.map(({ entry, start, end, lane, lanes }) => {
              const colour = palette[colourIndex(entry.course_code ?? entry.course_name)]!;
              const laneWidth = (dayWidth - 4) / lanes;
              const time = `${shortTime(entry.start_time)}–${shortTime(entry.end_time)}`;
              return <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={t('timetable.openEntry', { name: entry.course_name, day: t(dayKey(day)), time })} onPress={() => onOpen(entry)}
                style={[styles.block, {
                  top: (start - firstHour * 60) / 60 * HOUR_HEIGHT + 2, height: Math.max(28, (end - start) / 60 * HOUR_HEIGHT - 4),
                  left: 2 + lane * laneWidth, width: laneWidth - 2, backgroundColor: colour.background,
                  borderLeftColor: clashing.has(entry.id) ? tokens.cardErrorText : colour.edge, borderWidth: clashing.has(entry.id) ? 1.5 : 0, borderColor: tokens.cardErrorText,
                }]}>
                <Text style={[styles.code, { color: colour.text }]} numberOfLines={entry.course_code ? 1 : 2} adjustsFontSizeToFit={!!entry.course_code} minimumFontScale={0.8}>{entry.course_code ?? entry.course_name}</Text>
                {entry.location && <Text style={[styles.room, { color: mode === 'dark' ? colour.text : '#212529' }]} numberOfLines={2}>{entry.location}</Text>}
              </Pressable>;
            })}
          </View>;
        })}
      </View>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  grid: { borderWidth: 1, borderRadius: radius.radiusMd, overflow: 'hidden' },
  header: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: spacing.space2 },
  dayHeader: { alignItems: 'center', gap: spacing.space1, borderLeftWidth: StyleSheet.hairlineWidth },
  dayName: { ...typography.label, fontWeight: '700' },
  count: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  countText: { fontSize: 12, fontWeight: '700' },
  body: { flexDirection: 'row' },
  hour: { fontSize: 11, fontWeight: '600', textAlign: 'center', paddingTop: 4 },
  column: { borderLeftWidth: StyleSheet.hairlineWidth, position: 'relative' },
  cell: { position: 'absolute', left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  add: { width: 40, height: 40, borderRadius: radius.radiusSm, alignItems: 'center', justifyContent: 'center' },
  block: { position: 'absolute', borderRadius: 8, borderLeftWidth: 3, paddingHorizontal: 3, paddingVertical: 3, overflow: 'hidden' },
  code: { fontSize: 10.5, fontWeight: '800', lineHeight: 14, letterSpacing: -0.2 },
  room: { fontSize: 10, fontWeight: '600', lineHeight: 13, marginTop: 1 },
});
