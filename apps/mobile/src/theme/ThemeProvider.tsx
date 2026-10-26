import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
  type Theme,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { tokens, type ColorScheme } from './tokens';

export function navigationTheme(scheme: ColorScheme): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const color = tokens[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: color.primary,
      background: color.canvas,
      card: color.surface,
      text: color.fg,
      border: color['border-muted'],
      notification: color.danger,
    },
  };
}

export function useColorSchemeName(): ColorScheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorSchemeName();
  return (
    <NavigationThemeProvider value={navigationTheme(scheme)}>
      {children}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}
