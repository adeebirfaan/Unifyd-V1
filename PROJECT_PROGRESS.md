# Unifyd PSM 2 — Project Progress

> This is the single live progress record for Unifyd. Update this file at the end of every coding session and before starting a new development phase.

## Current status

| Item | Current value |
|---|---|
| Overall stage | Integrated dashboard and Groq summaries implemented locally |
| Current phase | Phase 8 - Integrated dashboard and Groq summaries |
| Current task | Device check of Home (AI summaries live) and My Semester |
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
