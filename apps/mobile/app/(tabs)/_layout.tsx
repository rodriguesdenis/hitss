import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { tokens } from '@/theme/tokens';
import { useColorSchemeName } from '@/theme/ThemeProvider';

type TabIconProps = { color: ColorValue; size: number };

const tint = (color: ColorValue) =>
  typeof color === 'string' ? color : undefined;

function TasksIcon({ color, size }: TabIconProps) {
  return <Feather name="check-square" color={tint(color)} size={size} />;
}

function TeamsIcon({ color, size }: TabIconProps) {
  return <Feather name="users" color={tint(color)} size={size} />;
}

function SettingsIcon({ color, size }: TabIconProps) {
  return <Feather name="settings" color={tint(color)} size={size} />;
}

export default function TabsLayout() {
  const color = tokens[useColorSchemeName()];
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color['fg-subtle'],
      }}
    >
      <Tabs.Screen
        name="tasks"
        options={{ title: 'Tarefas', tabBarIcon: TasksIcon }}
      />
      <Tabs.Screen
        name="teams"
        options={{ title: 'Times', tabBarIcon: TeamsIcon }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Ajustes', tabBarIcon: SettingsIcon }}
      />
    </Tabs>
  );
}
