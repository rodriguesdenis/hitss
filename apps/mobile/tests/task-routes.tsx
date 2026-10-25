import { Text } from 'react-native';

export const taskRoutes = {
  'tasks/new': () => <Text>new task screen</Text>,
  'tasks/[id]/index': () => <Text>task detail screen</Text>,
  'tasks/[id]/edit': () => <Text>edit task screen</Text>,
};
