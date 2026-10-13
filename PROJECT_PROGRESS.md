# Unifyd PSM 2 — Project Progress

> This is the single live progress record for Unifyd. Update this file at the end of every coding session and before starting a new development phase.

## Current status

| Item | Current value |
|---|---|
| Overall stage | Integrated dashboard and Groq summaries implemented locally |
| Current phase | Phase 8 - Integrated dashboard and Groq summaries |
| Current task | Physical-device checks for subscription reminders, split bills, and timetable (finance and timetable migrations applied per project owner, verified 2026-10-12) |
| Next milestone | Phase 9: evaluation, hardening, and thesis evidence |
| Product direction | AI-assisted; OCR plus Groq descriptive summaries with deterministic fallback |
| Custom ML / prediction | Not in scope |

## Approved project scope

Unifyd is an AI-assisted mobile application for Malaysian university students. It combines:

- financial tracking, budget monitoring, and editable OCR-assisted receipt entry;
- academic task management and deadline reminders;
- daily mood tracking, pattern awareness, and general non-clinical self-care suggestions; and
- an integrated dashboard with verified facts and optional Groq-generated descriptive summaries.

### Explicit exclusions

- Bank/e-wallet/payment/investment integration
- Direct UMPSA portal, LMS, timetable, or fee integration
- Custom machine-learning training or future prediction
- Clinical diagnosis, counselling, or emergency mental-health support
- Social, collaboration, or multi-user features

## Source-of-truth documents

| Document | Purpose | Status |
|---|---|---|
| `UNIFYD_PROJECT_BRIEF.md` | Project identity, scope, approved stack, rules, and phase order | Complete |
| `UNIFYD_PRD.md` | Product requirements, user stories, acceptance criteria, and evaluation scope | Complete |
| `UNIFYD_SRS.md` | Numbered functional/non-functional requirements and verification methods | Complete |
| `UNIFYD_SDD.md` | Architecture, data design, RLS, APIs, security, and integration flows | Complete |
| `UNIFYD_DEVELOPMENT_ROADMAP.md` | Controlled Phase 0–9 implementation plan and coding prompt template | Complete |
| `PROJECT_PROGRESS.md` | Live implementation status, decisions, tests, issues, and next actions | Active |

## Automated testing (Expo Web)

From `mobile/`, run `npx playwright install chromium` once, then `npm run test:e2e`. Playwright starts Expo Web and runs one worker against the development account configured only in ignored `mobile/.env.test` (`E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD`). The suite covers login validation, sign in/out, protected Profile and Edit Profile controls, collapsible appearance/language settings and immediate theme/translation changes, scrollable legal pages, manual expense create/read/update/delete, and current monthly/weekly budget summaries with period switching, category shares, and overspending.

The suite captures and restores the test profile around the run, including temporary onboarding preparation and preferences. Wallet titles use a unique run prefix; a final authenticated, user-scoped cleanup deletes only that prefix and verifies zero matching rows remain. The budget test also snapshots current weekly/monthly budget rows and restores their original amounts or removes only test-created rows. Screenshots, traces, and videos are disabled; any local Playwright artifacts and `.env.test` are ignored. Cross-user RLS isolation, duplicate-account registration, email confirmation, and native pull-to-refresh still require separate-account or device verification.

**Latest targeted local run:** 2 OCR review E2E tests passed, 0 failed, 0 skipped. They covered editable prefill, required missing fields, safe failed-save retention, the exact reviewed insert payload, and Wallet return with mocked OCR and database responses. Mobile TypeScript and Expo lint passed; Expo Web bundled through Playwright. The prior full five-test suite and its account-state cleanup remain available. A separate earlier live Expo Web request reached the local OCR server and Google Vision with a temporary synthetic receipt; the expense count stayed unchanged.

## Phase status

**Module 7, Phase 2:** The project owner reports the course-library tables are applied. The local UMPSA Student Course Catalog for academic session `2026/2027` supplied 105 Faculty of Computing degree course/campus entries covering 92 Semester 1 and 77 Semester 2 rows (169 total). The trusted SQL seed is idempotent and was applied by the project owner on 2026-10-08. The source PDF stays local and is excluded from Git and the mobile app. No credit hours are stated explicitly on the relevant pages, so all seed credit values are `NULL`. My Semester supports active-course search, owned catalogue/custom selections, edit/delete, known-credit totals, unknown-credit notice, and a non-blocking warning above 19. Add/Edit Task offers selected subjects as shortcuts while preserving editable plain-text task subjects. This is planning convenience, not UMPSA registration; timetable sections, conflicts, prerequisites, and official processes remain future work.

**Phase 2 verification:** Every seed row was checked programmatically against text extracted from PDF pages 393–434 (code, name, campus, semester, page). Mobile TypeScript and Expo lint pass; `npm run web` served `/my-semester` with HTTP 200. Authenticated Expo Web E2E: 3 passed, 0 failed (`e2e/semester.spec.ts` ×2 and `e2e/planner.spec.ts`). The catalogue test intercepts catalogue reads and student-selection writes because the seed is not yet applied. It covers code/name search, semester filtering, the exact non-custom insert snapshot, and duplicate refusal from both the visible list and the owned database check. The live test covers custom validation and insert, known-credit sums, the unknown-credit notice, the non-blocking warning above 19, owner-filtered PATCH/DELETE, Task form shortcuts, prefill, manual subject typing, and an unchanged task subject after its semester subject was deleted. Cleanup confirmed zero remaining test rows. Live catalogue selection after the seed is applied, second-account RLS isolation, and native-device layout/pull-to-refresh remain manual checks.

**Module 7, Phase 1:** One local migration defines active, authenticated read-only `catalog_courses` and owner-only `student_semester_courses`. Named checks protect required labels, semester values, optional positive credit hours, and the custom-versus-linked subject rule; nullable-campus uniqueness prevents duplicate reference rows. A catalogue deletion detaches affected student choices into custom snapshots instead of losing them. The student index supports one session/semester list; private security-invoker triggers maintain both `updated_at` fields. No catalogue records were imported, no UI changed, and no SQL was executed. This reference does not replace UMPSA/faculty registration; availability, sections, capacity, and final registration stay with UMPSA. Later work may add catalogue/custom selection, offerings, timetable sections, conflict and prerequisite checks, and a configurable credit-load warning that does not block saving.

**Phase 1 verification:** Static inspection confirmed both tables, the active-only catalogue policy, four owner-only student policies, narrow grants, the nullable-campus unique constraint, student-list index, detach trigger, and private timestamp triggers. `psql` is not installed locally, so the SQL was not executed or validated against a live PostgreSQL instance. Mobile TypeScript and Expo lint passed; `npm run web -- --port 19028` bundled and served HTTP 200. No mobile code changed.

**Module 6, Phase 3:** Mind now offers a default 7-day and optional 30-day private trend view. An owner-scoped, bounded, paged Supabase query reads only mood, stress, and timestamps for the current and previous equal-length periods. The summary averages every check-in; the lightweight accessible daily visual averages same-day entries and leaves missing days blank. Neutral higher/lower/similar comparison appears only with at least two entries in both periods (similar means under 0.25 points difference). A separate dark card shows no more than two deterministic general ideas from the latest saved mood/stress levels, or generic ideas without history, plus a non-professional-advice statement. Notes are excluded from trends and ideas. No AI, diagnosis, prediction, notifications, or schema change was added.

**Phase 3 verification:** Six pure trend/rule tests pass for missing data, one entry, same-day averaging, local 7/30-day bounds, previous-period threshold, and suggestion branches. The focused authenticated Expo Web Mind suite passes 2/2: existing live check-in CRUD with cleanup, plus intercepted historical trend cases that verify the bounded owner-filtered query, no-data/single/multiple states, blank days, comparison, period switching, note exclusion, and latest-level ideas. Physical-device presentation and a second-account RLS test remain for manual verification.

**Module 6, Phase 2:** The project owner reports the mood migration was applied. The protected Mind tab now supports required 1–5 self-reported mood and stress choices, an optional trimmed private note, safe save errors, and a ten-entry newest-first owner-scoped history with localised time. Saving clears the form and refreshes history; deleting requires confirmation and refreshes history. Loading, empty, error/retry, pull-to-refresh, English/Bahasa Melayu strings, and approved Dark/Light token styling are included. An authenticated E2E test uses unique test entries and cleans them up. No AI, charts, predictions, diagnosis, or notifications were added.

**Phase 2 verification:** Mobile TypeScript and Expo lint pass; `npm run web` bundled and served HTTP 200. The focused authenticated Playwright Mind test passed (1/1), covering required fields, a preserved form after a simulated save failure, a trimmed-note insert, a null-note insert, newest-first history, cancel without a DELETE request, a safe simulated delete failure, confirmed deletion, and cleanup of unique test rows. Physical-device layout, touch, keyboard, and pull-to-refresh remain for manual verification.

**Module 6, Phase 1:** Created one reviewable, unexecuted `public.mood_entries` migration for private, self-reported 1–5 mood and stress check-ins with an optional nonblank note. Multiple check-ins per day are allowed. The table uses Auth ownership with cascade deletion, owner-only RLS, narrow column grants, a newest-first owner index, and a private server-managed `updated_at` trigger. Mind UI, charts, AI insights, and self-care suggestions remain future phases. The scales are not clinical measurements or diagnoses.

**Phase 1 verification:** Static SQL checks confirmed table creation, RLS, four owner policies, the recent-history index, private trigger settings, and the absence of a per-day uniqueness rule. `psql` is not available locally, so SQL was not parsed against PostgreSQL or executed. Mobile TypeScript and Expo lint pass; `npm run web` bundled and served HTTP 200. No Supabase migration was run.

**Task reminder native branding:** Derived a transparent 96×96 all-white small icon and a separate full-colour large icon from the existing Unifyd logo. Expo Notifications config now sets the small icon, `brandBlue` accent, and `unifyd-task-reminders` default channel. A local Android config plugin supplies the large drawable through native manifest metadata because the installed Expo Notifications plugin has no `largeIcon` option. The reminder service uses the same channel ID with translated channel text, high normal-reminder importance, short vibration, blue light colour, and concise translated content. Existing task scheduling and data ownership remain unchanged. A fresh Android native build is required to assess tray branding; Expo Go does not show build-time icon changes.

**Branding verification:** The generated small icon is exactly 96×96 PNG with transparency and white-only visible pixels; the large icon is a square 256×256 PNG. Expo config introspection resolves the small-icon, colour, default-channel, and large-icon manifest entries. Mobile TypeScript, Expo lint, four reminder calculation tests, and Expo Web bundling/HTTP 200 pass. No physical Android device is attached to this development machine, so `npx expo run:android` installation and notification-tray inspection remain pending.

**Module 5, Phase 3:** Added a reviewable, unexecuted additive migration for `tasks.reminder_offset_minutes` with a 0/60/1440-minute constraint and narrow authenticated INSERT/UPDATE grants. The Task form offers None, at deadline, one hour before, and one day before. Expo Notifications schedules one local reminder per owned active task with a future fire time. The app reconciles on startup/foreground and after task changes, removes stale reminders, clears task reminders on sign-out, and handles a notification tap by opening the matching owned task. Permission denial keeps task saves intact and shows a translated warning; Expo Web can save the preference but does not deliver local notifications. No server-side reminder service or notification history was added.

**Phase 3 verification:** Four local reminder calculation tests pass; mobile TypeScript and Expo lint pass; Expo Web bundles and serves HTTP 200. Native scheduling, permission prompts, notification taps, and multi-device reconciliation cannot be verified in Expo Web. No SQL was executed remotely. The new reminder selector requires the reviewed migration to be applied before a non-None offset can be saved.

**Module 5, Phase 2:** The project owner reports the task migration was applied. Planner now loads only owned tasks, supports pull-to-refresh, orders active tasks by status and deadline, and places recently completed tasks last. Add, Detail, and Edit routes support task creation, viewing, editing, completion, reopening, and confirmed deletion. The form validates required fields and local deadline date/time; it keeps entered data after a failed save. English and Bahasa Melayu labels, loading/error/empty states, and semantic dark-card styling are included. No reminder, notification, or unrelated module was changed.

**Phase 2 verification:** Mobile TypeScript and Expo lint pass; Expo Web bundled and served HTTP 200. Local task ordering, overdue rules, and deadline validation assertions pass. A focused authenticated Playwright Planner test was added, but a bounded 60-second run ended with 0 executed tests and no diagnosis from the runner; live CRUD, cross-user RLS, and native-device interaction remain to be verified.

| Phase | Status | Summary | Evidence / notes |
|---:|---|---|---|
| 0. Project baseline and environment audit | In progress | Documentation prepared; source-code audit has not started | Need repository location and local run result |
| 1. Supabase foundation, authentication, profile, and RLS | In progress | Client, auth screens, profile gate, and onboarding implemented | Live Auth and database flow still needs testing |
| 2. Financial tracking | In progress | Applied expense table (per project owner), manual creation, Wallet total/history, detail, edit, and confirmed delete | User reports a saved real expense; live mutation and cross-user checks pending account access |
| 3. Budget and spending analysis | In progress | Applied budget table (per project owner), Set / Manage Budget, and current-period spending summary | Authenticated Expo Web budget test passed; native and cross-user checks remain |
| 4. Academic task management | In progress | Applied task table per project owner; Planner CRUD implemented locally | Authenticated CRUD and cross-user verification pending |
| 5. Reminder notifications | In progress | Per-task offset migration applied (verified 2026-10-09); local Expo scheduling and reminder history implemented | Native-device delivery tests pending |
| 6. Mood tracking and wellness rules | In progress | Applied mood table (per project owner); private check-ins, history, 7/30-day trends, and local ideas implemented | Authenticated tests and physical-device review pending for Phase 3 |
| 7. Receipt OCR | Complete per project owner | Protected backend, mobile capture, editable OCR review, and explicit expense save | No OCR retest in this task; prior grant and live-save status were not independently rechecked |
| 8. Integrated dashboard and Groq summaries | In progress | Home facts panels, authenticated insights endpoint, Groq summary with validation and fallback | Live Groq English/Malay summaries verified locally; phone review pending |
| 9. Evaluation, hardening, and thesis evidence | Not started | Depends on all core phases | — |

## Current phase checklist — Phase 0

- [ ] Locate and inspect the existing Unifyd project repository.
- [ ] Record the current folder structure, routes, screens, dependencies, and mock-data locations.
- [ ] Run the app with the approved Expo command.
- [ ] Confirm the actual Expo SDK, Expo Router, React Native, and TypeScript/JavaScript versions.
- [ ] Confirm that `/(tabs)` is preserved and identify public/protected routes.
- [ ] Record existing working screens, known bugs, and unfinished integration stubs.
- [ ] Create safe environment-variable templates without adding real secrets.
- [ ] Verify the app still launches after any Phase 0 documentation/configuration-only changes.

## Completed work log

### 2026-10-13 — Phase 9: offline receipt OCR evaluation tooling

**Requirements implemented:**
- Phase 9 evidence: OCR accuracy evaluation (RISK-002). No app behaviour changed.

**Changed files:**
- New: `server/src/receipt-eval.ts`, `server/src/receipt-eval.test.ts`, `server/scripts/receipt-ocr-cache.ts`, `server/scripts/receipt-eval.ts`, `server/scripts/receipt-labels.template.csv`.
- Edited: `server/package.json` (`eval:receipts:ocr`, `eval:receipts`), `server/README.md`, and this file.

**What changed:**
- `eval:receipts:ocr` sends each image in `server/local-data/receipt-eval/images/` to Google Vision once (same `documentTextDetection` call as the endpoint) and caches text and word boxes locally. Images, OCR text, and labels stay in the Git-ignored `local-data/`.
- `eval:receipts` re-scores `parseReceiptText` offline against `labels.csv`: merchant, date, and total accuracy, all-three-correct rate, and breakdowns by type (`chain_retail`, `food_beverage`, `local_shop`, `handwritten`, `digital`, `other`) and condition (`clean`, `hard`). Each wrong field is `flagged` (review warning shown) or `silent`.
- About 20% of receipts form a held-out test split chosen by a hash of the file name; its results are shown only with `--final`.
- Target set: 100 real receipts, labelled by hand, before any parser change.

**Tests performed:**
- Server unit tests 72/72 (6 new: CSV parsing and validation, merchant matching, outcomes, summary, split stability). Typecheck and build pass; the scripts typecheck under the same strict options.
- A dry run with 8 fictional OCR texts produced the expected table and wrong-field list; the fictional files were deleted. No Vision call was made.
- An earlier probe of the current parser with fictional texts showed six known weaknesses: "Total Qty" and "Total Savings" lines taken as the total, totals in a separate column not found, month-name dates ("12 Oct 2026", "12 OKT 2026") not read, a promo date chosen over the purchase date, and "WELCOME TO" taken as the merchant.

**Issues or decisions:**
- The baseline must be measured on real receipts before the parser is changed, so the thesis can report before and after on the same set.

**Next action:**
- Collect and label 100 receipts, run `npm run eval:receipts:ocr` and `npm run eval:receipts`, and record the baseline here.

### 2026-10-13 — Wallet: insight cards in the Home-style card deck

**What changed:** presentation only. Card contents, calculations, attention rules, routes, quick actions, recent expenses, View all, and Subscriptions are unchanged.
- The overview, by-category, and needs-attention cards now form one deck under the Wallet header (`components/wallet/FinanceDeck.tsx`). It reuses the Home `CardDeck`: native paging, peeking cards that come forward when tapped, dots, and the same stack proportions.
  - Order: overview first and selected; by category second (with a small loading state while the period reloads, so the deck keeps its place); needs attention only when it has items.
  - With a single card (period error), the card is shown plainly with no dots.
- **Overview card:** sits on the Home overview's `colors.brandGradient` with white text, and the ring track is translucent white. "Close to your budget" is amber on a dark pill, and "Over budget" keeps its red pill. The other cards keep the dark surface.
- **`CardDeck` gained optional props:** `height`, `testID` (card IDs `${testID}-card-${key}`), `dotLabel` ("Finance card N of M: {name}"), and `backToFirstLabel` (compact "Back to overview" under the dots, shown only away from the first card). The defaults keep Home's behaviour and test IDs.
- **Shared fixes**, which affect Home too:
  1. Under Reduce Motion, dot, peek, and back moves are instant.
  2. When the deck's scroller re-mounts after its screen was hidden, it is re-aligned to the front card. On the web the deck had shown the old card while the scroller sat at the start, which made "Back to overview" appear to do nothing. This uses `useEffectEvent`, so swiping never triggers it.
- The deck replaces the three stacked cards, so Recent expenses now begins within the first screen on 390 × 844.
- New i18n (English and Malay): `wallet.deckOverview`, `deckCategories`, `deckAttention`, `deckDot`, `deckBack`.

**Changed files:**
- New: `mobile/components/wallet/FinanceDeck.tsx`.
- Edited: `mobile/components/home/CardDeck.tsx`, `mobile/components/wallet/FinanceOverviewCard.tsx`, `SpendingBreakdownCard.tsx`, `FinanceAttentionCard.tsx` (`embedded` modes), `mobile/app/(tabs)/wallet.tsx`, `mobile/constants/i18n.ts`, `mobile/e2e/walletHome.spec.ts`.
- Docs: `UNIFYD_DESIGN_SYSTEM.md` (§8 Wallet), `UNIFYD_SDD.md`, `CLAUDE.md`, and this file.

**Tests performed:**
- Typecheck and lint pass. Unit tests 90/90.
- E2E `walletHome.spec.ts` 15/15 (2 new, 4 updated), covering:
  - the deck order and named dots (3 with attention, 2 without);
  - Recent expenses above the tab bar on the first screen;
  - swiping, with no movement past either end;
  - a peeking edge coming forward, and Back to overview appearing only off the first card;
  - Back to overview returning to the first card;
  - controls on the category and attention cards still navigating, and the deck keeping its place after returning from Add expense;
  - a single card shown plainly;
  - Light mode with the gradient (#007AFB → #34C1FC) and white figures, while the other cards stay dark.
- Home `home.spec.ts` and the Wallet roll spec pass unchanged. Full Expo Web suite: 66/66.
- Screenshots of the overview front, the second card with Back to overview, and the near-budget state were checked.

**Issues or decisions:** cards behind the front card are hidden from screen readers (as on Home), so the named dots are their accessible alternative; a peek label was tried and removed.

**Next action:** On a phone, swipe the Wallet deck, tap a peeking card, and check the blue overview in Dark and Light.

### 2026-10-13 — Subscriptions: local Simple Icons brand marks

**What changed:** brand visuals only. The Subscription UI layout, data, calculations, renewal, CRUD, and navigation are unchanged.
- **Package:** `simple-icons@^16.35.0` (CC0-1.0) added as a **dev dependency**, at the owner's request. `react-native-svg` was already installed.
  - The package's single entry point is about 5 MB of JavaScript, which Metro would bundle whole.
  - Instead, `scripts/generate-brand-marks.mjs` copies the 14 needed paths into `constants/brandMarks.generated.ts` (about 13 KB). A unit test checks that file against the installed package.
- `lib/subscriptionBrands.ts` holds the one typed mapping: case-insensitive, accent- and punctuation-tolerant, whole-word aliases, with "Drive" alone mapping to Google Drive and `subscriptionBrandKey()` added. In order of preference:
  1. a Simple Icons mark;
  2. an Ionicons mark for brands this version no longer carries (Google One, Microsoft, Amazon);
  3. an original category icon (OpenAI/ChatGPT, Disney+, Canva, Adobe, and others);
  4. a neutral initial.
- `SubscriptionBrandIcon` draws marks with `react-native-svg` in the card text colour, in the same tile as before. It is decorative and hidden from screen readers, does not animate, and makes no network requests.
- **Not available in simple-icons 16.35.0:** OpenAI/ChatGPT, Disney+, Google One, Canva, Adobe, Microsoft/Office, Amazon/Prime Video. These use the fallbacks above. Nothing was traced, drawn, or downloaded.

**Changed files:**
- New: `mobile/scripts/generate-brand-marks.mjs`, `mobile/constants/brandMarks.generated.ts`.
- Edited: `mobile/lib/subscriptionBrands.ts`, `mobile/components/finance/SubscriptionBrandIcon.tsx`, `mobile/tests/subscriptionBrands.test.mjs`, `mobile/e2e/subscriptions.spec.ts`, `mobile/package.json`, `mobile/package-lock.json`.
- Docs: `UNIFYD_DESIGN_SYSTEM.md` (§8 Subscriptions), `UNIFYD_SDD.md`, `CLAUDE.md`, and this file.

**Tests performed:**
- Typecheck and lint pass. Unit tests 90/90. The brand suite has 8 tests, covering:
  - every required name and alias;
  - the mark, Ionicons, and category split;
  - case and spacing tolerance with whole-word safety ("Spotifyish", "Test drive lessons");
  - stable initials, including for an empty name;
  - the input record left unchanged;
  - bundled paths equal to the installed package, with the version recorded;
  - no URL, `simple-icons` import, image, or fetch in the component or generated file, and `simple-icons` as a dev dependency only;
  - contrast ≥ 7:1 for marks and ≥ 4.5:1 for cyan icons in both themes.
- E2E `subscriptions.spec.ts` 5/5, with YouTube, Spotify, and Notion marks asserted.
- A screenshot of 12 mixed plans showed no external network requests.
- Full Expo Web suite: 64/64.

**Next action:** On a phone, check that the marks render crisply in Dark and Light.

### 2026-10-13 — Subscriptions: compact, scannable redesign

**What changed:** presentation only. Queries, the monthly-equivalent calculation, renewal advance, reminder rules, CRUD, routes, and user isolation are unchanged. There is no migration, API, or new dependency.
- **Header:** "Subscriptions", a brand-blue + Add pill, and one short subtitle. The long explanation and the conversion formula were removed.
- **Monthly overview:** "Monthly equivalent" (rolling amount), "N active subscriptions", or "No active subscriptions" with an Add link.
- **Needs attention:**
  - Shown only for real overdue, today, or soon renewals, at most 3, in priority order, via the new pure `attentionSubscriptions` in `lib/subscriptions.ts`.
  - Compact rows with written status ("Overdue" / "Renews today" / "In 3 days") and icons.
- **Active list:**
  - Compact rows in one card (`SubscriptionListItem`): tile, one-line name, "Monthly · 21 Oct", a status chip only when attention is needed, the amount, and a chevron.
  - Paused plans sit behind a collapsed "Paused (N)" expander.
- **Details sheet** (`SubscriptionDetailsSheet`), opened from a row:
  - Shows amount · frequency, next billing date, status, and reminder timing (only when reminders are on).
  - Actions: full-width Mark as renewed, then Edit, Pause/Resume, Delete. Renew and delete confirm inside the sheet, because iOS can refuse a second modal while one is closing.
  - Edit uses the existing route. The in-sheet delete is owner-filtered and cancels the plan's reminder.
- **Brand tiles** (`SubscriptionBrandIcon`, `lib/subscriptionBrands.ts`):
  - Bundled Ionicons marks only (YouTube, Apple, Google, Microsoft, Amazon).
  - Original category icons for Spotify, Netflix, Disney+, ChatGPT, Claude, Canva, Notion, Adobe, and others.
  - A neutral initial for every other name.
  - Derived from the name, never stored, never fetched.
- **Drag-to-close** now lives in the shared `hooks/useSheetDrag.ts`, also used by the Wallet "All expenses" sheet; its behaviour is unchanged.
- Removed the unused `components/finance/SubscriptionCard.tsx`. Added 17 `subscription.*` keys in English and Malay.

**Changed files:**
- New: `mobile/lib/subscriptionBrands.ts`, `mobile/hooks/useSheetDrag.ts`, `mobile/components/finance/SubscriptionBrandIcon.tsx`, `SubscriptionListItem.tsx`, `SubscriptionDetailsSheet.tsx`, `mobile/tests/subscriptionBrands.test.mjs`.
- Edited: `mobile/app/subscriptions.tsx`, `mobile/lib/subscriptions.ts`, `mobile/lib/expenseHistory.ts` (`formatDayMonth`), `mobile/components/wallet/AllExpensesSheet.tsx`, `mobile/constants/i18n.ts`, `mobile/tests/subscriptions.test.mjs`, `mobile/e2e/subscriptions.spec.ts`.
- Removed: `mobile/components/finance/SubscriptionCard.tsx`.
- Docs: `UNIFYD_DESIGN_SYSTEM.md` (§8 Subscriptions), `UNIFYD_SDD.md` (§7.8), `CLAUDE.md`, and this file.

**Tests performed:**
- Typecheck and lint pass. Unit tests 86/86 (5 new), covering:
  - attention priority and the limit of 3;
  - brand marks, category fallbacks, initials, and whole-word matching;
  - every icon name existing in the local Ionicons glyph map.
- E2E `subscriptions.spec.ts` 5/5 (1 new, 2 updated), covering:
  - the compact summary with the existing calculation, and no formula text;
  - attention order and limit;
  - one compact row per plan, with paused plans separate and collapsed;
  - logo, category, and initial tiles;
  - a long name fitting at 320 px;
  - the sheet under Reduce Motion;
  - renew, pause, resume, and edit through the sheet, plus in-sheet delete with confirmation.
- Full Expo Web suite: 64/64.
- Screenshots of the list and the sheet were checked; the renew label overflow found there was fixed.
- **Test note:** this spec freezes the browser clock, which also freezes animations, so it now runs with Reduce Motion; real devices are unaffected.

**Issues or decisions:** a plan that needs attention appears both under Needs attention and in the full Active list, so the list stays complete.

**Next action:** On a phone, check the list, the sheet actions, drag-to-close, and the brand tiles in Dark, Light, and Malay.

### 2026-10-13 — Wallet: recent expenses grouped by day

**What changed:** presentation only. Queries, stored dates, ordering, totals, the 5-row limit, View all, and sheet behaviour are unchanged.
- `mobile/lib/expenseGroups.ts` (pure, tested):
  - `groupExpensesByDate` groups by the stored `expense_date`. It is a local calendar date with no time, so one day is never split.
  - Groups are newest date first, rows keep the history order, and totals are integer cents per day. Loaded pages merge into one group per date, so no date repeats and no header is ever empty.
  - `relativeDay` gives Today or Yesterday from the device's local date.
- `mobile/components/wallet/ExpenseDateHeader.tsx`: a light sentence-case header with Today, Yesterday, or the date ("10 Oct 2026") and the day's total in the finance number style. Its accessible label reads "Expenses for 13 October 2026, total RM 146.00" (Malay: "Perbelanjaan pada …, jumlah …").
- **Wallet preview** (`SectionList`, non-sticky): still at most 5 rows in total, with headers only for the days those rows cover.
- **All expenses sheet** (`SectionList`): every day, with native sticky headers on the sheet background.
- Each day's rows sit in their own rounded card. Rows keep their information, label, and tap behaviour.
- New i18n: `wallet.today`, `wallet.yesterday`, `wallet.dayGroupA11y`, in English and Malay. New `formatExpenseDateLong` for screen-reader dates.

**Changed files:** `mobile/lib/expenseGroups.ts`, `mobile/components/wallet/ExpenseDateHeader.tsx`, `mobile/tests/expenseGroups.test.mjs` (all new); `mobile/app/(tabs)/wallet.tsx`, `mobile/components/wallet/AllExpensesSheet.tsx`, `mobile/lib/expenseHistory.ts`, `mobile/constants/i18n.ts`, `mobile/e2e/walletHome.spec.ts`; `UNIFYD_DESIGN_SYSTEM.md` (§8 Wallet), `UNIFYD_SDD.md`, `CLAUDE.md`, and this file.

**Tests performed:**
- Typecheck and lint pass. Unit tests 81/81 (6 new), covering:
  - same-date grouping and newest-first order;
  - exact cent totals;
  - pages merged without duplicate dates;
  - a five-row preview across two days;
  - Today/Yesterday across a month boundary;
  - English and Malay labels.
- E2E `walletHome.spec.ts` 11/11 (1 new), covering:
  - a preview of 5 rows with only Today and Yesterday headers, correct totals, the accessible label, and header order;
  - "View all (7)" opening a sheet with three days, each once, with totals;
  - the formatted older date, and a sheet row still opening its detail.
- Full Expo Web suite: 63/63.
- Screenshots of the grouped preview and sheet were checked.

**Issues or decisions:**
- Rows still show "category · date" inside a dated group, because the brief asked to keep each row's existing information. It could be shortened later.
- The row accessible label keeps its existing wording ("Open details for …"), so existing tests and behaviour are unchanged.
- Malay layout is verified by unit tests, not by E2E.

**Next action:** On a phone, check the grouped preview and sheet (sticky headers while scrolling) in Dark, Light, and Malay.

### 2026-10-13 — Wallet history sheet: reopening after a drag-close

**What changed:**
- The owner found that after closing the "All expenses" sheet by dragging, tapping "View all" again showed only the dimmed backdrop. The sheet stayed off-screen until it was dismissed and opened once more.
- Cause: after a drag-close, the sheet's translate value had been driven to the bottom by a native-driver animation. When the hidden modal unmounted, the reset on reopening could be lost on the phone.
- Fix in `AllExpensesSheet.tsx`:
  - every opening creates a new `Animated.Value(0)` and remounts the sheet (`key={opening}`), so no state from the previous close carries over;
  - a drag past the threshold now calls `onClose()` immediately, and the modal's own slide-out carries the sheet down from where the finger left it, so closing never depends on an animation callback.

**Changed files:** `mobile/components/wallet/AllExpensesSheet.tsx`, `mobile/e2e/walletHome.spec.ts`, and this file.

**Tests performed:**
- Typecheck and lint pass. E2E `walletHome` + `unifyd`: 16/16.
- The touch-drag test now also checks that the sheet reopens fully up after a handle drag-close and after a list drag-close.
- Web does not use the native driver, so the original phone bug could not be reproduced here. The fix removes the cause on both platforms.
- Not yet checked: the owner's phone.

**Next action:** On the phone, drag-close the sheet, tap "View all" again, and confirm it opens fully. Repeat a few times, including after closing with ×.

### 2026-10-13 — Wallet history sheet: drag-to-close fixed

**What changed:**
- The owner reported that dragging did not close the "All expenses" sheet on the phone; only the × worked. The old handler only reacted to a move inside the small handle strip, ignored touches that started there, and gave no visual feedback.
- `AllExpensesSheet` now moves the sheet with the finger (`Animated` translateY).
  - The handle and title area claim the touch immediately; the × button still receives its own taps.
  - The list hands a clearly downward drag to the sheet only when it is scrolled to the top, so normal scrolling is unaffected.
  - Release after 96 pt, or a downward flick (> 24 pt at > 1 pt/ms), animates the sheet out and closes it. Otherwise it eases back in 160 ms.
  - Under Reduce Motion it still follows the finger, then closes or resets without animation. Each opening starts fully up.
- An `Animated.spring` for the settle-back froze React Native Web's event loop in testing, so a timed ease-out is used instead.

**Changed files:** `mobile/components/wallet/AllExpensesSheet.tsx`, `mobile/e2e/walletHome.spec.ts`, `UNIFYD_DESIGN_SYSTEM.md` (§8 Wallet), and this file.

**Tests performed:**
- Typecheck and lint pass.
- E2E `walletHome` + `unifyd`: 16/16. The new drag test uses real touch events (DevTools `Input.dispatchTouchEvent`, touch-enabled mobile context). It checks:
  - the sheet follows the finger, and a slow 60 pt drag settles back;
  - a 240 pt drag on the handle closes it;
  - a 240 pt drag on the list at the top closes it without opening the row;
  - × still closes it.
- A mouse cannot reproduce phone drags reliably on React Native Web: repeated mouse drags were dropped, and releasing over a row clicked it. That is why the test uses touch.
- Not yet checked: the owner's phone.

**Next action:** On the phone, drag the sheet down from the title, and from the top of the list, then try a short drag that should spring back.

### 2026-10-13 — Wallet: recent-expenses preview and full-history sheet

**What changed:** presentation only. The expense query, ordering, totals, CRUD, routes, budgets, subscriptions, split bills, and category suggestion are unchanged.
- Wallet home now shows only the **5 newest** expenses. The all-time total and count stay under the "Recent expenses" heading.
- With more than 5 expenses, a secondary **View all (N)** link (live count; screen-reader label "View all N expenses", with a hint) opens `components/wallet/AllExpensesSheet.tsx` over Wallet, with no new route or tab. The sheet has:
  - a drag handle (a downward drag closes it), an "All expenses" title, an "N expenses recorded" subtitle, and a 44 pt close button;
  - the complete list in the same `ExpenseHistoryRow` rows, reusing the rows Wallet already loaded, so there is no second query;
  - bottom safe-area padding, and Android back / Escape to close.
- It follows the ShadePicker Modal pattern: it slides in, or opens with no movement under Reduce Motion. Its local state keeps the Wallet scroll position. Tapping a row closes the sheet and opens that expense.
- No search or filter was added, because none existed before. With 5 or fewer expenses there is no "View all".
- i18n: `wallet.viewAll`, `viewAllA11y`, `viewAllHint`, `allExpenses`, `closeHistory`, in English and Malay.

**Changed files:** `mobile/components/wallet/AllExpensesSheet.tsx` (new), `mobile/app/(tabs)/wallet.tsx`, `mobile/constants/i18n.ts`, `mobile/e2e/walletHome.spec.ts`, `UNIFYD_DESIGN_SYSTEM.md` (§8 Wallet), `UNIFYD_SDD.md`, `CLAUDE.md`, and this file.

**Tests performed:**
- Typecheck and lint pass. Unit tests 75/75.
- E2E `walletHome.spec.ts` 9/9 (2 new, 2 extended), covering:
  - 4 expenses shown in full with no View all, and the empty state with no View all;
  - 8 expenses with 5 shown newest first and "View all (8)" plus its label;
  - the sheet holding all 8 rows with the URL unchanged and a close button;
  - closing restoring the exact scroll position;
  - a sheet row opening its detail and closing the sheet;
  - Reduce Motion with no sliding, the last row clearing the bottom on a 320 × 640 screen, and Escape closing.
- Full Expo Web suite: 61/61.
- Screenshots of the preview header and the open sheet were checked.

**Issues or decisions:** dragging works only on the handle area, so it doesn't fight the list's own scrolling. The sheet does not follow the finger while dragging; it closes once released.

**Next action:** On a phone, open View all, scroll, close by button, by drag, and by Android back, and check that the Wallet position is kept.

### 2026-10-13 — Wallet home: information hierarchy and interaction polish

**What changed:** presentation only. No query, calculation, route, migration, API, or AI was added or changed.
- **New order:**
  - compact header (title, pill Weekly/Monthly switch, secondary date range);
  - `FinanceOverviewCard`;
  - `FinanceQuickActions`;
  - `SpendingBreakdownCard`;
  - `FinanceAttentionCard` (only when actionable);
  - compact Recent expenses.
- **Overview:**
  - "Available this month/week" is the largest value and rolls with the existing `AnimatedMoneyAmount`.
  - A usage ring has the percentage written inside: cyan normal, amber ≥ 80% with "Close to your budget", red over budget with an "Over budget" pill.
  - Budget, spent, and daily average are smaller supporting figures; the daily average shows only when there is spending.
  - With no budget: "Spent this month", "No budget set for this period.", and a small "Set a budget" action.
- **Quick actions:**
  - Four tiles: Add expense (primary), Scan receipt, Budget (screen-reader label "Set budget" / "Manage budget"), Split bills.
  - A slim Subscriptions pill sits below.
  - These replace the old full-width Manage budget / Add expense buttons and the "Plans and shared costs" card.
- **Breakdown:**
  - A real-data donut with the total spent in the centre; the top three categories with amount and share; "+N more category · RM x" for the rest.
  - One screen-reader summary. Colours come from `categoryPalette` (cyan-blue family plus grey) and always sit next to names.
  - Empty states keep the existing hints ("Your full budget is available…", "No expenses in this period yet. Older expenses are not included.") plus "Add an expense".
  - The donut sweeps in once per app session; Reduce Motion draws it complete.
- **Attention:**
  - At most two items, in priority order: over → near (≥ 80%) → renewals within 7 days → split-bill amount owed.
  - Each opens Budget, Subscriptions, or Split bills; renewal and owed items carry the "tracked separately" note.
  - The card is omitted when there is nothing to act on.
- **Recent expenses:**
  - Compact rows in one shared card: icon, one-line title, "category · date", and the amount on the trailing edge. Notes stay in the screen-reader label.
  - The all-time total and count sit beside the heading (no longer animated).
  - No "View all", because the list is already the full history.
- **Composition** lives in `lib/walletOverview.ts` (pure, tested). `hooks/useFinancePlans.ts` loads renewals and amounts owed (moved from the removed `FinanceSummaryCard`). New tokens: `cardWarningText` (both themes) and `categoryPalette`.
- **Existing test IDs are kept:** `budget-summary`, `budget-amount`, `budget-spent`, `budget-remaining` / `budget-overspent`, `budget-used`, `budget-daily-average`, `budget-category-*`. `budget-status` now marks the over/near pill.

**Changed files:**
- New: `mobile/components/wallet/FinanceOverviewCard.tsx`, `FinanceQuickActions.tsx`, `SpendingBreakdownCard.tsx`, `FinanceAttentionCard.tsx`, `mobile/lib/walletOverview.ts`, `mobile/hooks/useFinancePlans.ts`, `mobile/tests/walletOverview.test.mjs`, `mobile/e2e/walletHome.spec.ts`.
- Edited: `mobile/app/(tabs)/wallet.tsx`, `mobile/components/wallet/ExpenseHistoryRow.tsx`, `mobile/constants/theme.ts`, `mobile/constants/i18n.ts` (30 `wallet.*` keys in English and Malay).
- Tests rewritten or updated: `mobile/e2e/walletTotal.spec.ts` (the roll now targets the overview amount), `mobile/e2e/unifyd.spec.ts` (all-time total read and over-budget pill), `mobile/e2e/splitBills.spec.ts`, `mobile/e2e/subscriptions.spec.ts`.
- Removed: `mobile/components/wallet/BudgetSummary.tsx`, `mobile/components/finance/FinanceSummaryCard.tsx`.
- Docs: `UNIFYD_DESIGN_SYSTEM.md` (§5, §8 Wallet, §10), `UNIFYD_SDD.md` (§6 Wallet), `CLAUDE.md`, and this file.

**Tests performed:**
- Mobile typecheck and lint pass. Unit tests 75/75 (5 new). `npm run web` serves the bundle.
- E2E `walletHome.spec.ts` 7/7, covering:
  - section order and real figures;
  - all five shortcuts navigating, with ≥ 44 pt targets;
  - no-budget and no-expense states, with attention omitted;
  - near and over states, with attention priority;
  - period error and retry;
  - reduced-motion chart drawn complete;
  - Light mode with dark cards, and a 320 px layout clearing the tab bar.
- The existing budget scenario in `unifyd.spec.ts` passes unchanged in its figures.
- Full Expo Web suite: 59/59.
- Screenshots checked: Dark 390 px with data, the empty state, and near-budget at 320 px.
- Not yet checked: a physical device, and Malay layout on a small phone.

**Issues or decisions:**
- At 390 × 844 with an attention card showing, Recent expenses begins about one short scroll below the first screen. Without attention items it starts within the first screen.
- Quick-action labels may wrap to two lines at 320 px.

**Next action:** On a phone, check the Wallet in Dark, Light, and Malay, with and without a budget, and tap each shortcut.

### 2026-10-13 — Finance: smart expense category suggestion (Multinomial Naive Bayes)

**Requirements implemented:** SRS-FR-901 to SRS-FR-909 (new §5.10). This is a formal scope decision by the project owner on 2026-10-13, a narrow exception to the "no custom ML" rule.

**What changed:**
- **Classifier** `server/src/expense-classifier.ts`: pure TypeScript with no dependency.
  - Normalisation and tokenisation (lowercase, accents removed, punctuation to spaces, tokens of ≥ 2 characters, no pure numbers, a small English/Malay linking-word list).
  - Multinomial Naive Bayes with Laplace α = 1 and softmax posterior.
  - Thresholds: ≥ 15 usable labelled expenses, ≥ 2 categories, at least one known title word, confidence ≥ 0.70, and margin ≥ 0.15. Results are typed: `available: true`, or `not_enough_data` / `low_confidence`.
  - Training uses the latest ≤ 500 rows, rebuilt in memory per request and never stored.
  - Evaluation utilities `holdOutSplit` and `evaluateClassifier`: accuracy, per-category precision/recall/F1/support, macro F1, and confusion matrix.
- **History loader** `server/src/expense-history.ts`: selects only `title,category` with the caller's own token (RLS), filters by the user ID from `auth.getUser`, newest first, limit 500.
- **Endpoint** `POST /api/ml/expense-category-suggestion` in `server/src/app.ts`, wired in `index.ts`:
  - verifies the token first;
  - accepts exactly `{title}` (1–120 characters), so extra fields such as a user ID are refused;
  - rate limit 60 per 10 min per token hash;
  - safe error codes; nothing logged or cached;
  - CORS as for the other app endpoints.
- **App:**
  - `lib/categorySuggestion.ts` sends only the trimmed draft title.
  - `hooks/useCategorySuggestion.ts` applies a ≥ 3 character minimum and a 600 ms debounce; the latest title wins.
  - `components/wallet/CategorySuggestion.tsx` shows a loading line, the optional card ("Use {category}" / "Choose myself"), the not-enough-data note, or the unavailable note. Low confidence shows nothing.
  - `ExpenseForm` takes an opt-in `suggestCategory` setting, used by `add-expense` and `scan-receipt` (OCR checks its draft title once on open). Edit is unchanged.
  - A suggestion only fills the field, never saves, and hides once a category is chosen.
- **i18n:** 8 `suggest.*` keys in English and Malay.

**Changed files:**
- Server (new): `src/expense-classifier.ts`, `src/expense-history.ts`, `src/expense-classifier.test.ts`, `src/category-suggestion.test.ts`.
- Server (edited): `src/app.ts`, `src/index.ts`, `README.md`.
- Mobile (new): `lib/categorySuggestion.ts`, `hooks/useCategorySuggestion.ts`, `components/wallet/CategorySuggestion.tsx`, `e2e/categorySuggestion.spec.ts`.
- Mobile (edited): `components/wallet/ExpenseForm.tsx`, `app/add-expense.tsx`, `app/scan-receipt.tsx`, `constants/i18n.ts`.
- Docs: `UNIFYD_SRS.md` (§5.10, §8, §9), `UNIFYD_SDD.md` (§5.2, §7.9, §10), `CLAUDE.md`, and this file.

**Tests performed:**
- Server typecheck and build pass. Server tests 66/66 (19 new), covering:
  - tokenisation and normalisation;
  - training counts and probabilities;
  - clear predictions;
  - fewer than 15 expenses, a single category, and unknown or ambiguous titles all returning unavailable;
  - notes, OCR text, and other users' fields having no effect;
  - the 500-row bound;
  - hand-computed evaluation metrics and a reproducible hold-out;
  - 401 before any history read, the verified token reaching the loader, a body user ID refused, shape and length checks, the rate limit, a safe 503 with nothing logged, and the loader selecting only `title,category` for the verified user.
- Mobile typecheck and lint pass. Unit tests 70/70.
- E2E `categorySuggestion.spec.ts` 4/4, covering:
  - debounced title-only requests;
  - "Use" filling the field without a save;
  - manual change still possible;
  - "Choose myself" dismissing;
  - not-enough-data note, and nothing shown on low confidence;
  - OCR sending only the draft title, never raw text, with saving still explicit.
- Full Expo Web E2E suite: 52/52.
- Live smoke test against the built server with the test account: 401 without a token; `not_enough_data` with 0 saved expenses; 400 for an extra `userId` field. The server log held only the startup line.
- **Evaluation note:** the fictional fixture hold-out (16 train / 4 test) scored accuracy 0.25, because the held-out titles mostly use unseen words. This shows the small-history limitation.
- Not yet checked:
  - a physical device;
  - a real labelled history of 15 or more expenses (the test account has none);
  - a consented evaluation dataset for the thesis.

**Issues or decisions:**
- "Confidence" is the Naive Bayes posterior, a model score, not a certainty.
- A title with no known word returns `low_confidence`, so the most common category is never just echoed back.
- No migration, no model storage, and no Groq/LLM or remote ML API.

**Next action:** On a phone (with the server restarted via `npm run build && npm start`), add 15+ categorised expenses across at least 2 categories, then type similar titles in Add Expense and scan a receipt to see the suggestion.

### 2026-10-12 — Rolling amounts: play when visible, and Home cards

**What changed:**
- The roll now waits until the amount can be seen. The owner did not see the Wallet roll, because the ALL-TIME SPENT card sits below the fold and the roll had already finished.
- `AnimatedMoneyAmount` gains `play`. While it is off, the digits hold the previous value and nothing is remembered as shown. A started roll is latched and always finishes. Afterwards the columns collapse into one plain `FinanceNumber` text run of the same size and position, which keeps text queries and copying correct.
- **Wallet:** the card's real position comes from `measureInWindow`, compared with the window above the tab bar (68 pt + bottom inset). It is re-checked on scroll, on card layout, and on header layout, because anything that moves the card resizes the header.
  - Two traps found while testing:
    - On the web, `onLayout` does not report position changes.
    - The FlatList's `onLayout` reported the empty-state card's frame.
  - The window-based check avoids both.
- **Home:** the Overview and Money "Spent this month" amounts use the component. `CardDeck` now passes `front` to each card. Overview rolls on load; Money waits until it is brought to the front.
- New labels: `home.monthSpentAmount` ("Spent this month, {amount}"), in English and Malay.
- **Overview replays on return** (owner request, same day). `replayOnShow` rolls the Overview amount again from RM 0.00 each time the card comes back to the front of the deck, for example after Studies or Wellbeing. It does not replay when switching bottom tabs while Overview stays in front. E2E `home` + `walletTotal`: 15/15.

**Changed files:** `mobile/components/AnimatedMoneyAmount.tsx`, `mobile/app/(tabs)/wallet.tsx`, `mobile/components/home/CardDeck.tsx` (`front` in `DeckControls`), `mobile/components/home/DeckCards.tsx`, `mobile/app/(tabs)/index.tsx`, `mobile/constants/i18n.ts`, `mobile/e2e/walletTotal.spec.ts`, `mobile/e2e/home.spec.ts` (new roll test), `UNIFYD_DESIGN_SYSTEM.md` §5, `CLAUDE.md`, and this file.

**Tests performed:**
- Typecheck and lint pass. Unit tests 70/70.
- E2E `walletTotal`, `unifyd`, and `home`: 21/21. The new checks cover:
  - no movement below the fold, then a smooth roll after scrolling into view;
  - plain text after settling;
  - the Money card waiting behind the front card, then rolling when shown;
  - no replay on returning to Home.
- Full Expo Web E2E suite: 48/48.
- Not yet checked: a physical device.

**Next action:** On a phone, reload Expo Go, then:
- watch Overview roll on Home;
- swipe to Money;
- scroll Wallet down to ALL-TIME SPENT.

### 2026-10-12 — Wallet: rolling all-time total

**What changed:**
- **Reference.** I studied `local-assets/money move.mp4` (2.4 s) from frames saved in the session scratchpad. In it, the amount drops through intermediate values from above while the old value slides out below, and the decimals stay still. The video was not copied, bundled, or committed.
- **New component** `components/AnimatedMoneyAmount.tsx`, used only for Wallet's ALL-TIME SPENT amount (Wallet has no "balance"; this is its primary total).
  - Built with RN `Animated` (the project convention), native driver on phones, and no new dependency.
  - Each changed digit is a clipped column of `FinanceNumber` glyphs. Sliding it down reveals each next digit from above, through the digits in between: upwards for a rising total, downwards for a falling one.
  - "RM", unchanged characters, and separators are static. Duration 850 ms, `Easing.out(cubic)`.
- **Rules** in `lib/moneyRoll.ts` (pure, tested): columns align from the right and always take the target's length, so the layout is final from the first frame. New leading positions appear from blank. Numbers keep 2 decimals, `en-MY` thousands separators, and a leading minus.
- **Behaviour:**
  - The first value in a session rolls from RM 0.00.
  - Later values roll from the last value shown; a session map keyed by user survives Wallet remounting on focus.
  - An unchanged value never replays.
  - A new value mid-roll replaces the running animation, so animations never overlap.
  - **Plays when seen** (owner request, same day). The card sits below the fold, so the roll first finished unseen. Wallet now tracks, on scroll and layout, whether the card is at least 60% on screen and passes `play` to the component. Until then the digits wait on the previous value, and nothing is remembered as shown. A roll that has started is latched and always finishes.
  - Reduced motion shows the final value at once.
  - Large amounts shrink to the card width (minimum 0.6×), as `FinanceNumber fit` does.
  - One accessible label carries the final value ("All-time spent, RM 1,234.50" / "Jumlah semua perbelanjaan, …"). The glyphs are hidden from screen readers.
- `FinanceNumber.tsx` now exports its font metrics. Wallet's totals calculation, CRUD, budgets, and every other amount are unchanged.

**Changed files:** `mobile/components/AnimatedMoneyAmount.tsx` and `mobile/lib/moneyRoll.ts` (new), `mobile/components/FinanceNumber.tsx` (exports), `mobile/app/(tabs)/wallet.tsx`, `mobile/constants/i18n.ts` (`wallet.totalLabel`), `mobile/tests/moneyRoll.test.mjs` and `mobile/e2e/walletTotal.spec.ts` (new), `mobile/e2e/unifyd.spec.ts` (the total is now read from `aria-label`), `UNIFYD_DESIGN_SYSTEM.md` §5, `CLAUDE.md`, and this file.

**Tests performed:**
- Typecheck and lint pass. Unit tests 70/70 (4 new).
- E2E `walletTotal.spec.ts` 3/3. Frame-by-frame sampling shows:
  - no movement while the card is below the fold, then, after scrolling it into view, many intermediate positions, settling under 1.1 s and ending at exactly 0 offset;
  - card size, amount box, and label position constant throughout;
  - no replay on refocus with the same total;
  - a decrease rolling from the previous value;
  - RM 1,234,567.89 fitting a 320 px phone;
  - reduced motion with no movement.
- Regression E2E `unifyd`, `home`, `splitBills`, and `subscriptions`: 26/26.
- Screenshots of mid-roll, final, and 320 px frames were checked.
- Not yet checked: a physical device (native driver smoothness, Reduce Motion, TalkBack/VoiceOver reading).

**Issues or decisions:**
- When the budget panel above finishes loading, it can push the whole card down once. That is existing Wallet behaviour, and nothing inside the card moves.

**Next action:** On a phone, scroll down to ALL-TIME SPENT after a reload, or after adding or deleting an expense, and watch it roll. Repeat with Reduce Motion on.

### 2026-10-12 — Migrations applied: timetable and finance

**What changed:**
- The project owner reports that both migrations are applied in Supabase.
- `20261009_002_timetable_entries.sql` had been applied earlier. A re-run failed harmlessly with `42P07 relation already exists`. A read-only catalogue check then passed all 9 items: RLS, 15 columns, 4 policies, the index, the trigger and its function, no anon access, and the `entry_source` insert-only grant.
- `20261012_001_finance_subscriptions_split_bills.sql` was applied on 2026-10-12.
- New live test `mobile/e2e/financeLive.spec.ts` uses the configured test account and cleans up its uniquely prefixed rows. It checks:
  - owner CRUD on subscriptions and split bills, and the embedded participant read;
  - RLS rejects another `user_id` and a bill the student does not own;
  - grants reject client-set `id`, `created_at`, `user_id`, `split_bill_id`, and `is_self`;
  - every check constraint;
  - `settled_at` must move with `is_settled`;
  - the You row cannot be unsettled, duplicated, or deleted on its own;
  - deleting a bill cascades to its participants;
  - anon requests are denied on all three tables.

**Changed files:** `mobile/e2e/financeLive.spec.ts` (new), `UNIFYD_SRS.md` (§5.9 status), `UNIFYD_SDD.md` (§4/§6.2/§6.3 status), `CLAUDE.md`, and this file.

**Tests performed:** `npx playwright test e2e/financeLive.spec.ts`: 3/3 passed against the live database.

**Issues or decisions:**
- No second student account was available, so two-account isolation is checked indirectly: the other `user_id` is rejected, and so is a bill the student does not own.
- The UI E2E specs still use mocks, so they stay deterministic.

**Next action:** On a physical phone, check:
- the subscription reminder permission prompt, delivery at 09:00, and tapping the reminder;
- split-bill create, mark paid, and edit;
- timetable import with real data.

### 2026-10-12 — Finance module: subscription reminders and personal split bills

**Requirements implemented:** SRS-FR-801 to SRS-FR-815 (new §5.9, added at the project owner's request on 2026-10-12).

**Scope:** Private, manual planning and tracking only. There are no payments, transfers, DuitNow/QR, or payment links; no bank, e-wallet, or finance APIs; no AI or Groq; no participant accounts, invitations, groups, or shared access; and no automatic expense creation. Existing expense, OCR, Planner, Mind, Profile, auth, course, and timetable behaviour is unchanged.

**What changed:**
- **One migration:** `supabase/migrations/20261012_001_finance_subscriptions_split_bills.sql` creates `subscriptions`, `split_bills`, and `split_bill_participants`.
  - Constraints: non-blank text, positive `numeric(12,2)` amounts, Wallet categories only, and notes null or non-blank.
  - Subscriptions: frequency `weekly|monthly|quarterly|yearly`; reminder 0–30 days (default 3).
  - Participants: one `is_self` row per bill (partial unique index); self is always settled; `settled_at` is set exactly when settled.
  - Security: owner-only RLS; participants are reachable only through the owned parent bill, and the self row can be deleted only by the bill cascade. Grants are narrow and column-level for insert and update. Each table has its own private `updated_at` trigger function with client EXECUTE revoked.
  - Indexes: `(user_id, is_active, next_billing_date)`, `(user_id, bill_date desc)`, and `(split_bill_id)`.
  - **NOT applied, awaiting owner review.** E2E tests mock all three tables.
- **Subscriptions** (`/subscriptions`, `/subscription-entry`):
  - CRUD, pause/resume, and delete with confirmation.
  - "Mark as renewed" asks for confirmation, then advances the date by one cycle, clamped at month end.
  - Upcoming renewals cover the next 30 days plus passed dates. The monthly equivalent is integer cents over active plans.
  - Local reminder at 09:00 on billing date − days, via a pure `planSubscriptionReminders` + `reconcileReminders`, on the Android channel `unifyd-subscription-reminders`. Notes are never shown in a notification.
  - Permission is requested only when the saved or resumed plan wants a reminder.
  - `taskReminders.ts` now clears only task taps from the cold-start response; task behaviour is unchanged.
- **Split bills** (`/split-bills`, `/split-bill`, `/split-bill-entry`):
  - You plus 1–19 named people. Equal split in cents, with leftover cents going to You first. Custom amounts show what is left or over, and saving is blocked until the shares match the total exactly.
  - Names must be distinct. The detail screen has mark paid/unpaid, outstanding total, Settled/Open status, edit, and delete with confirmation.
  - Edits run as checked steps, because there is no multi-request transaction. A partial failure is reported, and a shares/total mismatch is flagged on detail.
- **Wallet:** the "Plans and shared costs" card shows renewals in the next 7 days and the total still owed, with "View subscriptions" and "View split bills". It is labelled as not included in spending totals.
- **i18n:** 206 keys (`subscription.*`, `split.*`, `finance.*`) in English and Malay.

**Changed files:**
- New: `supabase/migrations/20261012_001_finance_subscriptions_split_bills.sql`, `mobile/lib/subscriptions.ts`, `mobile/lib/subscriptionReminders.ts`, `mobile/lib/splitBills.ts`.
- New: `mobile/components/finance/` (`ConfirmDialog`, `SubscriptionForm`, `SubscriptionCard`, `SplitBillForm`, `SplitBillRow`, `FinanceSummaryCard`).
- New: `mobile/app/subscriptions.tsx`, `subscription-entry.tsx`, `split-bills.tsx`, `split-bill.tsx`, `split-bill-entry.tsx`.
- New tests: `mobile/tests/subscriptions.test.mjs`, `mobile/tests/splitBills.test.mjs`, `mobile/e2e/subscriptions.spec.ts`, `mobile/e2e/splitBills.spec.ts`.
- Edited: `mobile/app/_layout.tsx`, `mobile/app/(tabs)/wallet.tsx`, `mobile/lib/taskReminders.ts`, `mobile/constants/i18n.ts`, `UNIFYD_SRS.md` (§5.9, §7, §8, §9), `UNIFYD_SDD.md` (§6.2, §6.3, §7.8, §10), `CLAUDE.md`, and this file.

**Tests performed:**
- Mobile typecheck and lint pass. Mobile unit tests 66/66 (22 new).
- Server typecheck, tests 47/47, and build pass (server unchanged). `npm run web` serves the bundle with no errors, and `git diff --check` is clean.
- E2E `subscriptions.spec.ts` 4/4 and `splitBills.spec.ts` 5/5.
- Full Expo Web E2E suite: 41/41, covering Wallet, budgets, OCR, Planner, reminders, Mind, Home, Poof, avatar, My Semester, timetable, subscriptions, and split bills.
- Not yet checked: a physical device (permission prompt, delivery and tap, the Android channel), Light mode and Malay layout screenshots, and two-account RLS against the real tables, because the migration is not applied.

**Issues or decisions:**
- Share-sum equality is enforced by the app, not the database.
- Month-end renewal can drift, because no anchor day is stored.
- Participants are ordered with You first, then by name.

**Next action:** The owner reviews and applies `20261012_001_finance_subscriptions_split_bills.sql` and reports back. Then run the finance E2E without mocks, plus a two-account RLS check, and test reminders on a phone.

### 2026-10-12 — Finance number typography

**What changed:**
- Finance display numbers now use **Space Mono**, matching the owner's monospace reference. It was already in the project (`mobile/assets/fonts/SpaceMono-Regular.ttf`, SIL Open Font License) but unused, so no font was downloaded and no dependency was added.
- **Loading.** `app/_layout.tsx` loads the font with `expo-font` `useFonts` and keeps the existing "Opening your space…" screen until it is ready, so amounts never flash in another font. If loading fails, the app continues with a fallback: the system monospace on the web, the system font on native.
- **Component.** `components/FinanceNumber.tsx` is the one place this style is defined:
  - regular weight, tabular figures, −0.5 letter spacing;
  - a fixed line height of 1.25 × size, because Space Mono's natural line height of about 1.48 would push layouts down;
  - optional `fit` to keep large amounts on one line. Phones use `adjustsFontSizeToFit`; the web calculates the size exactly from the 0.612 em glyph width, because React Native Web ignores that prop.
- **Applied to** Wallet (all-time total, budget amount, spent, over or remaining amount, % used, daily average, category amounts), expense history rows, expense detail, the OCR-detected total, and the Home Money card (spent amount and category %) and Overview spent amount.
- **Not applied to** labels, titles, category names, dates, editable amount inputs, numbers inside translated sentences, or any non-finance screen (Planner, Mind, Profile, My Semester, Timetable, Poof, authentication).
- **No such screens yet:** subscriptions and split-bill screens do not exist in the app, so there was nothing to change. The app has no chart value labels.

**Changed files:** `mobile/components/FinanceNumber.tsx` (new), `mobile/constants/theme.ts` (`fonts`), `mobile/app/_layout.tsx`, `mobile/app/(tabs)/wallet.tsx`, `mobile/app/expense-detail.tsx`, `mobile/app/scan-receipt.tsx`, `mobile/components/wallet/BudgetSummary.tsx`, `mobile/components/wallet/ExpenseHistoryRow.tsx`, `mobile/components/home/DeckCards.tsx`, `UNIFYD_DESIGN_SYSTEM.md`, `CLAUDE.md`, and this file.

**Tests performed:**
- TypeScript and Expo lint pass; mobile unit tests 44/44.
- Expo Web E2E: 19/19 (`unifyd.spec.ts`, covering Wallet CRUD, budgets, and OCR; `home.spec.ts`; `poof.spec.ts`).
- Screenshots with mocked data were checked: Wallet, history, expense detail, OCR review, and the Home Money card in Dark and Light at 390 px, plus Dark at 320 px with RM 12,345.67 values. No clipping remains after the web fit fix.
- A probe confirmed the font is loaded at Home's first paint.
- Not yet checked: a physical device.

**Issues or decisions:**
- A pre-existing Home Overview overflow was found and left unchanged. When both the over-budget sentence and the next-deadline title wrap to two lines, the chips crowd the swipe hint. The same screenshot with the old font shows it too.

**Next action:** Check finance numbers on a physical phone. Then decide whether to fix the Overview overflow.

### 2026-10-12 — Poof launcher: round chat bubble

**What changed:**
- The Home Poof launcher's backdrop changed from a rounded-rectangle speech bubble with a lower-right tail to a round chat bubble with a short lower-left tail, matching the owner's reference icon.
- It is drawn as one outlined `react-native-svg` path (already installed), so the border flows unbroken into the tail. The circle is about 69 pt across. After the owner's phone review, the tail was narrowed to match the reference icon (its base now spans 26° of the circle instead of 48°). The outline stays about 2.5 pt.
- Unchanged:
  - the Poof artwork, theme tokens, position, animation, reduced motion, and tap behaviour;
  - chat logic, data access, and safety behaviour.

**Changed files:** `mobile/components/mascot/PoofMascot.tsx`, `mobile/e2e/home.spec.ts`, `UNIFYD_DESIGN_SYSTEM.md`, `UNIFYD_SDD.md`, and this file.

**Tests performed:**
- TypeScript and Expo lint pass.
- Expo Web E2E: Home 11/11 and Poof 2/2. The launcher test now checks the round shape and the outline path.
- Dark and Light close-up screenshots were checked.

**Next action:** Check the bubble on a physical phone.

### 2026-10-10 — Home: one Poof chat launcher

**What changed:**
- Home no longer shows the upper decorative Poof or the AI summary card. No gap remains; the greeting follows "YOUR SPACE" directly.
- Kept: the Poof asset, the `PoofMascot` component, `mobile/lib/insights.ts`, and the `/api/insights/generate` endpoint. The chat logic, endpoint, data access, navigation actions, and safety behaviour are unchanged.
- The lower chat launcher is now the only Poof on Home:
  - It is slightly larger (bubble about 69 × 60 pt, up from a 56 pt circle) and sits in a speech bubble with a tail, using new semantic tokens `poofBubble`, `poofBubbleBorder`, and `poofBubbleGlow` for Dark and Light.
  - It reuses the existing Poof animation: a welcome once per app session, then a calm idle while Home is focused.
  - A tap hops and opens the chat in the same handler. Repeated taps neither stack the hop nor open a second chat.
  - With reduced motion it stays still and a tap opens the chat at once.
- The chat backdrop ignores taps until the sheet has opened, so a quick double tap cannot open and then close it.
- Added a mobile `typecheck` script (`tsc --noEmit`).

**Changed files:** `mobile/app/(tabs)/index.tsx`, `mobile/components/mascot/PoofMascot.tsx`, `mobile/components/poof/PoofLauncher.tsx`, `mobile/components/poof/PoofAssistant.tsx`, `mobile/constants/theme.ts`, `mobile/e2e/home.spec.ts`, `mobile/package.json`, `UNIFYD_SDD.md`, `UNIFYD_DESIGN_SYSTEM.md`, and this file.

**Tests performed:**
- `npm run typecheck` and `npm run lint` pass. Mobile unit tests pass 44/44.
- Expo Web E2E: Home 11/11 and Poof 2/2. New Home tests cover:
  - a single Poof launcher with a speech-bubble backdrop, larger than 56 pt;
  - no upper mascot, no AI summary card, and no summary request;
  - no gap above the greeting, and no overlap with the deck, dots, centre button, tab bar, or avatar;
  - an idle loop that does not shift the layout, and one welcome per session;
  - tap and keyboard opening, and a double tap that opens only one chat;
  - reduced motion.
- Dark and Light screenshots were checked at 390×844.

**Next action:** Check the launcher's float and tap feel on a physical phone.

### 2026-10-10 — Poof AI Assistant (Phase 1: read-only chat)

**What changed:**
- Home has a floating Poof chat button at the lower right. The Home layout and Poof's artwork are unchanged; the chat reuses the approved image.
- The Poof chat sheet shows:
  - a first-time greeting (stored per account on the device) and a short hello on later visits;
  - a summary built from Wallet, Budget, Planner, Semester/Timetable, Mind, and Profile data, with a link on each line;
  - suggested questions, a free-text question box, and action buttons under replies.
- Answers: on-device rules detect English and Malay questions and answer from verified figures. For non-crisis questions, the app also asks the server for an AI reply. If the AI is unavailable, offline, rate-limited, or returns an invalid reply, the rule-based answer is shown instead. Each reply is labelled "AI answer" or "Quick answer".
- Safety:
  - Actions only navigate to other screens; Poof never creates, edits, deletes, submits, or spends anything.
  - Crisis wording is handled on the device with Malaysian support lines (999, Befrienders KL, Talian HEAL 15555) and is never sent to the AI.
  - Wellbeing replies include a "not a counsellor or diagnosis" note.
  - Questions outside Unifyd's scope get a friendly limitation notice.
- Privacy: the AI only receives aggregate numbers (no task titles, subjects, class names, notes, or names). The server accepts only that exact shape and rejects any extra field or free text. It also rejects replies that contain numbers not in the facts, diagnosis or guarantee wording, or claims of having changed data. Requests need sign-in and are rate-limited per session (30 per 10 minutes). Nothing is stored or logged.

**Changed files:**
- New (mobile): `mobile/lib/poofFacts.ts`, `mobile/lib/poofEngine.ts`, `mobile/lib/poofData.ts`, `mobile/lib/poofAi.ts`, `mobile/components/poof/PoofAssistant.tsx`, `mobile/components/poof/PoofLauncher.tsx`, `mobile/components/poof/PoofMessage.tsx`, `mobile/components/poof/PoofSummary.tsx`, `mobile/components/mascot/PoofAvatar.tsx`, `mobile/hooks/useReducedMotion.ts`, `mobile/tests/poof.test.mjs`, `mobile/e2e/poof.spec.ts`.
- New (server): `server/src/poof-chat.ts`, `server/src/poof-chat.test.ts`.
- Updated: `mobile/app/(tabs)/index.tsx`, `mobile/components/mascot/PoofMascot.tsx` (exports the image only), `mobile/constants/i18n.ts` (English and Malay), `server/src/app.ts`, `server/src/index.ts`, `server/src/insight-summary.ts` (shared safety patterns and response schema), `server/README.md`, and this file.

**Tests performed:**
- Mobile: TypeScript and Expo lint pass; unit tests 44/44 (10 new Poof tests).
- Server: typecheck passes; tests 47/47 (9 new). These include a contract test that runs the mobile payload builder against the server validator.
- Expo Web E2E: Poof 2/2 and Home 10/10.
- Screenshots at 390×844 were checked for the launcher, summary, answer, and wellbeing support card.

**Issues or decisions:**
- No schema change. Poof reads existing tables under the student's own Row Level Security.
- The summary is calculated on the device, so its figures are exact; the AI only writes chat replies.
- Live Groq replies need `GROQ_API_KEY`, as for the existing summaries. Without it, Poof uses its rule-based answers.

**Next action:** Restart the server, then try Poof on a phone with live Groq replies in English and Malay, including keyboard behaviour and screen reader announcements.

### 2026-10-09 — Timetable: real UMPSA grid reading, weekly grid view, quicker review

**Problem reported:** importing a real UMPSA timetable screenshot gave messy results, the weekly list was hard to read, and the review took too much work. The project owner shared another app's grid timetable as a reference.

**Diagnosis (screenshot read through Google Vision with the owner's permission):**
- Vision returns each time label in pieces (`07` `:` `00-07` `:` `50`), so no grid was detected and the line reader produced 4 broken candidates.
- Vision's text blocks also mixed neighbouring cells.

**Changed files:**
- `server/src/timetable-parser.ts`: grid reading rebuilt on word positions (details in the SDD), plus the UMPSA cell format.
- `server/src/timetable-parser.test.ts`: new test for a split UMPSA grid.
- `mobile/components/timetable/WeekGrid.tsx` (new): grid week view.
- `mobile/app/timetable.tsx`: grid replaces the day list; compact selectors and actions.
- `mobile/app/timetable-entry.tsx`: day and time prefilled from a + cell.
- `mobile/app/timetable-import.tsx`: one-line class summaries; details on tap.
- `mobile/constants/i18n.ts`, `mobile/e2e/timetable.spec.ts`, `UNIFYD_SDD.md`, and this file.

**Result on the owner's screenshot:** all 7 classes were read with the correct day, merged times, course name, section, and room. Before, it produced 4 broken candidates.

**Tests performed:**
- Server: typecheck, build, and tests 38/38.
- Mobile: TypeScript and Expo lint pass; unit tests 34/34; timetable E2E 4/4.
- The full suite was re-run (see the handoff).
- Grid screenshots of the 7 classes were checked at phone width.

**Note:** after pulling these changes, rebuild and restart the server (`npm run build`, then `npm start`) so the phone uses the new reader.

### 2026-10-09 — Correction: partial course loads and partial or empty timetables are valid

**Requirement change:** Unifyd must not require 12 credit hours, a full timetable, or classes every day. An incomplete import candidate must not block saving the others.

**Changed files:**
- `mobile/lib/timetable.ts` (new `isComplete`, `draftsToSave`) and `mobile/tests/timetable.test.mjs` (new partial-import test).
- `mobile/app/timetable-import.tsx`: per-class “Add to my timetable” checkbox; only complete, ticked classes are saved.
- `mobile/app/timetable.tsx`: all seven days in the week view, neutral “No classes” on free days, friendlier empty state, Next class note always shown.
- `mobile/components/timetable/NextClassCard.tsx`: “No upcoming classes in your timetable” instead of hiding.
- `mobile/app/timetable-entry.tsx`: Cancel button.
- `mobile/app/(tabs)/planner.tsx`: Next class note shown once loaded, hidden only if loading fails.
- `mobile/constants/i18n.ts`: new and reworded EN/MS strings; removed the unused “fix errors” and “No classes on {day}” strings.
- `mobile/e2e/timetable.spec.ts`; `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, and this file.

**My Semester:** no code change was needed. The app never had a minimum-credit rule, and the 19-credit notice was already non-blocking. The SRS and SDD now state this explicitly.

**Tests performed:** TypeScript and Expo lint pass; mobile unit tests 34/34 (new partial-import test); full Expo Web E2E 29/29. That includes 4 timetable tests: a five-candidate import where 3 are saved, 1 is removed, and 1 incomplete one is left out; an incomplete-only review that saves nothing; manual add/cancel/edit/delete; and safe import errors with the neutral Next class note. No migration was run.

### 2026-10-09 — Module 7 Phase 3: personal timetable import, review, and manual builder

**Changed files:**
- **Migration** (new, not executed): `supabase/migrations/20261009_002_timetable_entries.sql`.
- **Server:**
  - new: `server/src/timetable-parser.ts`, `server/src/timetable-vision.ts`, `server/src/timetable-parser.test.ts`, `server/src/timetable.test.ts`;
  - changed: `server/src/app.ts`, `server/src/index.ts`, `server/README.md`.
- **Mobile:**
  - new: `mobile/lib/timetable.ts`, `mobile/lib/timetableEntries.ts`, `mobile/lib/timetableImport.ts`, `mobile/components/timetable/ClassFields.tsx`, `mobile/components/timetable/NextClassCard.tsx`, `mobile/app/timetable.tsx`, `mobile/app/timetable-entry.tsx`, `mobile/app/timetable-import.tsx`, `mobile/tests/timetable.test.mjs`, `mobile/e2e/timetable.spec.ts`;
  - changed: `mobile/app/_layout.tsx`, `mobile/app/(tabs)/planner.tsx`, `mobile/constants/i18n.ts`, `mobile/package.json` and lock file (`expo-document-picker`).
- **Docs:** `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, and this file.

**What changed:**
- **Planner** links to My timetable and shows the Next class once classes are saved.
- **My timetable** shows the week for the chosen session/semester, with a day selector for small phones, clash warnings, and the Next class card. A note says it is not official UMPSA registration.
- **Manual classes:** students add, edit, and delete classes, with live clash warnings while editing.
- **Import:** a PNG, JPEG, or PDF goes to the server, then to a mandatory editable review. Suggested My Semester links appear on an exact course-code match only. Nothing is saved until the student presses Save.
- **iPhone fix:** Choose file opened only the Files app, which cannot reach the Photos library. Import now offers **Choose from Photos** (image picker; HEIC is delivered as JPEG) and **Choose from Files** (PDFs and images).
- **Not stored:** the uploaded file, raw OCR text, and drafts. The picker's cached copy is deleted on native after upload.
- **Not used:** AI, predictions, or outside timetable services.
- **Not added:** attendance, calendar sync, notifications, or automatic tasks.

**Tests performed:**
- Server: typecheck, build, and `npm test` 37/37 (13 new: parser layouts, upload validation, auth, PDF limits and protection, safe errors, inline Vision PDF request).
- Mobile: TypeScript and Expo lint pass; unit tests 33/33 (5 new timetable logic tests).
- E2E: 3 new Expo Web tests in `e2e/timetable.spec.ts`. They cover import → review → correction → explicit save, suggested links, clash rules, Next class, manual add/edit/delete, and safe import errors. The tests mock `timetable_entries` and the import endpoint, because the migration is not applied.

**Remaining:**
- Review and apply the migration (not executed by the assistant).
- Live save against Supabase.
- Real Vision reads of actual UMPSA timetable images and PDFs.
- Native file picking and upload on a phone.
- Second-account RLS isolation.

### 2026-10-09 — Poof mascot on Home

**Changed files:**
- `mobile/components/mascot/PoofMascot.tsx` (new), `mobile/assets/mascots/poof/poof.png` (new)
- `mobile/app/(tabs)/index.tsx`, `mobile/constants/theme.ts` (`mascotBackdrop` token), `mobile/constants/i18n.ts`
- `mobile/e2e/home.spec.ts`, `.gitignore` (`/local-assets/`)
- `UNIFYD_SDD.md`, `UNIFYD_DESIGN_SYSTEM.md`, and this file

**What changed:** Poof, the approved mascot, appears in the Home header's top-right corner above the avatar.
- **Behaviour.** It pops in and waves once per app session, then floats calmly while Home is focused. A tap makes it hop and wave, and overlapping taps are ignored.
- **Reduced motion.** With reduced motion on, it is static.
- **Asset.** Only one approved Poof image exists, so the animation uses transforms of that local image (React Native `Animated`) and the artwork is unchanged.
- **Dark appearance.** A light backdrop disc keeps Poof's black cap visible.
- **Celebration.** The celebration variant exists but is not wired, because Home has no task-completion event to reuse cleanly.
- **Storyboard.** The storyboard stays local and is now git-ignored.

**Tests performed:**
- TypeScript and Expo lint pass; unit tests 28/28.
- Full Expo Web E2E: 25/25, including 2 new Poof tests covering:
  - the welcome → idle sequence happening once per session;
  - the local image request only;
  - idle movement without layout shift;
  - no overlap with the greeting or avatar;
  - single-reaction taps returning to idle;
  - no repeated welcome after leaving Home;
  - Profile still opening;
  - static Poof under reduced motion.
- Zoomed screenshots confirmed Poof renders whole, with no cropping.

**Remaining manual checks:** animation smoothness on a physical phone; Light appearance; the device reduced-motion setting; smaller and larger screens.

### 2026-10-09 — Manual verification by the project owner

- **New account default avatar:** a newly created account showed the Turban girl avatar before any selection. This confirms the applied `avatar_id` default and the sign-up trigger.
- **Cross-user data isolation:** with a second account, the project owner confirmed that one student cannot see another student's data. This is manual evidence for SRS-NFR-001; an automated two-account RLS test is still open.

### 2026-10-09 — Avatar name and default

**What changed:**
- The default avatar's display name is now "Turban girl" ("Gadis berserban"); its stored ID stays `women_turban`.
- Migration `supabase/migrations/20261009_001_profiles_avatar_default.sql` sets `profiles.avatar_id` to default to `women_turban` instead of the legacy `avatar-01`. The project owner reports it was applied in the Supabase SQL Editor on 2026-10-09.
- Only the column default changed. Existing rows, constraints, grants, and RLS policies are untouched, and the sign-up trigger relies on the default.

**Tests performed:** TypeScript passes; avatar and core profile Expo Web E2E 7/7 with the new name.

### 2026-10-09 — Curated local avatar library

**Requirements implemented:** SRS-FR-013 (new) and SRS-FR-006 (profile editing).

**Changed files:**
- `mobile/lib/avatarIds.ts` (new), `mobile/constants/avatars.ts`
- `mobile/components/Avatar.tsx`, `mobile/components/profile/AvatarPicker.tsx`
- `mobile/app/onboarding.tsx`, `mobile/app/edit-profile.tsx`, `mobile/app/(tabs)/index.tsx`, `mobile/app/(tabs)/profile.tsx`
- `mobile/components/profile/AcademicFields.tsx` (render fix)
- `mobile/constants/i18n.ts`
- `mobile/assets/avatars/*.png` (12 new)
- `mobile/tests/avatarIds.test.mjs` (new), `mobile/e2e/avatar.spec.ts` (new), `mobile/e2e/unifyd.spec.ts`, `mobile/e2e/global-setup.ts`
- `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, `UNIFYD_DESIGN_SYSTEM.md`, and this file

**What changed:**
- **Library.** Generated DiceBear avatars (remote `api.dicebear.com` URLs built from seeds) were replaced by the curated library.
  - The approved PNGs in `/assets/avatars/` were copied at 384 px into `mobile/assets/avatars/`, aspect ratio preserved, about 1.5 MB in total versus about 12 MB of originals. The originals are untouched.
  - One typed manifest supplies IDs, translated names, and bundled sources.
- **Picker.** The picker shows all 12 with names and a tick, ring, and bold selection.
- **Storage.** Only stable IDs are stored in the existing `profiles.avatar_id`. **No migration was required.**
- **Fallback.** Legacy or invalid values show the default (Turban woman), and forms start from a valid ID so legacy values never block saving.
- **Removed.** `getAvatarUrl` and all DiceBear references. No npm dependency or environment value was involved.

**Bug found and fixed:** Edit Profile, already on the committed code, rendered an empty programme string directly inside a `View`. This raised "Unexpected text node" and, on Expo Web, a development error toast that covered the Save button. `AcademicFields` now uses boolean checks.

**Tests performed:**
- TypeScript and Expo lint pass.
- Unit tests 28/28 (3 new: ID shape, valid IDs, and fallback for legacy, remote, path, and empty values).
- Full Expo Web E2E: 23/23. The new avatar test covers:
  - legacy `avatar-07` falling back to the default on Home and Profile;
  - all 12 avatars rendering and loading;
  - saving Music girl, which persists exactly `music_girl`;
  - Home and Profile matching without a restart;
  - a failed save keeping the previous avatar in the database and on screen;
  - no remote image or avatar-service request.

  The test restores the account's original avatar and programme.

**Remaining manual checks:** Avatar sharpness and the picker layout on a physical phone in Light and Dark. Onboarding with a brand-new account.

### 2026-10-09 — Light code cleanup (first pass)

**Removed:**
- Two components imported nowhere: `mobile/components/ModuleCard.tsx` (old Home) and `mobile/components/SectionPlaceholder.tsx`.
- 20 obsolete translation entries (10 keys in English and Malay) from the pre-deck Home and the old floating Add button: `home.heroTitle`, `home.heroDescription`, `home.explore`, `home.walletDescription`, `home.plannerDescription`, `home.mood`, `home.moodDescription`, `home.expenseCount`, `home.budgetUsed`, and `tab.add`.

**Checks:** No stray `console.log`, TODO, or FIXME was found in app or server code. Typed translation keys mean TypeScript would fail if a removed key were still used. TypeScript and lint pass; unit 25/25, server 24/24, Expo Web E2E 22/22.

**For a later pass (review before removing):**
- Unused strings belonging to other screens: `wallet.emptyBody`, `wallet.totalSpent`, `scan.chooseAnother`, `expense.deleting`.
- About nine merged feature branches can be deleted locally and on GitHub.

### 2026-10-09 — Home final adjustments

**What changed:**
- The greeting is always two lines ("Good evening," then the name) in English and Malay, at 28 px.
- "YOUR SPACE" sits tighter above the greeting, and the avatar is 52 → 58 px.
- The wordmark reads `unifyd.`
- After on-device comparison, the bottom bar returned to its original height and full safe-area spacing; the elevated centre FAB is unchanged.
- Greeting tests now expect the line break.

**Fit check:** The dots end at 640 px in the web capture, about 687 pt on an iPhone with a 47 pt status inset. The FAB top is at about 718 pt.

**Tests performed:** TypeScript and lint pass; unit tests 25/25; full Expo Web E2E 22/22.

### 2026-10-09 — Compact Home and elevated centre action

**Changed files:**
- `mobile/app/(tabs)/_layout.tsx`, `mobile/components/QuickActions.tsx`
- `mobile/components/Screen.tsx` (opt-in `compact` top padding; other screens unchanged)
- `mobile/app/(tabs)/index.tsx`, `mobile/components/home/CardDeck.tsx`, `mobile/components/home/DeckCards.tsx`
- `mobile/constants/i18n.ts`, `mobile/e2e/home.spec.ts`
- `UNIFYD_DESIGN_SYSTEM.md` and this file

**What changed:**
- **Bottom bar.** About 32 pt shorter on an iPhone with a home indicator (102 → about 70).
- **Centre action.** The + is now an elevated 62 px FAB with a page-coloured ring, rising above the bar. It sits in an empty centre slot with two tabs on each side, and is layered above the quick-actions sheet so its × stays usable.
- **Home layout.** Home uses compact top spacing, a smaller logo and greeting, and 404 px cards with tighter padding.
- **Money card.** It shows "3 expenses | 35% of budget" in one line (singular form included) so all three top categories fit.
- **Unchanged.** Functionality is the same.

**Fit check:** In a 390 × 844 web capture, the deck's dots end at 636 px. Adding a 47 pt iPhone status inset gives about 683, against the FAB's top edge at about 750. A two-line greeting still fits.

**Tests performed:**
- TypeScript and Expo lint pass; unit tests 25/25.
- Full Expo Web E2E: 22/22, with tests updated for the FAB test ID and the Money summary wording.
- Screenshots were reviewed for every card, including Money with three categories, and for the open sheet.

### 2026-10-09 — Home card colours

**Changed files:**
- `mobile/lib/cardShades.ts`, `mobile/components/home/ShadePicker.tsx` (new), `mobile/components/home/DeckCards.tsx`
- `mobile/app/(tabs)/index.tsx`, `mobile/constants/i18n.ts`
- `mobile/tests/cardShades.test.mjs` (new), `mobile/e2e/home.spec.ts`
- `UNIFYD_DESIGN_SYSTEM.md` and this file

**What changed:** Each module card (Money, Studies, Wellbeing) has a palette button that opens a sheet of six named dark shades as mini-card swatches.
- A choice recolours that card immediately.
- It is stored in AsyncStorage under `unifyd:card-shades:<userId>`. Missing or unknown values fall back per card, and a storage failure keeps the choice for the session.
- The Overview card keeps the Unifyd gradient and has no colour option.
- English and Bahasa Melayu names were added. No database change was made.

**Tests performed:**
- TypeScript and Expo lint pass.
- Unit tests 25/25 (3 new, including a luminance check that every shade stays dark).
- Full Expo Web E2E: 22/22. A new test covers the default shade, choosing Ocean, the other cards staying unchanged, persistence after reopening, and Overview having no colour option.

**Next action:** Second-account RLS isolation test, then deployment preparation for user acceptance testing.

### 2026-10-09 — Home card deck: native swiping

**Issue:** On the project owner's phone, deck swipes stuck. The first version used a JavaScript PanResponder inside the vertical page ScrollView, and the two competed for the same touch. Gesture Handler was considered, but expo-router installs version 3.3.0 while Expo Go for SDK 57 ships 2.32. That native/JS mismatch was not risked.

**Fix:** `CardDeck` now uses a native horizontal paging `Animated.ScrollView`.
- **Native swiping.** The phone's own scrolling handles swipes and nests with the vertical page.
- **Deck appearance.** Each card's translate, peek offset, scale, and visibility are interpolated from the scroll offset, using the native driver on phones. Waiting cards stay stacked behind the front card, and the front card slides away.
- **Navigation.** Dots, the back-to-overview button, and peeking-edge taps scroll the pager (`goTo`).
- **Web.** React Native Web wraps paging children in containers, which broke the stacking order, so the web build uses CSS scroll-snap instead. Transparent page containers pass taps through so peeking edges stay tappable.

**Tests performed:**
- TypeScript and Expo lint pass; unit tests 22/22.
- Full Expo Web E2E: 21/21. The deck test now scrolls the pager horizontally (the web equivalent of a swipe) and covers both ends, the dots, the overview button, peek taps, and only the front card exposing controls.
- Screenshots confirmed correct stacking at rest and mid-swipe.
- Real-phone swipe feel still needs the project owner's confirmation.

### 2026-10-09 — Home card deck

**Changed files:**
- `mobile/components/home/CardDeck.tsx` (new), `mobile/components/home/DeckCards.tsx` (new), `mobile/lib/cardShades.ts` (new)
- `mobile/app/(tabs)/index.tsx`, `mobile/constants/i18n.ts`, `mobile/e2e/home.spec.ts`
- `mobile/components/home/DashboardPanel.tsx` (removed; replaced by the deck cards)
- `UNIFYD_DESIGN_SYSTEM.md`, `UNIFYD_SRS.md`, and this file

**What changed:**
- **Layout.** The Overview hero and three stacked panels became one deck of four equal, larger cards: Overview (gradient, front), Money, Studies, and Wellbeing (deep dark default shades).
- **Navigation.** Students move by horizontal swipe, by tapping the peeking edge of the card behind, or with the dots. Each module card has a back-to-overview button and an Open button for its module.
- **Overview content.** The card gained summary chips (due in 7 days, overdue, check-ins).
- **Implementation.** React Native PanResponder and Animated, with no new dependency. Only clearly horizontal drags are claimed, so vertical page scrolling still works. Cards behind the front one are hidden from screen readers and touch, except their peeking edge.
- **Not changed.** The AI summary card is unchanged below the deck.

**Issues found:**
- In Expo Web, a mouse drag selected card text, and the next press cleared that selection. React Native Web cancels the active gesture on a selection change, so every second swipe failed. Deck text is now non-selectable.
- A springy snap-back was replaced by a 180 ms ease.

**Tests performed:**
- TypeScript and Expo lint pass; unit tests 22/22.
- Phone-width screenshots of every card were reviewed during development.
- Full Expo Web E2E: 21/21. The rewritten and new Home tests cover:
  - each card's figures and empty states;
  - only the front card exposing controls;
  - Open actions;
  - swipe next/previous with bounce at both ends;
  - a short drag snapping back;
  - tapping a peeking card;
  - the dots;
  - the back-to-overview button.

**Next action:** Step 2, choosing dark shades per module card.

### 2026-10-09 — Customisable quick-action shortcuts

**Changed files:** `mobile/lib/quickActions.ts` (new), `mobile/components/QuickActions.tsx`, `mobile/app/(tabs)/_layout.tsx`, `mobile/constants/i18n.ts`, `mobile/tests/quickActions.test.mjs` (new), `mobile/e2e/home.spec.ts`, `UNIFYD_DESIGN_SYSTEM.md`, `UNIFYD_SDD.md`, and this file.

**What changed:**
- **Edit mode.** The quick-actions sheet has an Edit button that switches to a checklist of seven shortcuts: Add expense, Scan receipt, Set budget, Add task, Reminders, My semester, and Log mood.
- **Rules.** Students keep 1–4 selected, see a live count, and get a translated explanation when a fifth is refused or the last is removed. Reset to default is available.
- **Saving.** Done saves the choice in device storage per account. A missing, damaged, or out-of-range stored value falls back to the defaults, and a storage failure keeps the choice for the session without blocking.
- **Navigation.** The new shortcuts open `/set-budget`, `/reminders`, and `/my-semester`.
- **Scope.** No database change was made. The choice does not follow the student to another device.

**Tests performed:**
- TypeScript and Expo lint pass.
- Unit tests 22/22 (3 new: parsing and fallback, ordering, the 1–4 limit).
- Full Expo Web E2E: 20/20. A new test covers the limit notice, swapping a shortcut, the new shortcut navigating, the choice surviving an app reload, the minimum notice, and reset.

**Next action:** Second-account RLS isolation test, then deployment preparation for user acceptance testing.

### 2026-10-09 — Centre quick-actions button and balanced navigation

**Changed files:**
- `mobile/app/(tabs)/_layout.tsx`, `mobile/app/(tabs)/quick.tsx` (new placeholder route)
- `mobile/components/QuickActions.tsx`
- `mobile/app/(tabs)/index.tsx`, `mobile/app/(tabs)/profile.tsx`
- `mobile/constants/i18n.ts`
- `mobile/e2e/home.spec.ts`, `mobile/e2e/unifyd.spec.ts`
- `UNIFYD_DESIGN_SYSTEM.md`, `UNIFYD_SDD.md`, and this file

**What changed:**
- **Bar layout.** The disabled floating + overlapped content on every screen. It is now a working button in the centre of the tab bar (`Home · Wallet · [+] · Planner · Mind`).
- **Quick actions sheet.** Tapping + slides up a sheet with Add expense, Scan receipt, Add task, and Log mood, and rotates the + into ×. The sheet closes with ×, the dimmed area, a tab press, or Android back, and is removed from the screen once closed so its buttons are never present while hidden.
- **Profile access.** Profile left the bar (still a hidden `(tabs)` route) and opens from the Home avatar, which now has a small settings badge. Profile has a back arrow.
- **Money panel.** The cramped one-line top-spending text became one row per category.
- **Language and docs.** English and Bahasa Melayu text was added, and the design system records the approved change.

**Tests performed:**
- TypeScript and Expo lint pass; unit tests 19/19.
- Full Expo Web E2E: 19/19, including a new navigation test covering:
  - 4 bar tabs, with no Profile tab;
  - the sheet opening and the × closing it;
  - each action's destination;
  - a tab press closing the sheet;
  - the avatar opening Profile, and the back arrow returning to Home.
- The first full run exposed hidden sheet buttons still present on the page; this was fixed by unmounting the sheet after it closes.
- An interrupted earlier run had left one test expense and one test budget in the test account. Both were identified by their test-only title and creation time and removed, and the account was confirmed empty afterwards.

**Next action:** Optional shortcut customisation (choose up to 4 actions), then second-account RLS testing.

### 2026-10-09 — Time-of-day greeting on Home

**Changed files:** `mobile/lib/greeting.ts`, `mobile/app/(tabs)/index.tsx`, `mobile/constants/i18n.ts`, `mobile/tests/greeting.test.mjs`, `mobile/e2e/home.spec.ts`, and this file.

**What changed:** The fixed "Good evening" greeting now follows the device's local hour:
- 05:00 morning
- 12:00 midday
- 14:00 afternoon
- 18:00 evening in English, 19:00 in Malay, because "Selamat petang" lasts until about dusk

The hour is re-read whenever Home is opened. The Malay forms are Selamat pagi, tengah hari, petang, and malam.

**Tests performed:**
- TypeScript and Expo lint pass.
- 2 new unit tests (period boundaries and the Malay difference).
- A new Home E2E test that moves the browser clock from 08:00 to 15:00 to 21:00.
- A full regression run, all passing: unit tests 19/19, server tests 24/24, Expo Web E2E 18/18.

**Status:** All four small follow-up items are complete:
- mood editing;
- the migration check;
- reminder history;
- the greeting.

No SRS Must or Should requirement remains unimplemented. Native-device checks and second-account RLS testing remain.

**Next action:** Second-account RLS isolation test, then deployment preparation for user acceptance testing.

### 2026-10-09 — Reminder history (SRS-FR-507)

**Changed files:**
- `mobile/lib/reminderHistory.ts`, `mobile/app/reminders.tsx`
- `mobile/app/_layout.tsx`, `mobile/app/(tabs)/planner.tsx` (Reminders link)
- `mobile/constants/i18n.ts`
- `mobile/tests/reminderHistory.test.mjs`, `mobile/e2e/reminders.spec.ts`
- `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, and this file

**What changed:** Planner has a new Reminders link. The screen lists Upcoming reminders (active tasks, soonest first) and Past 30 days, worked out from each owned task's deadline and saved offset with the scheduler's rule. Tasks completed before their reminder time are excluded. Each item opens its task. Loading, empty, error/retry, and pull-to-refresh states and English/Bahasa Melayu text are included. No database change was made. The screen shows scheduled times, not device delivery or dismissal.

**Tests performed:**
- Mobile TypeScript and Expo lint pass.
- Unit tests 17/17 (3 new).
- E2E: 2 new reminder tests, covering ordering, offsets, exclusions, owner and non-null filters, empty states, and a live task appearing and opening. Planner and My Semester suites re-run (3/3).
- The test account had 0 tasks afterwards.

**Next action:** Make the Home greeting follow the time of day.

### 2026-10-09 — Database check: OCR source grant and task reminder offset

**What was checked:** The two migrations still recorded as unexecuted were checked with the test account through requests that cannot save data:
- Inserts were deliberately invalid (a blank task title or a negative expense amount).
- The update targeted a non-existent ID.

PostgreSQL checks privileges before constraints. A check-constraint error therefore proves the privilege exists, while "permission denied" would show it is missing.

**Results:**
- `20261008_004_task_reminder_offset.sql` is applied. `reminder_offset_minutes` is readable, insertable, and updatable, and its check constraint rejected 30.
- `20261008_002_expense_ocr_insert_grant.sql` is applied. An insert with `entry_source = 'ocr'` reached the amount check, and an update of `entry_source` was refused (42501), as designed.
- Task and expense counts for the test account stayed at 0, and no SQL was run.

**Changed files:** `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, and this file (status wording only).

**Next action:** Decide whether to build or formally defer reminder history (SRS-FR-507).

### 2026-10-09 — Mood check-in editing (SRS-FR-607)

**Changed files:** `mobile/app/(tabs)/mind.tsx`, `mobile/constants/i18n.ts`, `mobile/e2e/mind.spec.ts`, `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, and this file.

**What changed:** Each recent check-in now has an Edit action beside Delete. A sheet opens pre-filled with the saved mood, stress, and note; Cancel sends nothing. Save updates only those fields on the owned row and keeps the recorded time. Success shows "Check-in updated." and refreshes history and trends; failure keeps the edits with a translated error. English and Bahasa Melayu text was added. The existing migration already granted these UPDATE columns, so no SQL changed.

**Tests performed:** Mobile TypeScript and Expo lint pass. Mind E2E: 3/3, including a new edit test covering:
- the pre-filled sheet;
- Cancel sending no request;
- a simulated failure keeping the edits;
- the saved values, with the recorded time and owner unchanged;
- a cleared note becoming null;
- ID and owner filters on every update request.

The test account had 0 mood rows afterwards.

**Next action:** Read-only check that the OCR `entry_source` grant and task reminder-offset migrations are applied.

### 2026-10-09 — Phase 8: integrated dashboard and Groq summaries

**Requirements implemented:** SRS-FR-701 to SRS-FR-710, plus the SRS-FR-608 to SRS-FR-610 low-mood rule and notice on Home.

**Changed files:**
- `server/src/app.ts`, `server/src/index.ts`
- `server/src/insight-facts.ts`, `server/src/insight-data.ts`, `server/src/insight-summary.ts`, `server/src/insights.test.ts`
- `server/.env.example`, `server/README.md`
- `mobile/app/(tabs)/index.tsx`, `mobile/components/home/DashboardPanel.tsx`, `mobile/components/Screen.tsx`
- `mobile/lib/dashboardFacts.ts`, `mobile/lib/dashboardData.ts`, `mobile/lib/insights.ts`, `mobile/lib/receiptOcr.ts` (base-URL helper exported only)
- `mobile/constants/i18n.ts`, `mobile/tests/dashboardFacts.test.mjs`, `mobile/e2e/home.spec.ts`
- `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, and this file

**What changed:**
- **Home layout.** The placeholder hero and module cards were replaced with a live overview (month spending and budget status, next deadline, this week's mood) and three tappable Money, Studies, and Wellbeing panels with empty states. A clearly labelled AI summary card has a fallback message, and pull-to-refresh and a summary refresh button were added.
- **Facts.** The device calculates the facts. The server recalculates the same facts with the student's own token, so RLS still applies.
- **Groq.** Groq receives aggregate numbers only (`openai/gpt-oss-20b`, strict JSON schema). The server checks every number and rejects diagnosis, prediction, and advice wording. Missing keys, provider errors, and unsafe replies return facts with a fallback.
- **Low-mood rule.** Mood ≤ 2 on 3 or more different days in the last 7 shows a gentle, non-clinical notice.

**Tests performed:**
- Server: typecheck, build, and 22/22 tests (13 new: time zone and month boundaries, task counts, low-mood rule, comparison threshold, payload privacy, validator acceptance and rejection, auth, fallbacks, cache, CORS).
- Mobile: TypeScript and Expo lint pass; unit tests pass 14/14, including a device/server facts equality check in `Asia/Kuala_Lumpur`.
- Full authenticated Expo Web E2E: 14/14, including 3 new Home tests (fixture facts and navigation, AI failure, fallback and retry, real-data load).
- A live call to a locally started server: 401 without a token. Signed in, it returned real database facts with `fallbackReason: not_configured`.

**Live Groq check (same day):** With the project owner's key in the ignored `server/.env`, a local server produced accurate English and Malay summaries from temporary test records, which were then deleted. Every figure matched the facts.

Probing found two Groq behaviours:
- An occasional `json_validate_failed` reply, about 1 in 6 Malay requests. It is now retried once.
- The free-tier tokens-per-minute limit, hit during a rapid test burst. Low reasoning effort reduces this; the app's 5-minute request spacing and the server's 10-minute cache keep normal use well below it.

An early Malay reply came back in English, so the prompt now requires Malay and the validator rejects English text for Malay requests. Server tests: 24/24.

**Issues or decisions:**
- The Groq key must stay in `server/.env`. It was briefly placed in the ignored `mobile/.env`, which does not bundle it because it lacks the `EXPO_PUBLIC_` prefix, and was moved.
- Facts are calculated on both device and server; the parity test guards against drift.
- The Home greeting still always says "Good evening" (pre-existing).

**Next action:** Review summaries with real student data on a phone in both languages and themes, then collect AI-summary evaluation samples for the thesis.

### 2026-10-08 — Module 7 Phase 2: seed applied and live check

**What changed:** Before execution, the seed's conflict clause was changed so re-running it keeps credit hours (and their source label) added later from a verified source (`COALESCE`). Seven credit values that briefly appeared in the working file were reset to `NULL`. The project owner then ran the seed in the Supabase SQL Editor.

**Verification:** An authenticated client read 92 active Semester 1 and 77 Semester 2 `2026/2027` FK rows, all with unknown credits. A live, owner-scoped insert of real catalogue course BCS2233 (Semester 2) stored a linked non-custom snapshot. The duplicate pre-check found it, and a student update to `catalog_courses` changed nothing. The test row was deleted.

**Next action:** Check My Semester and Task shortcuts on a phone in both themes. Optionally add verified credit hours through a separate reviewed update file (for example, values the student copies from UMPSA Open Registration).

### 2026-10-08 — Module 7 Phase 2 continuation: seed correction, refinements, and E2E

**Requirements implemented:** SRS-FR-409 through SRS-FR-412.

**Context:** An earlier session had implemented the seed, My Semester, translations, Task form shortcuts, and documentation, then stopped before verification and testing.

**Changed files:** `supabase/seeds/2026_2027_fkom_catalog_courses.sql`, `mobile/app/my-semester.tsx`, `mobile/components/planner/TaskForm.tsx`, `mobile/e2e/semester.spec.ts` (new), `mobile/e2e/planner.spec.ts`, `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, and `PROJECT_PROGRESS.md`.

**What changed:**
- An independent re-extraction of the source PDF found that the earlier seed omitted eight Faculty of Computing degree courses that each fill a full page (BCI1033, BCI1093, BCI1103 Pekan, BCI2323, BCN1073, BCP2173, BCS1043, BCS2163). The seed now has 169 rows: 92 Semester 1 and 77 Semester 2. All 154 earlier rows matched the PDF unchanged. Credit hours remain `NULL`.
- My Semester now explains catalogue load failures above Retry. The 19-credit notice uses the design-system warning colour with an icon. A lint warning about ref cleanup was resolved.
- The Task form shows a "you can still type a subject" hint when the chosen semester has no subjects.
- New semester E2E tests were added. The existing Planner test was given only exact/visible-element selectors; Expo Web keeps earlier stack screens and fading dialogs in the DOM.

**Tests performed:** TypeScript, Expo lint, `npm run web` (HTTP 200), unit tests (moodTrends 6/6, reminderMath 4/4), and 3/3 authenticated E2E tests. See Phase 2 verification above.

**Issues or decisions:** Catalogue-selection E2E uses intercepted data until the seed is applied. Duplicate catalogue choices are prevented in the client and by an owned pre-insert query; there is no database unique rule, so simultaneous inserts from two devices remain theoretically possible. The seed has **not** been executed.

**Next action:** Project owner reviews and runs the seed in the Supabase SQL Editor, then verifies live catalogue search/selection and Task shortcuts on a device.

### 2026-10-08 — Module 5 Phase 1: academic task data foundation

Created one local `public.tasks` migration with generated IDs, Auth ownership and cascade deletion, required nonblank title/subject, optional description, required deadline, constrained priority/status defaults, and a completion timestamp consistent with completed status. It enables owner-only RLS for SELECT/INSERT/UPDATE/DELETE, revokes broad privileges, grants only task fields needed by authenticated clients, indexes each user's status/deadline list, and sets `updated_at` with a private security-invoker trigger. No Planner UI, reminder, notification, backend, or other table was added. The SQL has not been executed remotely.

**Verification:** A static structure check found all required task fields, four owner-only policies, narrow grants, the status/deadline index, and the private trigger. Mobile TypeScript and Expo lint passed; `npm run web -- --port 19020` bundled and returned HTTP 200. `git diff --check` found no whitespace errors. No SQL was executed; live RLS and constraints remain unverified until the migration is reviewed and applied.

### 2026-10-08 — Receipt scanning Phase 3: editable review and save

The scan route now places the shared expense form immediately below extracted merchant/date/total and warnings. Merchant, amount, and detected date prefill the form; category is always chosen by the student, and an undetected date remains empty until selected. The student can correct title, amount, category, date, and notes, then explicitly save. The authenticated client inserts only those reviewed expense fields, its session user ID, and `entry_source = 'ocr'`. Raw OCR text and the receipt image stay outside the database. Wallet focus refreshes history and period summaries after success; failed saves keep the edited form. A new reviewable migration grants only authenticated INSERT permission for `entry_source`; it has not been executed.

**Verification:** TypeScript, Expo lint, and two authenticated receipt web E2E tests cover prefill, missing-field validation, edited values, a failed save retaining input, and the exact intended insert with a mocked database response. Live Supabase save and native-phone review need verification after the grant is applied.

### 2026-10-08 — Handwritten receipt draft extraction refinement

The OCR text for a handwritten receipt split the merchant across `M/S`, `ZAHIRA`, and `BT. ALI`, and rendered its payable total as `TOTAL / WT 88` without decimal places. The server parser now joins that merchant pattern and accepts an integer amount only beside a payable-total label (including `88/=` on the following line). Integer totals remain marked for review because handwriting can be misread. The receipt's date field is blank, so the app correctly leaves its date undetected. No OCR text or image is saved as an expense.

**Verification:** Server typecheck and all nine backend tests passed. The user rescanned the real handwritten receipt and confirmed the draft shows `M/S ZAHIRA BT. ALI` and RM88.00.

### 2026-10-08 — Receipt scanning phone upload and payable-total fix

Verified the OCR backend from the phone on Wi-Fi. The app could reach `/health`, but React Native's file-URI FormData upload failed before the backend received the image. Native scanning now uses Expo FileSystem's multipart file uploader with the existing Supabase access token; Expo Web keeps its FormData path. In local development, the OCR URL follows Expo Go's current LAN host when the configured URL points to a local address. A real phone scan now reaches Google Vision and displays extracted text. The receipt's `Rounded Total (RM):` label and `89.70` amount were on separate OCR lines, so the parser now accepts an amount-only line immediately after a payable-total label without treating subtotals as totals. The same phone receipt now displays RM89.70. No receipt image or expense was saved. Temporary diagnostics were removed after verification.

**Verification:** Mobile TypeScript and Expo lint passed. Backend typecheck and eight tests passed, including the split-line payable total and a subtotal-only safeguard. The user confirmed the phone shows the real receipt's extracted text and RM89.70.

### 2026-10-08 — Receipt scanning phone configuration check

A phone screenshot showed the scan screen's `notConfigured` state. Expo inlines public environment variables in the JavaScript bundle, so the phone needs a full reload or update after the environment value changes. The user clarified that the phone provides a mobile hotspot to the computer. Further inspection found the ignored mobile OCR URL pointed to an active virtual Ethernet adapter rather than the computer's Wi-Fi interface on that hotspot. The ignored local URL was corrected to the hotspot-facing computer address; the backend responded to `/health` there. Expo Metro was restarted with a clear cache in LAN mode. Its new iOS bundle contains the hotspot-facing OCR URL and no longer contains the virtual-adapter URL. The restarted Expo server reported no phone connected, so physical-phone health-page access and OCR scan are still pending. Updated the English/Malay missing-configuration message and `server/README.md` with phone testing steps. TypeScript and Expo lint passed. No authentication, database, or OCR provider logic changed.


### 2026-10-08 — Receipt scanning, Phase 2: mobile selection and OCR request

Added a Wallet entry to the protected `/scan-receipt` Expo Router screen. Expo ImagePicker supports camera and gallery selection; the selected image is previewed locally, validated for supported type and known size, then sent in one multipart `image` field with the current Supabase access token. The returned merchant/date/total, raw text, and translated review warnings appear in a read-only draft. No image or expense is saved. Added `EXPO_PUBLIC_OCR_API_URL` to the mobile environment example and aligned ignored local development configuration to the server's port. The backend gained only scoped Expo Web CORS preflight and an optional private-network listener; token verification and upload rules remain intact.

**Verification:** Mobile TypeScript, Expo lint, and all five authenticated Expo Web E2E tests passed. The receipt test selected a PNG and confirmed the bearer-authenticated multipart request and unsaved draft preview with a mocked OCR response. Backend typecheck, production build, and all seven backend tests passed, including allowed/disallowed web preflight. A separate live browser-to-backend-to-Google Vision request with a temporary synthetic receipt showed the expected merchant and RM12.50; authenticated expense counts before and after were identical. The disposable account profile was restored and temporary files removed. Native camera/gallery permission, native networking, and accuracy on representative real receipts remain manual checks.


### 2026-10-08 — Receipt scanning, Phase 1: secure OCR backend

Created `server/` with Node.js, Express, TypeScript, the official Google Vision client, and Supabase Auth token verification through a publishable-key client. The `/health` route is non-sensitive. The OCR route authenticates before upload handling, accepts exactly one in-memory JPEG/PNG/WEBP image up to 5 MiB, validates its signature, and returns nullable merchant/date/amount, raw text, and review warnings. Google Application Default Credentials are used locally; no service-account JSON key, storage upload, database migration, expense write, or mobile UI change was made. Tests use injected verification and OCR responses. See `server/README.md` for setup and API details.

**Verification:** Server typecheck, all six route/parser tests, and production build passed. The built service returned HTTP 200 with `{ "status": "ok" }` from `/health`. A live authenticated request using the disposable test account and a temporary synthetic PNG returned HTTP 200, recognized the merchant, parsed `2026-10-08` and RM12.50, and returned no warnings. The synthetic image and temporary script were removed. Mobile TypeScript and Expo lint passed without UI changes. Accuracy on representative real receipts remains to be evaluated separately; automated unit tests do not send data to Google.


### 2026-10-08 — Module 4, Phase 3: Current-period budget summary

**Requirements implemented:** SRS-FR-303 through SRS-FR-307 for the current weekly/monthly period. Existing Phase 2 Set / Manage Budget code was complete and retained; no migration was created or run.

**Changed files:** `mobile/app/(tabs)/wallet.tsx`, `mobile/components/wallet/BudgetSummary.tsx`, `mobile/lib/budgetPeriod.ts`, `mobile/lib/budgetSummary.ts`, `mobile/constants/i18n.ts`, `mobile/app/add-expense.tsx`, `mobile/app/expense-detail.tsx`, `mobile/app/edit-expense.tsx`, `mobile/e2e/unifyd.spec.ts`, `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, and `PROJECT_PROGRESS.md`.

**What changed:** Wallet now reloads owner-scoped budget and paged expenses for the selected current week or month, calculates integer-cent totals, remaining/over-budget state, percentage used, elapsed-day daily average, and five-category shares. Dark cards and semantic cyan/red states support both approved themes. Older expenses remain only in all-time history. Expense routes preserve the selected period on return. Translated empty states cover the presence or absence of budgets and current-period expenses.

**Verification:** TypeScript, Expo lint, and `git diff --check` passed. `npm run web -- --port 19020` bundled and returned HTTP 200. All 4 authenticated E2E tests passed with no failures or skips. The budget test checked RM500 budget, RM50 spent, RM450 available, 10% used, category shares, current-week filtering, older-expense exclusion, and an overspent weekly state. It removed uniquely prefixed expense fixtures and restored original budget rows; a final authenticated read confirmed zero test expenses and the test account's original profile/current-budget state. Native pull-to-refresh, native visual/touch behaviour, and cross-user RLS remain manual checks.


### 2026-10-08 — Module 4, Phase 2: Set and Update Budget

**Requirements implemented:** SRS-FR-301 and SRS-FR-302 for the current weekly or monthly period. The project owner reports the Phase 1 budget migration has been applied; no migration was created or run in this phase.

**Changed files:** `mobile/app/(tabs)/wallet.tsx`, `mobile/app/set-budget.tsx`, `mobile/app/_layout.tsx`, `mobile/lib/budgetPeriod.ts`, `mobile/constants/i18n.ts`, `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, and `PROJECT_PROGRESS.md`.

**What changed:** Wallet has a Set/Manage budget entry regardless of expense history and reloads the selected current-period budget on focus or refresh. The protected budget form defaults to monthly, loads weekly/monthly amounts, shows the local period range, validates positive RM amounts, inserts a new owner-scoped budget or updates only an existing row's amount, and returns to Wallet with success feedback. English and Bahasa Melayu text is centralised in typed translations. No spending-versus-budget calculations or unrelated features were added.

**Verification:** `npx tsc --noEmit` and `npx expo lint` passed. `npm run web -- --port 19017` bundled, and `/set-budget` returned HTTP 200. Local checks passed for current Thursday and October periods, a week crossing New Year, leap February, and invalid/valid RM amount parsing. Live creation, update, form interaction, and cross-user tests require disposable authenticated accounts.


### 2026-10-08 — Module 4, Phase 1: Budget data foundation

**Requirements supported by the data foundation:** SRS-FR-301 and SRS-FR-302, with storage for later SRS-FR-303 through SRS-FR-307. This is a local migration draft, not an applied database change or completed Budget feature.

**Changed files:** `supabase/migrations/20261008_001_budgets.sql`, `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, and `PROJECT_PROGRESS.md`.

**What changed:** Added a reviewable `public.budgets` migration with positive amounts, weekly/monthly period checks, one budget per user and period, owner-only RLS, narrow grants, a latest-period index, and a private server-side `updated_at` trigger. Documented the future comparison with owned expenses using half-open date ranges. No app UI or existing migration changed.

**Verification:** A static SQL structure check passed for the requested fields, named constraints, owner-only policies, narrow grants, index, and private trigger. `npx tsc --noEmit` and `npx expo lint` passed. `npm run web -- --port 19015` bundled and the app root returned HTTP 200. `git diff --check` found no whitespace errors. The migration has not been executed in Supabase, so live constraint and RLS behaviour remain unverified.

**Next action:** Review the migration and approve its later Supabase execution. Budget UI and calculations belong to a subsequent task.

### 2026-10-08 — Phase 2: Expense detail, edit, and delete

**Requirements implemented in code:** SRS-FR-105 through SRS-FR-108. No migration was created or executed.

**Work already present when this continuation began:** Tappable Wallet history rows; a protected Expense Detail route with an owner-scoped single-row loader, loading/error/not-found states, and Retry; a translated delete-confirmation dialog and owner-scoped delete request; a shared expense form and English/Bahasa Melayu strings; Wallet success feedback and focus refresh after edit/delete. These mobile files were already tracked in the repository and were preserved.

**Changed files in this continuation:** `mobile/app/edit-expense.tsx`, `mobile/app/expense-detail.tsx`, `mobile/constants/i18n.ts`, `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, and `PROJECT_PROGRESS.md`.

**What changed:** Completed the missing protected Edit Expense screen. It loads and prefills the selected expense, reuses the Add form's validation, updates only permitted expense fields, and returns to Wallet after a confirmed update. Refined detail/edit loading messages and kept delete confirmation colours semantic. Wallet's existing focus reload recalculates the list and total after either mutation.

**Verification:** `npx tsc --noEmit` and `npx expo lint` passed. `npm run web -- --port 19014` bundled the app; `/expense-detail` and `/edit-expense` returned HTTP 200. Static review confirmed the edit payload contains only the five permitted fields, and detail/update/delete queries filter by record ID and current user while RLS remains enabled. No authenticated test accounts were available during this continuation, so opening a real row, editing it, cancelling and confirming deletion, Wallet total refresh, and another-user denial remain unverified live.

**Next action:** Test opening, editing, cancelling deletion, confirming deletion, and cross-user access with two authenticated disposable accounts. Then address any verified failures before advancing to another module.

### 2026-10-07 — Phase 2: Wallet summary and expense history

**Requirements implemented in code:** History-list portion of SRS-FR-105 and create-refresh portion of SRS-FR-108. The existing `public.expenses` table is used; no migration was created or run.

**Changed files:** `mobile/app/(tabs)/wallet.tsx`, `mobile/components/wallet/ExpenseHistoryRow.tsx`, `mobile/lib/expenseHistory.ts`, `mobile/constants/i18n.ts`, `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, and `PROJECT_PROGRESS.md`.

**What changed:** Replaced the one-row Wallet existence check and temporary history message with a paged, current-user query ordered by expense date and creation time. Wallet now has a dark total-spent summary, expense count, virtualized history rows, translated category/date display, pull-to-refresh, and loading/error/empty states. Returning from Add Expense reloads the total and rows. Existing RLS remains the security boundary; no edit, delete, budget, OCR, chart, or AI feature was added.

**Verification:** `npx tsc --noEmit` and `npx expo lint` passed. `npm run web -- --port 19013` bundled the Wallet route and returned HTTP 200. Local formatting checks passed for a two-expense RM15.90 total, `7 Oct 2026`, and `7 Okt 2026`. The project owner reports that a real expense exists, but no authenticated account/session was provided during this run. Opening that Wallet, checking its saved row, pull-to-refresh, adding a second record, and cross-user isolation remain unverified.

**Next action:** With access to the saved expense's account and a second disposable account, verify the Wallet total, row details, pull-to-refresh, second-expense update, and RLS isolation. Then implement expense details/edit/delete in the next Wallet sub-phase.

### 2026-10-07 — Phase 2: Manual Add Expense

**Requirements implemented in code:** SRS-FR-101 through SRS-FR-104. The project owner reports that the existing `public.expenses` migration has been applied; this session created or ran no SQL migration.

**Changed files:** `mobile/app/(tabs)/wallet.tsx`, `mobile/app/add-expense.tsx`, `mobile/app/_layout.tsx`, `mobile/components/wallet/ExpenseDatePicker.tsx`, `mobile/components/wallet/ExpenseTextField.tsx`, `mobile/components/profile/SelectionField.tsx`, `mobile/lib/expenseForm.ts`, `mobile/constants/i18n.ts`, `mobile/constants/theme.ts`, `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, and `PROJECT_PROGRESS.md`.

**What changed:** Wallet now checks for the signed-in student's first expense and presents a translated empty state and Add expense action. The protected form offers title, RM amount, exact database category choices, a cross-platform calendar date, and optional notes. Local validation prevents invalid amounts and missing required values. Saving uses the existing session and RLS client, leaves `entry_source` to its database default, and returns with translated feedback while Wallet refreshes its existence check. No expense history, totals, edit/delete, OCR, or budget UI was added.

**Verification:** `npx tsc --noEmit` and `npx expo lint` passed without errors or warnings. `npm run web -- --port 19012` bundled the `/add-expense` route and returned HTTP 200. A local validation check confirmed RM12.50 is accepted and `0`, negative values, and more than two fractional digits are rejected. A disposable authenticated test account was unavailable in this session, so the live Wallet tap, Supabase insert, stored-row ownership/source check, and authenticated invalid-submit UI test remain unverified.

**Next action:** Use a disposable authenticated account to save a Food expense for RM12.50 and confirm the resulting row has the account's `user_id`, `entry_source = manual`, and the entered values. Then implement expense history, details, edit, and delete as the next Wallet sub-phase.

### 2026-10-07 — Phase 2: Wallet expense data foundation

**Requirements supported by the data foundation:** SRS-FR-101 through SRS-FR-108 and SRS-NFR-001. The migration is a local draft, not an applied database change or a completed Wallet feature.

**Changed files:** `supabase/migrations/20261007_004_expenses.sql`, `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, and `PROJECT_PROGRESS.md`.

**What changed:** Added a reviewable `public.expenses` migration for positive manual expenses, approved categories, owner-only RLS, narrow grants, an owner/date history index, and a private server-side `updated_at` trigger. OCR and budget data remain outside this phase. No mobile UI or existing migration changed.

**Verification:** Static SQL structure checks (without executing SQL), TypeScript, Expo lint, and `npm run web` passed. The migration has not been executed in Supabase; owner-policy behavior has not been tested against a database.

**Next action:** Await review and approval of the migration before any Supabase execution. Wallet UI belongs to a subsequent task.


### 2026-10-07 — Phase 1: In-app legal information

**Requirements implemented in code:** SRS-FR-012. No database migration or consent flow was added.

**What changed:** Settings now has a separate Legal card linking to protected Privacy Policy and Terms of Use screens. A shared legal page component provides the account heading, back button, update date, and readable scrollable sections. All copy is translated through the typed English/Bahasa Melayu catalogue. The pages describe the academic prototype, its data practices and limits, and review duties without claiming compliance or absolute security. Existing theme palettes and preference behavior are unchanged.

**Verification:** TypeScript, Expo lint, and `npm run web` passed. Live authenticated navigation remains to be checked with a test account.


### 2026-10-07 — Phase 1: Collapsible Settings preferences

**Requirements implemented in code:** SRS-FR-008, SRS-FR-009, and SRS-FR-011. No database migration was created or run.

**What changed:** Settings now has compact Appearance and Language rows showing their current saved values. Each expands to radio choices and closes again on header tap. A successful choice saves through the existing profile row, applies immediately, and collapses; a failed save keeps choices visible with a translated error. Saving temporarily disables repeated taps. Onboarding retains its initial Language selector; Edit Profile now focuses on identity, academics, avatar, and reminder timing. The Light page and dark Settings card treatment remain intact.

**Verification:** TypeScript, Expo lint, and `npm run web` passed. Live authenticated preference persistence and native visual animation still require a test account and device run.


### 2026-10-07 — Phase 1: Language preference and visibility refinements

**Requirements implemented in code:** SRS-FR-009 and SRS-FR-010. The already applied `profiles.language_preference` column is used; no database migration was created or run.

**What changed:** Onboarding and Edit Profile now save English or Bahasa Melayu with the profile. A typed central catalogue in `mobile/constants/i18n.ts` supplies translated copy for the implemented account flow, Home, Profile, settings, shared controls, and tab labels. The profile refresh applies saved language immediately; missing values fall back to English. Light appearance has a legible Edit Profile icon and outlined Home avatar. Sign out is a filled destructive red button in both appearances; the approved Dark cards, gradients, navigation, and layout remain unchanged.

**Verification:** TypeScript, Expo lint, and `npm run web` were run. Authenticated visual and live Supabase preference checks still require a test account.


### 2026-10-07 — Phase 1: Persisted appearance preferences

**Requirements implemented in code:** SRS-FR-008. The user reports that the existing profile preference migration has been applied; this session did not run SQL.

**Changed files:** `mobile/constants/theme.ts`, `mobile/providers/AppearanceProvider.tsx`, `mobile/providers/AuthProvider.tsx`, `mobile/app/_layout.tsx`, `mobile/app/settings.tsx`, `mobile/app/(tabs)/_layout.tsx`, `mobile/app/(tabs)/index.tsx`, `mobile/app/(tabs)/profile.tsx`, `mobile/app/(auth)/login.tsx`, `mobile/app/(auth)/create-account.tsx`, `mobile/app/onboarding.tsx`, `mobile/app/edit-profile.tsx`, `mobile/components/Screen.tsx`, `mobile/components/SectionPlaceholder.tsx`, `mobile/components/auth/`, `mobile/components/profile/`, `UNIFYD_DESIGN_SYSTEM.md`, `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, and this progress log.

**What changed:** Added System, Light, and Dark choices in Profile Settings, saved through `public.profiles.theme_preference`. Dark keeps the approved palette and existing component styles. Light uses a cool off-white screen background with dark text on that background, while cards, inputs, navigation, the Add button, and the overview gradient retain their dark/brand treatment. No language behavior was changed.

**Tests performed:** TypeScript, Expo lint, `git diff --check`, and a web export passed. `npm run web` bundled; dark and light Login screens were captured at phone width and visually inspected. Protected Home/Profile/Settings appearance and live Supabase persistence still need an authenticated test account for visual and functional verification.

**Next action:** With a test account, verify all protected screens in both modes and confirm theme preference survives restart and follows the device when System is selected.

### 2026-10-07 — Phase 1: User Account and Profile module

**Requirements implemented in code:** SRS-FR-005, SRS-FR-006, and SRS-NFR-003/004/006. Live database verification remains pending.

**Changed files:** `mobile/constants/umpsa-academic-catalog.ts`, `mobile/constants/reminder-timing.ts`, `mobile/components/profile/`, `mobile/app/onboarding.tsx`, `mobile/app/edit-profile.tsx`, `mobile/app/(tabs)/profile.tsx`, `mobile/app/_layout.tsx`, `mobile/providers/AuthProvider.tsx`, and `supabase/migrations/20261007_003_profile_preferences.sql`.

**What changed:** Added the 11-faculty UMPSA catalogue with six Computing programmes, shared native selection and avatar components, an editable profile route, and a default reminder preference. Legacy `BCS Software Engineering` is mapped to the current programme label in the edit form. Other faculties save a null programme until catalogue entries are added.

**Tests performed:** `npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform web`, and `git diff --check` passed. `npm run web -- --port 19009` bundled `/edit-profile`, which returned HTTP 200. SQL was reviewed but not executed; no live account test was performed.

**Issue/decision:** The new reminder field cannot be saved until `20261007_003_profile_preferences.sql` is applied through the approved database workflow. Existing auth routing still reads profiles before that migration because it selects the existing row without naming the new column.

**Next action:** Review and apply the profile migrations, then test onboarding, profile edits, avatar changes, reminders, RLS ownership, and sign-out with a test account.

### 2026-10-07 — Phase 1: Auth and onboarding UI

**Requirements implemented in code:** SRS-FR-001 to SRS-FR-007 and SRS-NFR-001 for client-side profile gating. Live verification remains pending.

**Changed files:** `mobile/app/_layout.tsx`, `mobile/app/+not-found.tsx`, `mobile/app/(auth)/`, `mobile/app/onboarding.tsx`, `mobile/app/(tabs)/index.tsx`, `mobile/app/(tabs)/profile.tsx`, `mobile/components/Avatar.tsx`, `mobile/components/auth/`, `mobile/providers/AuthProvider.tsx`, `mobile/lib/authError.ts`, `mobile/package.json`, `mobile/package-lock.json`, and this progress log.

**What changed:** Added Supabase email/password screens, session and profile-based route protection, required profile onboarding with original avatar choices, and Profile sign-out. Existing Home, Wallet, Planner, Mind, and tab navigation remain in place.

**Tests performed:** `npx tsc --noEmit` and `npx expo lint` passed. `npm run web -- --port 19007` bundled and `/login` returned HTTP 200. `npx expo export --platform web` passed. No live account or database test was performed.

**Issue/decision:** The profile migration remains reviewable and was not applied here. Authenticated onboarding requires `public.profiles` and its Auth user trigger to be present in the target Supabase project.

**Next action:** Apply the reviewed migration through the approved database workflow, then test sign-up with and without email confirmation, sign-in, onboarding, route protection, and sign-out using test accounts.

### 2026-10-07 — PSM 2 planning baseline created

**Completed:**

- Reviewed the PSM 1 thesis to confirm the eight approved system modules.
- Confirmed the project direction as **AI-assisted**, not custom machine learning or predictive analytics.
- Confirmed Google Vision OCR for editable receipt extraction.
- Confirmed Groq AI for short descriptive summaries generated from verified facts.
- Required a deterministic rule-based fallback whenever Groq is unavailable or invalid.
- Created the Project Brief, PRD, SRS, SDD, and phase-by-phase development roadmap.

**Decision record:**

- No bank/e-wallet, university portal/LMS, social, clinical, or prediction features will be added to the MVP.
- The existing Expo Router structure, especially `/(tabs)`, must be preserved.
- Every implementation task must be tied to approved SRS requirement IDs and completed in one controlled phase.

**Tests performed:**

- Documentation consistency review completed across the Project Brief, PRD, SRS, SDD, and roadmap.
- No source-code or runtime tests have been performed yet; this is the purpose of Phase 0.

**Next action:**

- Begin Phase 0 by locating the Unifyd repository and running the existing Expo application.

## Changed files log

| Date | Files | Purpose |
|---|---|---|
| 2026-10-07 | `UNIFYD_PROJECT_BRIEF.md` | Created project source-of-truth brief |
| 2026-10-07 | `UNIFYD_PRD.md` | Created product requirements document |
| 2026-10-07 | `UNIFYD_SRS.md` | Created numbered software requirements specification |
| 2026-10-07 | `UNIFYD_SDD.md` | Created software design document |
| 2026-10-07 | `UNIFYD_DEVELOPMENT_ROADMAP.md` | Created controlled development roadmap |
| 2026-10-07 | `PROJECT_PROGRESS.md` | Created live project progress record |

## Test evidence log

| Date | Phase | Requirement IDs | Test/evidence | Result | Notes |
|---|---:|---|---|---|---|
| — | — | — | No implementation test yet | Pending | Begin after repository audit |

## Active issues and risks

| ID | Status | Issue / risk | Impact | Next action |
|---|---|---|---|---|
| RISK-001 | Open | Current codebase baseline is not yet audited in PSM 2 | Cannot safely start implementation without verifying structure and dependencies | Complete Phase 0 audit |
| RISK-002 | Open | OCR accuracy depends on receipt image quality and format | May require manual correction | Test a representative receipt sample set in Phase 7 |
| RISK-003 | Open | Groq/provider availability or invalid response | Dashboard summary may fail | Retain and test rule-based fallback in Phase 8 |
| RISK-004 | Open | Notification delivery varies by device permission and platform conditions | Reminders may not be delivered | Test permission, scheduling, update, and cancellation flows in Phase 5 |

## Deferred ideas

Do not implement an item here unless its scope is formally approved later.

| Idea | Reason deferred | Decision |
|---|---|---|
| Bank/e-wallet integration | Outside PSM 2 MVP and increases security/compliance scope | Out of scope |
| UMPSA portal/LMS/timetable integration | Requires external access and expands integration complexity | Out of scope |
| Spending/grade/mood prediction | Would require a justified predictive model and evaluation dataset | Out of scope |
| Social or shared-account features | Not needed for the individual student MVP | Out of scope |

## Update template for future sessions

Copy this section at the top of **Completed work log** after every meaningful implementation session.

```md
### YYYY-MM-DD — Phase [number]: [name]

**Requirements implemented:**
- SRS-FR-XXX

**Changed files:**
- `path/to/file`

**What changed:**
- Brief implementation summary.

**Tests performed:**
- Command/device/test steps:
- Result:

**Issues or decisions:**
- Issue/decision and its effect.

**Next action:**
- One clear next task.
```

## Rules for updating this file

1. Update it after every implementation session, not only at the end of a phase.
2. Record factual results only; do not mark a feature complete without a test or demonstration.
3. Include relevant SRS IDs, exact changed files, and a clear next action.
4. Record new ideas under **Deferred ideas** unless they are formally added to the approved scope.
5. Do not remove history; append new work logs at the top of the log section.
