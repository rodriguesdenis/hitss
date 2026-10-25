import { zodResolver } from '@hookform/resolvers/zod';
import type { TaskResponseDto } from '@hitss/api-client';
import { useRef, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { AccessibilityInfo } from 'react-native';

import { errorCode, errorMessage } from '@/lib/error-messages';
import {
  errorCountMessage,
  errorDetails,
  validationFields,
} from '@/lib/form-errors';

import {
  DESCRIPTION_TOO_LONG,
  TEAMS_LIMIT,
  TITLE_TOO_SHORT,
  TOO_MANY_TEAMS,
  taskFormSchema,
  UNKNOWN_TEAMS_REMOVED,
  type TaskFormOutput,
  type TaskFormValues,
} from '../task-form.schema';
import { useCreateTask, useUpdateTask } from './useTaskMutations';

const fieldMessages: Partial<Record<keyof TaskFormValues, string>> = {
  title: TITLE_TOO_SHORT,
  description: DESCRIPTION_TOO_LONG,
  teamIds: TEAMS_LIMIT,
};

function isField(field: string): field is keyof TaskFormValues {
  return Object.hasOwn(fieldMessages, field);
}

let tempCounter = 0;

function nextTempId(): string {
  tempCounter += 1;
  return `temp-task-${tempCounter}`;
}

export function taskFormDefaults(
  task?: TaskResponseDto,
  teamId?: string,
): TaskFormValues {
  return task
    ? {
        title: task.title,
        description: task.description ?? '',
        status: task.status,
        dueDate: task.dueDate,
        teamIds: task.teams.map((team) => team.id),
      }
    : {
        title: '',
        description: '',
        status: 'PENDING',
        dueDate: null,
        teamIds: teamId ? [teamId] : [],
      };
}

export function useTaskForm({
  task,
  teamId,
  onSaved,
}: {
  task?: TaskResponseDto;
  teamId?: string;
  onSaved: () => void;
}) {
  const create = useCreateTask();
  const update = useUpdateTask();
  const form = useForm<TaskFormValues, unknown, TaskFormOutput>({
    resolver: zodResolver(taskFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: taskFormDefaults(task, teamId),
  });
  const [formError, setFormError] = useState<string>();
  const inFlight = useRef(false);

  function applyServerError(error: unknown) {
    const code = errorCode(error);
    if (code === 'UNKNOWN_TEAMS') {
      const missing =
        (errorDetails(error) as { teamIds?: string[] } | undefined)?.teamIds ??
        [];
      form.setValue(
        'teamIds',
        form.getValues('teamIds').filter((id) => !missing.includes(id)),
        { shouldDirty: true },
      );
      form.setError('teamIds', { message: UNKNOWN_TEAMS_REMOVED });
      return;
    }
    if (code === 'TOO_MANY_TEAMS') {
      form.setError('teamIds', { message: TOO_MANY_TEAMS });
      return;
    }
    if (code === 'VALIDATION_FAILED') {
      const fields = validationFields(error).filter(isField);
      fields.forEach((field) =>
        form.setError(field, { message: fieldMessages[field] }),
      );
      if (fields.length > 0) {
        return;
      }
    }
    setFormError(errorMessage(error));
  }

  const handleSubmit = form.handleSubmit(
    async (values) => {
      setFormError(undefined);
      try {
        if (task) {
          await update.mutateAsync({ id: task.id, body: values });
        } else {
          await create.mutateAsync({ tempId: nextTempId(), body: values });
        }
        onSaved();
      } catch (error) {
        applyServerError(error);
      }
    },
    (errors: FieldErrors<TaskFormValues>) => {
      AccessibilityInfo.announceForAccessibility(
        errorCountMessage(Object.keys(errors).length),
      );
    },
  );

  async function submit() {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    try {
      await handleSubmit();
    } finally {
      inFlight.current = false;
    }
  }

  return {
    form,
    submit,
    formError,
    saving: create.isPending || update.isPending,
  };
}
