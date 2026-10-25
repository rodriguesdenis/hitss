import { OfflineBanner } from '@/ui';

import { useConnectivityBanner } from '../use-connectivity-banner';

export function ConnectivityBanner() {
  const { status, pendingCount } = useConnectivityBanner();
  return <OfflineBanner status={status} pendingCount={pendingCount} />;
}
