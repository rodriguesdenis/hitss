import { useTheme } from 'expo-router';
import { colorScheme, render, screen } from 'nativewind/test';
import { Text } from 'react-native';

import { ThemeProvider } from './ThemeProvider';

function Probe() {
  const { dark, colors } = useTheme();
  return (
    <Text>{`${dark ? 'dark' : 'light'} ${String(colors.background)} ${String(colors.text)}`}</Text>
  );
}

describe('ThemeProvider', () => {
  it.each([
    ['light', 'light #F8FAFC #0F172A'],
    ['dark', 'dark #0B1120 #F1F5F9'],
  ] as const)(
    'gives navigation the %s tokens of the device scheme',
    async (scheme, expected) => {
      colorScheme.set(scheme);
      await render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      );
      expect(screen.getByText(expected)).toBeTruthy();
    },
  );
});
