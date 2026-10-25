import { zodResolver } from '@hookform/resolvers/zod';
import type { TeamResponseDto } from '@hitss/api-client';
import { useRef, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { AccessibilityInfo } from 'react-native';

import { errorCode, errorMessage } from '@/lib/error-messages';
import { newTempId, submitDurable } from '@/offline';
import { errorCountMessage, validationFields } from '@/lib/form-errors';

import { DEFAULT_TEAM_COLOR } from '../palette';
import {
  COLOR_MESSAGE,
  DESCRIPTION_MESSAGE,
  DUPLICATE_NAME_MESSAGE,
  NAME_MESSAGE,
  teamFormSchema,
  type TeamFormOutput,
  type TeamFormValues,
} from '../team-form.schema';
import { useCreateTeam, useUpdateTeam } from './useTeamMutations';

const fieldMessages: Record<keyof TeamFormValues, string> = {
  name: NAME_MESSAGE,
  colorHex: COLOR_MESSAGE,
  description: DESCRIPTION_MESSAGE,
};

function isField(field: string): field is keyof TeamFormValues {
  return Object.hasOwn(fieldMessages, field);
}

export function teamFormDefaults(team?: TeamResponseDto): TeamFormValues {
  return team
    ? {
        name: team.name,
        colorHex: team.colorHex,
        description: team.description ?? '',
      }
    : { name: '', colorHex: DEFAULT_TEAM_COLOR, description: '' };
}

export function useTeamForm({
  team,
  onSaved,
}: {
  team?: TeamResponseDto;
  onSaved: (saved: TeamResponseDto) => void;
}) {
  const create = useCreateTeam();
  const update = useUpdateTeam();
  const form = useForm<TeamFormValues, unknown, TeamFormOutput>({
    resolver: zodResolver(teamFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: teamFormDefaults(team),
  });
  const [formError, setFormError] = useState<string>();

  function applyServerError(error: unknown) {
    const code = errorCode(error);
    if (code === 'TEAM_NAME_ALREADY_EXISTS') {
      form.setError(
        'name',
        { message: DUPLICATE_NAME_MESSAGE },
        { shouldFocus: true },
      );
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
        const tempId = newTempId();
        const result = team
          ? await submitDurable(update, { id: team.id, body: values })
          : await submitDurable(create, { tempId, body: values });
        onSaved(
          result.outcome === 'saved'
            ? result.data.data
            : team
              ? { ...team, ...values }
              : {
                  ...values,
                  id: tempId,
                  description: values.description ?? null,
                  taskCount: 0,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  version: 0,
                },
        );
      } catch (error) {
        applyServerError(error);
      }
    },
    (errors: FieldErrors<TeamFormValues>) => {
      AccessibilityInfo.announceForAccessibility(
        errorCountMessage(Object.keys(errors).length),
      );
    },
  );

  const inFlight = useRef(false);

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
