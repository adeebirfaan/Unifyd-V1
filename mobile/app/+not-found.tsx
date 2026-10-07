import { Redirect } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';

export default function NotFoundScreen() {
  const { gate } = useAuth();
  if (gate === 'ready') return <Redirect href="/" />;
  if (gate === 'onboarding') return <Redirect href="/onboarding" />;
  return <Redirect href="/login" />;
}
