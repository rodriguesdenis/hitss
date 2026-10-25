import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { tokens } from '@/theme/tokens';
import { useColorSchemeName } from '@/theme/ThemeProvider';

import { useSignIn } from '../hooks/useSignIn';
import { useSessionStore } from '../session.store';

export function SignInScreen() {
  const scheme = useColorSchemeName();
  const color = tokens[scheme];
  const { form, submit, formError } = useSignIn();
  const expired = useSessionStore((state) => state.expired);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const submitting = form.formState.isSubmitting;
  const { errors } = form.formState;
  const banner =
    formError ?? (expired ? 'Sua sessão expirou. Entre novamente.' : null);

  const inputClass = (field: 'email' | 'password') =>
    errors[field]
      ? 'input input-error'
      : focused === field
        ? 'input input-focused'
        : 'input';

  return (
    <SafeAreaView className="screen">
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

        <View className="field">
          <Text className="field-label" nativeID="sign-in-email-label">
            E-mail
          </Text>
          <Controller
            control={form.control}
            name="email"
            render={({ field }) => (
              <TextInput
                className={inputClass('email')}
                accessibilityLabelledBy="sign-in-email-label"
                accessibilityLabel="E-mail"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={() => {
                  setFocused(null);
                  field.onBlur();
                }}
                onFocus={() => setFocused('email')}
                editable={!submitting}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                autoCorrect={false}
                returnKeyType="next"
                placeholderTextColor={color['fg-subtle']}
              />
            )}
          />
          {errors.email?.message ? (
            <Text className="field-error" accessibilityLiveRegion="polite">
              {errors.email.message}
            </Text>
          ) : null}
        </View>

        <View className="field">
          <Text className="field-label" nativeID="sign-in-password-label">
            Senha
          </Text>
          <View className="justify-center">
            <Controller
              control={form.control}
              name="password"
              render={({ field }) => (
                <TextInput
                  className={`${inputClass('password')} pr-12`}
                  accessibilityLabelledBy="sign-in-password-label"
                  accessibilityLabel="Senha"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={() => {
                    setFocused(null);
                    field.onBlur();
                  }}
                  onFocus={() => setFocused('password')}
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
            <Pressable
              className="icon-btn absolute right-0"
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? 'Ocultar senha' : 'Mostrar senha'
              }
              onPress={() => setShowPassword((shown) => !shown)}
              hitSlop={4}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={color['fg-muted']}
              />
            </Pressable>
          </View>
          {errors.password?.message ? (
            <Text className="field-error" accessibilityLiveRegion="polite">
              {errors.password.message}
            </Text>
          ) : null}
        </View>

        {banner ? (
          <View
            className="banner-error mb-4"
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
          >
            <Ionicons name="close-circle" size={20} color={color.danger} />
            <Text className="type-body flex-1">{banner}</Text>
          </View>
        ) : null}

        <Pressable
          className={submitting ? 'btn-primary btn-disabled' : 'btn-primary'}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting, busy: submitting }}
          disabled={submitting}
          onPress={() => void submit()}
        >
          {submitting ? (
            <ActivityIndicator color={color['on-primary']} />
          ) : null}
          <Text className="btn-primary-label">
            {submitting ? 'Entrando…' : 'Entrar'}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
