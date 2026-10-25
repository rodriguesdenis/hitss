import type { TaskResponseDto, TaskStatus } from '@hitss/api-client';
import { useEffect, useState } from 'react';
import { Controller } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { useCreatedTeamStore } from '@/features/teams';
import { isPastDate } from '@/lib/dates';
import { errorCode } from '@/lib/error-messages';
import {
  Button,
  ConfirmDialog,
  DatePickerField,
  ErrorState,
  Field,
  Icon,
  Input,
  ModalHeader,
  Screen,
  SegmentedControl,
  SkeletonList,
  statusIcons,
  statusLabels,
  TextArea,
  type SegmentOption,
} from '@/ui';

import { useTaskDetail } from '../hooks/useTaskDetail';
import { useTaskForm } from '../hooks/useTaskForm';
import { DESCRIPTION_MAX, TEAMS_MAX, TITLE_MAX } from '../task-form.schema';
import { TeamPicker } from './TeamPicker';

const statusOptions: SegmentOption<TaskStatus>[] = (
  ['PENDING', 'IN_PROGRESS', 'DONE'] as const
).map((status) => ({
  value: status,
  label: statusLabels[status],
  icon: statusIcons[status],
}));

export interface TaskFormScreenProps {
  taskId?: string;
  teamId?: string;
  onClose: () => void;
  onCreateTeam?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function TaskFormScreen({
  taskId,
  onClose,
  ...props
}: TaskFormScreenProps) {
  const detail = useTaskDetail(taskId);
  if (taskId && !detail.data) {
    return (
      <Screen>
        <ModalHeader title="Editar tarefa" onCancel={onClose} />
        {detail.isError ? (
          <ErrorState
            error={detail.error}
            onRetry={() => detail.refetch()}
            action={
              errorCode(detail.error) === 'TASK_NOT_FOUND'
                ? { label: 'Voltar', onPress: onClose }
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
  return <TaskForm task={detail.data} onClose={onClose} {...props} />;
}

function TaskForm({
  task,
  teamId,
  onClose,
  onCreateTeam,
  onDirtyChange,
}: Omit<TaskFormScreenProps, 'taskId'> & { task?: TaskResponseDto }) {
  const { form, submit, formError, saving } = useTaskForm({
    task,
    teamId,
    onSaved: onClose,
  });
  const {
    control,
    formState: { isDirty },
  } = form;
  const [discarding, setDiscarding] = useState(false);
  const createdTeamId = useCreatedTeamStore((state) => state.teamId);
  const clearCreatedTeam = useCreatedTeamStore((state) => state.clear);

  useEffect(() => {
    if (!createdTeamId) {
      return;
    }
    const teamIds = form.getValues('teamIds');
    if (!teamIds.includes(createdTeamId) && teamIds.length < TEAMS_MAX) {
      form.setValue('teamIds', [...teamIds, createdTeamId], {
        shouldDirty: true,
      });
    }
    clearCreatedTeam();
  }, [createdTeamId, clearCreatedTeam, form]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  function cancel() {
    if (isDirty) {
      setDiscarding(true);
    } else {
      onClose();
    }
  }

  return (
    <Screen>
      <ModalHeader
        title={task ? 'Editar tarefa' : 'Nova tarefa'}
        onCancel={cancel}
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4"
          keyboardShouldPersistTaps="handled"
        >
          <Controller
            control={control}
            name="title"
            render={({ field, fieldState }) => (
              <Field
                label="Título"
                required
                error={fieldState.error?.message}
                count={field.value.length}
                max={TITLE_MAX}
              >
                <Input
                  ref={field.ref}
                  testID="task-title"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  editable={!saving}
                  autoFocus={!task}
                  returnKeyType="next"
                />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field, fieldState }) => (
              <Field
                label="Descrição"
                error={fieldState.error?.message}
                count={field.value.length}
                max={DESCRIPTION_MAX}
              >
                <TextArea
                  ref={field.ref}
                  testID="task-description"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  editable={!saving}
                  maxLength={DESCRIPTION_MAX}
                />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <View className="field">
                <Text
                  className="field-label"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  Status
                </Text>
                <SegmentedControl
                  label="Status"
                  options={statusOptions}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={saving}
                />
              </View>
            )}
          />
          <Controller
            control={control}
            name="dueDate"
            render={({ field }) => (
              <Field label="Prazo">
                <DatePickerField
                  testID="task-due"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={saving}
                />
                {field.value && isPastDate(field.value) && (
                  <View className="flex-row items-center gap-1">
                    <Icon name="alert-triangle" color="warning" size={14} />
                    <Text className="type-meta text-warning">
                      Esta data já passou
                    </Text>
                  </View>
                )}
              </Field>
            )}
          />
          <Controller
            control={control}
            name="teamIds"
            render={({ field, fieldState }) => (
              <TeamPicker
                value={field.value}
                onChange={(teamIds) => {
                  field.onChange(teamIds);
                  form.clearErrors('teamIds');
                }}
                error={fieldState.error?.message}
                disabled={saving}
                onCreateTeam={onCreateTeam}
              />
            )}
          />
        </ScrollView>
        {formError && (
          <View className="banner-error mx-4 mb-2" accessibilityRole="alert">
            <Icon name="alert-circle" color="danger" />
            <Text className="type-muted flex-1 text-fg">{formError}</Text>
            <Button label="Tentar novamente" variant="ghost" onPress={submit} />
          </View>
        )}
        <View className="form-footer">
          <Button
            label="Cancelar"
            variant="secondary"
            onPress={cancel}
            className="flex-1"
          />
          <Button
            testID="task-save"
            label={task ? 'Salvar alterações' : 'Criar tarefa'}
            loading={saving}
            loadingLabel="Salvando…"
            onPress={submit}
            className="flex-1"
          />
        </View>
      </KeyboardAvoidingView>
      <ConfirmDialog
        visible={discarding}
        title="Descartar alterações?"
        confirmLabel="Descartar"
        cancelLabel="Continuar editando"
        onCancel={() => setDiscarding(false)}
        onConfirm={() => {
          setDiscarding(false);
          onClose();
        }}
      />
    </Screen>
  );
}
