import { StyleSheet, Text, View } from 'react-native';

import { SelectionField } from '@/components/profile/SelectionField';
import { UMPSA_FACULTIES, UMPSA_NAME, facultyForLabel, programmeForLabel } from '@/constants/umpsa-academic-catalog';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';
import type { TranslationKey } from '@/constants/i18n';

const STUDY_YEAR_IDS = Array.from({ length: 8 }, (_, index) => String(index + 1));

export function AcademicFields({ faculty, programme, studyYear, onFacultyChange, onProgrammeChange, onStudyYearChange, errors }: {
  faculty: string;
  programme: string;
  studyYear: string;
  onFacultyChange: (value: string) => void;
  onProgrammeChange: (value: string) => void;
  onStudyYearChange: (value: string) => void;
  errors?: { faculty?: string; programme?: string; studyYear?: string };
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const studyYears = STUDY_YEAR_IDS.map((id) => ({ id, label: t('academic.year', { year: id }) }));
  const selectedFaculty = facultyForLabel(faculty);
  const programmeOptions = selectedFaculty?.programmes ?? [];
  const selectedProgramme = programmeForLabel(faculty, programme);

  return (
    <>
      <View style={styles.universityCard}>
        <Text style={styles.universityLabel}>{t('academic.university')}</Text>
        <Text style={styles.universityName}>{UMPSA_NAME}</Text>
      </View>
      <SelectionField
        label={t('academic.faculty')}
        value={selectedFaculty?.id ?? null}
        placeholder={t('academic.facultyPlaceholder')}
        options={UMPSA_FACULTIES}
        onSelect={(id) => {
          const next = UMPSA_FACULTIES.find((entry) => entry.id === id)?.label ?? '';
          if (next !== faculty) onProgrammeChange('');
          onFacultyChange(next);
        }}
        error={errors?.faculty}
      />
      {!!faculty && !selectedFaculty && <Text style={[styles.futureMessage, { color: tokens.mutedText }]}>{t('academic.legacyFaculty', { value: faculty })}</Text>}
      {programmeOptions.length > 0 ? (
        <View style={styles.programmeField}>
          <SelectionField
            label={t('academic.programme')}
            value={selectedProgramme?.id ?? null}
            placeholder={t('academic.programmePlaceholder')}
            options={programmeOptions}
            onSelect={(id) => onProgrammeChange(programmeOptions.find((entry) => entry.id === id)?.label ?? '')}
            error={errors?.programme}
          />
          {!!programme && !selectedProgramme && <Text style={[styles.futureMessage, { color: tokens.mutedText }]}>{t('academic.legacyProgramme', { value: programme })}</Text>}
        </View>
      ) : selectedFaculty ? (
        <Text style={[styles.futureMessage, { color: tokens.mutedText }]}>{t('academic.future')}</Text>
      ) : null}
      <SelectionField
        label={t('academic.studyYear')}
        value={studyYear || null}
        placeholder={t('academic.yearPlaceholder')}
        options={studyYears}
        onSelect={onStudyYearChange}
        error={errors?.studyYear}
      />
    </>
  );
}

export function validateAcademicFields(faculty: string, programme: string, studyYear: string, t: (key: TranslationKey) => string) {
  const selectedFaculty = facultyForLabel(faculty);
  return {
    faculty: !selectedFaculty ? t('academic.facultyRequired') : undefined,
    programme: selectedFaculty?.programmes.length && !programmeForLabel(faculty, programme) ? t('academic.programmeRequired') : undefined,
    studyYear: !STUDY_YEAR_IDS.includes(studyYear) ? t('academic.yearRequired') : undefined,
  };
}

const styles = StyleSheet.create({
  programmeField: { gap: spacing.space2 },
  universityCard: { padding: spacing.space4, borderRadius: radius.radiusMd, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  universityLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.space1 },
  universityName: { ...typography.body, color: colors.textPrimary },
  futureMessage: { ...typography.label, color: colors.textSecondary, lineHeight: 19, marginTop: -spacing.space2 },
});
