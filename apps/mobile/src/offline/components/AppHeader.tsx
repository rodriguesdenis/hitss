import { getHeaderTitle, Header } from 'expo-router/react-navigation';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { ConnectivityBanner } from './ConnectivityBanner';

type HeaderOptions = Omit<ComponentProps<typeof Header>, 'title'> & {
  title?: string;
  headerTitle?: unknown;
};

export function AppHeader({
  options,
  route,
}: {
  options: HeaderOptions;
  route: { name: string };
}) {
  return (
    <View>
      <Header
        {...options}
        title={getHeaderTitle(options as never, route.name)}
      />
      <ConnectivityBanner />
    </View>
  );
}
