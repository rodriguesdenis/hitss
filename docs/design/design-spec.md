# Design Spec — Teams & Tasks (mobile)

- **Owner:** ux-ui-designer · **Status:** Draft · **Specs:** [004-mobile-app](../specs/004-mobile-app/spec.md), [005-offline-sync](../specs/005-offline-sync/spec.md)
- **Epics:** [EP-04 Mobile Experience](../product/epics/EP-04-mobile-experience.md), [EP-05 Offline & Responsiveness](../product/epics/EP-05-offline-and-responsiveness.md)
- **ADRs:** [0009](../architecture/adr/archive/0009-expo-and-expo-router.md) · [0011](../architecture/adr/archive/0011-nativewind-with-apply.md) · [0012](../architecture/adr/archive/0012-offline-first-and-optimistic-updates.md)

The design lives **in this document** (text, tables, ASCII wireframes, Mermaid). There is no external design file. Every visual value used by the app must be a token defined here; anything not here is a bug in this spec, not a licence to improvise.

**Design principles (for Marina, a team lead on her phone between meetings):**

1. **Thumb first.** Primary actions sit in the bottom half of the screen (FAB, sticky form footer, quick-action bar).
2. **Status at a glance.** Status is always shown by color **and** icon **and** text — never color alone.
3. **Instant, honest feedback.** Changes appear immediately; anything not yet confirmed by the server is visibly marked "pending sync"; failures are explained and recoverable.
4. **Calm density.** One task per row, two lines max, chips truncated with a `+N` overflow.

---

## 1. Design tokens

### 1.1 Color — semantic roles

Each role is a **CSS variable** holding space-separated RGB channels, defined once for light under `:root` and once for dark under `.dark:root` in `global.css` (§2.1), and mapped to a semantic Tailwind color name in `tailwind.config.js` (§1.6). Components therefore use **one** class (`bg-surface`, `text-fg`, `border-border-muted`) that switches theme automatically — no `dark:` pairs. Components never use raw palette names (`indigo-600`). The `dark:` variant is reserved for the documented exceptions in §2.2. Contrast ratios are WCAG 2.1 against the role's intended background.

| Role (= Tailwind color / CSS variable `--color-<role>`) | Light            | Dark             | Use                                              | Contrast (L / D)                        |
| ------------------------------------------------------- | ---------------- | ---------------- | ------------------------------------------------ | --------------------------------------- |
| `canvas`                                                | `#F8FAFC`        | `#0B1120`        | Screen background                                | —                                       |
| `surface`                                               | `#FFFFFF`        | `#111827`        | Cards, list rows, sheets, inputs                 | —                                       |
| `surface-muted`                                         | `#F1F5F9`        | `#1F2937`        | Skeletons, segmented-control track, pressed rows | —                                       |
| `border-muted`                                          | `#E2E8F0`        | `#334155`        | Decorative dividers, card outline                | decorative (exempt)                     |
| `border-strong`                                         | `#64748B`        | `#94A3B8`        | Input outline, low-contrast chip outline         | 4.76 / 6.92 vs surface (≥ 3:1 non-text) |
| `fg`                                                    | `#0F172A`        | `#F1F5F9`        | Primary text                                     | 17.9 / 16.2                             |
| `fg-muted`                                              | `#475569`        | `#CBD5E1`        | Secondary text                                   | 7.6 / 12.0                              |
| `fg-subtle`                                             | `#64748B`        | `#94A3B8`        | Placeholders, captions, disabled labels          | 4.76 / 6.9 (4.55 on `canvas` L)         |
| `primary`                                               | `#4F46E5`        | `#818CF8`        | Primary buttons, links, active segment           | 6.3 / 6.0 (as text on surface)          |
| `primary-pressed`                                       | `#4338CA`        | `#6366F1`        | Pressed primary                                  | —                                       |
| `on-primary`                                            | `#FFFFFF`        | `#0B1120`        | Text/icons on primary                            | 6.3 / 6.3                               |
| `danger`                                                | `#DC2626`        | `#F87171`        | Destructive buttons, field errors                | 4.83 / 6.4                              |
| `danger-pressed`                                        | `#B91C1C`        | `#EF4444`        | Pressed destructive                              | —                                       |
| `on-danger`                                             | `#FFFFFF`        | `#0B1120`        | Text on danger                                   | 4.83 / 6.8                              |
| `danger-soft`                                           | `#FEE2E2`        | `#450A0A`        | Error banner background                          | —                                       |
| `success`                                               | `#15803D`        | `#4ADE80`        | Success icon, sync-complete                      | 5.0 / 10.2                              |
| `warning`                                               | `#B45309`        | `#FBBF24`        | Overdue date, offline icon                       | 5.0 / 10.6                              |
| `warning-soft`                                          | `#FEF3C7`        | `#422006`        | Offline banner background                        | `fg` on it: 16.0 / 14.0                 |
| `info-soft`                                             | `#E0E7FF`        | `#1E1B4B`        | Pending-sync badge background                    | —                                       |
| `on-info-soft`                                          | `#3730A3`        | `#C7D2FE`        | Pending-sync badge text/icon                     | 8.0 / 11.3                              |
| `focus`                                                 | `#4F46E5`        | `#A5B4FC`        | Focus ring                                       | ≥ 3:1                                   |
| `inverse`                                               | `#0F172A`        | `#1F2937`        | Toast background                                 | —                                       |
| `on-inverse`                                            | `#FFFFFF`        | `#F1F5F9`        | Toast text                                       | 17.9 / 13.4                             |
| `inverse-action`                                        | `#818CF8`        | `#818CF8`        | Toast action (Undo, Retry)                       | 6.0 / 4.9                               |
| `overlay`                                               | `#0F172A` @ 50 % | `#000000` @ 60 % | Scrim colour (alpha in --alpha-overlay)          | —                                       |

Class usage: `bg-<role>` / `text-<role>` / `border-<role>`; e.g. `bg-canvas`, `bg-surface`, `text-fg`, `text-fg-muted`, `text-on-primary`, `border-border-strong`. Overlay alpha is a separate variable (`--alpha-overlay`: `0.5` light, `0.6` dark). Task-status colors (§1.2) are roles too: `status-{pending,progress,done}-{bg,fg}`.

### 1.2 Color — task status

Status is rendered as a badge (`.badge-status-*`) with icon + label. Background/foreground pairs are ≥ 6:1.

| Status        | Label (en / pt-BR)         | Icon (name in icon set) | Light bg / fg         | Dark bg / fg          | Ratio L / D |
| ------------- | -------------------------- | ----------------------- | --------------------- | --------------------- | ----------- |
| `PENDING`     | Pending / Pendente         | `circle` (hollow)       | `#FEF3C7` / `#92400E` | `#422006` / `#FCD34D` | 6.4 / 10.1  |
| `IN_PROGRESS` | In progress / Em andamento | `circle-half`           | `#DBEAFE` / `#1E40AF` | `#172554` / `#93C5FD` | 7.2 / 8.2   |
| `DONE`        | Done / Concluída           | `check-circle`          | `#DCFCE7` / `#166534` | `#052E16` / `#86EFAC` | 6.5 / 10.6  |

A `DONE` task's title in lists is rendered in `text-muted` with **no** strikethrough (strikethrough harms legibility and screen readers ignore it; the badge already carries the meaning).

**Overdue** (derived from the API's `isOverdue`): due-date text in `warning` with an `alert-triangle` icon and the word "Overdue" — never color alone.

### 1.3 Team color palette (picker presets)

Team colors are user data (`#RRGGBB`); any value is valid. The team form offers these 14 presets (plus a hex text field). The "chip text" column is the result of the chip rule (§3) and is listed so QA can assert it.

| Name    | Hex       | Chip text | Text contrast | Needs border on surface? (L / D) |
| ------- | --------- | --------- | ------------- | -------------------------------- |
| Red     | `#EF4444` | black     | 5.6           | no / no                          |
| Orange  | `#F97316` | black     | 7.5           | yes / no                         |
| Amber   | `#F59E0B` | black     | 9.8           | yes / no                         |
| Yellow  | `#EAB308` | black     | 11.0          | yes / no                         |
| Lime    | `#84CC16` | black     | 10.6          | yes / no                         |
| Emerald | `#10B981` | black     | 8.3           | yes / no                         |
| Teal    | `#14B8A6` | black     | 8.4           | yes / no                         |
| Sky     | `#0EA5E9` | black     | 7.6           | yes / no                         |
| Blue    | `#3B82F6` | black     | 5.7           | no / no                          |
| Indigo  | `#6366F1` | black     | 4.7           | no / no                          |
| Violet  | `#7C3AED` | white     | 5.7           | no / no                          |
| Pink    | `#EC4899` | black     | 6.0           | no / no                          |
| Slate   | `#64748B` | white     | 4.8           | no / no                          |
| Ink     | `#1E293B` | white     | 14.6          | no / **yes**                     |

Default color for a new team: `#6366F1` (Indigo).

### 1.4 Typography

System font stack (San Francisco on iOS, Roboto on Android) — no font download, works in Expo Go, respects platform dynamic type. Sizes are in pt and scale with the OS text size (see §8).

| Token      | Size / line height | Weight | Use                                                         |
| ---------- | ------------------ | ------ | ----------------------------------------------------------- |
| `display`  | 28 / 34            | 700    | Auth screen title                                           |
| `title`    | 22 / 28            | 600    | Screen titles (large header), detail title                  |
| `headline` | 17 / 22            | 600    | List row title, card title, dialog title                    |
| `body`     | 16 / 22            | 400    | Body, input text (16 avoids iOS zoom on web)                |
| `callout`  | 15 / 20            | 400    | Descriptions, banners, toasts                               |
| `label`    | 14 / 20            | 500    | Buttons (with `body` size for primary), field labels, chips |
| `caption`  | 12 / 16            | 400    | Meta (due date, counts), helper text, badges                |

### 1.5 Spacing, size, radii, elevation, motion

- **Spacing** (4 pt grid): `0.5`=2, `1`=4, `2`=8, `3`=12, `4`=16, `5`=20, `6`=24, `8`=32, `10`=40, `12`=48. Screen gutter = 16. Gap between list rows = 8. Section gap = 24.
- **Sizes:** `touch` = 44 (min hit target), `control` = 48 (button/input height), `fab` = 56, `row-min` = 72 (task row min height), `chip` = 24 (visual; hit area padded to 44 when interactive).
- **Radii:** `sm` = 6 (chips, badges), `md` = 10 (inputs, buttons), `lg` = 14 (cards, sheets), `full` = 9999 (FAB, segmented chips, avatars).
- **Elevation:** `e0` none · `e1` card (light: shadow `#0F172A` 6 % y1 blur3; Android elevation 1; dark: no shadow, 1 px `border`) · `e2` FAB/toast (light: 12 % y4 blur12; Android elevation 4; dark: `surface-muted` + `border`) · `e3` dialog/sheet (16 % y8 blur24; Android 8).
- **Motion:** `fast` 150 ms (press, toggle), `base` 220 ms (toast, banner slide), `slow` 300 ms (sheet). Easing: standard `cubic-bezier(0.2, 0, 0, 1)`. Skeleton shimmer 1200 ms loop. All non-essential motion is disabled under Reduce Motion (§8).

### 1.6 Tailwind theme extension

`apps/mobile/tailwind.config.js` (NativeWind v4 preset, `darkMode: 'class'`). Colors are **semantic names mapped to the CSS variables** of §2.1; there are no `*-dark` keys. The `<alpha-value>` placeholder keeps opacity modifiers (`bg-primary/10`) working.

```js
// tailwind.config.js
const v = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: v('canvas'),
        surface: v('surface'),
        'surface-muted': v('surface-muted'),
        'border-muted': v('border-muted'),
        'border-strong': v('border-strong'),
        fg: v('fg'),
        'fg-muted': v('fg-muted'),
        'fg-subtle': v('fg-subtle'),
        primary: v('primary'),
        'primary-pressed': v('primary-pressed'),
        'on-primary': v('on-primary'),
        danger: v('danger'),
        'danger-pressed': v('danger-pressed'),
        'on-danger': v('on-danger'),
        'danger-soft': v('danger-soft'),
        success: v('success'),
        warning: v('warning'),
        'warning-soft': v('warning-soft'),
        'info-soft': v('info-soft'),
        'on-info-soft': v('on-info-soft'),
        focus: v('focus'),
        inverse: v('inverse'),
        'on-inverse': v('on-inverse'),
        'inverse-action': v('inverse-action'),
        overlay: v('overlay'),
        status: {
          'pending-bg': v('status-pending-bg'),
          'pending-fg': v('status-pending-fg'),
          'progress-bg': v('status-progress-bg'),
          'progress-fg': v('status-progress-fg'),
          'done-bg': v('status-done-bg'),
          'done-fg': v('status-done-fg'),
        },
      },
      fontSize: {
        display: ['28px', { lineHeight: '34px', fontWeight: '700' }],
        title: ['22px', { lineHeight: '28px', fontWeight: '600' }],
        headline: ['17px', { lineHeight: '22px', fontWeight: '600' }],
        body: ['16px', { lineHeight: '22px' }],
        callout: ['15px', { lineHeight: '20px' }],
        label: ['14px', { lineHeight: '20px', fontWeight: '500' }],
        caption: ['12px', { lineHeight: '16px' }],
      },
      spacing: {
        touch: '44px',
        control: '48px',
        fab: '56px',
        'row-min': '72px',
        chip: '24px',
      },
      minHeight: { touch: '44px', control: '48px', 'row-min': '72px' },
      minWidth: { touch: '44px' },
      borderRadius: { sm: '6px', md: '10px', lg: '14px' },
    },
  },
};
```

Utility names are the contract between design and implementation: `bg-canvas`, `bg-surface`, `bg-surface-muted`, `text-fg`, `text-fg-muted`, `text-fg-subtle`, `border-border-muted`, `border-border-strong`, `bg-primary`, `bg-primary-pressed`, `text-on-primary`, `bg-danger`, `bg-danger-pressed`, `text-on-danger`, `bg-danger-soft`, `text-danger`, `text-success`, `text-warning`, `bg-warning-soft`, `bg-info-soft`, `text-on-info-soft`, `border-focus`, `bg-inverse`, `text-on-inverse`, `text-inverse-action`, `bg-overlay`, `bg-status-{pending,progress,done}-bg`, `text-status-{pending,progress,done}-fg`.

**TypeScript mirror.** Values needed outside `className` (navigation theme, status bar, `RefreshControl` tint, placeholder color, icon colors, `contrastingText` surface) are exported from `src/theme/tokens.ts` as `{ light, dark }` hex maps keyed by the role names above. `global.css` is the styling source; a unit test parses `global.css` and fails if any role differs from `tokens.ts` (no silent drift).

---

## 2. `global.css` — theme variables and semantic class catalog

Components use these classes; raw utilities are allowed only for one-off layout (`flex-row`, `gap-2`, `mt-4`). Because every color is a theme variable (§2.1), **no class below needs a `dark:` pair**. NativeWind v4 compiles `@apply` inside `@layer components`.

### 2.1 Theme variables

Light values under `:root`, dark values under `.dark:root` (react-native-css-interop reads root variables only as `:root` and `.dark:root`). The theme follows the device; NativeWind `colorScheme.set()` is used only by the COULD theme choice (T-004-23). Variable names and values are normative.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --color-canvas: 248 250 252; /* #F8FAFC */
    --color-surface: 255 255 255; /* #FFFFFF */
    --color-surface-muted: 241 245 249; /* #F1F5F9 */
    --color-border-muted: 226 232 240; /* #E2E8F0 */
    --color-border-strong: 100 116 139; /* #64748B */
    --color-fg: 15 23 42; /* #0F172A */
    --color-fg-muted: 71 85 105; /* #475569 */
    --color-fg-subtle: 100 116 139; /* #64748B */
    --color-primary: 79 70 229; /* #4F46E5 */
    --color-primary-pressed: 67 56 202; /* #4338CA */
    --color-on-primary: 255 255 255; /* #FFFFFF */
    --color-danger: 220 38 38; /* #DC2626 */
    --color-danger-pressed: 185 28 28; /* #B91C1C */
    --color-on-danger: 255 255 255; /* #FFFFFF */
    --color-danger-soft: 254 226 226; /* #FEE2E2 */
    --color-success: 21 128 61; /* #15803D */
    --color-warning: 180 83 9; /* #B45309 */
    --color-warning-soft: 254 243 199; /* #FEF3C7 */
    --color-info-soft: 224 231 255; /* #E0E7FF */
    --color-on-info-soft: 55 48 163; /* #3730A3 */
    --color-focus: 79 70 229; /* #4F46E5 */
    --color-inverse: 15 23 42; /* #0F172A */
    --color-on-inverse: 255 255 255; /* #FFFFFF */
    --color-inverse-action: 129 140 248; /* #818CF8 */
    --color-overlay: 15 23 42; /* #0F172A */
    --color-status-pending-bg: 254 243 199; /* #FEF3C7 */
    --color-status-pending-fg: 146 64 14; /* #92400E */
    --color-status-progress-bg: 219 234 254; /* #DBEAFE */
    --color-status-progress-fg: 30 64 175; /* #1E40AF */
    --color-status-done-bg: 220 252 231; /* #DCFCE7 */
    --color-status-done-fg: 22 101 52; /* #166534 */
    --alpha-overlay: 0.5;
  }
  .dark:root {
    --color-canvas: 11 17 32; /* #0B1120 */
    --color-surface: 17 24 39; /* #111827 */
    --color-surface-muted: 31 41 55; /* #1F2937 */
    --color-border-muted: 51 65 85; /* #334155 */
    --color-border-strong: 148 163 184; /* #94A3B8 */
    --color-fg: 241 245 249; /* #F1F5F9 */
    --color-fg-muted: 203 213 225; /* #CBD5E1 */
    --color-fg-subtle: 148 163 184; /* #94A3B8 */
    --color-primary: 129 140 248; /* #818CF8 */
    --color-primary-pressed: 99 102 241; /* #6366F1 */
    --color-on-primary: 11 17 32; /* #0B1120 */
    --color-danger: 248 113 113; /* #F87171 */
    --color-danger-pressed: 239 68 68; /* #EF4444 */
    --color-on-danger: 11 17 32; /* #0B1120 */
    --color-danger-soft: 69 10 10; /* #450A0A */
    --color-success: 74 222 128; /* #4ADE80 */
    --color-warning: 251 191 36; /* #FBBF24 */
    --color-warning-soft: 66 32 6; /* #422006 */
    --color-info-soft: 30 27 75; /* #1E1B4B */
    --color-on-info-soft: 199 210 254; /* #C7D2FE */
    --color-focus: 165 180 252; /* #A5B4FC */
    --color-inverse: 31 41 55; /* #1F2937 */
    --color-on-inverse: 241 245 249; /* #F1F5F9 */
    --color-inverse-action: 129 140 248; /* #818CF8 */
    --color-overlay: 0 0 0; /* #000000 */
    --color-status-pending-bg: 66 32 6; /* #422006 */
    --color-status-pending-fg: 252 211 77; /* #FCD34D */
    --color-status-progress-bg: 23 37 84; /* #172554 */
    --color-status-progress-fg: 147 197 253; /* #93C5FD */
    --color-status-done-bg: 5 46 22; /* #052E16 */
    --color-status-done-fg: 134 239 172; /* #86EFAC */
    --alpha-overlay: 0.6;
  }
}
```

### 2.2 Documented `dark:` exceptions

Only values that are **not colors** may branch on theme:

| Where   | Exception                    | Why                                                                                                   |
| ------- | ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `.card` | `shadow-sm dark:shadow-none` | Elevation e1 is a shadow in light and a hairline border in dark (§1.5); shadows are not color tokens. |

Any new `dark:` usage needs an entry here.

### 2.3 Semantic classes

```css
@layer components {
  /* Layout */
  .screen {
    @apply flex-1 bg-canvas;
  }
  .screen-padded {
    @apply flex-1 bg-canvas px-4 pt-4;
  }
  .section {
    @apply gap-3 mb-6;
  }
  .section-title {
    @apply text-caption uppercase tracking-wide text-fg-subtle;
  }

  /* Typography (named type-* so they never collide with the text-* size utilities) */
  .type-display {
    @apply text-display text-fg;
  }
  .type-title {
    @apply text-title text-fg;
  }
  .type-headline {
    @apply text-headline text-fg;
  }
  .type-body {
    @apply text-body text-fg;
  }
  .type-muted {
    @apply text-callout text-fg-muted;
  }
  .type-meta {
    @apply text-caption text-fg-subtle;
  }
  .type-link {
    @apply text-label text-primary underline;
  }

  /* Surfaces */
  .card {
    @apply bg-surface rounded-lg p-4 border border-border-muted shadow-sm dark:shadow-none;
  }
  .list-item {
    @apply bg-surface rounded-lg px-4 py-3 min-h-row-min gap-1.5 border border-border-muted active:bg-surface-muted;
  }
  .list-item-pending {
    @apply opacity-80;
  } /* + pending-sync badge; never the only signal */
  .divider {
    @apply h-px bg-border-muted;
  }

  /* Buttons (all ≥ 48 high, ≥ 44 wide) */
  .btn {
    @apply min-h-control min-w-touch flex-row items-center justify-center gap-2 rounded-md px-4;
  }
  .btn-label {
    @apply text-label;
  }
  .btn-primary {
    @apply btn bg-primary active:bg-primary-pressed;
  }
  .btn-primary-label {
    @apply btn-label text-on-primary;
  }
  .btn-secondary {
    @apply btn bg-transparent border border-border-strong active:bg-surface-muted;
  }
  .btn-secondary-label {
    @apply btn-label text-fg;
  }
  .btn-danger {
    @apply btn bg-danger active:bg-danger-pressed;
  }
  .btn-danger-label {
    @apply btn-label text-on-danger;
  }
  .btn-ghost {
    @apply btn bg-transparent active:bg-surface-muted;
  }
  .btn-ghost-label {
    @apply btn-label text-primary;
  }
  .btn-ghost-danger-label {
    @apply btn-label text-danger;
  } /* Delete task / Delete team / Sign out */
  .btn-disabled {
    @apply opacity-50;
  }
  .icon-btn {
    @apply h-touch w-touch items-center justify-center rounded-full active:bg-surface-muted;
  }
  .fab {
    @apply absolute bottom-6 right-4 h-fab w-fab items-center justify-center rounded-full bg-primary shadow-lg active:bg-primary-pressed;
  }

  /* Forms */
  .field {
    @apply gap-1.5 mb-4;
  }
  .field-label {
    @apply text-label text-fg;
  }
  .field-help {
    @apply text-caption text-fg-subtle;
  }
  .field-error {
    @apply text-caption text-danger;
  }
  .input {
    @apply min-h-control rounded-md border border-border-strong bg-surface px-3 text-body text-fg;
  }
  .input-focused {
    @apply border-2 border-focus;
  }
  .input-error {
    @apply border-2 border-danger;
  }
  .input-multiline {
    @apply input min-h-[112px] py-3;
  }
  .search-input {
    @apply input flex-1 pl-10 rounded-full;
  }

  /* Chips & badges */
  .chip {
    @apply h-chip flex-row items-center rounded-sm px-2 max-w-[160px];
  } /* bg/text via style (team color rule) */
  .chip-label {
    @apply text-caption font-medium;
  }
  .chip-outline {
    @apply border border-border-strong;
  } /* low-contrast team colors */
  .chip-overflow {
    @apply chip bg-surface-muted;
  }
  .chip-overflow-label {
    @apply chip-label text-fg-muted;
  }
  .badge {
    @apply flex-row items-center gap-1 self-start rounded-sm px-2 py-0.5;
  }
  .badge-label {
    @apply text-caption font-medium;
  }
  .badge-status-pending {
    @apply badge bg-status-pending-bg;
  }
  .badge-status-pending-label {
    @apply badge-label text-status-pending-fg;
  }
  .badge-status-in_progress {
    @apply badge bg-status-progress-bg;
  }
  .badge-status-in_progress-label {
    @apply badge-label text-status-progress-fg;
  }
  .badge-status-done {
    @apply badge bg-status-done-bg;
  }
  .badge-status-done-label {
    @apply badge-label text-status-done-fg;
  }
  .badge-pending-sync {
    @apply badge bg-info-soft;
  }
  .badge-pending-sync-label {
    @apply badge-label text-on-info-soft;
  }

  /* Segmented control (status filter, status change, theme) — single-select, radiogroup */
  .segmented {
    @apply flex-row rounded-full bg-surface-muted p-1 gap-1;
  } /* track */
  .segment {
    @apply flex-1 min-h-touch flex-row items-center justify-center gap-1.5 rounded-full px-2;
  }
  .segment-active {
    @apply bg-primary;
  }
  .segment-label {
    @apply text-label text-fg;
  }
  .segment-label-active {
    @apply text-label text-on-primary;
  }

  /* Feedback */
  .banner-offline {
    @apply flex-row items-center gap-2 px-4 py-2 bg-warning-soft;
  }
  .banner-error {
    @apply flex-row items-center gap-2 rounded-md p-3 bg-danger-soft;
  }
  .toast {
    @apply mx-4 mb-4 flex-row items-center gap-3 rounded-md px-4 py-3 bg-inverse shadow-lg;
  }
  .toast-label {
    @apply flex-1 text-callout text-on-inverse;
  }
  .toast-action {
    @apply min-h-touch justify-center px-2 text-label text-inverse-action;
  }
  .empty-state {
    @apply flex-1 items-center justify-center gap-3 px-8 py-12;
  }
  .error-state {
    @apply flex-1 items-center justify-center gap-3 px-8 py-12;
  }
  .skeleton {
    @apply rounded-md bg-surface-muted;
  }
  .skeleton-line {
    @apply skeleton h-3;
  }
  .skeleton-row {
    @apply list-item;
  }

  /* Sheets & dialogs */
  .scrim {
    @apply absolute inset-0 bg-overlay;
    opacity: var(--alpha-overlay);
  }
  .sheet {
    @apply bg-surface rounded-t-lg px-4 pt-3 pb-8 gap-2;
  }
  .sheet-handle {
    @apply self-center h-1 w-10 rounded-full bg-border-strong mb-2;
  }
  .sheet-option {
    @apply min-h-touch flex-row items-center gap-3 px-2 rounded-md active:bg-surface-muted;
  }
  .dialog {
    @apply mx-6 rounded-lg bg-surface p-6 gap-4 border border-border-muted shadow-xl;
  }
  .form-footer {
    @apply flex-row gap-3 px-4 pt-3 pb-6 bg-surface border-t border-border-muted;
  }
}
```

> NativeWind note for implementers: if a nested `@apply` of a custom class (e.g. `.btn-primary { @apply btn ... }`) is not supported by the installed NativeWind version, inline the `.btn` utilities — the composition above is normative, the nesting is a convenience.

**Changes vs. the earlier catalog (for reviewers):** all `dark:` pairs removed (colors are variables); `.text-display/-title/-headline/-body/-muted/-meta/-link` renamed `.type-*` (a class named like its own `@apply` utility would recurse); `.segment` split into a `.segmented` track plus equal-width `.segment` items (status filter is a single-select segmented control, D32); `.btn-ghost-danger-label`, `.scrim` added; toast uses the `inverse` roles instead of borrowing `fg`/`surface`.

---

## 3. Team chip rule

A team chip shows the **team name** on the **team color**. Color is decorative; the name carries the meaning.

1. **Background** = `team.colorHex` (dynamic → passed via `style={{ backgroundColor }}`; never interpolated into className).
2. **Text color** = black `#000000` or white `#FFFFFF`, whichever has the higher WCAG contrast ratio with the background:
   - relative luminance `L = 0.2126·R + 0.7152·G + 0.0722·B`, each channel linearised (`c ≤ 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4`);
   - `ratio(a,b) = (Lmax + 0.05) / (Lmin + 0.05)`;
   - choose black if `ratio(bg, black) ≥ ratio(bg, white)` (equivalently `L > ≈ 0.179`).
   - Mathematically one of the two always reaches **≥ 4.58:1**, so every chip meets AA for small text.
   - Computed only in the app (the API returns just `colorHex`); the app implements a pure function `contrastingText(hex)` in `src/theme/contrast.ts` with table-driven tests from §1.3.
3. **Outline:** if `ratio(bg, current surface)` < **3:1** (WCAG 1.4.11 non-text contrast), add `.chip-outline` (1 px `border-strong`). Evaluated against the surface of the active theme, so the same color may need an outline in dark mode and not in light (e.g. Ink `#1E293B`) or vice versa (e.g. Yellow).
4. **Truncation:** label truncates at 160 pt with an ellipsis; the full name is in the accessibility label.
5. **Overflow:** a list row shows at most **3** chips, then `+N` (`.chip-overflow`). The detail screen shows all chips, wrapping.
6. **Accessibility:** the chip group is one element: `accessibilityLabel = "Teams: Mobile, Backend"` / `"Times: Mobile, Backend"`. Tasks without teams show no chip row (no "No team" chip in lists; detail shows "No teams" in `text-meta`).
7. **Selectable chips** (task form team picker): unselected = outline only, team color as a 10 pt dot + name in `text`; selected = filled per rules 1–3 + `check` icon. Selection is never shown by color alone (`accessibilityState={{ selected }}` + icon).

---

## 4. Screen inventory and navigation

| #   | Screen                                            | Route (Expo Router file)                                                     | Presentation          | Spec story           |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------- | -------------------- |
| S1  | Sign in                                           | `app/(auth)/sign-in.tsx`                                                     | stack                 | US-04.1              |
| S2  | Sign up                                           | `app/(auth)/sign-up.tsx`                                                     | stack push            | US-04.1              |
| S3  | Tasks (global)                                    | `app/(app)/(tabs)/tasks/index.tsx`                                           | tab                   | US-04.4/5            |
| S4  | Teams list                                        | `app/(app)/(tabs)/teams/index.tsx`                                           | tab                   | US-04.2              |
| S5  | Settings                                          | `app/(app)/(tabs)/settings.tsx`                                              | tab                   | US-04.10/11, US-04.1 |
| S6  | Team tasks (filtered)                             | `app/(app)/(tabs)/tasks/index.tsx` with `?teamId=<id>` (URL state, ADR-0009) | push to Tasks tab     | US-04.2/4            |
| S7  | Task detail                                       | `app/(app)/tasks/[id]/index.tsx`                                             | stack push            | US-04.6              |
| S8  | Task form — create                                | `app/(app)/tasks/new.tsx` (`?teamId=` preselects)                            | modal                 | US-04.7              |
| S9  | Task form — edit                                  | `app/(app)/tasks/[id]/edit.tsx`                                              | modal                 | US-04.7              |
| S10 | Team form — create                                | `app/(app)/teams/new.tsx`                                                    | modal                 | US-04.3              |
| S11 | Team form — edit                                  | `app/(app)/teams/[id]/edit.tsx`                                              | modal                 | US-04.3              |
| —   | Sort sheet, status sheet, confirm dialogs, toasts | in-screen components                                                         | bottom sheet / dialog | —                    |

**Priority (MoSCoW, per spec 004):** MUST — S1 sign in, S3/S6 task lists with **status filter and search**, S4 teams list, **S10/S11 team create / edit / delete** (S4 `⋯` menu, S11 footer, confirm dialog), S5 settings (account, sign out; theme row COULD), S7, S8, S9. COULD — **S2 sign up** (an account can be seeded/created via the API; if cut, S1 drops the “New here?” link and S2 is not routed) and **task sort** (`⇅` button, sort sheet and “Sorted by” caption; if cut, lists use the default `-createdAt`). Everything below is fully specified (wireframe, states, copy) even for COULD items, so cutting one is a deletion, not a redesign.

```mermaid
flowchart TD
  Root["app/_layout.tsx<br/>providers + auth gate"] -->|no session| Auth
  Root -->|session| App
  subgraph Auth["(auth) stack"]
    S1[Sign in] <--> S2[Sign up]
  end
  subgraph App["(app) stack"]
    subgraph Tabs["(tabs)"]
      S3[Tasks — global]
      S4[Teams]
      S5[Settings]
    end
    S6["Team tasks<br/>/tasks?teamId=…"]
    S7["Task detail<br/>/tasks/[id]"]
    S8["New task (modal)"]
    S9["Edit task (modal)"]
    S10["New team (modal)"]
    S11["Edit team (modal)"]
  end
  S1 -->|signed in| S3
  S2 -->|account created| S3
  S4 -->|tap team| S6
  S4 -->|FAB| S10
  S4 -->|long-press / ⋯ Edit| S11
  S6 -->|header ⋯ Edit team| S11
  S3 -->|tap task| S7
  S6 -->|tap task| S7
  S3 -->|FAB| S8
  S6 -->|FAB, team preselected| S8
  S7 -->|Edit| S9
  S7 -->|tap team chip| S6
  S7 -->|deleted| Back((back to list))
  S6 -->|Show all tasks| S3
  S5 -->|Sign out| S1
```

- **Auth gate:** the root layout reads the session; while it is resolving it keeps the splash screen visible (no flash of the sign-in screen). Unauthenticated users can only reach `(auth)`; authenticated users visiting `(auth)` are redirected to Tasks. A `401` from any request signs the user out locally and returns to Sign in with the "session expired" message.
- **Team filter is URL state** ([ADR-0009](../architecture/adr/archive/0009-expo-and-expo-router.md)): tapping a team pushes `/tasks?teamId=<id>`; the Tasks tab uses `backBehavior="history"`, so Back returns to Teams; "Show all tasks" (header action) replaces the route with `/tasks`.
- **Deep links / typed routes:** `teamstasks://tasks/<id>` opens S7; `teamstasks://tasks?teamId=<id>` opens S6 (cold start goes through the gate first).
- **Back behaviour:** modals close with "Cancel" or swipe-down; if the form is dirty, a "Discard changes?" dialog appears (§6.6).
- **Tab bar:** icons `check-square` (Tasks), `users` (Teams), `settings` (Settings), always with labels; the Tasks tab shows a small pending-sync dot when the offline queue is non-empty.

---

## 5. Wireframes

Legend: `[ Button ]` button · `( Chip )` chip · `⟦ a│b ⟧` segmented control (`●` = selected segment) · `▢` skeleton · `⋯` overflow menu · `◷` pending-sync badge · `▔▔` input · `●` selected segment. All widths are a 375 pt phone; layouts are single-column and grow with dynamic type.

### Global elements (present on every authenticated screen)

```
┌────────────────────────────────────┐
│ ⚠ You're offline. Changes will     │  ← .banner-offline, under the header, only while offline
│   sync when you reconnect.         │
├────────────────────────────────────┤
│               … screen …           │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ ✓ Task updated          [Undo] │ │  ← .toast, bottom, above tab bar, 4 s
│ └────────────────────────────────┘ │
├────────────────────────────────────┤
│  ☑ Tasks•    👥 Teams    ⚙ Settings │  ← tab bar; • = pending-sync dot
└────────────────────────────────────┘
```

### S1 — Sign in

```
┌────────────────────────────────────┐
│                                    │
│   Teams & Tasks                    │  display
│   Sign in to continue              │  text-muted
│                                    │
│   Email                            │
│   ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔   │  keyboard: email, autocomplete: email
│   Password                    👁    │
│   ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔   │  secure, show/hide toggle (44pt)
│   ┌──────────────────────────────┐ │
│   │ ⓧ Incorrect email or password│ │  .banner-error (form-level, after submit)
│   └──────────────────────────────┘ │
│   [        Sign in         ]       │  btn-primary, spinner while submitting
│                                    │
│   New here?  Create an account     │  type-link → S2 (COULD; hidden if sign-up is cut)
└────────────────────────────────────┘
```

States: **submitting** — button shows spinner + "Signing in…", inputs disabled. **Validation** — on submit, inline field errors (email format, password required). **Error** — `.banner-error` with mapped copy (invalid credentials, rate limited, network). **Offline** — banner shown; Sign in disabled with helper "You need a connection to sign in". **Success** — navigate to Tasks (no toast).

### S2 — Sign up

```
┌────────────────────────────────────┐
│ ‹ Back                             │
│   Create your account              │  display
│   Name                             │
│   ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔   │
│   Email                            │
│   ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔   │
│   Password                    👁    │
│   ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔   │
│   At least 8 characters            │  field-help → field-error if < 8
│   [      Create account     ]      │
│   Already have an account? Sign in │
└────────────────────────────────────┘
```

States as S1. Errors: email already registered (field-level on Email), password length (8–128). Success → signed in → Tasks, toast "Welcome, {name}!".

### S3 — Tasks (global) and S6 — Team tasks (filtered)

S3 and S6 are the **same screen component** with an optional `teamId`. S6 adds the team header and preselects that team in "New task".

```
S3 (global)                              S6 (filtered by team "Mobile")
┌────────────────────────────────────┐   ┌────────────────────────────────────┐
│ Tasks                    ⇅ (COULD)│   │ ‹ Teams  ● Mobile            ⋯    │  ● = team color dot; ⋯ = Edit team / Show all tasks
├────────────────────────────────────┤   │ 4 tasks                            │  text-meta
│ 🔍 Search tasks             ✕      │   ├────────────────────────────────────┤
│ ⟦●All│○Pending│◐In prog│✓Done⟧      │   │ 🔍 Search in Mobile         ✕      │
│ Sorted by: Newest first (COULD)    │   │ ⟦●All│○Pending│◐In prog│✓Done⟧      │
├────────────────────────────────────┤   ├────────────────────────────────────┤
│ ┌────────────────────────────────┐ │   │ ┌────────────────────────────────┐ │
│ │ Implement login screen     ◐   │ │   │ │ Implement login screen     ◐   │ │
│ │ (Mobile)(Backend)              │ │   │ │ (Mobile)(Backend)              │ │
│ │ 📅 Oct 31                      │ │   │ │ 📅 Oct 31                      │ │
│ └────────────────────────────────┘ │   │ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │   │ ┌────────────────────────────────┐ │
│ │ Write release notes  ◷ Pending │ │   │ │ Fix crash on Android 14    ○   │ │
│ │ sync                       ○   │ │   │ │ (Mobile)                       │ │
│ │ (Design)(Mobile)(Backend)(+1)  │ │   │ │ ⚠ Overdue · Oct 12             │ │
│ └────────────────────────────────┘ │   │ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │   │                                    │
│ │ Update dependencies        ✓   │ │   │                                    │
│ │ (no chips — no teams)          │ │   │                                    │
│ └────────────────────────────────┘ │   │                                    │
│          ⟳ Loading more…           │   │                              ( + ) │
│                              ( + ) │   │                                    │
└────────────────────────────────────┘   └────────────────────────────────────┘
```

**Row anatomy** (`.list-item`, min 72 pt): line 1 = title (`text-headline`, 2 lines max, ellipsis) + status badge on the right (icon-only in row with label hidden visually but present in a11y label; full badge on detail). Line 2 = team chips (max 3 + `+N`). Line 3 = due date (`text-meta`; overdue in `warning` with icon). Pending-sync badge `◷ Pending sync` appears next to the title when the item has unconfirmed changes.

**Row gestures:** tap → S7. Long-press → status sheet (quick change without opening detail; same as detail's status action). No swipe-to-delete in lists (delete lives in detail with confirmation — protects against accidental destruction on a crowded list).

**Filter bar:**

- **Search** — `.search-input`, placeholder "Search tasks" / "Search in {team}". Debounce **300 ms**; minimum 1 non-space char; trimmed; max 100 chars (input `maxLength=100`). Clear button (✕, 44 pt) appears when non-empty. While a debounced search is in flight, the previous results stay visible with a thin progress bar under the filter bar (no skeleton flash).
- **Status filter (MUST)** — one **single-select segmented control**: `All · Pending · In progress · Done` (`All` = no status filter, default). Track `.segmented`, items `.segment` / `.segment-active` (equal width, ≥ 44 pt high, icon + label; `All` has no icon). Exactly one segment is always selected; selecting a segment replaces the previous one and refetches page 1. At OS font scale > 130 % the labels wrap to two lines, and above 200 % the control becomes horizontally scrollable with intrinsic widths. `accessibilityRole="radio"` per segment inside a `radiogroup` labelled “Filter by status”; selected state announced.
- **Sort (COULD)** — header icon button `⇅` opens the sort sheet; the current sort is shown as a caption under the chips ("Sorted by: Newest first").
- Filters are remembered **per list** (global list and each team list keep their own search/status/sort) while the app is running; they reset when the app is restarted or on sign-out.
- "Clear filters" link appears in the empty-state when any filter is active.

**Sort sheet (COULD):**

```
┌────────────────────────────────────┐
│               ────                 │
│ Sort by                            │
│ ◉ Newest first          (-createdAt) default
│ ○ Oldest first          (createdAt)│
│ ○ Due date (soonest)    (dueDate, no date last)
│ ○ Recently updated      (-updatedAt)
│ ○ Title A–Z             (title)    │
│ ○ Status                (status)   │
└────────────────────────────────────┘
```

**Infinite scroll:** pages of 20; next page requested when the user is within ~1.5 screen heights of the end. Footer shows "Loading more…" spinner; on page error the footer shows "Couldn't load more. [Retry]" without discarding loaded rows. End of list: footer "That's all ({total} tasks)" in `text-meta`.

**Pull to refresh:** native `RefreshControl` tinted `primary`; refreshes page 1 with current filters; on failure a toast "Couldn't refresh. Showing saved data." and the list stays.

**States:**

| State                                 | Rendering                                                                                                                                                                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading (first load, nothing cached)  | Filter bar is interactive; 6 `.skeleton-row`s, each: 60 % title line, 2 chip pills (48×24), 30 % meta line. Shimmer unless Reduce Motion. `accessibilityLabel="Loading tasks"` on the container, `busy`.                               |
| Empty — no tasks at all               | Illustration-free: icon `check-square` 48 pt in `text-subtle`, title "No tasks yet", body "Capture your first task — it takes seconds.", `[ New task ]` btn-primary. S6 variant: "No tasks in {team} yet", button preselects the team. |
| Empty — filters active                | Icon `search`, "No tasks match your filters", body "Try another status or search term.", `[ Clear filters ]` btn-secondary.                                                                                                            |
| Error (no cached data)                | `.error-state`: icon `cloud-off` (network) or `alert-circle` (server), title from copy table, body with mapped error message, `[ Try again ]` btn-primary.                                                                             |
| Error (cached data present)           | Keep showing cached list + toast with mapped message and `Retry` action.                                                                                                                                                               |
| Offline                               | Offline banner; list shows cached data; pull-to-refresh shows toast "You're offline. Showing saved data."; FAB still works (creation is queued).                                                                                       |
| Pending sync                          | Affected rows show `◷ Pending sync`; tab shows dot.                                                                                                                                                                                    |
| Success feedback                      | Toasts from mutations (created/updated/deleted), see copy table.                                                                                                                                                                       |
| S6 team not found (deleted elsewhere) | `.error-state` "This team no longer exists" + `[ Back to teams ]`.                                                                                                                                                                     |

### S4 — Teams list

```
┌────────────────────────────────────┐
│ Teams                              │
├────────────────────────────────────┤
│ 🔍 Search teams             ✕      │
├────────────────────────────────────┤
│ ┌────────────────────────────────┐ │
│ │ ▌● Mobile                  ›   │ │  ▌ 4pt left stripe + 12pt dot = team color
│ │ ▌  iOS & Android squad         │ │  description, 1 line, text-muted
│ │ ▌  4 tasks                 ⋯   │ │  taskCount, text-meta; ⋯ = Edit / Delete
│ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │
│ │ ▌● Backend                 ›   │ │
│ │ ▌  3 tasks                 ⋯   │ │
│ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │
│ │ ▌● Design        ◷ Pending sync│ │
│ │ ▌  0 tasks                 ⋯   │ │
│ └────────────────────────────────┘ │
│                              ( + ) │  FAB → S10
└────────────────────────────────────┘
```

- **Tap a team → S6** (tasks filtered by that team). This is the brief's core interaction; the whole card is the target, with `accessibilityHint="Shows the tasks of this team"`.
- `⋯` (44 pt icon button) opens a sheet: **Edit team** → S11, **Delete team** → confirm dialog "Delete “{name}”? Its tasks are kept and will no longer be assigned to this team." `[Cancel] [Delete]`.
- Sorted by name A–Z (`sort=name`); search debounced 300 ms; infinite scroll + pull to refresh as S3.
- **Team management is MUST** (create / edit / delete): create = FAB → S10; edit = `⋯` → Edit team → S11; delete = `⋯` → Delete team → confirm dialog (also reachable from S11 and from the S6 header `⋯`).
- States: skeleton (5 rows: stripe + 40 % line + 25 % line); empty "No teams yet — Teams group related tasks and give them a color." `[ Create team ]`; empty-with-search "No teams match “{term}”" + `[ Clear search ]`; error/offline/pending-sync as S3.

| Team action       | Behaviour                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create (S10)      | Closes the modal on submit; the new row appears immediately with `◷ Pending sync` until confirmed; toast “Team created”. If opened from the task form's “+ New team”, it returns there with the team selected.                                                                                                                                                        |
| Edit (S11)        | Row updates immediately (name, color, description); toast “Team updated”; chips on tasks update in place.                                                                                                                                                                                                                                                             |
| Delete            | Dialog “Delete “{name}”?” / “Its tasks are kept and will no longer be assigned to this team.” `[Cancel] [Delete]` (focus on Cancel). Confirm → row disappears at once, toast “Team deleted”; if the user was on S6 for that team, navigate to Teams. On failure the row reappears and a toast explains. Offline: queued, row marked `◷ Pending sync` until confirmed. |
| Deleted elsewhere | Opening S6/S11 for a missing team → `.error-state` “This team no longer exists” + `[ Back to teams ]`; a queued edit of a deleted team is discarded with a warning toast (§6.5).                                                                                                                                                                                      |

### S5 — Settings

```
┌────────────────────────────────────┐
│ Settings                           │
├────────────────────────────────────┤
│ ACCOUNT                            │
│ ┌────────────────────────────────┐ │
│ │ Marina Souza                   │ │
│ │ marina@example.com             │ │
│ └────────────────────────────────┘ │
│ APPEARANCE                         │
│ ┌────────────────────────────────┐ │
│ │ Theme ⟦System│●Light│Dark⟧       │ │  segmented control, radiogroup
│ └────────────────────────────────┘ │
│ SYNC                               │
│ ┌────────────────────────────────┐ │
│ │ ◷ 2 changes waiting to sync    │ │  only when queue non-empty; "All changes synced ✓" otherwise
│ └────────────────────────────────┘ │
│ [          Sign out          ]     │  btn-secondary (danger text)
│ Version 1.0.0 (build 12) · API ok  │  text-meta
└────────────────────────────────────┘
```

- The theme row is COULD (T-004-23); until then the theme follows the system. A choice applies **immediately** (no save button) and persists across restarts.
- **Sign out:** if the offline queue is non-empty, confirm dialog "You have {n} changes that haven't synced. Signing out will discard them." `[Cancel] [Sign out anyway]` (danger). Otherwise sign out directly. Sign-out clears the session, the persisted cache and the queue, then shows S1.

### S7 — Task detail

```
┌────────────────────────────────────┐
│ ‹ Tasks                    Edit    │  header; Edit → S9
├────────────────────────────────────┤
│ Implement login screen             │  title (text-title)
│ [◐ In progress]   ◷ Pending sync   │  status badge (full) + sync badge if any
│                                    │
│ Email + password, error states.    │  description, text-body; "No description" text-meta if empty
│                                    │
│ TEAMS                              │
│ (Mobile)(Backend)                  │  all chips, wrap; tap chip → S6
│ DUE DATE                           │
│ 📅 Fri, Oct 31, 2026               │  overdue variant: ⚠ Overdue · Fri, Oct 12
│ DETAILS                            │
│ Created Oct 20 · Updated Oct 21    │  text-meta; "Completed Oct 22" when DONE
│                                    │
├────────────────────────────────────┤
│ CHANGE STATUS                      │  sticky quick-action bar
│ ⟦○Pending│●In progress│✓Done⟧       │  segmented control, one tap = change
│ [🗑 Delete task]                   │  btn-ghost danger label
└────────────────────────────────────┘
```

- **Change status (quick action):** tapping a segment applies the new status **immediately** in the UI (optimistic), the segment animates (`fast`, or instant under Reduce Motion), a polite screen-reader announcement "Status changed to Done" fires, and a toast "Marked as Done" with `Undo` (restores the previous status) appears. Tapping the already-active segment does nothing. On server failure: the previous status is restored and a toast explains why.
- **Delete:** opens confirm dialog:
  ```
  ┌──────────────────────────────┐
  │ Delete this task?            │
  │ “Implement login screen”     │
  │ will be removed. This can't  │
  │ be undone.                   │
  │        [Cancel]  [Delete]    │  Delete = btn-danger; focus starts on Cancel
  └──────────────────────────────┘
  ```
  Confirm → navigate back to the list immediately, the row disappears, toast "Task deleted". On failure the row reappears and a toast explains.
- States: **loading** (opened from a list → render instantly from list data, refresh in background; deep link with no cache → skeleton: title bar, badge pill, 3 lines, chip pills); **not found / deleted elsewhere** → `.error-state` "This task no longer exists" `[ Back to tasks ]`; **error** → error-state + Retry; **offline** → banner, actions still enabled (queued); **pending sync** → badge.

### S8 / S9 — Create / Edit task form (modal)

```
┌────────────────────────────────────┐
│ Cancel        New task             │  "Edit task" in S9
├────────────────────────────────────┤
│ Title *                            │
│ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔   │  autofocus on create
│ ⓧ Title must be at least 3 chars   │  field-error (shown after blur or submit)
│                           2 / 120  │  counter, text-meta
│ Description                        │
│ ┌──────────────────────────────┐   │
│ │                              │   │  multiline, max 2000
│ └──────────────────────────────┘   │
│                          0 / 2000  │
│ Status                             │
│ ⟦●Pending│◐In progress│✓Done⟧       │  segmented control; default Pending
│ Due date                           │
│ ▔ 📅 Select a date ▔▔▔▔▔▔▔▔▔ ✕ ▔   │  opens native date picker; ✕ clears
│ Teams                    2 of 10   │
│ (✓ Mobile)(✓ Backend)( ● Design)   │  selectable chips (§3.7), wrap
│ ( ● Platform)  [+ New team]        │  "+ New team" → S10 then returns with it selected
├────────────────────────────────────┤
│ [ Cancel ]        [ Create task ]  │  .form-footer sticky above keyboard; "Save changes" in S9
└────────────────────────────────────┘
```

**Validation (client mirrors the API rules):**

| Field       | Rule                                                                                                   | When shown                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Title       | required; trimmed length 3–120                                                                         | on blur after first edit, and on submit; clears as soon as valid while typing |
| Description | ≤ 2000 chars (input hard-limited)                                                                      | counter turns `danger` at the limit                                           |
| Status      | one of the three                                                                                       | — (always valid)                                                              |
| Due date    | valid calendar date; past dates **allowed** (helper "This date is in the past" in `warning` when past) | on change                                                                     |
| Teams       | 0–10 distinct; picker disables unselected chips at 10 with helper "You can pick up to 10 teams"        | on change                                                                     |

- Submit button is **always enabled** (disabled-until-valid hides why); pressing it with errors focuses the first invalid field and announces "Fix 1 error to continue".
- **Server errors:** `VALIDATION_FAILED` details map to their fields; `UNKNOWN_TEAMS` removes the missing teams from the selection with field error "Some teams no longer exist and were removed"; `TOO_MANY_TEAMS` on Teams field. Edits are last write wins: no conflict dialog.
- **Submitting:** footer button spinner + "Saving…"; fields stay visible. Success → modal closes, toast "Task created" / "Changes saved"; new task appears at the top of the relevant list (with pending-sync badge until confirmed).
- **Edit form** preloads current values; if the task was deleted elsewhere → error-state "This task no longer exists".
- **Dirty-cancel:** "Discard changes?" `[Keep editing] [Discard]`.
- **Team list loading** in the picker: 3 chip skeletons; error → inline "Couldn't load teams. [Retry]"; no teams → "No teams yet" + `[+ New team]`.
- **Offline:** form works; on save the task is queued, toast "Saved. It will sync when you're back online."

### S10 / S11 — Team form (modal)

```
┌────────────────────────────────────┐
│ Cancel        New team             │  "Edit team"
├────────────────────────────────────┤
│ Name *                             │
│ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔   │  2–50 chars, unique
│ Color *                            │
│ ⬤ ⬤ ⬤ ⬤ ⬤ ⬤ ⬤                     │  14 presets, 44pt swatches, 2 rows,
│ ⬤ ⬤ ⬤ ⬤ ⬤ ⬤ ⬤                     │  selected = ring + check icon
│ Hex  ▔ #6366F1 ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔   │  free entry, validated #RRGGBB
│ Preview  (Mobile)                  │  live chip preview using the chip rule
│ Description                        │
│ ┌──────────────────────────────┐   │  ≤ 280
│ └──────────────────────────────┘   │
│                           0 / 280  │
│ (S11 only) [🗑 Delete team]        │  btn-ghost danger → same confirm as S4
├────────────────────────────────────┤
│ [ Cancel ]        [ Create team ]  │  "Save changes"
└────────────────────────────────────┘
```

- Swatch a11y label: "Indigo, #6366F1" + selected state.
- Errors: name length (2–50), duplicate name (`TEAM_NAME_ALREADY_EXISTS`, on Name field), invalid hex, description length.
- Success: toast "Team created" / "Team updated"; team lists and task chips reflect the new name/color.
- Hex field: accepts with or without `#`, case-insensitive, normalized to `#RRGGBB` uppercase on blur; typing a valid value selects the matching swatch (or none) and updates the preview; typing an invalid value shows `team.color.invalid` and keeps the last valid color in the preview.

**States (S10 / S11):**

| State                                                  | Rendering                                                                                                                                                                                            |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial (S10)                                          | Name autofocused; color preselected `#6366F1` (Indigo); preview shows the placeholder name “Team name”.                                                                                              |
| Loading (S11, opened by deep link with nothing cached) | Skeleton: name field, 2 swatch rows, description box; footer buttons disabled. From the list it renders instantly from cached data.                                                                  |
| Validation                                             | Name 2–50 (trimmed), hex `#RRGGBB`, description ≤ 280; errors on blur/submit, same rules as the task form (button always enabled, first invalid field focused, “Fix 1 error to continue” announced). |
| Submitting                                             | Footer button spinner + “Saving…”; fields remain visible and disabled.                                                                                                                               |
| Server errors                                          | `TEAM_NAME_ALREADY_EXISTS` on Name; `VALIDATION_FAILED` mapped to fields; network/other → `.banner-error` above the footer with `[ Try again ]`.                                                     |
| Not found (S11)                                        | `.error-state` “This team no longer exists” + `[ Back to teams ]`.                                                                                                                                   |
| Offline                                                | Banner; save is queued, toast “Saved. It will sync when you're back online.” (a queued create whose name later collides surfaces as a sync toast, §6.5).                                             |
| Dirty-cancel                                           | “Discard changes?” `[Keep editing] [Discard]`.                                                                                                                                                       |
| Delete (S11)                                           | `[🗑 Delete team]` → same confirm dialog as S4; confirm closes the modal and returns to Teams.                                                                                                        |

---

## 6. Interaction details

1. **Optimistic feedback.** Status change, delete, create and edit render immediately. Unconfirmed items carry the `◷ Pending sync` badge (icon + text, `badge-pending-sync`). When confirmed, the badge disappears silently (no toast spam). When rejected, the UI rolls back and a toast explains.
2. **Undo.** Status-change toasts offer `Undo` (4 s; 8 s when a screen reader is on). Delete does **not** offer undo (the API has no restore); it is protected by the confirm dialog instead.
3. **Toasts.** One at a time, newest replaces older; 4 s default, 6 s for errors; `accessibilityLiveRegion="polite"` / `AccessibilityInfo.announceForAccessibility`; not shown for silent background syncs. Position: bottom, above tab bar / form footer, respects safe area.
4. **Offline banner.** Appears within 1 s of losing connectivity, slides down (`base`), stays while offline; on reconnect becomes "Back online — syncing {n} changes…" then "All changes synced ✓" for 2 s, then hides.
5. **Rejected changes on sync.** Edits are last write wins. If a queued change can't be applied (item deleted elsewhere, invalid data), the app rolls it back, discards it and shows a warning toast: "“{title}” foi excluída em outro lugar." or "Não foi possível salvar “{title}”: {reason}". A deletion of something already deleted is silent. No modal interruptions for background sync.
6. **Destructive confirmations.** Delete task, delete team, discard form, sign out with pending changes — dialog with neutral default focus (Cancel), destructive button on the right in `btn-danger`.
7. **Keyboard.** Forms scroll the focused field into view; `returnKeyType="next"` chains fields; the footer stays above the keyboard; tapping outside dismisses the keyboard.
8. **Haptics** (if available in Expo Go via the standard SDK): light impact on status change, notification-warning on destructive confirm; disabled when the OS disables haptics.
9. **Double-submit protection.** Primary buttons ignore presses while their action is in flight.
10. **Date display.** pt-BR (`Intl.DateTimeFormat('pt-BR')`): "31 de out." in lists; full weekday + date on detail. Due dates are calendar dates — never shifted by timezone.

---

## 7. Screen-state matrix (checklist for component tests)

| Screen               | Loading                                  | Empty           | Error + retry              | Offline                | Pending sync        | Success feedback     |
| -------------------- | ---------------------------------------- | --------------- | -------------------------- | ---------------------- | ------------------- | -------------------- |
| S1 Sign in           | button spinner                           | —               | banner                     | banner + disabled      | —                   | navigate             |
| S2 Sign up           | button spinner                           | —               | banner / field             | banner + disabled      | —                   | toast "Welcome"      |
| S3 Tasks             | skeleton rows                            | none / filtered | error-state / toast        | banner + cache         | row badge + tab dot | mutation toasts      |
| S4 Teams             | skeleton rows                            | none / filtered | error-state / toast        | banner + cache         | row badge           | toasts               |
| S5 Settings          | —                                        | —               | —                          | banner                 | queue count         | immediate apply      |
| S6 Team tasks        | skeleton rows                            | none / filtered | error-state / not-found    | banner + cache         | row badge           | toasts               |
| S7 Detail            | skeleton (deep link)                     | —               | error-state / not-found    | banner, actions queued | badge               | toast + Undo         |
| S8/S9 Task form      | footer spinner; teams skeleton           | no teams        | field + banner             | banner, queued save    | —                   | toast + close        |
| S10/S11 Team form    | footer spinner; skeleton (S11 deep link) | —               | field + banner / not-found | banner, queued save    | —                   | toast + close        |
| Team delete (S4/S11) | —                                        | —               | toast, row restored        | queued, row badge      | row badge           | toast “Team deleted” |

---

## 8. Accessibility (WCAG 2.1 AA)

| Area            | Rule                                                                                                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contrast        | Text ≥ 4.5:1 (all token pairs in §1 comply; large text ≥ 3:1); UI component boundaries and focus indicators ≥ 3:1 (`border-strong`, `focus`); team chips per §3.                                                                                                          |
| Not color alone | Status = icon + label; selection = check icon + state; overdue = icon + word; pending sync = icon + text; errors = icon + text.                                                                                                                                           |
| Touch targets   | ≥ 44×44 pt for every interactive element (`min-h-touch`/`min-w-touch` or `hitSlop` for visually smaller elements like the ✕ clear button and chips). 8 pt minimum spacing between adjacent targets.                                                                       |
| Labels & roles  | Every control has `accessibilityRole` (`button`, `link`, `radio`, `checkbox`, `search`, `header`, `alert`) and `accessibilityLabel`. Icon-only buttons always labelled ("Sort tasks", "Clear search", "Team options for Mobile", "New task").                             |
| Rows            | A task row is one focusable element with label "{title}. {status}. Teams: {names}. Due {date}{, overdue}{, pending sync}." and hint "Opens task details". Long-press action exposed as `accessibilityActions` ("Change status").                                          |
| State           | `accessibilityState` for `selected`, `disabled`, `busy`, `checked`; segmented controls are `radiogroup`.                                                                                                                                                                  |
| Forms           | Labels are visible (no placeholder-only fields); errors are linked to their field (label includes error text) and announced on submit; required fields marked with "*" and "required" in the label.                                                                       |
| Live regions    | Toasts, offline banner and status changes announced politely; form-submit errors assertively.                                                                                                                                                                             |
| Dynamic type    | All text scales with the OS setting (`allowFontScaling` default true). Layouts tested at 200 %: rows grow vertically, chips wrap, filter chips scroll horizontally, header titles may wrap to 2 lines. `maxFontSizeMultiplier=1.5` only on the tab bar labels and badges. |
| Reduce motion   | When the OS reports reduce motion: no shimmer (static skeleton), no slide/scale animations (fade ≤ 150 ms or instant), no animated segment indicator.                                                                                                                     |
| Focus order     | Matches visual order; modals trap focus; on open, focus moves to the screen title; after closing a modal, focus returns to the element that opened it.                                                                                                                    |
| Screen readers  | Verified with VoiceOver (iOS) and TalkBack (Android) for the main journeys (sign in, filter by team, change status, create task, delete).                                                                                                                                 |
| Language        | `accessibilityLanguage` is `pt-BR`; copy is plain and short.                                                                                                                                                                                                              |

---

## 9. UX copy (pt-BR)

The app ships pt-BR only, as literals (no i18n library). Domain terms follow the [ubiquitous language](../architecture/overview.md#ubiquitous-language): Team = **Time**, Task = **Tarefa**, Pending = **Pendente**, In progress = **Em andamento**, Done = **Concluída**. Interpolations in `{braces}`.

### 9.1 Navigation, titles, actions

| pt-BR                                                                 |
| --------------------------------------------------------------------- |
| Teams & Tasks                                                         |
| Tarefas                                                               |
| Times                                                                 |
| Ajustes                                                               |
| {count} tarefas                                                       |
| Nova tarefa                                                           |
| Editar tarefa                                                         |
| Criar tarefa                                                          |
| Salvar alterações                                                     |
| Salvando…                                                             |
| Cancelar                                                              |
| Excluir                                                               |
| Editar                                                                |
| Tentar novamente                                                      |
| Desfazer                                                              |
| Voltar                                                                |
| Novo time                                                             |
| Editar time                                                           |
| Criar time                                                            |
| Excluir time                                                          |
| {count, plural, =0 {Nenhuma tarefa} one {1 tarefa} other {# tarefas}} |
| Opções do time {name}                                                 |
| Mostra as tarefas deste time                                          |
| Abre os detalhes da tarefa                                            |
| Ver todas as tarefas                                                  |
| Fechar                                                                |

### 9.2 Status, filters, sort

| pt-BR                                                                         |
| ----------------------------------------------------------------------------- |
| Pendente                                                                      |
| Em andamento                                                                  |
| Concluída                                                                     |
| Todas                                                                         |
| Filtrar por status                                                            |
| {status}, filtro {position} de {total}                                        |
| Buscar tarefas                                                                |
| Buscar em {team}                                                              |
| Buscar times                                                                  |
| Limpar busca                                                                  |
| Limpar filtros                                                                |
| Ordenar por                                                                   |
| Ordenar tarefas                                                               |
| Ordenado por: {option}                                                        |
| Mais recentes                                                                 |
| Mais antigas                                                                  |
| Prazo (mais próximo)                                                          |
| Atualizadas recentemente                                                      |
| Título A–Z                                                                    |
| Status                                                                        |
| Carregando mais…                                                              |
| Não foi possível carregar mais.                                               |
| {total, plural, one {Isso é tudo (1 tarefa)} other {Isso é tudo (# tarefas)}} |

### 9.3 Task detail and form

| pt-BR                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------- |
| Times                                                                                                                              |
| Sem times                                                                                                                          |
| Prazo                                                                                                                              |
| Sem prazo                                                                                                                          |
| Atrasada                                                                                                                           |
| Sem descrição                                                                                                                      |
| Criada em {date}                                                                                                                   |
| Atualizada em {date}                                                                                                               |
| Concluída em {date}                                                                                                                |
| Alterar status                                                                                                                     |
| Marcada como {status}                                                                                                              |
| Status alterado para {status}                                                                                                      |
| Excluir tarefa                                                                                                                     |
| Excluir esta tarefa?                                                                                                               |
| “{title}” será removida. Isso não pode ser desfeito.                                                                               |
| Título                                                                                                                             |
| O título deve ter pelo menos 3 caracteres                                                                                          |
| O título deve ter no máximo 120 caracteres                                                                                         |
| O título é obrigatório                                                                                                             |
| Descrição                                                                                                                          |
| A descrição deve ter no máximo {max} caracteres                                                                                    |
| Status                                                                                                                             |
| Selecione uma data                                                                                                                 |
| Remover prazo                                                                                                                      |
| Esta data já passou                                                                                                                |
| {count} de 10                                                                                                                      |
| Você pode escolher até 10 times                                                                                                    |
| Alguns times não existem mais e foram removidos                                                                                    |
| Nenhum time ainda                                                                                                                  |
| Não foi possível carregar os times.                                                                                                |
| {count, plural, one {Corrija 1 erro para continuar} other {Corrija # erros para continuar}}                                        |
| Descartar alterações?                                                                                                              |
| Continuar editando                                                                                                                 |
| Descartar                                                                                                                          |
| Nome                                                                                                                               |
| O nome deve ter de 2 a 50 caracteres                                                                                               |
| Cor                                                                                                                                |
| Use uma cor como #6366F1                                                                                                           |
| Prévia                                                                                                                             |
| Nome do time                                                                                                                       |
| Cor em hexadecimal                                                                                                                 |
| {color}, {hex}                                                                                                                     |
| Vermelho · Laranja · Âmbar · Amarelo · Lima · Esmeralda · Verde-azulado · Céu · Azul · Índigo · Violeta · Rosa · Ardósia · Grafite |
| {label}, obrigatório, {error}                                                                                                      |
| {count} de {max} caracteres                                                                                                        |
| Prévia, {name}                                                                                                                     |
| Este time não existe mais                                                                                                          |
| Voltar para times                                                                                                                  |
| Voltar para tarefas                                                                                                                |
| A descrição deve ter no máximo 280 caracteres                                                                                      |
| Excluir “{name}”?                                                                                                                  |
| As tarefas serão mantidas e deixarão de estar atribuídas a este time.                                                              |
| Times: {names}                                                                                                                     |
| +{count}                                                                                                                           |

### 9.4 Empty, loading, success, offline

| pt-BR                                                                                                     |
| --------------------------------------------------------------------------------------------------------- |
| Carregando tarefas                                                                                        |
| Carregando times                                                                                          |
| Carregando tarefa                                                                                         |
| Carregando time                                                                                           |
| Nenhuma tarefa ainda                                                                                      |
| Registre sua primeira tarefa — leva segundos.                                                             |
| Nenhuma tarefa em {team} ainda                                                                            |
| Nenhuma tarefa corresponde aos filtros                                                                    |
| Tente outro status ou termo de busca.                                                                     |
| Nenhum time ainda                                                                                         |
| Times agrupam tarefas relacionadas e dão uma cor a elas.                                                  |
| Nenhum time corresponde a “{term}”                                                                        |
| Tarefa criada                                                                                             |
| Alterações salvas                                                                                         |
| Tarefa excluída                                                                                           |
| Time criado                                                                                               |
| Time atualizado                                                                                           |
| Time excluído                                                                                             |
| Boas-vindas, {name}!                                                                                      |
| Salvo. Será sincronizado quando você estiver online.                                                      |
| Você está offline. As alterações serão sincronizadas ao reconectar.                                       |
| De volta online — sincronizando {count} alterações…                                                       |
| Todas as alterações sincronizadas                                                                         |
| Você está offline. Exibindo dados salvos.                                                                 |
| Não foi possível atualizar. Exibindo dados salvos.                                                        |
| Sincronização pendente                                                                                    |
| {count, plural, one {1 alteração aguardando sincronização} other {# alterações aguardando sincronização}} |
| “{title}” foi excluída em outro lugar.                                                                    |
| Não foi possível salvar “{title}”: {reason}                                                               |

### 9.5 Auth and settings

| pt-BR                                                                           |
| ------------------------------------------------------------------------------- |
| Entre para continuar                                                            |
| Entrar                                                                          |
| Entrando…                                                                       |
| Novo por aqui? Crie uma conta                                                   |
| Crie sua conta                                                                  |
| Criar conta                                                                     |
| Já tem uma conta? Entre                                                         |
| Nome                                                                            |
| E-mail                                                                          |
| Senha                                                                           |
| Mostrar senha                                                                   |
| Ocultar senha                                                                   |
| Pelo menos 8 caracteres                                                         |
| Informe um e-mail válido                                                        |
| Este campo é obrigatório                                                        |
| A senha deve ter de 8 a 128 caracteres                                          |
| E-mail ou senha incorretos                                                      |
| Já existe uma conta com este e-mail                                             |
| Você precisa de conexão para entrar                                             |
| Conta                                                                           |
| Aparência                                                                       |
| Tema                                                                            |
| Sistema                                                                         |
| Claro                                                                           |
| Escuro                                                                          |
| Sincronização                                                                   |
| Todas as alterações sincronizadas                                               |
| Sair                                                                            |
| Sair com alterações não sincronizadas?                                          |
| Você tem {count} alterações não sincronizadas. Ao sair, elas serão descartadas. |
| Sair mesmo assim                                                                |
| Versão {version}                                                                |

### 9.6 Error messages by API error code

The app maps `error.code` to the message below; unknown codes fall back to the `INTERNAL_ERROR` message. Field-level messages for `VALIDATION_FAILED` use the field copy (§9.3) when the field is known, otherwise the `VALIDATION_FAILED` message.

| Code (HTTP)                      | pt-BR                                                         | Where shown                   |
| -------------------------------- | ------------------------------------------------------------- | ----------------------------- |
| `VALIDATION_FAILED` (400)        | Alguns campos são inválidos. Verifique os campos destacados.  | form banner + fields          |
| `UNAUTHENTICATED` (401)          | Sua sessão expirou. Entre novamente.                          | Sign in banner after redirect |
| `TASK_NOT_FOUND` (404)           | Esta tarefa não existe mais.                                  | error-state / toast           |
| `TEAM_NOT_FOUND` (404)           | Este time não existe mais.                                    | error-state / toast           |
| `ROUTE_NOT_FOUND` (404)          | Algo está desatualizado. Atualize o aplicativo.               | toast                         |
| `TEAM_NAME_ALREADY_EXISTS` (409) | Você já tem um time com este nome.                            | Name field                    |
| `UNKNOWN_TEAMS` (422)            | Alguns times não existem mais e foram removidos.              | Teams field                   |
| `TOO_MANY_TEAMS` (422)           | Uma tarefa pode ter até 10 times.                             | Teams field                   |
| `RATE_LIMITED` (429)             | Muitas requisições. Tente novamente em {seconds} s.           | toast / banner                |
| `INTERNAL_ERROR` (500)           | Algo deu errado do nosso lado. Tente novamente.               | error-state / toast           |
| (client) network failure         | Não foi possível conectar ao servidor. Verifique sua conexão. | error-state / toast           |
| (client) timeout                 | O servidor está demorando demais. Tente novamente.            | error-state / toast           |
| (auth) invalid credentials       | E-mail ou senha incorretos                                    | Sign in banner                |
| (auth) email already registered  | Já existe uma conta com este e-mail                           | Sign up Email field           |

Error-state titles: network "Você está offline"; generic "Não foi possível carregar"; not found "Não encontrado".
