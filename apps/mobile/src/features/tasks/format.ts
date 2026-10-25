import type { TaskResponseDto } from '@hitss/api-client';

import { formatLongDate, formatShortDate } from '@/lib/dates';
import { statusLabels } from '@/ui';

const instantDate = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
});

export function formatInstant(iso: string): string {
  return instantDate.format(new Date(iso));
}

export function dueLabel(
  task: Pick<TaskResponseDto, 'dueDate' | 'isOverdue'>,
  style: 'short' | 'long' = 'short',
): string | null {
  if (!task.dueDate) {
    return null;
  }
  const date =
    style === 'short'
      ? formatShortDate(task.dueDate)
      : formatLongDate(task.dueDate);
  return task.isOverdue ? `Atrasada · ${date}` : date;
}

export function taskAccessibilityLabel(
  task: TaskResponseDto,
  pendingSync = false,
): string {
  const parts = [task.title, statusLabels[task.status]];
  if (task.teams.length > 0) {
    parts.push(`Times: ${task.teams.map((team) => team.name).join(', ')}`);
  }
  if (task.dueDate) {
    parts.push(
      `Prazo ${formatShortDate(task.dueDate)}${task.isOverdue ? ', atrasada' : ''}`,
    );
  }
  if (pendingSync) {
    parts.push('Sincronização pendente');
  }
  return `${parts.join('. ')}.`;
}

export function tasksTotalLabel(total: number): string {
  return total === 1
    ? 'Isso é tudo (1 tarefa)'
    : `Isso é tudo (${total} tarefas)`;
}
