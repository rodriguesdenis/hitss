import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { AppHeader } from '@/offline';
import { tokens } from '@/theme/tokens';
import { useColorSchemeName } from '@/theme/ThemeProvider';
import { Icon, type IconName } from '@/ui';

type TabIconProps = { color: ColorValue; size: number };

const tabIcon = (name: IconName) =>
  function TabIcon({ color, size }: TabIconProps) {
    return (
      <Icon
        name={name}
        color={typeof color === 'string' ? (color as `#${string}`) : 'fg'}
        size={size}
      />
    );
  };

const TasksIcon = tabIcon('check-square');
const TeamsIcon = tabIcon('users');
const SettingsIcon = tabIcon('settings');

export default function TabsLayout() {
  const color = tokens[useColorSchemeName()];
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        header: AppHeader,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color['fg-subtle'],
      }}
    >
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tarefas',
          tabBarButtonTestID: 'tab-tasks',
          tabBarIcon: TasksIcon,
        }}
      />
      <Tabs.Screen
        name="teams"
        options={{
          title: 'Times',
          tabBarButtonTestID: 'tab-teams',
          tabBarIcon: TeamsIcon,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarButtonTestID: 'tab-settings',
          tabBarIcon: SettingsIcon,
        }}
      />
    </Tabs>
  );
}
