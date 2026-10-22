# ADR-0009 — Expo (managed, Expo Go) + Expo Router

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** software-architect, react-native-expo-specialist

## Context

The brief asks for a React Native app with a handful of screens (teams list, task list global/per team, task form, task detail) and values "easy to run". Evaluators will most likely scan a QR code with **Expo Go** on their phone rather than install Xcode/Android Studio. The app needs navigation with typed params (`/tasks/[id]`), secure session storage and network-state awareness — all available in the Expo SDK.

## Decision drivers

- Zero native toolchain for evaluators: run in Expo Go via QR code.
- Type-safe navigation and deep links with minimal boilerplate.
- Maintained, first-party modules for storage, secure storage, network status, localization.
- Upgrade path: one SDK version bump instead of manual native upgrades.
- Ability to "eject" to a dev build later without rewriting the app.

## Considered options

### 1. Expo managed workflow + Expo Router, Expo Go compatible (chosen)

- **+** `npx expo start` → QR → app running in seconds; the Compose `mobile` service can run Metro with `--tunnel` for remote devices.
- **+** Expo Router: file-based routes in `app/`, layouts, groups (`(auth)`, `(app)`), redirects for protected routes, **typed routes** (`experiments.typedRoutes`) and automatic deep linking.
- **+** First-party `expo-secure-store`, `expo-localization`, `@react-native-community/netinfo`, `@react-native-async-storage/async-storage` all work in Expo Go.
- **−** **Constraint:** only libraries bundled in Expo Go are allowed (no custom native modules → no MMKV by default; see [ADR-0012](0012-offline-first-and-optimistic-updates.md)).
- **−** Expo Go tracks a single SDK version; evaluators need the matching Expo Go (documented in the README).

### 2. Bare React Native CLI

- **+** Full native control, any native library.
- **−** Requires Xcode/Android Studio and native builds to run; contradicts "easy to run"; manual native upgrades.

### 3. Expo with development builds only (no Expo Go)

- **+** Any native module (MMKV, etc.) while keeping Expo tooling.
- **−** Evaluators must build or install a custom client (EAS or local toolchain). Kept as an **opt-in** path, not the default.

### 4. React Navigation configured manually (instead of Expo Router)

- **+** Most widely used navigator; explicit configuration.
- **−** More boilerplate for linking config and param typing; Expo Router is built on React Navigation anyway and is the Expo default.

## Decision outcome

- **Expo SDK:** the latest stable SDK at implementation time, pinned in `apps/mobile/package.json`; dependencies installed with `npx expo install` to get SDK-compatible versions.
- **Expo Go compatibility is a hard rule:** a dependency that requires a custom native module is rejected unless it sits behind an adapter with an Expo Go fallback (e.g. MMKV behind `StorageAdapter`).
- **Expo Router** with typed routes. Route groups:
  - `(auth)/sign-in`, `(auth)/sign-up` — public;
  - `(app)/_layout` redirects to `(auth)` when there is no session;
  - `(app)/(tabs)/` — `tasks`, `teams`, `settings`;
  - stacks for `tasks/new`, `tasks/[id]`, `tasks/[id]/edit`, `teams/new`, `teams/[id]/edit`.
- **Team filter as URL state:** tapping a team navigates to `/tasks?teamId=<id>`, so "tasks of a team" is a deep-linkable route and back navigation restores the previous filter.
- Route files stay thin; logic lives in `src/features/*` ([overview §6.3](../../overview.md#8-mobile-app-next-phase)).
- **Scheme** `teamstasks` (used by Better Auth trusted origins, [ADR-0007](../0007-better-auth.md)).

## Consequences

**Positive**

- Evaluator runs the app with a phone and a QR code; no native setup.
- Navigation params are type-checked at compile time.
- One SDK upgrade moves every native dependency together.

**Negative**

- The library set is limited to what Expo Go ships; storage performance trade-off accepted (AsyncStorage instead of MMKV by default).
- Some testing/tooling (Maestro) still needs a simulator/emulator or device.

**Neutral**

- Moving to development builds later requires no code changes beyond enabling the native adapters.

## Links

- [Spec 004 — Mobile app](../../../specs/004-mobile-app/spec.md)
- Expo Router: https://docs.expo.dev/router/introduction/ · Typed routes: https://docs.expo.dev/router/reference/typed-routes/
