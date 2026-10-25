import type { TeamResponseDto } from '@hitss/api-client';
import { useEffect, useState } from 'react';
import { Controller } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { errorCode } from '@/lib/error-messages';
import {
  Button,
  ConfirmDialog,
  ErrorState,
  Field,
  Icon,
  Input,
  ModalHeader,
  Screen,
  SkeletonList,
  TextArea,
} from '@/ui';

import { useTeam } from '../hooks/useTeam';
import { useTeamForm } from '../hooks/useTeamForm';
import { DEFAULT_TEAM_COLOR } from '../palette';
import { DESCRIPTION_MAX, normalizeHex } from '../team-form.schema';
import { ChipPreview } from './ChipPreview';
import { ColorSwatchGrid } from './ColorSwatchGrid';
import { DeleteTeamDialog } from './DeleteTeamDialog';

export interface TeamFormScreenProps {
  teamId?: string;
  onClose: () => void;
  onDeleted?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function TeamFormScreen({
  teamId,
  onClose,
  ...props
}: TeamFormScreenProps) {
  const team = useTeam(teamId);
  if (teamId && !team.data) {
    return (
      <Screen>
        <ModalHeader title="Editar time" onCancel={onClose} />
        {team.isError ? (
          <ErrorState
            error={team.error}
            onRetry={() => team.refetch()}
            action={
              errorCode(team.error) === 'TEAM_NOT_FOUND'
                ? { label: 'Voltar para times', onPress: onClose }
                : undefined
            }
          />
        ) : (
          <View className="p-4">
            <SkeletonList label="Carregando time" variant="team" count={1} />
          </View>
        )}
      </Screen>
    );
  }
  return <TeamForm team={team.data} onClose={onClose} {...props} />;
}

function TeamForm({
  team,
  onClose,
  onDeleted,
  onDirtyChange,
}: Omit<TeamFormScreenProps, 'teamId'> & { team?: TeamResponseDto }) {
  const { form, submit, formError, saving } = useTeamForm({
    team,
    onSaved: onClose,
  });
  const {
    control,
    setValue,
    watch,
    formState: { isDirty },
  } = form;
  const [preview, setPreview] = useState(team?.colorHex ?? DEFAULT_TEAM_COLOR);
  const [discarding, setDiscarding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const name = watch('name');
  const colorHex = watch('colorHex');

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  function selectColor(hex: string) {
    setValue('colorHex', hex, { shouldDirty: true, shouldValidate: true });
    setPreview(hex);
  }

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
        title={team ? 'Editar time' : 'Novo time'}
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
            name="name"
            render={({ field, fieldState }) => (
              <Field label="Nome" required error={fieldState.error?.message}>
                <Input
                  ref={field.ref}
                  testID="team-name"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  editable={!saving}
                  autoFocus={!team}
                  returnKeyType="next"
                />
              </Field>
            )}
          />
          <Field label="Cor" required>
            <ColorSwatchGrid
              value={normalizeHex(colorHex)}
              onSelect={selectColor}
              disabled={saving}
            />
          </Field>
          <Controller
            control={control}
            name="colorHex"
            render={({ field, fieldState }) => (
              <Field
                label="Cor em hexadecimal"
                error={fieldState.error?.message}
              >
                <Input
                  ref={field.ref}
                  testID="team-hex"
                  value={field.value}
                  onChangeText={(text) => {
                    field.onChange(text);
                    const valid = normalizeHex(text);
                    if (valid) {
                      setPreview(valid);
                    }
                  }}
                  onBlur={() => {
                    const valid = normalizeHex(field.value);
                    if (valid) {
                      setValue('colorHex', valid, { shouldDirty: true });
                    }
                    field.onBlur();
                  }}
                  editable={!saving}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={7}
                />
              </Field>
            )}
          />
          <ChipPreview name={name} colorHex={preview} />
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
                  testID="team-description"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  editable={!saving}
                  maxLength={DESCRIPTION_MAX}
                />
              </Field>
            )}
          />
          {team && (
            <Button
              label="Excluir time"
              icon="trash"
              variant="ghost-danger"
              onPress={() => setDeleting(true)}
              className="self-start"
            />
          )}
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
            label={team ? 'Salvar alterações' : 'Criar time'}
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
      <DeleteTeamDialog
        team={deleting ? team : undefined}
        onCancel={() => setDeleting(false)}
        onDeleted={onDeleted ?? onClose}
      />
    </Screen>
  );
}
