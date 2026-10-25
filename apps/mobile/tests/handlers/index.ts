import { authHandlers } from './auth';
import { tasksHandlers } from './tasks';
import { teamsHandlers } from './teams';

export const handlers = [...authHandlers, ...teamsHandlers, ...tasksHandlers];
