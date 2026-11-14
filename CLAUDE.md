# Unifyd — guide for Claude sessions

This file condenses every project document (Brief, PRD, SRS, SDD, Design System, Progress, server README, `mobile/AGENTS.md`) as of 2026-10-14.

- **Rule 1:** if something is not stated here or in the code, do not assume it. Check the named source section, or ask.
- **Rule 2:** open only the files a task needs. The long docs are listed under "Where to look".
- **Rule 3:** at the end of every session, rewrite "Current status" below (a few lines, facts only).
- **Rule 4:** keep this file current without being asked. When a change alters something a future session must know (commands, architecture rules, modules or endpoints, database tables or columns, design or code conventions, env variable names, test counts, branch state, or an owner decision), edit the matching section in the same session. Replace outdated lines instead of appending; keep it short. Session history, debugging notes, and step-by-step logs go in `PROJECT_PROGRESS.md`, not here. Mention the CLAUDE.md edit in the end-of-task summary.

## 0. Current status (updated 2026-10-16)

- **Unifyd Focus** (owner-approved Planner addition, 2026-10-16) is built one phase at a time, each with owner approval, on branch **`ui-revamp`** (it started equal to `main`). Phases 1 (design), 2 (timer and Focus screen), 3 (sync to Supabase; migration `20261016_001_focus_sessions` **applied per project owner 2026-10-16**, live checks 2/2), 4 (Focus insights), 5 (Poof companion, optional reflection, rule-based suggestions; migration `20261016_002_focus_session_reflections` **applied per project owner 2026-10-16**, live checks 3/3), and **6 (final QA and polish) are done**. **Status: development-complete, pending final device validation and UAT; not user-accepted or production-ready.** Final code review done 2026-10-16: no blocking findings (3 low-severity notes in `PROJECT_PROGRESS.md`, not fixed). **Committed on `ui-revamp` as `1884cc8`** (`feat: implement Unifyd Focus and study analytics`, owner-approved 2026-10-16; was `42a5dfc` before the 2026-11-14 history rewrites); **merged into `main` 2026-11-14 (owner-approved)**; the owner pushes. Do not repeat Phases 1–6 or start new Focus work unasked.
- **Tab bar fix (2026-11-14):** the hidden Profile tab left an empty sixth slot on iPhone, so Planner sat under the +. Fixed in `(tabs)/_layout.tsx`, with a guard check in `e2e/home.spec.ts` (12/12). Owner to confirm on the phone.
- **iPhone UAT is paused by owner decision (2026-10-16)** until all planned features are built. Do not resume it unless the owner asks. Recorded so far: item 4, both alerts delivered (PASS) but silent (minor finding; the optional Focus sound is a pending enhancement in `PROJECT_PROGRESS.md` "Deferred ideas"); item 5 Scenario 1 PASS. Everything else is **Deferred — Pending Full Application UAT** (list in `DEVELOPMENT_HANDOVER.md`). Keep running unit and e2e tests after every change; don't save all testing for the end.
- **Git history cleaned and pushed (2026-11-14, owner-requested):** every Claude co-author and `Claude-Session` line was removed and Claude-authored commits re-authored to the owner (file trees and dates unchanged); the receipt-data commit `ff4f044` is gone. The misspelled author email on older commits was also corrected to the owner's current address. The owner force-pushed both: GitHub `main` = local `main` = `09c5832`; GitHub's contributor list shows only the owner. `ui-revamp` = Focus `1884cc8` plus five commits (SDK 58, tab bar, receipt rules, retake hint, docs); **merged into `main` 2026-11-14** (owner-approved; the owner pushes `main`). The old history is kept only in local `backup-2026-11-14/*`, `backup-2026-11-14-email/*`, and `clean-*`/`rewritten/*` branches; never push those backups (they contain `ff4f044`).
- **Module 8 AI summary (owner decision 2026-10-16, Option A):** restore the validated `/api/insights/generate` summary as a separate section inside Poof's existing chat sheet; no Home card and no Poof redesign. Analysis and phased plan are in the top `PROJECT_PROGRESS.md` entry. **Waiting for owner approval before any implementation.**
- **To resume Focus:** read SRS §5.11, SDD §7.10, and the top `PROJECT_PROGRESS.md` entries. Final tests (Phase 6): unit 167/167; `focus` 9/9, `focusInsights` 6/6, `focusCompanion` 5/5, `focusLive` 3/3 (real database), `studies` 6/6; full Playwright **117/117**. Known limitation: a round that finishes while Focus is closed is saved, but gets no celebration or reflection.
- **Owner decisions for Poof on Focus (2026-10-16):** a compact row under the timer card; Poof holds still during focus rounds and pauses, floats when ready and on breaks, and celebrates once per completed round; the greeting is text only (`PoofMascot` is unchanged); suggestions appear only on Focus screens (Poof chat and its server contract are unchanged). Still pending: the deferred phone checks and a true cross-account RLS test (needs a second test account).
- **Receipts (unchanged):** scan-speed work is merged into `main`; after-fix iPhone timings have not been run yet. Next: an image-size check on the **development set only**, then switch `SCAN_TIMING` / `EXPO_PUBLIC_SCAN_TIMING` off. **Final set ready (2026-11-14):** 43 receipts in `server/local-data/receipt-eval/final/` (`099`/`100` excluded as copies of dev `037`/`042`); Vision OCR cached; labels drafted by Claude and checked by the owner. **`--final` was run once on 2026-11-14** (report `reports/final-2026-11-14.txt`): all-three-correct 37.2% on the final 43, 53.3% held-out, 41.4% on all 58 unseen (dev 78.6%). **Merged into development the same day** (scored folder archived as `final-2026-11-14-scored/`): 100 receipts = 72 dev + 28 held-out (hash split), dev all-three 61.1%. Totals, dates, and merchants improved the same day (dev total 80.6% → 93.1%, date 87.5% → 90.3%, merchant 81.9% → 87.5%, all-three 61.1% → 75.0%); what remains is mostly OCR or handwriting damage. General rules only; any future final score needs a fresh `final/` set. Do not edit labels unasked, and never tune the parser on held-out or final receipts. Leave the untracked `completed receipt data.md` alone.

## 1. Project identity and scope

- **Title:** Unifyd, an AI-assisted smart student life management application with financial, academic, and mental wellness analytics.
- **What it is:** a Final Year Project (PSM 2) at UMPSA (Universiti Malaysia Pahang Al-Sultan Abdullah) for Malaysian university students. Android-first, built with Expo.
- **Developer:** solo student. Development and tests run on Windows with Expo Web; the owner tests on a real iPhone or Android phone with Expo Go.
- **The eight approved modules:**
  1. Account & Profile
  2. Financial Tracking
  3. Receipt OCR
  4. Budget & Spending
  5. Academic Tasks
  6. Reminder Notifications
  7. Mood Tracking
  8. Integrated Dashboard and AI summary

  Also built: My Semester subjects and the personal timetable (filed as "Module 7" phases in the SRS), the **Poof** AI chat assistant, and **Unifyd Focus** (owner-approved 2026-10-16, part of Planner; SRS §5.11).
- **AI-assisted, not ML:**
  - Google Cloud Vision does OCR (receipts and timetables).
  - Groq writes **descriptive** text only, from facts the app or server calculated.
  - Every AI feature has a rule-based fallback.
  - Never claim to predict spending, grades, or mood.
- **Out of scope (do not build without a formal scope decision):**
  - bank, e-wallet, payment, or investment integration;
  - UMPSA portal, LMS, fee, or official-registration integration (the personal timetable is the student's own plan, not official data);
  - custom ML training or prediction, **except** the owner-approved expense category suggester (2026-10-13): in-memory Multinomial Naive Bayes over the student's own titles, which only suggests a category;
  - clinical diagnosis, counselling, or emergency service (the app may *show* help-line contacts);
  - social, collaboration, or shared-account features.

  Record new ideas under "Deferred ideas" in `PROJECT_PROGRESS.md`.
- **Product rules:**
  - Students see only their own records (RLS).
  - OCR output is always reviewed and editable before saving; nothing is auto-saved.
  - Completing or deleting a task cancels its reminder.
  - Wellness text is general, supportive, non-clinical, and carries a disclaimer.
  - AI uses only supplied, verified facts.

## 2. Repo map

| Path | Contents |
|---|---|
| `mobile/` | Expo SDK 58 (`expo ~58.0.21`, upgraded 2026-10-26), Expo Router 58 with **typed routes**, React Native 0.88, React 19.3, TypeScript strict. Read `mobile/AGENTS.md` before touching Expo APIs: fetch the v58 docs and never trust memory. Expo Go on the test phone must support SDK 58. |
| `mobile/app/` | Routes. `_layout.tsx` is the auth and profile gate. `(auth)/`: login and create-account. `onboarding.tsx`. `(tabs)/`: `index` (Home), `wallet`, `quick` (centre + slot; a direct visit redirects Home), `planner`, `mind`, `profile` (hidden with `tabBarButton: () => null` **plus** `tabBarItemStyle: { display: 'none' }`, opened from the Home avatar; without `display: 'none'` the empty item still takes a sixth slot and pushes Planner under the +). **Never use `href: null` on a tab:** since SDK 58 a hidden tab redirects to Home, so the screen becomes unreachable. |
| `mobile/app/` stack screens | `add-expense`, `edit-expense`, `expense-detail`, `scan-receipt`, `set-budget` (param `period=weekly\|monthly`, default monthly), `subscriptions`, `subscription-entry` (param `id` for edit), `split-bills`, `split-bill` (param `id`), `split-bill-entry` (param `id` for edit), `add-task`, `edit-task`, `task-detail`, `reminders`, `focus`, `focus-insights`, `my-semester`, `timetable`, `timetable-entry`, `timetable-import`, `settings`, `edit-profile`, `privacy-policy`, `terms-of-use`. |
| `mobile/components/` | Grouped by feature: `home/` (CardDeck, DeckCards, ShadePicker), `finance/` (subscriptions, split bills, `ConfirmDialog`), `scan/` (receipt scan steps), `focus/` (Unifyd Focus), `poof/`, `mascot/`, `wallet/`, `planner/`, `mind/`, `timetable/`, `profile/`, `auth/`, plus `Screen.tsx`, `Avatar.tsx`, `QuickActions.tsx`. |
| `mobile/lib/` | Logic and data. Pure, tested rule modules: `dashboardFacts`, `poofFacts`, `poofEngine`, `budgetSummary`, `budgetPeriod`, `moodTrends`, `reminderMath`, `reminderHistory`, `subscriptions`, `splitBills`, `timetable`, `greeting`, `quickActions`, `cardShades`, `avatarIds`, `focusTimer` (incl. `companionState`), `focusSyncCore` (incl. reflections), `focusInsights` (incl. `focusSuggestions`). Loaders: `*Data.ts`, `timetableEntries.ts`, `semesterCourses.ts`, `focusHistory.ts`. Clients: `supabase.ts`, `receiptOcr.ts` (`ocrBaseUrl()`), `insights.ts`, `poofAi.ts`, `timetableImport.ts`, `taskReminders.ts`, `subscriptionReminders.ts`, `focusNotifications.ts`, `focusSync.ts`; device storage `focusStorage.ts`. |
| `mobile/constants/` | `i18n.ts` (every string, English and Malay), `theme.ts` (tokens), `avatars.ts` (12-avatar manifest), `umpsa-academic-catalog.ts` (11 faculties, 6 Computing programmes), `reminder-timing.ts`. |
| `mobile/providers/` | `AuthProvider` (`session`, `profile`, `refreshProfile`), `AppearanceProvider` (`tokens`), `LanguageProvider` (`t`, `language`, `saveLanguage`). |
| `mobile/plugins/` | `withUnifydNotificationLargeIcon.js`, a config plugin for the Android notification large icon. |
| `mobile/tests/*.test.mjs` | Node unit tests that import `.ts` files directly. |
| `mobile/e2e/*.spec.ts` | Playwright on Expo Web: `unifyd`, `avatar`, `home`, `poof`, `mind`, `planner`, `reminders`, `semester`, `timetable`, `studies`, `focus`, `focusInsights`, `focusCompanion`, `focusLive` (real database), plus `global-setup`, `test-client`, and `safe-reporter`. |
| `server/` | Node 24 Express in TypeScript (ESM; imports use `.js` suffixes). Endpoints in §5. Receipt parsing: `receipt-parser.ts` composes `receipt-merchant.ts` (with the brand list `receipt-merchants.ts`), `receipt-total.ts`, `receipt-date.ts`, and `receipt-layout.ts` (rows from Vision word boxes). Line items: `receipt-items.ts`, outside the parser. OCR evaluation: `receipt-eval.ts` plus `scripts/receipt-*.ts`. |
| `supabase/migrations/` | SQL migrations (§6). `supabase/seeds/2026_2027_fkom_catalog_courses.sql`: the course catalogue seed. |
| Root `assets/` | Approved originals: avatars, logo, `poof-mascot.png`. The app bundles resized copies in `mobile/assets/`. |
| `docs/design references/` | Reference screenshots only; never ship them. `/local-assets/` (storyboard) and `local data/` (UMPSA catalogue PDF) are local only and must not be shipped. |

## 3. Commands

```bash
# mobile/
npm run typecheck                                     # tsc --noEmit
npm run lint                                          # expo lint (strict react-hooks rules)
TZ=Asia/Kuala_Lumpur node --test tests/*.test.mjs     # unit tests (TZ required; use the glob)
npx playwright test e2e/<file>.spec.ts                # or `npm run test:e2e`; starts Expo Web on :19018; needs mobile/.env.test
npm run web                                           # dev server
# server/
npm run typecheck && npm test && npm run build        # tsx --test with injected fakes, no network
npm run dev   |   npm run build && npm start          # 127.0.0.1:3001; set OCR_HOST=0.0.0.0 for a phone on the LAN
npm run eval:receipts:run                             # receipt OCR evaluation: labels.csv rows, cached Vision OCR, development scores
npm run eval:receipts:final-setup                     # final test set in local-data/receipt-eval/final/ (asks before Vision)
npm run eval:receipts:final-check                     # final labels format check only; never runs the parser
```

- **Last known counts (on `ui-revamp`, dates per item):** mobile unit 168, server 127 (2026-11-14, after the receipt total, date, and merchant rules), full Playwright e2e suite 117/117 (2026-10-16, after Phase 6). The Wallet "no budget and no expenses" test is intermittent: it fails 1 in 2 on clean `main` too. The `budget` failed-save test has been intermittent on `main` since 2026-10-14. Per spec, recent: Focus 9, Focus insights 6, Focus companion 5, Focus live 3, Studies 6, Wallet home 13, budget 4, Home 11, Poof 2.
- **E2E memory (2026-11-14, after the SDK 58 upgrade):** the Expo Web test server's memory grows with every page load and crashes ("JavaScript heap out of memory") partway through a full `npx playwright test`, even within `home`/`walletHome` alone; an 8 GB heap is more than the 7.7 GB PC has. Run spec files one at a time and rerun crash-hit tests with `-g`. Result that day: 116/117, only the known-intermittent Wallet "no budget and no expenses" test failed. Root cause not investigated.
- **Supabase:** the app's project is `unifyd-v1` in the **Cipher** organization (ref in `mobile/.env`). Free plan: it pauses after inactivity; the owner restores it from the dashboard. The old Unifyd organization and projects were deleted 2026-11-14.
- **Before calling a task done,** run typecheck, lint, and the relevant unit and e2e tests. If you change the server, also run server typecheck, test, and build.
- **Screenshots:** copy a spec into `e2e/zz-*.spec.ts`, call `page.screenshot` into the scratchpad, run it with `-g`, then delete the copy.
- **Server changes reach the phone** only after `npm run build && npm start` restarts the server.
- **Mobile env changes** require a full reload of Expo Go, because `EXPO_PUBLIC_*` values are inlined into the bundle.

## 4. Architecture rules (do not break)

- **Data access.** The app reads and writes Supabase directly, and every query also filters by `user_id`. Row Level Security (owner-only, `(select auth.uid()) = user_id`) is the security boundary.
  - There is no service-role key anywhere.
  - The server verifies `Authorization: Bearer <token>` with `getUser`. Where it reads data, it uses a per-request client carrying the caller's token, and it never trusts a user ID in the request body.
- **Secrets.** These stay only in `server/.env`: Groq key, Google credentials (Application Default Credentials; no JSON key file). The app has only the `EXPO_PUBLIC_*` Supabase URL, the publishable key, and the server URL.
- **Facts first.** Totals, counts, and trends are deterministic. Money is summed in **integer cents** and formatted as `RM 1,234.50` (`en-MY`).
- **AI payloads are aggregate-only.** No task titles, subjects, notes, names, IDs, or dates. The server validates exactly:
  - every number in the reply must appear in the facts;
  - diagnosis, therapy, medication, self-harm, prediction, guarantee, invest, link, and email wording is blocked (`BLOCKED_PHRASES` in `insight-summary.ts`);
  - a Malay reply containing English is rejected.

  Any failure becomes a fallback.
- **Duplicated rules that must change together:**
  - `mobile/lib/dashboardFacts.ts` and `server/src/insight-facts.ts` (a parity test runs in Kuala Lumpur time);
  - `mobile/lib/poofFacts.ts` `poofAiPayload` and `server/src/poof-chat.ts` `isPoofFacts` (a contract test in `poof-chat.test.ts`).
- **Testable logic.** Pure `lib` modules may import `@/…` **types only**, because Node tests cannot resolve aliases. Inject translations as a `t` function.
- **Navigation.** Preserve the Expo Router structure and `/(tabs)` (SRS-NFR-008). Never rename, move, or delete unrelated routes or files.
- **Database changes.** Migrations are written as reviewable SQL. **Never run SQL.** The owner applies it in the Supabase SQL Editor and reports back; record "applied per project owner" with a date.

## 5. Modules (current implementation)

### Account and profile
- **Sign-in.** Supabase email and password; `_layout.tsx` routes signed-out users to auth.
- **Onboarding** is required and blocks the app until complete. It asks for name, university (default UMPSA), faculty or programme from the UMPSA catalogue, study year, avatar, and language.
- **`profiles` columns:** `full_name`, `university`, `faculty`, `programme`, `study_year`, `avatar_id`, `onboarding_completed`, `default_reminder_timing` (`1_day|3_days|1_week`), `theme_preference` (`system|light|dark`; default `dark`), `language_preference` (`en|ms`; default `en`).
- **Settings:** collapsible Appearance and Language rows. A successful save collapses the row; a failure keeps it open with an error. There is also a Legal card with Privacy Policy and Terms of Use (October 2026, academic prototype, no consent flow).
- **Avatars:** 12 bundled illustrations, stored as a stable ID only. The default is `women_turban`, named "Turban girl". Unknown, legacy (`avatar-01`), or URL values fall back to the default. Avatars are never fetched from the network.

### Wallet
- **Expense CRUD.** Fields: title, amount > 0 (at most 2 decimals, `numeric(12,2)`), category, date, notes.
- **Categories:** `food`, `transport`, `academic_materials`, `personal`, `other`.
- **`entry_source`:** `manual` (default) or `ocr`. The client cannot change it after saving.
- **Delete** requires confirmation.
- **Budgets:** weekly (starts Monday) or monthly (starts on day 1), unique per user, type, and start date. Wallet's period view shows budget, spent, remaining or over-budget, % used, daily average (over elapsed days, minimum 1), and category shares. Periods use local dates; never convert them to UTC.
- **Subscriptions** (`/subscriptions`, opened from a Wallet card; added at the owner's request on 2026-10-12): manual planning only.
  - Mark as renewed (after confirmation) advances `next_billing_date` by one cycle. Nothing renews automatically, and no expense is created.
  - Pause/resume and delete (with confirmation) are available.
  - One local reminder fires at 09:00 on the billing date minus `reminder_days_before`, on the channel `unifyd-subscription-reminders`. Notes never appear in a notification.
  - The monthly equivalent is integer cents over active plans only.
- **Subscriptions screen layout** (2026-10-13): header with Add → monthly overview → "Needs attention" (≤ 3, `attentionSubscriptions`) → compact active rows → collapsed Paused. Tapping a row opens `SubscriptionDetailsSheet`, where renew and delete confirm in-sheet. Brand tiles come from `lib/subscriptionBrands.ts`, in order: local Simple Icons paths in `constants/brandMarks.generated.ts` (regenerate with `node scripts/generate-brand-marks.mjs`), then Ionicons marks, then a category icon, then an initial; nothing is fetched. Sheets share `hooks/useSheetDrag.ts`. The subscriptions e2e freezes the clock, so it runs with Reduce Motion.
- **Split bills** (`/split-bills`): a private tracker of what others owe the student.
  - You is always a participant and is settled. Other people are names only, never accounts.
  - Equal splits are in cents, with leftover cents going to You first. Custom shares must equal the total exactly.
  - Mark paid/unpaid is whole shares only. Outstanding is the unsettled shares of other people. A bill is Settled when every other person is settled.
  - Nothing is ever sent to participants.
- **Wallet `FinanceSummaryCard`:** renewals in the next 7 days and the amount owed. Never part of spending totals.
- **Wallet home layout** (2026-10-13): header and period switch → `FinanceDeck` (Home `CardDeck` with the cards `FinanceOverviewCard` on `colors.brandGradient`, `SpendingBreakdownCard` (donut, top 3), and `FinanceAttentionCard` (≤ 2 real items, only when present); dots "Finance card N of M", direct selection in one stable place via `CardDeck stableFront` with no Back to overview, a guide at the bottom of the overview card, test IDs `finance-deck-*`) → `FinanceQuickActions` (shared `IconQuickActions` 4-column grid: Add expense, Scan receipt, Budget, Split bills; row 2: Subscriptions tile) → compact recent rows grouped by day (`groupExpensesByDate`; newest 5 rows in total; "View all (N)" opens `AllExpensesSheet`, a Modal reusing the loaded rows, with sticky day headers). Composition lives in `lib/walletOverview.ts`; figures still come only from `calculateBudgetSummary`. The existing `budget-*` test IDs are kept.
- **Receipt OCR** (`/scan-receipt`, camera or gallery) → on-device preparation (`lib/receiptImage.ts` rules, `lib/receiptImageTools.ts`: upright JPEG, longest side ≤ 2400 px and never below 1600, quality 0.8 then one retry at 0.6, ≤ 5 MiB; HEIC accepted) → server (JPEG, PNG, or WEBP; up to 5 MiB) → editable review.
  - Category always starts empty, and an undetected date stays blank.
  - Saving is explicit and sets `entry_source='ocr'`.
  - The image and raw text are never stored.
  - **Scan flow** (2026-10-14, design system "Receipt scan flow"): one route, three steps in `app/scan-receipt.tsx` with `components/scan/`: **Start** (`ScanStart`: gradient icon tile, privacy line naming the Unifyd server and Google Cloud Vision, Scan with camera / Choose photo or screenshot / Add expense manually) → **Reading** (`ScanReading` + `ReceiptReadingRing`, RN `Animated` dotted ring; ≥ 1.2 s, Retry and Enter manually after 20 s, static under Reduce Motion) → **Review** (`ScanReview`: photo row with full-screen viewer, Details with amber "Check" marks from the warnings, `ReceiptItemsCard` only when the optional `items` field is present, `DetectedTextSheet`, fixed Save expense). Review offers **Retake photo** (back to Start) when the photo was hard to read (no text, or ≥ 2 of the 3 fields flagged), until a field is edited (2026-11-14; owner confirmed on the phone). Rules in `lib/scanFlow.ts`; form state shared with Add expense via `hooks/useExpenseDraft.ts`. `scanReceipt` takes an abort `signal` and reports `network`, `timeout`, and `cancelled` separately. Items are never saved.

### Planner
- **Task fields:** title and subject required, description optional, deadline (`timestamptz`), priority `low|medium|high` (default medium), status `pending|ongoing|completed`.
- **`completed_at`** is set exactly when the task is completed; reopening clears it.
- **Order:** active tasks by nearest deadline, then completed tasks.
- **Studies main page** (2026-10-13): header → `InsightDeck` `studies-deck` (Academic focus on `colors.brandGradient` as the default card with the only guide, then Today next class and Semester on dark cards) → dots → `IconQuickActions` with `columns={3}` (Add task, My semester, My timetable / Focus mode, Reminders: 3 + 2; Wallet's `FinanceQuickActions` keeps 4 columns) → Priority tasks (≤ 5 incomplete, `priorityTasks` in `lib/studiesOverview.ts`: overdue → today → High → Medium → Low → undated) with "View all (N)" opening `AllTasksSheet`. Rows (`TaskRow`) keep complete/reopen. `InsightDeck` (`components/home/`) is the shared measured deck behind `FinanceDeck`.
- **Reminders** are per-task `reminder_offset_minutes`: none, 0, 60, or 1440.
  - They are scheduled with local `expo-notifications` on the Android channel `unifyd-task-reminders`.
  - The app reconciles them on start, foreground, language change, and task changes, and clears them on sign-out.
  - Tapping a reminder opens the task. Web does not deliver them.
- **Unifyd Focus** (`/focus`, all 6 phases done, development-complete; device checks and UAT deferred; SDD §7.10):
  - Timer rules in pure `lib/focusTimer.ts`: timestamps are the source of truth, and ticks only redraw (`FocusDial`). Presets Classic 25/5, Deep 50/10, Quick 15/3, plus Custom; a long break (default 15) after every 4th round. After a break, the next round waits for Start.
  - Completed = reached its planned length; partial = ended early with ≥ 1 min of focus (kept); discarded = Reset or ended under 1 min (not kept). Breaks and paused time never count. Reset affects only the current round.
  - Device storage: `unifyd:focus-session:<userId>` (state) and `unifyd:focus-blocks:<userId>` (kept rounds awaiting Phase 3 sync; never cleared on sign-out). Sign-out pauses the timer and clears alerts (channel `unifyd-focus`).
  - Subject/task links are read-only (semester subjects or General study; open tasks filtered by exact subject text). The timer never changes a task. Rounds keep a copy of the task title and subject label.
  - **Sync** (Phase 3): `lib/focusSyncCore.ts` holds the rules (pure); `lib/focusSync.ts` wires them to Supabase. A round leaves the outbox only after its insert succeeds, or after `23505` when the same ID is shown to be the student's own row.
    - A deleted or foreign link: retry once without the links. A row the table refuses: keep it and count it. No network, a 15 s timeout, or a missing table: wait.
    - Sending runs when a round is kept, when Focus opens, on sign-in, on foreground, and every 60 s while rounds that can still succeed wait (refused rounds are not retried every minute). It checks the signed-in user before every insert. One quiet status line (`focus-sync`) shows the state.
  - **Focus insights** (`/focus-insights`, Phase 4; opened from the `focus-insights-link` row on Focus): Today and This week tiles, rounds this week, an optional goal, a Monday–Sunday bar chart, subjects over the last 30 days, and history in pages of 20.
    - Rules in pure `lib/focusInsights.ts`. Only `focus_seconds` counts, never planned time. **A round counts on the local day it ended**; one total is stored per round, so midnight-crossing rounds are not split.
    - Synced rows and device-outbox rounds are merged by ID (never counted twice), and device rounds are marked "On this device". Subjects group by the saved label (null = General study); percentages use the largest remainder, so they add up to 100.
    - The goal is a device preference at `unifyd:focus-goal:<userId>` (daily 15–480 min or weekly 60–3000 min). There are no streaks.
  - **Poof companion** (Phase 5, `components/focus/FocusCompanion.tsx`): the row under the timer.
    - Poses come from `companionState`: still while focusing or paused (the same image on its disc), the `idle` float when ready or on breaks, and `celebrate` once for a round completed while Focus is open.
    - It shows one message. When ready, that is the top suggestion, which may carry a "Focus on this task" action.
    - Hide or show is stored at `unifyd:focus-poof-hidden:<userId>`. Not interactive. Reduce Motion is handled by `PoofMascot`.
  - **Reflection** (Phase 5): after a round completes on screen, the student may answer "How was your study session?" (Great, Okay, Struggled, Tired) or Skip; it never blocks the timer.
    - The answer waits at `unifyd:focus-reflections:<userId>` (first answer wins) and is sent after its round, by an update limited to `reflection is null`.
    - Never interpreted, never sent to AI.
  - **Suggestions** (`focusSuggestions`, on the device, no Groq), in this order:
    - a task due later today or tomorrow;
    - a reached goal, or a goal at least half-way;
    - an hour or more of focus today;
    - a semester subject with no focus time this week, only after some study this week;
    - a starter tip when there are no rounds.
    - Rules needing history are skipped when it fails to load. Focus shows 1 (in Poof's row when ready); Focus insights shows up to 3 (`focus-suggestions`).
- **`/reminders` history** is derived from tasks (deadline minus offset): Upcoming, and Past 30 days. No `reminders` table exists.
- **My Semester** (`/my-semester`) lets students pick 2026/2027 Faculty of Computing catalogue courses (169 rows, credits all `NULL`) or custom subjects.
  - There is **no minimum-credit rule**; a warning above 19 known credits never blocks saving.
  - The task form offers those subjects as `CODE — Name` shortcuts, and the task keeps its own text copy.
  - The session and semester choice is stored in AsyncStorage at `unifyd:semester-choice:<userId>`.
- **Timetable** (`/timetable`, a week grid):
  - Manual classes can be added, edited, and deleted.
  - Import accepts PNG, JPEG, or PDF up to 5 MiB, reading the first 3 PDF pages. The server uses fixed rules (no AI) and returns drafts.
  - Review is mandatory: only complete, ticked drafts are saved, so a partial save is fine.
  - Clashes are warnings only, and empty or partial timetables are valid.
  - `NextClassCard` falls back to "No upcoming classes in your timetable".
  - Not official UMPSA registration.

### Mind
- **Check-ins:** mood 1–5 and stress 1–5 with an optional note. **Multiple per day are allowed.**
- **Edit and delete.** Editing keeps `recorded_at`.
- **Trends:** 7-day (default) or 30-day. The previous-period comparison needs at least 2 entries in each period, and a difference under 0.25 points counts as "similar".
- **Ideas:** at most 2 local rule-based ideas, with a non-professional-advice disclaimer.
- **Low-mood rule (SRS-FR-608):** mood ≤ 2 on at least 3 different local days in the last 7 shows a gentle notice.

### Home (dashboard)
- **Layout:** logo with `unifyd.`, "YOUR SPACE", a time-of-day two-line greeting, and the avatar (opens Profile).
  - Greeting times: morning from 05:00, midday from 12:00, afternoon from 14:00, evening from 18:00 (19:00 in Malay).
- **Card deck:** Overview (gradient, in front), then Money, Studies, and Wellbeing. Move by native horizontal paging, peek taps, or dots.
- **Card colours:** six dark shades stored at `unifyd:card-shades:<userId>`.
- **Facts** are calculated on the device (`dashboardData.ts` and `dashboardFacts.ts`).
- **No AI summary card on Home any more.** `lib/insights.ts` and `/api/insights/generate` remain but are unused by Home.
- **Poof chat launcher** at the lower right (see Poof).
- **Quick actions:** the centre + opens a sheet; students choose 1–4 of 7 shortcuts, stored at `unifyd:quick-actions:<userId>`.

### Poof (AI assistant, Phase 1, read-only)
- `lib/poofFacts.ts` builds the snapshot from Wallet, budgets, tasks, semester and timetable, moods, and profile, and also builds the aggregate AI payload.
- `lib/poofData.ts` is the loader.
- `lib/poofEngine.ts` holds the English and Malay intent regexes (whole words; `makan` once matched inside `utamakan`), summary insights, rule answers, and the `POOF_ACTION_IDS` navigation allowlist.
- **Reply flow.** `lib/poofAi.ts` calls `POST /api/poof/chat`.
  - Crisis, greeting, and help messages never go to the AI.
  - When the AI fails, the rule-based answer is shown instead.
  - Each reply is labelled "AI answer" or "Quick answer".
- **UI** (`components/poof/`):
  - `PoofAssistant`: a Modal sheet. Data loads in `onShow`, and the backdrop ignores taps until the sheet is shown.
  - `PoofMessage`: crisis card (999, Befrienders KL 03-7627 2929, Talian HEAL 15555), support, and scope notices.
  - `PoofSummary`; `PoofLauncher` (speech-bubble launcher).
- **Animation:** all in `components/mascot/PoofMascot.tsx`.
  - welcome once per app session, idle on focus, a hop on tap guarded by a busy flag;
  - reduced motion leaves Poof still;
  - `backdrop: 'disc'|'bubble'`;
  - web test attributes `data-phase`, `data-reactions`, `data-backdrop`.
- **Artwork:** `mobile/assets/mascots/poof/poof.png`. Never redraw, recolour, or crop it; animate with transforms only.
- **Read-only.** Actions only navigate. Any future write must show a preview and ask for confirmation.

### Server endpoints (`server/README.md` has details)
- `GET /health`.
- `POST /api/ocr/receipt`: one `image` part, JPEG, PNG, or WEBP, up to 5 MiB; the signature is checked. Returns `{merchantName, purchaseDate, totalAmount, rawText, warnings, items}` (the first five unchanged since Phase 1; `items` added 2026-10-14).
  - Parsing (2026-10-14): the endpoint passes the text **and** Vision word boxes from the same `documentTextDetection` call; the parser still works from text alone.
  - Merchant: a general list of nationwide Malaysian brands, then "THANK YOU FOR SHOPPING AT X", fuel brands over dealer companies, then generic header rules (a header line with its company registration, a business word, or a supporting company line beats an earlier slogan/logo/noise line; labels, `(`/`&` continuation lines and sentences over six words are never names; 2026-11-14). Total: label/amount pairing on rebuilt rows (sideways photos turned upright first, 2026-11-14), final labels over plain "Total" (incl. "Total Payment", "Total (incl tax)"), never subtotal/cash/change; with no total label, a card/QR/e-wallet payment amount or cash minus change is used with the review warning, and a total that disagrees with the card/e-wallet amount is flagged; unpaid orders and outstanding bills return `null`. Date: English/Malay month names, label/time context (a time with seconds may have OCR dashes/spaces), never due/expiry dates; a year misread as 29xx becomes 20xx and two different dates with equal support are flagged (2026-11-14).
  - Uncertain values reuse the three existing warning strings (the app maps them exactly).
  - Speed (2026-10-14): the Supabase token check runs in parallel with reading the upload (every path awaits it before any response or OCR; never cached), and `vision-warmup.ts` warms the Vision client at start-up without failing start-up. The app prepares photos in one pass from the picker's upright size (`encodeFile`), falling back to decode-then-encode.
  - Items (2026-10-14): `receipt-items.ts` (`withReceiptItems`, applied in `app.ts` after `parseReceiptText`, so the evaluation never sees it) returns `{name, quantity, unitPrice, amount}` lines (discounts negative). It adds `Items may be incomplete.` when they miss the total by more than RM 0.05 after printed rounding/tax, and returns `[]` when there is no total, the order is unpaid, or the lines are more than 40% off. The app shows that warning on the Items card only.
- `POST /api/timetable/import`: one `file` part, PNG, JPEG, or PDF; encrypted or truncated PDFs return 422. Returns `{candidates, warnings, pagesProcessed, totalPages}`. Raw text is never returned.
- `POST /api/insights/generate`: `{language, timeZone}` returns facts plus a summary or fallback. It uses a 10-minute cache.
  - Groq model `GROQ_MODEL` (default `openai/gpt-oss-20b`), temperature 0.2, strict JSON schema.
  - Retries once on `json_validate_failed`.
- `POST /api/ml/expense-category-suggestion`: body exactly `{title}` (≤ 120). Naive Bayes in `expense-classifier.ts` is trained per request on the verified caller's latest 500 `title,category` rows (`expense-history.ts`). Thresholds: ≥ 15 expenses, ≥ 2 categories, a known word, confidence ≥ 0.70, margin ≥ 0.15. Rate limit 60 per 10 min. Never Groq. The app (`ExpenseForm suggestCategory`, used in Add Expense and OCR review) only fills the field when tapped.
- `POST /api/poof/chat`: `{language, message ≤500, facts}`, accepting the exact shape only.
  - Rate limit: 30 requests per 10 minutes per session.
  - Returns `{source:'ai', reply, actions, scope}` or `{source:'fallback', fallbackReason}`.
- CORS allows localhost Expo Web origins plus `OCR_ALLOWED_ORIGINS`. Logs contain only status codes, never content or tokens.

## 6. Database (`supabase/migrations/`, all owner-only RLS with narrow column grants)

| Migration | Table | State |
|---|---|---|
| `20261007_001_profiles` | `profiles` (plus a sign-up trigger) | applied |
| `20261007_003_profile_preferences` | adds reminder, theme, and language columns | applied |
| `20261007_004_expenses` | `expenses` | applied |
| `20261008_001_budgets` | `budgets` | applied |
| `20261008_002_expense_ocr_insert_grant` | `entry_source` insert grant | applied (checked 2026-10-09) |
| `20261008_003_tasks` | `tasks` | applied |
| `20261008_004_task_reminder_offset` | `tasks.reminder_offset_minutes` | applied (checked 2026-10-09) |
| `20261008_005_mood_entries` | `mood_entries` | applied |
| `20261008_006_course_library` | `catalog_courses` (read-only), `student_semester_courses` | applied; seed applied 2026-10-08 |
| `20261009_001_profiles_avatar_default` | default `women_turban` | applied 2026-10-09 |
| `20261009_002_timetable_entries` | `timetable_entries` | applied per project owner (checked 2026-10-12: RLS, 15 columns, 4 policies, index, trigger, grants). E2E tests still mock this table. |
| `20261012_001_finance_subscriptions_split_bills` | `subscriptions`, `split_bills`, `split_bill_participants` (no `user_id`; RLS through the parent bill) | applied per project owner 2026-10-12; verified by `e2e/financeLive.spec.ts`. UI E2E specs still mock these tables. |
| `20261016_001_focus_sessions` | `focus_sessions` (app-supplied UUID; insert/select/delete only; links to own task and semester subject only, set null on delete with copied labels) | applied per project owner 2026-10-16 (owner checked RLS and 14 columns); verified by `e2e/focusLive.spec.ts` 2/2. `focus`, `focusInsights`, and `focusCompanion` specs mock the table. |
| `20261016_002_focus_session_reflections` | adds `focus_sessions.reflection` (`great\|okay\|struggled\|tired`, completed rounds only), an UPDATE grant on that column only, and an update policy (own row, `reflection is null`, completed) | applied per project owner 2026-10-16; verified by `e2e/focusLive.spec.ts` (15 columns; once only; own completed round only; no other column; signed-out blocked). |

There are no `receipts` or `reminders` tables. The SDD diagram lists them as design entities, but they were never built.

## 7. UI and design rules (`UNIFYD_DESIGN_SYSTEM.md` is binding)

- **Colours:**
  - brandBlue `#007AFB`, brandCyan `#34C1FC`; the gradient appears on only **one** focal element per screen (Overview).
  - Dark: bg `#0B0B0F`, surface `#17171C`, elevated `#23232A`, border `#2E2E37`, text `#F8FAFC`, secondary `#98A2B3`, tertiary `#667085`.
  - Status: success `#22C55E`, warning `#F59E0B`, danger `#EF4444`.
- **Appearance:**
  - Dark is the default.
  - Light changes only the page: bg `#F7F8FA`, text `#17171C`, accent `#0057B7`. **Cards, inputs, sheets, and the tab bar stay dark.**
  - Use `useAppearance().tokens`; add new tokens to both `dark` and `light`.
  - Do not use colour alone to convey meaning.
- **Spacing and shape:**
  - spacing 4, 8, 12, 16, 20, 24, 32; radius 12, 16, 24, 999;
  - type sizes: display 32, screen title 26, section 19, body 16, label 13;
  - screen padding 24; touch targets at least 44 pt;
  - one scroll area per screen (`Screen`, bottom padding 112);
  - Ionicons only; sentence case.
- **Style:** "Premium, calm, student-friendly", dark-forward, and **not glassmorphism-heavy**. Don't copy reference apps' branding or screens.
- **Tab bar:** `Home · Wallet · [+] · Planner · Mind`. The bar is 68 pt plus the safe area. The + is a 62 pt FAB rising 24 pt above it.
- **Required states:** loading, empty, error/retry, and success on every action. Honour reduced motion with `hooks/useReducedMotion.ts`. Bottom sheets follow the `ShadePicker` pattern.
- **Mandatory UI prompt clause** (Design System §12): read the design system before UI changes and report any intentional difference.

## 8. Code conventions

- **Strings:** every visible or accessible string is a typed key in `constants/i18n.ts`, in **both** `en` and `ms` with the same `{placeholders}`. Plurals use separate `…One` and `…Many` keys. User data and official UMPSA names are not translated.
- **Lint:** `react-hooks/set-state-in-effect` fails the build. Load data from events, `useFocusEffect`, or a Modal's `onShow`, not from `setState` inside `useEffect`.
- **Dependencies:** add none without asking; use `npx expo install`.
  - Dev only: `simple-icons` (CC0; used by `scripts/generate-brand-marks.mjs` and the brand test, never bundled).
  - Never imported directly but required: `expo-symbols` (a dependency of `expo-router`), `expo-linking`, `react-native-screens`, `react-native-reanimated`, `react-native-worklets`, `react-dom`, `react-native-web`. `expo-web-browser` was removed on 2026-10-14 (unused).
  - Installed: `expo-linear-gradient`, `expo-image-picker`, `expo-image-manipulator` (added 2026-10-14 for receipt photos), `expo-document-picker`, `expo-file-system`, `expo-notifications`, `react-native-svg`, `react-native-reanimated`, AsyncStorage, Ionicons.
  - Animations use RN `Animated`.
  - Gesture Handler is deliberately avoided (it mismatches Expo Go). No Lottie, no 3D.
- **Style:** match the surrounding code: dense single-line JSX props, short "why" comments, and `testID`s for e2e.
- **Line endings:** root Markdown files use CRLF; preserve them when editing with scripts.
- **Finance numbers:**
  - Standalone money and percentage values in Wallet, OCR, and the Home Money and Overview cards use `components/FinanceNumber.tsx`, which applies Space Mono loaded in `app/_layout.tsx`. Use `fit` for large amounts.
  - Never use it for inputs, labels, numbers inside sentences, or non-finance screens. **Exception:** the Manage budget amount input and its "RM" use it (`financeFontStyle`; owner request 2026-10-13).
  - Don't set `fontFamily` directly anywhere else.
  - `components/AnimatedMoneyAmount.tsx` (an odometer roll built from `FinanceNumber` glyphs; logic in `lib/moneyRoll.ts`) is used **only** for the Wallet overview's primary amount and Home's Overview and Money "Spent this month". It rolls only when the amount is visible (`play`). The Wallet overview is at the top, and Home uses the deck's `front` flag. Overview also has `replayOnShow`, so it rolls from RM 0.00 again each time it returns to the front. After a roll it settles into plain text. Wallet e2e reads the all-time total from `aria-label` (`testID wallet-total`, beside Recent expenses).

## 9. E2E pitfalls

- Mocks intercept `**/rest/v1/<table>?*` and match the **exact `select=` column list**; other selects reach the real database. Home and Poof use different selects.
- Stub `**/api/insights/generate` and `**/api/poof/chat`.
- Global setup forces the test profile to dark and English, and restores it afterwards. Tests clean up their own rows using unique prefixes.
- Expo Web keeps earlier stack screens and dialogs in the DOM, so use exact or scoped selectors.
- Wait for `data-phase="idle"` before measuring Poof.
- Focus specs mock `**/rest/v1/focus_sessions*`; an unmocked run sends real rows. The Focus sync line includes an Ionicons glyph in its web text, so use `toContainText`.

## 10. Workflow

1. **Before a task:** identify the phase or SRS IDs, and make the smallest complete change.
2. **After a task:** add an entry at the **top** of "Completed work log" in `PROJECT_PROGRESS.md`, using the template at the end of that file. Record facts only, including real test results, changed files, and one next action.
3. **Other docs:** update `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, and `UNIFYD_DESIGN_SYSTEM.md` only in the sections the change affects.
4. **Git:** don't commit unless asked. The working tree often holds the owner's uncommitted work; never revert it. **No Claude attribution:** commit messages and PR descriptions never carry `Co-Authored-By: Claude` or "Generated with Claude Code" lines, and commits are authored as the owner (owner decision 2026-11-14; also set in the owner's Claude Code settings).

**Status:** all SRS Must and Should features are implemented locally, and Poof Phase 1 is done. The full Expo Web e2e suite passed 117/117 on 2026-10-16 (`ui-revamp`, with Unifyd Focus) and 116/117 after the SDK 58 upgrade on 2026-11-14 (only the known-intermittent Wallet test failed). Still open:
- checks on a physical device (Poof feel, reminders, native pickers);
- an automated two-account RLS test (cross-user isolation has been confirmed manually by the owner);
- Phase 9 (evaluation, UAT, thesis evidence). **Started:** receipt OCR evaluation. 57 real receipts are labelled locally (42 development, 15 held out); development all-three-correct 21.4% → 78.6% after the 2026-10-14 parser work; **final score on 58 unseen receipts 41.4%** (`--final`, 2026-11-14). **Pending:** AI-summary samples, UAT, and the Likert questionnaire.
- Receipt evaluation data lives only in git-ignored `server/local-data/receipt-eval/` (images, `labels.csv`, `ocr/` cache); originals are also in `local data/receipt-eval/images`. Never commit or delete them.

**Environment variable names (never print values):**
- `mobile/.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_OCR_API_URL`, optional `EXPO_PUBLIC_SCAN_TIMING` (1 = scan stage timings in the Metro log, development builds only).
- `mobile/.env.test`: `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`.
- `server/.env`: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `GROQ_API_KEY` (optional), `GROQ_MODEL`, `PORT`, `OCR_HOST`, `OCR_ALLOWED_ORIGINS`, optional `SCAN_TIMING` (1 = per-scan stage durations in the server log via `scan-timing.ts`; off in production).

## 11. Known document inconsistencies (trust the code and the newest source)

| Topic | Older wording (Brief/PRD) | Actual (SRS and code) |
|---|---|---|
| Mood | One entry per day; Very Happy…Very Sad | Mood **and** stress, 1–5, multiple per day |
| Reminder choices | 1 day / 3 days / 1 week | Per task: none, at deadline, 1 h, 1 day. `profiles.default_reminder_timing` (1d/3d/1w) exists but does not drive scheduling |
| Styling | NativeWind | Not installed; StyleSheet plus tokens |
| Home AI summary | SRS FR-701–710 status text mentions a summary card and refresh button | Card removed 2026-10-10; Poof's chat replaces it |
| Roadmap | `UNIFYD_DEVELOPMENT_ROADMAP.md` listed as a source document | The file does not exist |
| Phase table | `PROJECT_PROGRESS.md` phase table and "Phase 0 checklist" were stale | Both were annotated with a 2026-10-14 status; the dated work-log entries remain the detailed source of truth |
| Design-references path | `docs/design-references/` | `docs/design references/` (with a space); file names fixed to single `.png` on 2026-10-14 |

`UNIFYD_DESIGN_SYSTEM.md` line 1 starts with a stray `~`.

## 12. Where to look

| Need | Source |
|---|---|
| Requirement IDs and acceptance criteria | `UNIFYD_SRS.md` §5 (SRS-FR-0xx…7xx, NFR-001–010); `UNIFYD_PRD.md` §6 |
| How a module is built, its data rules, and flows | `UNIFYD_SDD.md` §4–7 (7.2 budget maths, 7.4 reminders, 7.5 mood, 7.6–7.7 insights and Groq controls) |
| Visual specs | `UNIFYD_DESIGN_SYSTEM.md` §4–8 (Home deck, quick actions, Poof launcher) |
| History of what changed and why | `PROJECT_PROGRESS.md` "Completed work log" (newest first) |
| Endpoint details and phone setup | `server/README.md` |
| Expo rules | `mobile/AGENTS.md` |
