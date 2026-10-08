import { testClient } from './test-client';

export default async function globalSetup() {
  const { client, userId } = await testClient();
  const { data: original, error } = await client.from('profiles')
    .select('full_name,university,faculty,programme,study_year,avatar_id,onboarding_completed,theme_preference,language_preference')
    .eq('id', userId)
    .single();
  if (error || !original) throw new Error('The E2E account profile could not be read.');

  const testProfile = {
    full_name: original.full_name?.trim() || 'E2E Student',
    university: original.university || 'Universiti Malaysia Pahang Al-Sultan Abdullah',
    faculty: original.faculty?.trim() || 'Faculty of Computing',
    programme: original.programme,
    study_year: original.study_year || 1,
    avatar_id: original.avatar_id || 'avatar-01',
    onboarding_completed: true,
    theme_preference: 'dark',
    language_preference: 'en',
  };
  const { data: prepared, error: prepareError } = await client.from('profiles')
    .update(testProfile)
    .eq('id', userId)
    .select('id')
    .maybeSingle();
  if (prepareError || !prepared) throw new Error('The E2E account could not be prepared for protected screens.');

  return async () => {
    const { data: restored, error: restoreError } = await client.from('profiles')
      .update(original)
      .eq('id', userId)
      .select('id')
      .maybeSingle();
    if (restoreError || !restored) throw new Error('The original E2E profile could not be restored.');
    await client.auth.signOut();
  };
}
