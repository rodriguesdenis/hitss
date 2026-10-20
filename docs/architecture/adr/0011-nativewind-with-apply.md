# ADR-0011 — NativeWind v4 with `@apply` semantic classes

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** software-architect, react-native-expo-specialist, ux-ui-designer

## Context

The brief forbids styled-components. The UI needs light/dark themes, a small design system (buttons, chips, cards, inputs) and per-team dynamic colors (chips colored with the team's `#RRGGBB`, text color chosen for contrast). Components should stay readable — not buried under 20-class strings — and the styling must work in Expo Go.

## Decision drivers

- No styled-components (brief).
- Works in Expo Go without native modules or custom dev clients.
- Design tokens shared across components; dark mode with minimal duplication.
- Lean component markup; reusable semantic styles.
- Familiar to reviewers; mature and stable release line.

## Considered options

### 1. NativeWind v4 (Tailwind CSS v3) with `@apply` semantic classes (chosen)

- **+** Tailwind utility classes compiled for React Native; works in Expo Go; `dark:` variant and CSS variables for theming.
- **+** `@apply` in `global.css` lets us define semantic classes (`.btn-primary`, `.chip`, `.card`, `.input`) so components read `className="card"` instead of long utility strings.
- **+** v4 is the stable line; huge Tailwind familiarity.
- **−** Build-time Babel/Metro integration to configure; class strings are not type-checked.
- **−** NativeWind v5 (Tailwind v4) is pre-release; we stay on v4 and Tailwind v3 syntax until v5 is stable.

### 2. Tamagui

- **+** Optimizing compiler, rich component kit, themes.
- **−** Large API surface and compiler setup; heavy for five screens; steeper learning curve for reviewers.

### 3. react-native-unistyles

- **+** Fast, typed StyleSheet-like API with themes and breakpoints.
- **−** v3 relies on Nitro modules (native code) → not usable in Expo Go.

### 4. Dripsy / twrnc / plain `StyleSheet`

- **+** twrnc is runtime Tailwind with no build step; Dripsy offers theme-aware props; `StyleSheet` has no dependency.
- **−** twrnc lacks `@apply`-style semantic classes and CSS-variable theming; Dripsy is less active; plain `StyleSheet` means hand-rolled theming and token duplication.

## Decision outcome

- **NativeWind v4** + **Tailwind CSS v3** (`tailwind.config.js` with the `nativewind/preset`), `global.css` imported once in `app/_layout.tsx`.
- **Tokens** as CSS variables in `global.css` (`:root` and `.dark` / `@media (prefers-color-scheme: dark)`), mapped in `tailwind.config.js` (`colors.surface: "rgb(var(--color-surface) / <alpha-value>)"`). Theme preference from `preferences.store` drives NativeWind's `colorScheme.set()`.
- **Semantic classes** with `@apply` in `@layer components`:
  - `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`
  - `.card`, `.chip`, `.input`, `.input-error`, `.label`, `.screen`
- **Dynamic team color:** chips use `className="chip"` plus `style={{ backgroundColor: team.colorHex, color: contrastingTextColor(team.colorHex) }}` — Tailwind cannot generate classes for runtime values, and the contrast rule mirrors the domain `ColorHex.contrastingTextColor()` (WCAG luminance).
- **Components** in `src/shared/ui/` encapsulate semantic classes plus accessibility props (roles, labels, minimum 44×44 pt touch targets).
- **Forbidden:** styled-components and inline style objects for static styling (lint rule); `style` is allowed only for runtime-computed values.

## Consequences

**Positive**

- Components stay short; visual consistency comes from a dozen semantic classes.
- Dark mode is a variable swap, not per-component branching.
- Runs in Expo Go; no native dependency.

**Negative**

- `@apply` reintroduces a small "CSS layer" developers must check when changing a look; kept intentionally tiny and documented in the design spec.
- Upgrading to NativeWind v5 later means migrating to Tailwind v4 config syntax.

**Neutral**

- Storybook (COULD) can render the same components with both themes for visual review.

## Links

- [Design spec](../../design/design-spec.md)
- NativeWind: https://www.nativewind.dev/docs · Tailwind `@apply`: https://v3.tailwindcss.com/docs/functions-and-directives#apply
