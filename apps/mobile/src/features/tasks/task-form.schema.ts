import {
  tasksCreateBodyDescriptionMax,
  tasksCreateBodyTitleMax,
  tasksCreateBodyTitleMin,
} from '@hitss/api-client/zod';
import { z } from 'zod';

export const TITLE_MIN = tasksCreateBodyTitleMin;
export const TITLE_MAX = tasksCreateBodyTitleMax;
export const DESCRIPTION_MAX = tasksCreateBodyDescriptionMax;
export const TEAMS_MAX = 10;

export const TITLE_REQUIRED = 'O título é obrigatório';
export const TITLE_TOO_SHORT = 'O título deve ter pelo menos 3 caracteres';
export const TITLE_TOO_LONG = 'O título deve ter no máximo 120 caracteres';
export const DESCRIPTION_TOO_LONG = `A descrição deve ter no máximo ${DESCRIPTION_MAX} caracteres`;
export const TEAMS_LIMIT = 'Você pode escolher até 10 times';
export const UNKNOWN_TEAMS_REMOVED =
  'Alguns times não existem mais e foram removidos';
export const TOO_MANY_TEAMS = 'Uma tarefa pode ter até 10 times.';

export const taskFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, TITLE_REQUIRED)
    .min(TITLE_MIN, TITLE_TOO_SHORT)
    .max(TITLE_MAX, TITLE_TOO_LONG),
  description: z
    .string()
    .max(DESCRIPTION_MAX, DESCRIPTION_TOO_LONG)
    .transform((value) => value.trim() || null),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE']),
  dueDate: z.string().nullable(),
  teamIds: z.array(z.string()).max(TEAMS_MAX, TEAMS_LIMIT),
});

export type TaskFormValues = z.input<typeof taskFormSchema>;

export type TaskFormOutput = z.output<typeof taskFormSchema>;
