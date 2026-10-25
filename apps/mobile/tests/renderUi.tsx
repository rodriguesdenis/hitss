import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cssToReactNativeRuntimeOptions } from 'nativewind/dist/metro/common';
import { colorScheme } from 'nativewind/test';
import postcss from 'postcss';
import type { ReactElement } from 'react';
import { StyleSheet, type Insets } from 'react-native';
import { render } from 'react-native-css-interop/test';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import tailwind from 'tailwindcss';
import type { TestInstance } from 'test-renderer';

import { tokens, type ColorRole, type ColorScheme } from '@/theme/tokens';

import tailwindConfig from '../tailwind.config.js';

export { act, fireEvent, screen, within } from 'nativewind/test';

const { content: _content, ...config } = tailwindConfig;

const css = readFileSync(join(__dirname, '../src/theme/global.css'), 'utf8');

const sourceDir = join(__dirname, '../src');

const safelist = [
  ...new Set(
    readdirSync(sourceDir, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx'))
      .flatMap((file) =>
        readFileSync(join(sourceDir, file), 'utf8').split(/[^\w:\-[\].%/]+/),
      )
      .filter((word) => /^[a-z][\w:\-[\].%/]*$/.test(word)),
  ),
];

const TOUCH_MIN = 44;

const REM = 16;

let compiled: Promise<string> | undefined;

function compiledCss(): Promise<string> {
  compiled ??= postcss([
    tailwind({ ...config, content: [{ raw: '' }], safelist }),
  ])
    .process(css, { from: undefined })
    .then((result) => result.css);
  return compiled;
}

const metrics = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export async function renderUi(
  ui: ReactElement,
  { scheme = 'light' }: { scheme?: ColorScheme } = {},
) {
  colorScheme.set(scheme);
  return render(
    <SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>,
    {
      css: await compiledCss(),
      cssOptions: { ...cssToReactNativeRuntimeOptions, inlineRem: REM },
    },
  );
}

export function rgba(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, 1)`;
}

export function token(role: ColorRole, scheme: ColorScheme = 'light'): string {
  return rgba(tokens[scheme][role]);
}

export function styleOf(element: TestInstance) {
  return StyleSheet.flatten(element.props.style) ?? {};
}

function slop(
  hitSlop: Insets | number | undefined,
  a: keyof Insets,
  b: keyof Insets,
) {
  if (typeof hitSlop === 'number') {
    return hitSlop * 2;
  }
  return (hitSlop?.[a] ?? 0) + (hitSlop?.[b] ?? 0);
}

export function touchTarget(element: TestInstance) {
  const style = styleOf(element);
  const size = (min: unknown, fixed: unknown) =>
    Math.max(Number(min ?? 0), Number(fixed ?? 0));
  return {
    height:
      size(style.minHeight, style.height) +
      slop(element.props.hitSlop, 'top', 'bottom'),
    width:
      size(style.minWidth, style.width) +
      slop(element.props.hitSlop, 'left', 'right'),
  };
}

export function expectTouchTarget(
  element: TestInstance,
  { width = true }: { width?: boolean } = {},
) {
  const target = touchTarget(element);
  expect(target.height).toBeGreaterThanOrEqual(TOUCH_MIN);
  if (width) {
    expect(target.width).toBeGreaterThanOrEqual(TOUCH_MIN);
  }
}
