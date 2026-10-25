import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { Button, Field, Icon, IconButton, Input, Screen } from '@/ui';

import { useSignIn } from '../hooks/useSignIn';
import { useSessionStore } from '../session.store';

export function SignInScreen() {
  const { form, submit, formError } = useSignIn();
  const expired = useSessionStore((state) => state.expired);
  const [showPassword, setShowPassword] = useState(false);
  const submitting = form.formState.isSubmitting;
  const { errors } = form.formState;
  const banner =
    formError ?? (expired ? 'Sua sessão expirou. Entre novamente.' : null);

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1 justify-center px-4"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="mb-8 gap-2">
          <Text className="type-display" accessibilityRole="header">
            Teams & Tasks
          </Text>
          <Text className="type-muted">Entre para continuar</Text>
        </View>

        <Field label="E-mail" error={errors.email?.message}>
          <Controller
            control={form.control}
            name="email"
            render={({ field }) => (
              <Input
                testID="sign-in-email"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                editable={!submitting}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                autoCorrect={false}
                returnKeyType="next"
              />
            )}
          />
        </Field>

        <Field label="Senha" error={errors.password?.message}>
          <View className="justify-center">
            <Controller
              control={form.control}
              name="password"
              render={({ field }) => (
                <Input
                  testID="sign-in-password"
                  className="pr-12"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  editable={!submitting}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={() => void submit()}
                />
              )}
            />
            <View className="absolute right-0">
              <IconButton
                icon={showPassword ? 'eye-off' : 'eye'}
                label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                color="fg-muted"
                onPress={() => setShowPassword((shown) => !shown)}
              />
            </View>
          </View>
        </Field>

        {banner ? (
          <View
            className="banner-error mb-4"
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
          >
            <Icon name="alert-circle" color="danger" />
            <Text className="type-body flex-1">{banner}</Text>
          </View>
        ) : null}

        <Button
          testID="sign-in-submit"
          label="Entrar"
          loadingLabel="Entrando…"
          loading={submitting}
          onPress={() => void submit()}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
