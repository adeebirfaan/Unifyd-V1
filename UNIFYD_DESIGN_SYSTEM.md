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
- **Finance display numbers** use **Space Mono** (bundled, SIL Open Font License) through the shared `components/FinanceNumber.tsx`.
  - Scope: Wallet totals, budget amount, spent, remaining or over-budget amount, percentage used, daily average, category amounts, expense amounts in history and detail, the OCR-detected total, and the Home Money and Overview spending figures and category percentages.
  - Everything else keeps the system font: labels, titles, category names, buttons, dates, editable amount inputs, numbers inside sentences such as "RM 350.00 left of RM 1,500.00", and every non-finance module.
  - The font is regular weight only, with a line height of 1.25 × its size. Large values shrink to fit rather than clip.
  - **Rolling totals:** `components/AnimatedMoneyAmount.tsx` is used for the Wallet overview's primary amount (Available, Over budget, or Spent this period) and for Home's "Spent this month" on the Overview and Money cards. The all-time total no longer rolls.
    - Changed digits roll down into place like an odometer, passing through the digits in between, over 850 ms with ease-out.
    - "RM", unchanged digits, separators, the card, and the label stay still. The layout is final from the first frame, because every glyph is the same width.
    - The first roll in a session starts from RM 0.00. Later rolls start from the last value shown, and an unchanged total never replays.
    - The roll starts only when the amount can be seen. The Wallet overview is at the top, so it rolls on load; a Home card must be the front card of the deck. Until then the digits wait on the previous value. A roll that has started always finishes, then settles into one plain text run.
    - The Overview card (`replayOnShow`) rolls again from RM 0.00 each time it returns to the front of the deck. Other rolling amounts replay only when their value changes.
    - Reduced motion shows the final value at once. Screen readers hear one label, such as "All-time spent, RM 125.50".
    - Do not use it for any other amount (lists, budgets, subscriptions, split bills, inputs, OCR).

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

- The bar keeps the standard iPhone safe-area spacing: 68 px plus the full home-indicator inset (an earlier trimmed version was reverted after on-device comparison with other iPhone apps).
- The **+** is an elevated, action-focused centre FAB: a 62 px `brandBlue` circle with a 5 px ring in the page colour (a cut-out look) and a soft blue glow, rising 24 px above the bar. An empty centre slot keeps two destinations balanced on each side.
- The FAB is layered above the quick-actions sheet so its × stays visible and tappable, and the sheet's bottom padding leaves room for it.
- Tapping **+** slides up a dark **Quick actions** sheet above the bar (dimmed page behind it) and rotates the + into × (200 ms). Tapping ×, the dimmed area, another tab, or Android back closes it. The default shortcuts are **Add expense, Scan receipt, Add task, and Log mood**, shown as a 2 × 2 grid of tiles with an icon, title, and short hint.
- An **Edit** text button in the sheet header turns it into a checklist of all seven shortcuts (the four above plus Set budget, Reminders, and My semester).
  - It shows an "x of 4 selected" count and keeps between one and four shortcuts, explaining in warning colour when a fifth is refused or the last is removed.
  - It offers **Reset to default**.
  - **Done** saves the choice on the device for that account. Shortcuts always appear in catalogue order.
- **Profile** is not a bar destination. It opens from the avatar at the top of Home, which carries a small settings badge, and Profile has a back arrow to Home. This keeps two destinations on each side of the centre action.
- The active destination uses the Unifyd blue/cyan brand treatment; inactive destinations use `textTertiary`.

*Approved design change (October 2026):* the original layout had five destinations and a floating Add button above the bar. The placeholder button overlapped page content and had no function, so the centre action moved into the bar and Profile moved to the Home avatar.

### Home/dashboard

- Home is tuned to fit above the fold on a typical phone (about 844 pt tall):
  - compact top padding;
  - a 30 px logo with the wordmark `unifyd.` (with its dot);
  - the eyebrow sitting tight above the greeting;
  - a 28 px greeting always on two lines ("Good evening," then the name);
  - a 58 px avatar;
  - a tight intro line;
  - 404 px cards with a 14 px peek and tighter card padding.
  The deck's dots end above the raised FAB.
- Greeting row: time-of-day greeting with name, and the selected avatar (opens Profile).
- **Card deck:** four equal cards (404 px tall) stacked like a deck: **Overview** in front, then **Money**, **Studies**, and **Wellbeing**.
  - The next two cards peek out 14 px above the front card.
  - Move with a horizontal swipe (left = next, right = previous; native paging stops at either end), by tapping a peeking edge, or with the four dots below the deck. The front card slides away to the left while the next card is already in place. The dots are buttons with a selected state, so swiping is never the only way.
  - Only the front card is interactive or visible to screen readers. Deck text is not selectable.
- **Overview card:** the only card with the blue-to-cyan gradient, so it stays the most prominent.
  - It shows month spending with budget left and a progress bar, the next deadline, this week's mood, three summary chips (due in 7 days, overdue, check-ins), and a swipe hint.
- **Card colours:** students can recolour each module card from six dark shades: Midnight `#141B2D`, Emerald `#0F2620`, Amethyst `#221A31`, Topaz `#2B2113`, Ocean `#0D2230`, and Graphite `#1C1C22`.
  - Every shade has relative luminance below 0.15, a unit-tested rule, so none can outshine the Overview gradient. Overview is not customisable.
  - The **palette** button (beside the overview button) opens a sheet of mini-card swatches with names and a tick on the current shade. A choice applies immediately and is saved on the device per account.
  - Defaults: Money Emerald, Studies Midnight, Wellbeing Amethyst.
- **Module cards:** deep dark shades so they never compete with Overview. Each has its icon and title, a round **back to overview** button (grid icon) in the top-right corner, its figures, and an **Open …** button pinned to the bottom.
  - **Money:** spending, budget bar, expense count, budget used, and the top 3 categories with bars.
  - **Studies:** a 2 × 2 tile grid, completed in 7 days, and the next deadline.
  - **Wellbeing:** three tiles, the comparison, and the gentle low-mood notice.
- Keep the first viewport useful: budget status, nearest deadline, and latest mood are all on the Overview card.

### Wallet (Finance home)

**Insight deck (2026-10-13).** The overview, "by category", and "needs attention" cards sit in one stacked, swipeable deck directly under the header, reusing the Home `CardDeck`:
- **Interaction:** native paging, with the cards behind peeking above. Tapping a peeking edge brings that card forward.
- **Dots:** one per card, named "Finance card N of M: {name}". Screen readers use them instead of swiping.
- **Back to overview:** a compact control under the dots, shown only away from the first card.
- **Overview card:** uses the Home overview's brand gradient (`colors.brandGradient`) with white text.
  - "Close to your budget" sits on a dark pill (amber on near-black), and "Over budget" keeps its red pill, so both stay readable on blue.
- **Other cards:** "by category" and "needs attention" keep the dark card surface. "Needs attention" is included only when it has items.
- **Sizing:** the deck is as tall as its tallest card, measured from the content.
- **Single card:** with only one card (for example while the period cannot load), it is shown plainly with no dots.
- **Reduce Motion:** dots, peeks, and Back to overview switch cards without the sliding transition.
- **Returning to Wallet** keeps the deck on the same card.
- **Layout order:** quick actions follow the deck, then Recent expenses, which now starts within the first screen of a standard phone.

The numbered list below describes each card's contents.

The order is fixed and favours what a student needs first (2026-10-13 redesign):

1. **Compact header.**
   - "YOUR WALLET" and "Wallet", with a pill Weekly/Monthly switch on the right.
   - The period's date range is a secondary label underneath.
2. **Overview card** (`FinanceOverviewCard`):
   - The largest value is **Available this month/week**, the budget minus spending.
   - When over budget, it shows a red "Over budget" pill and the amount over.
   - Beside it, a usage ring with the % used written inside. Cyan is normal; amber marks ≥ 80% used, with "Close to your budget" written out; red marks over budget.
   - Budget, spent, and daily average are smaller supporting figures. The daily average appears only when the period has spending.
   - With no budget, the card shows **Spent this month/week** with "No budget set for this period." and a small "Set a budget" action.
   - The card itself never animates. Only the primary amount rolls (`AnimatedMoneyAmount`).
3. **Quick actions** (`FinanceQuickActions`):
   - Four icon tiles with short labels: **Add expense** (the brand-blue primary tile), **Scan receipt**, **Budget**, **Split bills**.
   - The Budget tile's screen-reader label says "Set budget" or "Manage budget".
   - A slim **Subscriptions** pill sits below so it stays reachable without crowding the row. Every tile is at least 44 pt.
4. **This period by category** (`SpendingBreakdownCard`):
   - A donut of every real category in the period, with the total spent in the centre.
   - The top three are listed with a colour dot, icon, name, amount, and share; any others are summarised as "+N more category · RM x".
   - Colours come from `categoryPalette` (cyan-blue family plus grey) and always sit next to a written name. Screen readers get one text summary.
   - With no spending, a short message and "Add an expense" replace the chart.
   - The donut sweeps in once per app session (700 ms ease-out) and draws complete under Reduce Motion, on later renders, and when the period changes.
5. **Needs attention** (`FinanceAttentionCard`), shown only when something is actionable:
   - At most two items, in priority order: over budget → close to budget (≥ 80%) → subscription renewals in the next 7 days → money still owed in split bills.
   - Each item is one factual sentence with an icon and chevron, opening Budget, Subscriptions, or Split bills.
   - Renewal and split-bill items carry "Tracked separately. Not included in your spending totals."
6. **Recent expenses:**
   - A preview of the **5 newest** expenses, in compact rows inside one shared card: category icon, title (one line), "category · date", and the amount on the trailing edge. Notes stay in the screen-reader label.
   - The all-time total and count sit under the heading as a quiet summary.
   - Rows are **grouped by day**, newest first. Each day has a light header with **Today**, **Yesterday**, or the date ("10 Oct 2026"), and that day's total on the trailing edge. Each day's rows sit in their own rounded card.
     - The preview still shows at most 5 rows in total, with headers only for the days those rows cover.
     - Screen readers hear one label per header, for example "Expenses for 13 October 2026, total RM 146.00".
     - In the sheet, day headers stick to the top while their day scrolls.
   - With more than 5 expenses, a secondary **View all (N)** link sits beside the heading. Its screen-reader label is "View all N expenses".
   - **View all** opens `AllExpensesSheet` over Wallet, not a new route or tab. The sheet has:
     - a near-full-height card with a drag handle. The sheet follows the finger when dragged from the handle and title area, or from the list when it is scrolled to the top. Releasing after 96 pt, or a quick downward flick, closes it; a shorter drag eases back;
     - an "All expenses" title, the "N expenses recorded" subtitle, and a 44 pt close button;
     - the complete list in the same rows.
   - The sheet covers the tab bar and the + button, so nothing blocks its rows, and it pads for the bottom safe area.
   - It follows the ShadePicker sheet pattern: it slides in, or opens with no movement under Reduce Motion.
   - Closing returns to the same Wallet scroll position. Tapping a row closes the sheet and opens that expense.

### Subscriptions

The screen is compact and easy to scan (2026-10-13 redesign):

1. **Header:**
   - back, "YOUR FINANCES", and **Subscriptions**, with a brand-blue **+ Add** pill on the right;
   - one short subtitle, "Track recurring plans and renewal dates." The long explanation and the conversion formula are no longer shown.
2. **Monthly overview:**
   - "Monthly equivalent", the amount (the existing calculation, rolling with `AnimatedMoneyAmount`), and "N active subscriptions";
   - with no active plans: "No active subscriptions" and an Add link.
3. **Needs attention:** shown only when something is overdue, renews today, or falls within the reminder window.
   - At most three rows, in priority order: overdue → today → soonest (`attentionSubscriptions`).
   - Each status is written out ("Overdue" in red, "Renews today" in amber, "In 3 days" in cyan) with an icon, never colour alone.
4. **Active subscriptions:**
   - Compact rows in one shared card: brand tile, name (one line), "Monthly · 21 Oct", a small status chip only when attention is needed, the amount on the trailing edge, and a chevron.
   - No reminder text, notes, or action buttons appear in rows.
5. **Paused (N):** a collapsed expander. Paused plans never appear in the active list.
6. **Details sheet** (`SubscriptionDetailsSheet`, drag-to-close via `useSheetDrag`, Reduce Motion aware), opened by tapping a row:
   - Contents: tile, name, amount · frequency, next billing date, status, and reminder timing (only when reminders are on).
   - Actions: a full-width **Mark as renewed** (active plans only), then Edit, Pause/Resume, and Delete.
   - Renew and delete confirm inside the sheet, with no second modal.
   - Edit opens the existing edit route. Closing keeps the list position.

**Brand tiles** (`SubscriptionBrandIcon`, rules in `lib/subscriptionBrands.ts`):
- The visual is derived from the plan name each time (case-insensitive, whole words); nothing is stored and no migration is needed. Each tile shows, in order of preference:
  1. **Local vector marks** from **Simple Icons** (open-source, CC0 vector data): Spotify, YouTube, Claude, Anthropic, Netflix, Apple Music, iCloud, Google Drive, Notion, Grammarly, Duolingo, Figma, Dropbox, Zoom.
     - `scripts/generate-brand-marks.mjs` copies only these paths into `constants/brandMarks.generated.ts`, about 13 KB, instead of bundling the 5 MB package. `simple-icons` is a dev dependency only.
     - They are drawn with `react-native-svg`.
  2. **Ionicons marks** for brands this Simple Icons version no longer carries: Google One, Microsoft 365, Amazon/Prime Video.
  3. **Original category icons** where no mark is available: ChatGPT/OpenAI (sparkles), Disney+ (film), Canva (palette), Adobe (brush), plus other music, video, AI, notes, and storage services.
  4. **A neutral initial tile** for every other name.
- Marks are monochrome in the card text colour (contrast ≥ 7:1 on the dark tile in both themes). Category icons and initials are cyan.
- All four share one size and shape and are hidden from screen readers, because the name is written beside them.
- Nothing is downloaded or loaded remotely. Marks only identify the student's own plan and imply no affiliation.

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

### Poof chat launcher (Home)

- **Design.** Poof is Unifyd's approved mascot: a bright cyan-blue fluffy cloud with dot eyes, a black smile and arm line, a raised waving arm, short legs, a black mortarboard and tassel, and a floating cyan-blue circle. The approved artwork is never redrawn, recoloured, cropped, or distorted; animation uses only movement, a small scale change, and a small tilt.
- **One Poof on Home.** Poof appears only as the chat launcher. The header has no mascot, and Home has no separate AI summary card; the chat greets the student and explains their data.
- **Placement.** Lower right, 16 pt from the edge and 20 pt above the tab bar. It stays clear of the card deck and dots, the centre quick-action button, the tab bar, and safe areas. It is absolutely positioned, so it adds no height.
- **Chat bubble.** Poof (46 pt tall) sits in a round chat bubble, a circle about 69 pt across with a short tail at the lower left, like a standard chat icon. It is drawn as one outlined SVG shape (`react-native-svg`), so the border flows unbroken from the circle into the tail. It uses semantic tokens only:
  - Dark: `poofBubble` `#E6F4FF`, a 2.5 pt `poofBubbleBorder` in brand cyan, and a soft brand-blue glow (`poofBubbleGlow`). The pale fill keeps Poof's black cap and lines visible on the dark page.
  - Light: a white `poofBubble` with a `#0057B7` border and glow, for a 3:1 boundary contrast on the light page.
- **Motion** (following the local storyboard):
  - welcome once per app session: pop in (scale 0.4 → 1 with slight overshoot), then a wave and small hop;
  - calm idle while Home is focused: about 6 pt float, 2% breathing scale, ±1.2° tilt, 3.6 s loop;
  - tap: one hop and wave while the chat opens at once; extra taps during a reaction are ignored;
  - celebrate: two happy hops.
- **Reduced motion.** Poof stays still; a tap opens the chat immediately.
- **Accessibility.** A button labelled "Chat with Poof" ("Berbual dengan Poof"), with the hint "Opens Poof, your Unifyd assistant". It works with a keyboard and screen readers.

## 9. Avatar system

Every student has a personal visual identity through an **original illustrated avatar**, inspired by the simplicity of Notion-style avatars but not copied from Notion assets.

### MVP behaviour

- **Library.** Students choose from the project's curated library of **12 local illustrations**: Turban girl, Afro guy, Gorpcore guy, Music girl, Cap guy, Everyday guy, Genius guy, Cool guy, Floral girl, Hijab girl, IT girl, and Curly guy.
  - The approved originals live in `/assets/avatars/`.
  - The app bundles 384 px copies in `mobile/assets/avatars/`, named by stable ID, with aspect ratio preserved and centred on a transparent square.
  - Avatars are never generated or downloaded.
- **Picker.** The chooser in onboarding and Edit Profile is a 3-column grid of dark tiles, each with the avatar and its translated name.
  - The selection shows a cyan tick badge, a thicker cyan ring, and a bold name, so it is never indicated by colour alone.
  - Each tile's accessible label reads "Select {name} avatar".
- **Storage and display.** The app stores only the stable ID, such as `music_girl`, in `profiles.avatar_id`. The selected avatar appears on Home and Profile.
- **Fallback.** A missing, legacy, or unknown stored value shows the default, Turban girl, until the student picks another.
- **Changing it.** Edit Profile lets the student change the avatar at any time. Photo-upload avatars are not part of the PSM 2 MVP.

### Avatar art direction

- Friendly black line drawings of diverse students; simple hair, glasses, hijab, and facial-feature variants.
- Circular white background. The whole illustration is shown (`contain`), so faces and blue details are never cropped.
- No branded characters, copied Notion art, real-person likenesses, or copyrighted avatar packs.
- Bundled PNGs are sized for on-screen use (largest display 76 pt), keeping the app small (about 1.5 MB for all 12).

## 10. Screen-specific direction

### Native task reminders

- Android uses a 96×96 transparent white Unifyd mark as the small system notification icon, a separate full-colour Unifyd mark as the large icon, and `brandBlue` (`#007AFB`) where Android permits accent colour.
- Use the single `unifyd-task-reminders` Android channel with a concise translated name and description. Reminder titles and bodies stay brief and contain only the task title and due-time message.
- Android and iOS control the notification layout. iOS keeps its normal app icon and notification presentation; web does not deliver local reminders. Native icon changes require a newly installed Android build and are not represented by Expo Go.

| Module | Visual focus |
|---|---|
| Welcome/authentication | Centred Unifyd logo, confident heading, low-clutter forms, one main CTA |
| Profile onboarding | Personal greeting, avatar picker, simple progress/required-field clarity |
| Wallet | Overview card (available amount + usage ring), compact quick-action tiles, real-data category donut, conditional attention items, compact recent-expense rows (see §8 Wallet) |
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
- [x] Add the curated avatar illustrations under `assets/avatars/` (bundled copies in `mobile/assets/avatars/`).
- [x] Add `avatar_id` to the `profiles` data model and profile form.
- [ ] Create shared colour, spacing, typography, radius, and component tokens.
- [ ] Create reusable Avatar, Card, Button, Input, EmptyState, and BottomNavigation components.
- [ ] Verify at least one representative screen from each module against this design system.
