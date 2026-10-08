import { Redirect } from 'expo-router';

// Placeholder for the centre tab-bar slot. Its button opens the quick-actions
// sheet instead of navigating, so a direct visit simply returns to Home.
export default function QuickActionsRoute() {
  return <Redirect href="/" />;
}
