import type {
  TaskResponseDto,
  TaskStatus,
  TeamChipDto,
} from '@hitss/api-client';
import { useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { errorCode } from '@/lib/error-messages';
import {
  Button,
  ConfirmDialog,
  ErrorState,
  IconButton,
  Screen,
  SegmentedControl,
  SkeletonList,
  StatusBadge,
  statusIcons,
  statusLabels,
  TeamChipGroup,
  type SegmentOption,
} from '@/ui';

import { formatInstant } from '../format';
import { useStatusChange } from '../hooks/useStatusChange';
import { useTaskDetail } from '../hooks/useTaskDetail';
import { useDeleteTask } from '../hooks/useTaskMutations';
import { DueDate } from './DueDate';

const statusOptions: SegmentOption<TaskStatus>[] = (
  ['PENDING', 'IN_PROGRESS', 'DONE'] as const
).map((status) => ({
  value: status,
  label: statusLabels[status],
  icon: statusIcons[status],
}));

export interface TaskDetailScreenProps {
  taskId: string;
  onBack: () => void;
  onEdit: (task: TaskResponseDto) => void;
  onOpenTeam: (team: TeamChipDto) => void;
  onDeleted: () => void;
}

function Header({
  onBack,
  onEdit,
}: {
  onBack: () => void;
  onEdit?: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between px-2">
      <IconButton icon="chevron-left" label="Voltar" onPress={onBack} />
      {onEdit && <Button label="Editar" variant="ghost" onPress={onEdit} />}
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="section">
      <Text className="section-title" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

export function TaskDetailScreen({
  taskId,
  onBack,
  onEdit,
  onOpenTeam,
  onDeleted,
}: TaskDetailScreenProps) {
  const detail = useTaskDetail(taskId);
  const { change, pending } = useStatusChange();
  const remove = useDeleteTask();
  const [confirming, setConfirming] = useState(false);
  const task = detail.data;

  if (!task) {
    return (
      <Screen>
        <Header onBack={onBack} />
        {detail.isError ? (
          <ErrorState
            error={detail.error}
            onRetry={() => detail.refetch()}
            action={
              errorCode(detail.error) === 'TASK_NOT_FOUND'
                ? { label: 'Voltar para tarefas', onPress: onBack }
                : undefined
            }
          />
        ) : (
          <View className="p-4">
            <SkeletonList label="Carregando tarefa" count={1} />
          </View>
        )}
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header onBack={onBack} onEdit={() => onEdit(task)} />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4">
        <Text className="type-title" accessibilityRole="header">
          {task.title}
        </Text>
        <StatusBadge testID="status-badge" status={task.status} />
        <Text className={task.description ? 'type-body' : 'type-meta'}>
          {task.description ?? 'Sem descrição'}
        </Text>
        <Section title="Times">
          <TeamChipGroup
            teams={task.teams}
            variant="detail"
            onPressTeam={onOpenTeam}
            teamHint="Mostra as tarefas deste time"
          />
        </Section>
        <Section title="Prazo">
          <DueDate task={task} style="long" emptyLabel="Sem prazo" />
        </Section>
        <Section title="Detalhes">
          <Text className="type-meta">
            {`Criada em ${formatInstant(task.createdAt)} · Atualizada em ${formatInstant(task.updatedAt)}`}
          </Text>
          {task.completedAt && (
            <Text className="type-meta">
              {`Concluída em ${formatInstant(task.completedAt)}`}
            </Text>
          )}
        </Section>
      </ScrollView>
      <View className="form-footer flex-col">
        <Text className="section-title" accessibilityRole="header">
          Alterar status
        </Text>
        <SegmentedControl
          label="Alterar status"
          options={statusOptions}
          value={task.status}
          disabled={pending}
          onChange={(status) => change(task, status)}
        />
        <Button
          label="Excluir tarefa"
          icon="trash"
          variant="ghost-danger"
          className="self-start"
          onPress={() => setConfirming(true)}
        />
      </View>
      <ConfirmDialog
        visible={confirming}
        title="Excluir esta tarefa?"
        message={`“${task.title}” será removida. Isso não pode ser desfeito.`}
        confirmLabel="Excluir"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          if (!remove.isPending) {
            remove.mutate(
              { id: task.id, title: task.title },
              { onSuccess: onDeleted },
            );
          }
        }}
      />
    </Screen>
  );
}
