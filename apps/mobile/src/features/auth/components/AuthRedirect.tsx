import { Redirect } from 'expo-router';

import { useAuthSession } from '../session';

export function AuthRedirect() {
  const { status } = useAuthSession();
  if (status === 'loading') {
    return null;
  }
  return <Redirect href={status === 'signedIn' ? '/tasks' : '/sign-in'} />;
}
