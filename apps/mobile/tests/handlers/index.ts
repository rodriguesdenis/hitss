import { tasksHandlers } from './tasks';
import { teamsHandlers } from './teams';

export const handlers = [...teamsHandlers, ...tasksHandlers];
