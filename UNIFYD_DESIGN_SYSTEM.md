~# Unifyd Design System

## 1. Status and purpose

**Status:** Approved visual direction for the Unifyd PSM 2 application.

This document is binding for every user-interface implementation. It translates the supplied finance-app, clean product-site, avatar, and Unifyd logo references into an original design system. The app may take inspiration from the references, but must not copy their logos, illustrations, text, brand names, or exact screens.

## 2. Visual direction

Unifyd should feel like a **premium, calm, student-friendly personal workspace**:

- Dark-forward application interface with high-contrast neutral surfaces.
- Blue-to-cyan Unifyd gradient as the recognisable brand signal.
- Generous rounded cards, concise typography, and clear information hierarchy.
- Minimal, finance-app-style summaries with no visual clutter.
- Original black-line illustrated avatars inside soft circular backgrounds.

The design should be clean and confident, not overly playful, neon, or glassmorphism-heavy.

## 3. Brand assets

| Asset | Intended repository location | Usage |
|---|---|---|
| Unifyd logo (`icon.png`) | `assets/brand/unifyd-logo.png` | App icon, welcome screen, onboarding, loading/splash branding only |
| Design screenshots | `docs/design-references/` | Reference only; never show inside the released app |

The Unifyd icon must retain clear empty space around it. Never stretch, recolour, add effects to, or place busy content behind the logo.

## 4. Colour system

The primary colour pair is sampled from the supplied Unifyd logo.

| Token | Value | Intended use |
|---|---|---|
| `brandBlue` | `#007AFB` | Primary actions, active states, main gradient start |
| `brandCyan` | `#34C1FC` | Main gradient end, secondary accent |
| `brandGradient` | `#007AFB → #34C1FC` | Hero cards, primary highlights, selected avatar accent only |
| `background` | `#0B0B0F` | Default app background |
| `surface` | `#17171C` | Cards, sheets, grouped content |
| `surfaceElevated` | `#23232A` | Selected/raised card, input surface, modal content |
| `border` | `#2E2E37` | Subtle dividers and input outlines |
| `textPrimary` | `#F8FAFC` | Main headings and key values |
| `textSecondary` | `#98A2B3` | Supporting labels and metadata |
| `textTertiary` | `#667085` | Disabled/low-emphasis content |
| `success` | `#22C55E` | Positive balance, completed task, successful save |
| `warning` | `#F59E0B` | Budget caution or upcoming deadline |
| `danger` | `#EF4444` | Overdue, destructive action, input error |
| `white` | `#FFFFFF` | Primary action button on dark surfaces where required |
| `black` | `#000000` | Icon/line-art avatar strokes and highest contrast |

### Colour rules

- Use `brandGradient` on only one main focal element per screen, usually the summary/hero card or primary action.
- Do not use the gradient as body text, a full-page background, or on many small controls at the same time.
- Use semantic colours only for status; never rely on colour alone to convey meaning.
- Keep the interface predominantly neutral so the Unifyd gradient remains distinctive.

### Approved Dark and Light appearance

- Dark is the default saved appearance and retains the approved colours, component styling, layout, and interactions above.
- Light uses a cool off-white `screenBackground` (`#F7F8FA`). Text and icons directly on that background use accessible dark `screenText`, `mutedText`, and `pageAccent` values.
- Cards, input surfaces, selection sheets, and bottom navigation remain dark in both modes. Their current borders, light text, icons, radii, and spacing remain in place.
- The floating blue Add button and the Unifyd blue-to-cyan gradient remain unchanged in both modes.
- Use semantic theme tokens such as `screenBackground`, `screenText`, `mutedText`, `cardBackground`, `cardText`, `border`, and `navigationBackground`. System appearance follows the device setting; the user's saved choice takes precedence.
- The light reference image informs only the page/background feeling. Do not copy its branding, content, or layout.
- On Light pages, the white Edit Profile button uses a dark ink icon matching its text. The Home greeting avatar has a subtle circular outline; the Dark outline stays low contrast. These refinements do not change the avatar art, dimensions, or layout.
- Profile Sign out is a filled destructive red button with white icon and text in both appearances. Its existing size, shape, spacing, and action stay the same.
- English and Bahasa Melayu are the supported interface languages. Onboarding collects the initial choice; Settings is the central place to change it. Fixed interface copy and accessible labels use the central translation catalogue, while personal data and official UMPSA names stay as entered.
- The dark Settings card presents Appearance and Language as separate compact rows, each showing its saved value and a chevron. Tapping a row reveals radio choices below it; tapping again closes it. A successful choice saves immediately, applies immediately, and collapses the section. A failed save leaves the section open with a translated error. The card stays dark against the Light page background.
- Settings places a separate Legal card below preferences, with direct Privacy Policy and Terms of Use rows. Each page uses the existing account heading pattern, a readable dark content card, and the same Light or Dark page background. Legal information is available in English and Bahasa Melayu and describes the academic prototype without compliance claims.

## 5. Typography

Use the platform’s clear sans-serif typeface (for example Inter, if configured) with the following hierarchy:

| Style | Size / weight | Use |
|---|---|---|
| Display | 32 / 700 | Welcome greeting, key dashboard value |
| Screen title | 26 / 700 | Primary screen heading |
| Section title | 18–20 / 700 | Card and list section headings |
| Body | 15–16 / 400–500 | Descriptions, task labels, form content |
| Label | 12–13 / 500–600 | Metadata, badges, categories, helper text |
| Numeric emphasis | 24–32 / 700 | Budget, spending, balance, task count |

- Use sentence case for labels and actions.
- Keep descriptions short; prefer one strong title and one supportive line.
- Use tabular/monospaced numerals only where financial alignment is required.

## 6. Layout, spacing, and shape

Use an 8-point spacing system:

| Token | Value | Use |
|---|---:|---|
| `space1` | 4 | Tight icon/text gap |
| `space2` | 8 | Small internal gap |
| `space3` | 12 | Form/list item gap |
| `space4` | 16 | Card padding and common screen gap |
| `space5` | 20 | Section gap |
| `space6` | 24 | Main horizontal screen padding |
| `space8` | 32 | Large separation |

| Token | Value | Use |
|---|---:|---|
| `radiusSm` | 12 | Small chips, compact controls |
| `radiusMd` | 16 | Inputs, standard cards |
| `radiusLg` | 24 | Hero cards, modal sheets |
| `radiusFull` | 999 | Avatars, pills, circular actions |

- Standard horizontal screen padding: 20–24 px.
- Use one vertical scroll area per primary screen.
- Keep tap targets at least 44 × 44 px.
- Prefer cards for grouped information; avoid placing every small item in a separate card.

## 7. Core UI components

### Cards

- Default card: `surface`, 16 px radius, 16–20 px padding, subtle border or shadow.
- Hero/summary card: blue-to-cyan gradient, 20–24 px radius, white content, one focal metric.
- List card: neutral surface with clear title, secondary metadata, and a leading icon/avatar.

### Buttons

| Type | Appearance | Usage |
|---|---|---|
| Primary | White fill, near-black text, rounded 14–16 px | Main action on dark screen |
| Brand secondary | Blue/cyan gradient fill, white text | Main branded CTA where it is the screen’s focal action |
| Secondary | Transparent or dark surface with border, white text | Alternative action |
| Destructive | Red-tinted surface/text, confirmation required | Delete actions only |
| Icon button | Circular dark/elevated surface, 44 px minimum | Search, scan, settings, overflow |

### Inputs

- Use `surfaceElevated` background and 14–16 px radius.
- Show a leading icon only when it adds meaning.
- Keep labels visible above fields for longer forms.
- Invalid fields use red border plus short text explanation.

### Chips and status badges

- Use rounded pills with a clear text label.
- Financial categories use restrained tinted surfaces, not saturated blocks.
- Task priority and status use semantic colours consistently.

### Icons

- Use one icon family consistently, such as Ionicons.
- Standard size: 20–24 px; do not mix heavy filled icons with thin outline icons without purpose.
- Use outlines for inactive navigation and filled/brand treatment for active state.

## 8. Navigation and screen patterns

### Bottom navigation

Use a persistent dark bottom navigation with four destinations and a centred quick-action button inside the bar:

`Home · Wallet · [+] · Planner · Mind`

- The **+** button sits in the middle slot of the bar, not floating over page content, so it never covers cards or text. It uses `brandBlue` with a white icon and is at least 44 × 44 px.
- Tapping **+** slides up a dark **Quick actions** sheet above the bar (dimmed page behind it) and rotates the + into × (200 ms). Tapping ×, the dimmed area, another tab, or Android back closes it. The default shortcuts are **Add expense, Scan receipt, Add task, and Log mood**, shown as a 2 × 2 grid of tiles with an icon, title, and short hint.
- An **Edit** text button in the sheet header turns it into a checklist of all seven shortcuts (the four above plus Set budget, Reminders, and My semester).
  - It shows an "x of 4 selected" count and keeps between one and four shortcuts, explaining in warning colour when a fifth is refused or the last is removed.
  - It offers **Reset to default**.
  - **Done** saves the choice on the device for that account. Shortcuts always appear in catalogue order.
- **Profile** is not a bar destination. It opens from the avatar at the top of Home, which carries a small settings badge, and Profile has a back arrow to Home. This keeps two destinations on each side of the centre action.
- The active destination uses the Unifyd blue/cyan brand treatment; inactive destinations use `textTertiary`.

*Approved design change (October 2026):* the original layout had five destinations and a floating Add button above the bar. The placeholder button overlapped page content and had no function, so the centre action moved into the bar and Profile moved to the Home avatar.

### Home/dashboard

- Greeting row: selected avatar, greeting/name, and notification icon.
- One large brand-gradient overview card.
- Compact module cards for Wallet, Planner, and Mind.
- Keep the first viewport useful: current budget status, nearest deadline, and latest mood state.

### List screens

- Screen title, optional quick filter/sort control, primary list, and a helpful empty state.
- Use a clear primary action rather than hiding essential actions in menus.

### Forms and bottom sheets

- Use bottom sheets for quick creation such as expense, task, and mood log.
- Use full screen for longer editing or receipt-review flows.
- Keep a visible Save/Continue action near the bottom with enough safe-area spacing.

### Empty states

- Use a simple original outline icon/illustration, direct sentence, and one action.
- Example: “No expenses yet. Add your first expense to see your spending here.”

## 9. Avatar system

Every student has a personal visual identity through an **original illustrated avatar**, inspired by the simplicity of Notion-style avatars but not copied from Notion assets.

### MVP behaviour

- During Complete Profile, show a curated grid of at least 12 original line-art avatar options.
- Each avatar uses near-black line art on a light neutral circular background.
- The student selects one avatar; the app stores its stable `avatar_id` in the profile.
- Display the selected avatar in the Home greeting, Profile screen, settings/profile entry points, and relevant list headers.
- If no selection exists, assign a default avatar deterministically from the user ID and prompt the student to personalise it later.
- Profile settings must allow the student to change their avatar at any time.
- Do not add photo-upload avatars in the PSM 2 MVP.

### Avatar art direction

- Friendly black line drawings of diverse students; simple hair, glasses, hijab, and facial-feature variants.
- Circular white/off-white background with optional thin `brandBlue` selection ring.
- No branded characters, copied Notion art, real-person likenesses, or copyrighted avatar packs.
- Use SVG/vector assets where possible for a sharp appearance and small app size.

## 10. Screen-specific direction

### Native task reminders

- Android uses a 96×96 transparent white Unifyd mark as the small system notification icon, a separate full-colour Unifyd mark as the large icon, and `brandBlue` (`#007AFB`) where Android permits accent colour.
- Use the single `unifyd-task-reminders` Android channel with a concise translated name and description. Reminder titles and bodies stay brief and contain only the task title and due-time message.
- Android and iOS control the notification layout. iOS keeps its normal app icon and notification presentation; web does not deliver local reminders. Native icon changes require a newly installed Android build and are not represented by Expo Go.

| Module | Visual focus |
|---|---|
| Welcome/authentication | Centred Unifyd logo, confident heading, low-clutter forms, one main CTA |
| Profile onboarding | Personal greeting, avatar picker, simple progress/required-field clarity |
| Wallet | Gradient financial summary, high-contrast amount, receipt scan icon action, compact category chips |
| Budget | Simple progress/ring or bar with semantic status; never hide total spent or remaining amount |
| Planner | Date/deadline clarity, status chips, priority visible but restrained |
| Mind | Calmer neutral surfaces, mood emojis or icons, low-pressure wording, no alarming graphics |
| Insights | Three simple cards/panels: finance, academics, wellness; facts first, AI text secondary |

## 11. Design acceptance checklist

Before a screen is considered complete:

- [ ] It uses the colours, spacing, radii, typography, and components in this document.
- [ ] It has one clear primary action and does not overload the first viewport.
- [ ] It works on a narrow phone screen without clipped text or overlapping controls.
- [ ] It has loading, empty, success, and error states where applicable.
- [ ] It uses semantic status text/icons in addition to colour.
- [ ] It uses the selected avatar consistently where the user identity is shown.
- [ ] It does not copy branding or distinctive assets from the reference apps.

## 12. Mandatory prompt clause

Include this in every UI implementation prompt:

```text
Read UNIFYD_DESIGN_SYSTEM.md and inspect the approved design references before changing UI code.

The Unifyd design system is non-negotiable:
- Follow the logo-derived blue-to-cyan brand gradient, dark-forward neutral surfaces, typography, spacing, radius, and component rules.
- Reuse or extend shared components instead of creating visually unrelated UI.
- Keep the original illustrated-avatar system and selected avatar behaviour consistent.
- Do not copy logos, text, illustrations, or exact screens from reference applications.
- Before finishing, compare the implemented screen with this design system and report any intentional difference.
```

## 13. Asset implementation checklist

- [ ] Add the supplied Unifyd logo as `assets/brand/unifyd-logo.png`.
- [ ] Add original avatar SVGs under `assets/avatars/`.
- [ ] Add `avatar_id` to the `profiles` data model and profile form.
- [ ] Create shared colour, spacing, typography, radius, and component tokens.
- [ ] Create reusable Avatar, Card, Button, Input, EmptyState, and BottomNavigation components.
- [ ] Verify at least one representative screen from each module against this design system.
