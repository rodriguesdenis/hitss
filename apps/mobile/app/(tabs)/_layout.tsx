import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { AppHeader, tasksTabLabel, usePendingCount } from '@/offline';
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
  const pending = usePendingCount() > 0;
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
          tabBarBadge: pending ? '' : undefined,
          tabBarBadgeStyle: {
            minWidth: 10,
            maxHeight: 10,
            borderRadius: 5,
            backgroundColor: color.primary,
          },
          tabBarAccessibilityLabel: tasksTabLabel(pending),
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
