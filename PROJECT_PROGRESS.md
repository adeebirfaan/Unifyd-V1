# Unifyd PSM 2 — Project Progress

> This is the single live progress record for Unifyd. Update this file at the end of every coding session and before starting a new development phase.

## Current status

| Item | Current value |
|---|---|
| Overall stage | All SRS Must and Should features implemented locally, plus Unifyd Focus (owner-approved 2026-10-16); full Expo Web e2e suite 117/117 (2026-10-16, `ui-revamp`) |
| Current phase | Phase 9 - Evaluation, hardening, and thesis evidence (receipt OCR evaluation started 2026-10-14) |
| Current task | Unifyd Focus Phases 1–6 **development-complete** on `ui-revamp` (committed as `42a5dfc`, not merged or pushed; code review done; both migrations applied per owner 2026-10-16). It is pending final device validation and UAT, and is not user-accepted or production-ready. iPhone UAT and full UAT are **paused by owner decision (2026-10-16)** until all planned features are built. Waiting on: the owner's commit and merge decision, then the next feature. Receipt OCR: collect a fresh 40–50-receipt final test set |
| Next milestone | Remaining development, then full-application device checks and UAT, the final OCR evaluation, AI-summary samples, and the Likert questionnaire |
| Product direction | AI-assisted; OCR plus Groq descriptive summaries with deterministic fallback |
| Custom ML / prediction | Prediction not in scope. One owner-approved exception (2026-10-13): the Naive Bayes expense-category suggester trained per request on the student's own titles |

## Handover summary (2026-10-14)

Status words: **verified** = implemented and its automated Expo Web or server tests pass; **pending device check** = native or live behaviour not yet confirmed on a phone. Evidence for each item is in the dated work log.

### A. Completed work (verified)

- **Account and profile:** Supabase sign-in, required onboarding, profile editing, 12 local avatars, theme and language settings, legal pages.
- **Finance:** expense CRUD; weekly/monthly budgets (slide-to-save, shared "Budget saved." toast); subscriptions (manual renewals, local reminders); split bills; Wallet card deck and quick-action grid; receipt OCR (camera/gallery, editable review, explicit save with `entry_source = 'ocr'`); optional category suggestion.
- **Planner:** task CRUD with completion rules; Studies page (Academic focus deck, Priority tasks, All tasks sheet); local task reminders and reminder history; My Semester subjects; personal timetable (manual and import).
- **Mind:** mood and stress check-ins, 7/30-day trends, local ideas, low-mood notice.
- **Home:** card deck, quick actions, Poof assistant (Phase 1, read-only).
- **Server:** `/health`, receipt OCR, timetable import, insights, category suggestion, Poof chat.
- **Recent:** Wallet and Studies refresh (`950d231`); receipt OCR evaluation tool and parser improvements (`e5ec4e0` to `a5280d5`); maintenance review and documentation sync (2026-10-14).
- **Latest evidence (2026-10-14):** full Playwright e2e 82/82; mobile unit 103/103; server 93/93; typecheck, lint, and server build clean; offline OCR scoring on 42 development receipts: all three fields 78.6%, no silent errors.

### B. In progress

- **Phase 9 OCR evaluation:** the single `--final` run was done 2026-11-14 (41.4% all-three-correct on 58 unseen receipts); the final set was then merged into development (100 receipts) and the parser improved (development all-three 61.1% → 75.0%). An "after" score needs a new fresh set.
- **Physical-device verification** of recently changed screens (Wallet, budget, Studies) and of OCR with the new parser (needs a server restart: `npm run build && npm start`).

### C. Pending work, limitations, and technical debt

- **Not started:** AI-summary samples, UAT, and the Likert questionnaire (Phase 9); an automated two-account RLS test (isolation confirmed manually by the owner only).
- **Pending device checks:** task and subscription reminder delivery, native date/image/document pickers, Poof animation feel, OCR on the phone.
- **OCR limitations (flagged, not silent):** strongly tilted photos, receipts with only a subtotal or no total label, logo-only merchant names, handwritten two-digit-year dates.
- **Test reliability:** the Wallet test "no budget and no expenses … deck keeps its place" failed intermittently on 2026-10-13 (also on the code before that day's changes); it passed in both full runs on 2026-10-14. Monitor.
- **Technical debt:** `mobile/lib/insights.ts` and `/api/insights/generate` are unused by the app but kept for Module 8 and the Phase 9 AI-summary samples; older PRD/Brief wording is listed in `CLAUDE.md` §11. (Cleaned up 2026-10-14: `expo-web-browser` removed, design-reference file names fixed, leftover branches merged or deleted.)

### D. Next development priorities

1. **Commit and push** the 2026-10-14 maintenance changes after review.
2. **Phone checks:** restart the server, scan several receipts, and run the device checklist in C. These confirm work already built and need no new code.
3. **Final OCR evaluation:** done 2026-11-14 (41.4% on 58 unseen receipts), then merged into development. For an "after" score: collect 20–30 fresh receipts, label them, run `final-setup`, `final-check`, and `npm run eval:receipts -- --final` once, with no parser change after collecting.
4. **Two-account RLS test:** prerequisite: a second test account added to the ignored `mobile/.env.test`.
5. **Remaining Phase 9 evidence:** AI-summary samples (prerequisite: `GROQ_API_KEY` in `server/.env`), then UAT and the Likert questionnaire (prerequisite: participants and an approved questionnaire).
6. **Housekeeping:** done on 2026-10-14 (see the maintenance entry). The insights module stays until the AI-summary samples are collected.

New features are not a priority until B and C are closed.

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

**Latest full run (2026-10-14, `main` at `a5280d5`):** 82 passed, 0 failed, 0 skipped (`npx playwright test`).

**Earlier targeted local run:** 2 OCR review E2E tests passed, 0 failed, 0 skipped. They covered editable prefill, required missing fields, safe failed-save retention, the exact reviewed insert payload, and Wallet return with mocked OCR and database responses. Mobile TypeScript and Expo lint passed; Expo Web bundled through Playwright. The prior full five-test suite and its account-state cleanup remain available. A separate earlier live Expo Web request reached the local OCR server and Google Vision with a temporary synthetic receipt; the expense count stayed unchanged.

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

> **Status as of 2026-10-14.** Legend: *Implemented, automated tests pass* = code exists and the Expo Web/server tests listed in the work log pass; *device/manual checks pending* = native or two-account behaviour not yet verified. The dated work log below remains the detailed source of truth.

| Phase | Status | Summary | Evidence / notes |
|---:|---|---|---|
| 0. Project baseline and environment audit | Complete (superseded) | Repository audited and documented in `CLAUDE.md`; app runs on Expo Web and Expo Go | 2026-10-14 maintenance review: typecheck, lint, 103 mobile unit, 93 server, 82 e2e tests pass |
| 1. Supabase foundation, authentication, profile, and RLS | In progress | Client, auth screens, profile gate, and onboarding implemented | Live Auth and database flow still needs testing |
| 2. Financial tracking | In progress | Applied expense table (per project owner), manual creation, Wallet total/history, detail, edit, and confirmed delete | User reports a saved real expense; live mutation and cross-user checks pending account access |
| 3. Budget and spending analysis | In progress | Applied budget table (per project owner), Set / Manage Budget, and current-period spending summary | Authenticated Expo Web budget test passed; native and cross-user checks remain |
| 4. Academic task management | In progress | Applied task table per project owner; Planner CRUD implemented locally | Authenticated CRUD and cross-user verification pending |
| 5. Reminder notifications | In progress | Per-task offset migration applied (verified 2026-10-09); local Expo scheduling and reminder history implemented | Native-device delivery tests pending |
| 6. Mood tracking and wellness rules | In progress | Applied mood table (per project owner); private check-ins, history, 7/30-day trends, and local ideas implemented | Authenticated tests and physical-device review pending for Phase 3 |
| 7. Receipt OCR | Complete per project owner | Protected backend, mobile capture, editable OCR review, and explicit expense save | No OCR retest in this task; prior grant and live-save status were not independently rechecked |
| 8. Integrated dashboard and Groq summaries | In progress | Home facts panels, authenticated insights endpoint, Groq summary with validation and fallback | Live Groq English/Malay summaries verified locally; phone review pending |
| 9. Evaluation, hardening, and thesis evidence | In progress | Receipt OCR evaluation tool, 57 labelled receipts, and parser improvements (development all-three-correct 21.4% → 78.6%) | Final held-out/fresh-set OCR score, AI-summary samples, UAT, and Likert questionnaire pending |

Phases 1–6 and 8 above keep their older notes for history. As of 2026-10-14 each is **implemented, and its automated tests pass** (full e2e 82/82); **device/manual checks are pending** for native reminders and notifications, native pickers, Poof feel on a phone, and an automated two-account RLS test (cross-user isolation was confirmed manually by the owner). Phase 7 (Receipt OCR) was re-tested on 2026-10-14: 2 OCR review e2e tests pass, and the parser was improved (see the work log); a phone re-test with the new parser is pending.

## Current phase checklist — Phase 0

> Historical (2026-10-07). Overtaken by implementation: the repository, routes, versions, and environment templates are recorded in `CLAUDE.md`, and the app runs. Kept unticked for history.

- [ ] Locate and inspect the existing Unifyd project repository.
- [ ] Record the current folder structure, routes, screens, dependencies, and mock-data locations.
- [ ] Run the app with the approved Expo command.
- [ ] Confirm the actual Expo SDK, Expo Router, React Native, and TypeScript/JavaScript versions.
- [ ] Confirm that `/(tabs)` is preserved and identify public/protected routes.
- [ ] Record existing working screens, known bugs, and unfinished integration stubs.
- [ ] Create safe environment-variable templates without adding real secrets.
- [ ] Verify the app still launches after any Phase 0 documentation/configuration-only changes.

## Completed work log

### 2026-11-14 — Receipt scan: Retake hint on hard-to-read photos

**Changed files:**
- `mobile/lib/scanFlow.ts` (`suggestRetake`, `RETAKE_FLAGGED_FIELDS`), `mobile/components/scan/ScanReview.tsx` (notice text and Retake button; `onRetake` prop), `mobile/app/scan-receipt.tsx` (Retake returns to Start), `mobile/constants/i18n.ts` (`scan.retakeHint`, `scan.retake`, English and Malay).
- Tests: `mobile/tests/scanFlow.test.mjs` (1 new), `mobile/e2e/scanFlow.spec.ts` (2 new).
- Docs: `UNIFYD_DESIGN_SYSTEM.md` (Receipt scan flow, Uncertain fields), `CLAUDE.md`.

**What changed:**
- Owner phone test: a blurred sideways photo read badly; a retake read fine. Review now suggests a retake when there is no readable text or two or more of Merchant, Date, and Total are flagged. The notice reads "Parts of this photo were hard to read. It may be blurry, dark, or sideways." with a "Retake photo" button; both disappear once a field is edited, so retaking never discards edits and needs no discard question.
- On the 100 saved receipts the rule would fire on 25 (17 of them hard or handwritten) and never on receipts with zero or one flag.

**Tests performed:**
- Mobile typecheck and lint clean; unit **168/168**; `e2e/scanFlow.spec.ts` **14/14** (one test rerun alone after the known Expo Web out-of-memory crash). Phone-width screenshot checked.
- Owner checked on the phone (2026-11-14): works.

**Next action:**
- Owner tries a blurry or sideways scan on the phone; later, collect a fresh unseen receipt set for the honest "after" score.

### 2026-11-14 — Receipt OCR: merchant rules (general)

**Changed files:** `server/src/receipt-merchant.ts`, `server/src/receipt-merchant.test.ts` (2 new tests, fictional names), `CLAUDE.md`.

**What changed:**
- A header line carrying its company registration (`(001234567-K)`, `(Co. No. …)`) gives a confident name; such numbers no longer end the header as if they were barcodes.
- The header loop keeps the first plausible line but replaces it with a later, better-supported one (business word, company line below, or registration).
- Never names: "Since/Est. …", "Cash Sales", "No. Pendaftaran"/"No. Syarikat", store/outlet/branch codes, lines starting with `(` or `&`, and lines over six words (company words not counted). "Shop" added as a business word.

**Tests performed:**
- Development split (72): merchant 83.3% → **87.5%**, all three 73.6% → **75.0%**, silent 2. Report: `reports/dev-after-merchants-2026-11-14.txt`.
- Merchant changes across all 100 receipts: 3 fixed, 1 correct name now confident, no other change (three side effects found during the work were fixed before finishing).
- Server typecheck, **127/127** tests, build.

**Issues or decisions:**
- Not fixed (OCR or handwriting damage): `004`, `046`, `072`, `094` (OCR dropped letters), `097`, `098`; `005`/`052`/`073` are label-specific cases.

**Next action:**
- Owner decision: collect a fresh unseen set to measure the improved parser, or test on the phone first.

### 2026-11-14 — Receipt OCR: date rules (general)

**Changed files:** `server/src/receipt-date.ts`, `server/src/receipt-date.test.ts` (2 new tests, fictional dates), `server/README.md`, `CLAUDE.md`.

**What changed:**
- A time with seconds is recognised even with an OCR dash or spaces (for example `12-30 : 45`), so it supports its date.
- A four-digit year read as 29xx is corrected to 20xx and always flagged.
- When two different dates have the same support, the earliest is kept but flagged.

**Tests performed:**
- Development split (72): date 87.5% → **90.3%**, all three 72.2% → **73.6%**, silent 3 → 2. Report: `reports/dev-after-dates-2026-11-14.txt`.
- Date changes across all 100 receipts: 3 better (one found, one corrected, one silent error now flagged); 2 correct dates now carry a review warning (a second, different date with equal support).
- Server typecheck, **125/125** tests, build.

**Issues or decisions:**
- Not fixed: dates OCR garbled beyond a safe rule (a month name read as digits, a month name read as one digit, handwriting), and a year misread as another valid year (indistinguishable from a real date).

**Next action:**
- Merchant names: header noise taken as the shop name.

### 2026-11-14 — Receipt OCR: total rules (general, no shop-specific rules)

**Changed files:**
- `server/src/receipt-layout.ts`, `server/src/receipt-total.ts`, `server/src/receipt-total.test.ts` (4 new tests, fictional receipts only), `server/README.md`, `CLAUDE.md`.
- Labels: two supermarket receipts' merchant labels changed to the store's brand name (owner decision).

**What changed:**
- Sideways photos: when most words are tall and narrow, word boxes are turned upright (direction from Vision's reading order) before rows are rebuilt.
- New final labels: "Total Payment" and "Total (incl tax)"; "Tctal"/"T0tal" read as "Total".
- No total label: the lowest card/QR/e-wallet payment amount (card numbers, approvals, points skipped), else cash minus change; always with the review warning.
- A labelled total that disagrees with the card/e-wallet amount by more than RM 0.05 gets the review warning.

**Tests performed:**
- Development split (72): total 80.6% → **93.1%**, all three 61.1% → **72.2%**, silent 5 → 3. Report: `reports/dev-after-totals-2026-11-14.txt`.
- Server typecheck, **123/123** tests, build.

**Next action:**
- Dates (month names damaged by OCR, missing time context), then merchant header noise.

### 2026-11-14 — Receipt OCR: final set merged into the development labels

**What changed (git-ignored data only; no code change):** the 43 scored final receipts were copied into `server/local-data/receipt-eval/images/`, their cached OCR into `ocr/`, and their label rows appended to `labels.csv`. The scored folder was renamed `final-2026-11-14-scored/` (archive), so a future `final-setup` starts a fresh, empty `final/`. The split is a hash of the file name: the original 57 keep their sides; **100 receipts = 72 development + 28 held-out**.

**Result:** `eval:receipts:run`, development split 72: all three correct **61.1%** (merchant 81.9%, date 87.5%, total 80.6%; 5 silent). Report: `reports/dev-after-merge-2026-11-14.txt`.
- Main failure groups: totals not found or wrong (label and amount apart, "Total Payment (Rounding)", amounts split by OCR such as `24 60`, a fast-food pre-discount TOTAL); dates with damaged month names; header noise taken as merchant (`Since 1993`, garbled first lines); OCR misreads (wrong year) that rules cannot fix.
- Label question for the owner: two supermarket receipts are labelled with the company name; the parser returns the store's brand name.

**Next action:**
- Owner picks which failure group to fix first; general rules only, with server tests after each change.

### 2026-11-14 — Receipt OCR: the single `--final` run (thesis score on unseen receipts)

**What ran:** `npm run eval:receipts -- --final` on the owner-checked final labels (43 receipts) plus the 15 held-out receipts. No parser change since 2026-10-14. Output saved to `server/local-data/receipt-eval/reports/final-2026-11-14.txt` (git-ignored).

**Results (all three fields correct):**
- Development split (tuned on, 42): 78.6%. Held-out (15): **53.3%**. Final set (43): **37.2%** (merchant 65.1%, date 74.4%, total 67.4%; 10 receipts wrong with no warning). Held-out + final combined (58 unseen receipts): **41.4%** (merchant 62.1%, date 81.0%, total 72.4%).
- By type (combined): digital 100% (2), chain retail 58.8% (17), local shop 45.5% (11), food and drink 31.3% (16), handwritten 10.0% (10). Clean 61.3%, hard 18.5%.
- The gap between development and unseen receipts shows the 2026-10-14 rules fit the development receipts more than receipts in general.

**Next action:**
- Owner decision: merge the 43 final receipts into the development set and improve the parser with general rules only (no shop-specific rules); measure the improved parser later on a fresh unseen set.

### 2026-11-14 — Receipt OCR final test set prepared (labels drafted by Claude, pending owner check)

**What changed (local, git-ignored data only; no code change):**
- 45 new receipt photos were renamed to `receipt-NNN` (handwritten ones end in `-hw`) in `local data/receipt-eval/images/` and copied to `server/local-data/receipt-eval/final/images/`. `final-setup` read them with Google Vision (45 read, 0 failed; inside the free monthly 1,000).
- `receipt-099` and `receipt-100` were removed from the final set: they are lower-resolution copies of development receipts `037` and `042` (the same downloaded photos). The originals stay in `local data`. **Final set: 43 receipts** (chain_retail 11, food_beverage 11, local_shop 10, handwritten 7, digital 2, other 2; clean 25, hard 18).
- At the owner's request, Claude drafted `final/labels.csv` from the photos (OCR text used only as a reading aid; the parser was not run). The owner is checking it. `final-check`: Labels OK.
- Decisions to confirm: deposit receipts (`063`, `097`, `101`, `102`) use the bill total, not the deposit; dates without a year (`095`, `098`) or hidden by a finger (`071`) are blank; `063`'s only date is a delivery date (left blank); `080`'s day is hard to read; `096` prints a template placeholder instead of a shop name.

**Next action:**
- Owner checks the labels, then the single `npm run eval:receipts -- --final` run. No parser changes before it.

### 2026-11-14 — Fix: tab bar off-centre (empty Profile slot)

**Changed files:**
- `mobile/app/(tabs)/_layout.tsx`
- `mobile/e2e/home.spec.ts`

**What changed:**
- On iPhone, the tab bar had six slots: the hidden Profile tab (`tabBarButton: () => null`) still kept its `flex: 1` item wrapper. Planner ended up under the + button, and Mind moved off-centre. Fixed by adding `tabBarItemStyle: { display: 'none' }` to Profile.
- The Home e2e now checks that Wallet and Planner sit evenly on either side of the + button, with Planner clear of it.

**Tests performed:**
- Typecheck and lint pass. `e2e/home.spec.ts` 12/12 (two tests rerun with `-g` after the known Expo Web out-of-memory crash). With the fix removed, the new check fails (65 px off-centre), so it catches this bug.
- Not yet rechecked on the phone.

**Next action:**
- Owner reloads Expo Go and confirms the bar shows Home · Wallet · [+] · Planner · Mind evenly spaced.

### 2026-10-16 — Pre-push privacy audit: receipt text found in unpushed history (nothing pushed)

**Scope:** all 13 commits that a push of `ui-revamp` would send (`origin/main..ui-revamp`: the 12 unpushed `main` commits plus `42a5dfc`), checked across the full history, not just the final tree. Read-only; nothing pushed, rewritten, or changed in Git.
- **No problems found in:** binary files, images, `local-data/`, `labels.csv`, OCR caches, reports, `.env` files, secrets, or tokens. No path is added and later deleted. The `.env.example` changes are flags set to `0`.
- **Problem:** every added line was matched against the 57 cached OCR texts (read locally only; never copied into the repo). In commit **`ff4f044`**, `server/src/receipt-items.test.ts` contains 17 lines copied from the owner's real receipts:
  - an invoice number and a store staff name;
  - a fuel purchase line (litres, price, total);
  - dine-in orders, product lines, and barcodes.
  - `server/src/receipt-items.ts` comments contain 3 product examples (low risk).
- **Low risk, not counted as private:** the scan-flow fixtures in `mobile/e2e/scanFlow.spec.ts` and `mobile/tests/scanFlow.test.mjs` use a made-up merchant and common product names, with no matching merchant, date, or total.
- **Already on GitHub (before today):** earlier receipt test files hold some receipt-derived strings, mostly shop names and labels, plus one total line. Cleaning those would mean rewriting published history.
- `ff4f044` is on no remote, so it can be cleaned before the first push without a force push.

**Next action:**
- Owner chooses how to clean the history; then rerun the server and mobile tests, then push.

### 2026-10-16 — Unifyd Focus committed (`42a5dfc`); Module 8 AI summary analysis (no code)

**Commit (owner-approved):** `42a5dfc feat: implement Unifyd Focus and study analytics` on `ui-revamp`: 38 files (Focus code, tests, both migrations, Focus documentation). **Not merged or pushed.**
- Before staging, every hunk was checked as Focus or status, the i18n changes as only `focus.*` keys, and the files were scanned for secrets, env files, and test artifacts (none found).
- Left out: the owner's **Rule 4** line in `CLAUDE.md` (staged without it, pending owner approval), and the untracked `completed receipt data.md`.

**Module 8 analysis (owner chose Option A: an AI summary inside Poof's sheet):**
- **What `/api/insights/generate` covers:**
  - finance for this local calendar month, **monthly budget only**;
  - academic = **task counts only** (pending, ongoing, overdue, due in 7 days, completed in 7 days);
  - wellbeing = 7-day mood and stress, the previous-7-day comparison, and the low-mood flag.
- **Not covered:** weekly budgets, semester and timetable, subscriptions, split bills, and Focus.
- **Inconsistencies found:**
  - SRS §5.8 status still describes the removed Home card and its refresh button.
  - SDD §7.6 says Poof's chat replaces the summary.
  - The endpoint ignores weekly budgets, which Wallet and Poof support.
  - The endpoint has no rate limit; only successful summaries are cached, for 10 minutes.
  - `mobile/lib/insights.ts` is unused, drops the returned `facts`, and reports every non-OK status as `unavailable`.
  - The Privacy Policy says Unifyd "does not use a custom machine-learning model", which contradicts the approved category suggester.
- The plan (UI, backend reuse, privacy, files, tests, docs, phases) is in the session summary given to the owner.

**Tests:** none run for this entry (documentation and analysis only; the Focus results are unchanged from earlier the same day).

**Next action:**
- Owner approves (or changes) the Module 8 plan; decides on Rule 4 and on merging `ui-revamp`.

### 2026-10-16 — iPhone UAT paused; Unifyd Focus marked development-complete

**Decision (owner):** iPhone UAT and full user acceptance testing are postponed until all planned features are implemented. Unifyd Focus Phases 1–6 are **development-complete** (automated tests and code review done). They are **pending final device validation and UAT**, and are not user-accepted or production-ready. Unit, integration, and e2e tests keep running after every change.

**UAT recorded before the pause (owner, iPhone, Expo Go):**
- Item 4: "Focus round complete" PASS and "Break's over" PASS; sound silent (minor finding; the optional Focus alert sound is a pending enhancement under "Deferred ideas").
- Item 5 Scenario 1 (running round restored after force-quit, Custom 5/1/5): PASS; times were not recorded.
- Everything else, including item 5 Scenarios 2–4 (Scenario 2 was given but not reported), the item 4 sound retest and permission denial, and items 1–3 and 6–10: **Deferred — Pending Full Application UAT** (table in `DEVELOPMENT_HANDOVER.md`).

**Unchanged and still documented:** automated results (unit 167/167, full Playwright 117/117 on the Phase 6 run, review rerun 26/26), the known limitations, and the pending cross-account RLS test (needs a second test account).

**Remaining-work review (documents only; nothing implemented):**
- All eight approved modules, plus My Semester, Timetable, Poof Phase 1, Subscriptions, Split bills, the category suggester, and Unifyd Focus, are built. No SRS requirement is listed as unbuilt, and no further feature is planned in any document.
- **Gap against the Brief's success criteria:** "generates integrated, descriptive insights" and "AI-summary evaluation". The Home AI summary card was removed on 2026-10-10, and `/api/insights/generate` is unused. SRS §5.8 still describes a summary card and refresh button (`CLAUDE.md` §11). Needs an owner decision: re-show the validated summary in the app, or formally treat Poof's AI answers as Module 8's summary.
- **Other open items:** commit and merge `ui-revamp`; the automated two-account RLS test; deployment preparation (a reachable server and a development or EAS build for UAT participants, also needed for native notification icons and custom sounds); the final OCR evaluation (on hold); AI-summary samples; UAT and the Likert questionnaire; switching off `SCAN_TIMING` / `EXPO_PUBLIC_SCAN_TIMING`.
- **Proposed, not approved:** the Focus delayed reflection, and the optional Focus alert sound (approved in principle, postponed).

**Changed files:** `CLAUDE.md`, `DEVELOPMENT_HANDOVER.md`, `PROJECT_PROGRESS.md` (status sections only). No code, tests, migrations, or database changes.

**Next action:**
- Owner decides on committing and merging `ui-revamp`, and on the Module 8 AI-summary gap.

### 2026-10-16 — Final code review of the `ui-revamp` diff (Unifyd Focus)

**Scope:** every changed or new code path on `ui-revamp`: `lib/focus*.ts`, `hooks/useFocusSession.ts`, `app/focus.tsx`, `app/focus-insights.tsx`, `components/focus/*`, the `_layout.tsx` / `planner.tsx` / `IconQuickActions.tsx` / `studies.spec.ts` diffs, and both Focus migrations. Read-only; no code, migration, or database changes. Nothing committed.

**Result: no blocking findings.** Timer maths (timestamps, clamping, restore validation), the outbox (serialised writes, never dropped, ID replacement carries reflections), sync (user check before each insert, link/duplicate handling, timeouts), RLS and grants, and the one-time reflection update all hold up. The three notification modules set identical foreground handlers, so they do not conflict.

**Low-severity notes (not fixed; owner to decide):**
- Focus insights: a sync finishing while the screen is open reloads history from page 1, so pages loaded with Load more collapse back to 20 rows. The server orders history by `started_at` and the merged list by `ended_at`, so a round with long pauses can sit slightly out of place after Load more.
- Focus: if a round finishes while the "End session?" dialog is open, confirming keeps the full round (correct), but the dialog's "keeps N minutes" text was worked out when it opened.
- No reminder (task, subscription, or Focus) sets a notification `sound`. *Corrected the same day after reading the native code:* expo-notifications 57.0.22 on iOS plays the **default sound** when `sound` is left out (`NotificationRecords.swift`), so alerts are silent only in the foreground (the shared handler has `shouldPlaySound: false`) or because of iPhone settings.

**iPhone UAT, checklist item 4 (owner, 2026-10-16):** "Focus round complete" PASS; "Break's over" PASS; sound **silent**, a minor finding under investigation. Cause, from the code:
- **App open (foreground):** the app silences it. All three modules set the same global handler, with `shouldPlaySound: false`.
- **Locked or backgrounded:** the notification asks for the default sound, so silence comes from iPhone settings: Silent mode, a Focus or Do Not Disturb mode, Settings → Expo Go → Notifications → Sounds, Scheduled Summary, or volume.
- **Expo Go:** the alerts belong to Expo Go, so Expo Go's notification settings apply, and custom sound files need a development build. The default sound works in Expo Go.

Recommended fix (not built; needs owner approval): an optional Focus-only sound. A shared handler module would let only `unifydKind: 'focus'` alerts play in the foreground, and Focus alerts would set `sound` explicitly. On Android this needs a second, silent channel, because channel sound cannot change after creation. Task and Subscription reminders stay unchanged.

**Tests performed:** mobile typecheck and lint clean; unit **167/167**; Playwright `focus` 9/9, `focusInsights` 6/6, `focusCompanion` 5/5, `studies` 6/6 (26/26). `focusLive` was not rerun (it writes to the real database).

**Changed files:** `CLAUDE.md`, `DEVELOPMENT_HANDOVER.md`, `PROJECT_PROGRESS.md` (status only).

**Next action:**
- Owner runs the iPhone checklist in `DEVELOPMENT_HANDOVER.md`.

### 2026-10-16 — Session closure: Unifyd Focus Phases 1–6 complete, awaiting review and phone checks

**Status:**
- Unifyd Focus Phases 1–6 are implemented on `ui-revamp`; both Focus migrations were applied per project owner and verified live.
- **Nothing committed, pushed, or merged** (HEAD `b832a2f`).

**Final automated QA (Phase 6 run, 16 Oct; not rerun at closure):**
- typecheck and lint clean;
- unit 167/167;
- full Playwright 117/117, including live `focusLive` 3/3.

**Changed files (this closure):** documentation only (`CLAUDE.md`, `DEVELOPMENT_HANDOVER.md`, `PROJECT_PROGRESS.md`). No code, migrations, or database changes.

**Outstanding:**
- a final code review of the `ui-revamp` diff;
- the iPhone (Expo Go) checklist in `DEVELOPMENT_HANDOVER.md`;
- a true cross-account RLS test (second test account);
- UAT;
- the commit and merge decision.

**Next action:**
- Code review of all `ui-revamp` changes, then the owner's iPhone checks.

### 2026-10-16 — Unifyd Focus, Phase 5 verification and Phase 6: final QA and polish (branch `ui-revamp`)

**Phase 5 verification (real database, test account only):**
- The owner applied `20261016_002_focus_session_reflections.sql` on 2026-10-16.
- `e2e/focusLive.spec.ts` **3/3**, checked by behaviour, not by policy listings:
  - `select *` returns exactly the 15 expected columns;
  - a reflection is set once on the student's own completed round, and a second answer, with or without the empty filter, changes nothing;
  - partial rounds take none;
  - invalid values, clearing, other columns, and changing status through the update are refused;
  - an insert cannot carry a reflection;
  - a signed-out client can do nothing;
  - a reflection given in the real app is saved on the same row once.
- RLS is enabled (signed-out reads return nothing), and earlier rounds and links are intact (the Phase 3 live test still passes).
- A read-only check found 0 leftover rows, and the test profile was back to English.
- **Not executable:** a true cross-account RLS test (no second test account).
- Phase 5 regression: unit 167/167; full Playwright **116/117**. The one failure was the known intermittent Wallet "no budget and no expenses" test (it fails 1 in 2 on clean `main`; Wallet unchanged). Phase 5 marked complete.

**Phase 6 changes (targeted; no new features, no schema change):**
- `mobile/lib/focusSync.ts`:
  - The 60 s retry no longer fires for rounds the database refused, or for reflections waiting on them. Those still retry on start, foreground, and opening Focus.
  - New `onFocusSyncChange`: screens reload only when a sync changed something.
- `mobile/app/focus.tsx`, `mobile/app/focus-insights.tsx`: use `onFocusSyncChange` (fewer requests while offline).
- `mobile/components/focus/FocusDial.tsx`: dial text capped at 1.2× system text size.
- `mobile/components/focus/FocusSetup.tsx`, `mobile/components/focus/FocusInsightCards.tsx`: steppers wrap on narrow phones (found at 320 pt in Malay, where the + button overflowed the card); goal chip text 14 pt.
- `mobile/components/focus/FocusCompanion.tsx`: long task titles in suggestions are shortened to 48 characters.
- `mobile/e2e/focusLive.spec.ts`: column check, and a reflection saved from the real app.

**QA review (findings with no change needed):**
- **Timer:** start, pause, resume, reset, end, presets, custom times, breaks, round counting, pauses, suspension and restart, expiry, duplicates, clock changes, and per-user state are covered by 16 unit and 9 e2e tests. Notifications are cancelled and rescheduled on every change.
- **Sync:** ownership, idempotency, offline, timeouts, account switching, reflections, deleted links, and no double counting are covered by unit, mocked, and live tests.
- **Insights:** figures match the stored rows. Rounds count on the local day they ended; midnight-crossing rounds are not split (documented).
- **Poof:** still during focus; celebrates only rounds completed on screen; Reduce Motion; hide kept; no listeners left behind (listeners and intervals cleaned up on blur or unmount).
- **Suggestions:** real data only, no Groq, no predictions, skipped when data is missing.
- **Layout:** checked at 320, 375, 390, and 430 pt and in Malay at 320 pt; no sideways scrolling (asserted).

**Tests performed (final):**
- Mobile typecheck and lint clean; unit **167/167**.
- `focus` 9/9, `focusInsights` 6/6, `focusCompanion` 5/5, `focusLive` 3/3, `studies` 6/6.
- **Full Playwright 117/117.**
- In one combined run, `focus.spec` "presets and custom durations" failed once. It then passed 4/4 alone, 9/9 in its spec, and in the full suite; it was not reproduced.
- **No physical-device testing has been done.** See the iPhone checklist in `DEVELOPMENT_HANDOVER.md`.

**Known limitations:**
- A round that finishes while Focus is closed gets no celebration or reflection (accepted).
- Midnight-crossing rounds count on the day they ended.
- Subject-to-task matching uses exact text.
- No true cross-account RLS test yet.
- Web has no alerts.
- Only the owner's device can confirm iOS background behaviour.

**Proposal (not built): delayed reflection.** When Focus opens and the newest round in the last 2 hours is completed, has no reflection, and was not skipped, offer the same optional card once ("How was your last round?"). It needs only a per-student "asked" marker on the device; no schema change.

**Next action:**
- Owner runs the iPhone checklist, reviews, and decides on commit and merge into `main`.

### 2026-10-16 — Unifyd Focus, Phase 5: Poof companion, optional reflection, rule-based suggestions (branch `ui-revamp`)

**Requirements implemented:**
- SRS-FR-1018 to SRS-FR-1022 (new). SRS-FR-1021 (database rule for reflections) waits for migration 002 to be applied.

**Phase 4 final verification (before Phase 5 changes):** full Playwright suite **110/110**; no blockers.

**Owner decisions (2026-10-16, asked before building):**
- Poof sits in a compact row under the timer card.
- Poof holds still during focus rounds and pauses, floats only when ready and on breaks, and celebrates once per completed round.
- The greeting is text only; `PoofMascot` is unchanged.
- Suggestions appear only on Focus screens; Poof chat and its server contract are unchanged.

**Changed files:**
- New: `supabase/migrations/20261016_002_focus_session_reflections.sql`, `mobile/components/focus/FocusCompanion.tsx`, `mobile/e2e/focusCompanion.spec.ts`, `mobile/tests/focusI18n.test.mjs`.
- Changed:
  - `mobile/lib/focusTimer.ts` (`companionState`), `mobile/lib/focusInsights.ts` (`focusSuggestions`), `mobile/lib/focusSyncCore.ts` (`runReflectionSync`).
  - `mobile/lib/focusSync.ts` (reflection sync; `saveFocusReflection`; reflections included in the retry), `mobile/lib/focusStorage.ts` (reflection outbox; re-ID carries reflections), `mobile/lib/focusHistory.ts` (Poof hidden preference).
  - `mobile/hooks/useFocusSession.ts` (`lastCompleted` from live transitions only).
  - `mobile/app/focus.tsx` (Poof row, reflection card, ready suggestion), `mobile/app/focus-insights.tsx` (suggestions card; loads open tasks and semester subjects).
  - `mobile/constants/i18n.ts` (29 keys in English and Malay).
  - Tests: `mobile/tests/focusTimer.test.mjs`, `mobile/tests/focusInsights.test.mjs`, `mobile/tests/focusSync.test.mjs`, `mobile/e2e/focusInsights.spec.ts`, `mobile/e2e/focusLive.spec.ts` (reflection test).
- Docs: `CLAUDE.md`, `PROJECT_PROGRESS.md`, `DEVELOPMENT_HANDOVER.md`, `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, `UNIFYD_PRD.md`, `UNIFYD_DESIGN_SYSTEM.md`.

**What changed:**
- **Poof:** the official image and the shared `PoofMascot` animations, with no new animation code and no change to the mascot.
  - Still poses reuse the bundled image on its disc. Messages cover ready, the next round, focusing, paused, break, long break, and completed.
  - Hiding is remembered per student on the device. Reduce Motion keeps Poof still.
- **Reflection:**
  - After a round completes on screen: Great, Okay, Struggled, Tired, or Skip. It is never blocking, and there is one answer per round.
  - Kept on the device while offline, then sent after its round with an update that only sets an empty reflection, so the first answer wins and retries cannot change it.
  - The migration adds the column (completed rounds only), an update grant on that column only, and an owner/empty/completed update policy. Existing policies are unchanged.
- **Suggestions:**
  - Rules, in order: a task due later today or tomorrow, a reached or half-way goal, an hour or more today, a semester subject not yet studied this week (only after some study this week), and a starter tip.
  - Computed on the device with no Groq. No predictions, no invented numbers, no guilt or streak wording; rules are skipped when their data cannot load.
  - Shown as 1 on Focus (Poof's ready message, with "Focus on this task" for a due task) and up to 3 on Focus insights.
  - AI suggestions remain a future enhancement (aggregate-only).

**Tests performed:**
- Mobile typecheck and lint clean.
- Unit **167/167**, 8 new:
  - Poof poses (1);
  - suggestions (3);
  - reflection sync (3): once only, waiting for its round, offline, before the column exists, deleted rounds, wrong account;
  - English/Malay parity for all `focus.*` keys (1).
- Playwright:
  - `focusCompanion` **5/5**: Poof through ready, focus, pause, celebrate, and break, with the timer still exact; the long-break message; an offline reflection kept and then sent once after its round; a due-tomorrow suggestion and its action; hide kept after reload; Reduce Motion still.
  - `focusInsights` **6/6** (+1: suggestions card), `focus` **9/9**.
  - `focusLive` **2/2** with the reflection test excluded.
- Screenshots at 390 and 320 pt (ready, focusing, celebration and reflection) checked by eye. One fix: Poof's completion line no longer repeats the notice.
- **Not run yet:** the live reflection test (needs migration 002) and the full regression suite (after the migration).
- **Not run:** any native device test (iPhone or Android).

**Issues or decisions:**
- A round found finished on load (restart, or returning to Focus) does not celebrate or ask for a reflection; only rounds completed while Focus is open do.
- Until migration 002 is applied, a submitted reflection waits on the device and is retried each minute; nothing is lost.

**Next action:**
- Owner applies `20261016_002_focus_session_reflections.sql`; then run `npx playwright test e2e/focusLive.spec.ts` and the full suite, and record both here.

### 2026-10-16 — Unifyd Focus, Phase 3 live verification and Phase 4: Focus insights (branch `ui-revamp`)

**Requirements implemented:**
- Phase 3 complete: SRS-FR-1010 to 1012 verified live. Phase 4: SRS-FR-1013 to 1017 (new).

**Phase 3 verification (real database, test account only):**
- The owner applied `20261016_001_focus_sessions.sql` in the SQL Editor on 2026-10-16 and confirmed RLS and 14 columns.
- `e2e/focusLive.spec.ts` **2/2**. It covers:
  - owner insert, read, and delete;
  - a duplicate ID refused with `23505`;
  - another user's ID, a task or subject the account does not own, edits, and a client-set `created_at` all refused;
  - 15 check violations rejected;
  - deleting the linked task and subject keeps the round with null links and its title and label;
  - a signed-out client sees and writes nothing;
  - a real round finished in the app saved once, cleared from the outbox, and read back by Focus insights.
- A read-only count afterwards found 0 `focus_sessions` rows and no leftover test tasks or subjects for the test account.
- **Not executable:** a true cross-account RLS test (no second test account; the spec uses IDs the account does not own). Policies and grants were checked by behaviour, not by querying `pg_policies` (the project never runs SQL from the app side).

**Changed files (Phase 4):**
- New: `mobile/lib/focusInsights.ts`, `mobile/lib/focusHistory.ts`, `mobile/app/focus-insights.tsx`, `mobile/components/focus/FocusInsightCards.tsx`, `mobile/tests/focusInsights.test.mjs`, `mobile/e2e/focusInsights.spec.ts`.
- Changed: `mobile/app/focus.tsx` (Focus insights row), `mobile/app/_layout.tsx` (`focus-insights` route), `mobile/constants/i18n.ts` (44 keys in English and Malay), `mobile/e2e/focusLive.spec.ts` (reads the round back in insights).
- Docs: `CLAUDE.md`, `PROJECT_PROGRESS.md`, `DEVELOPMENT_HANDOVER.md`, `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, `UNIFYD_PRD.md`, `UNIFYD_DESIGN_SYSTEM.md`.
- No database change in Phase 4.

**What changed:**
- **Focus insights:** Today and This week tiles; rounds this week (completed and partial); an optional goal; a Monday–Sunday SVG chart; subjects over the last 30 days with whole percentages adding up to 100; history newest first, 20 per page with "Load more".
- **Counting rule:** only `focus_seconds` counts (planned time, breaks, and pauses never do). A round counts on the **local day it ended**. Midnight-crossing rounds are not split, because the table stores one total per round. Splitting exactly would need per-interval data (a schema change), which was not proposed.
- **Sources:** synced rows and device-outbox rounds are merged by ID, so a round is never counted twice. Device rounds carry "On this device". If synced history fails to load, device rounds still show, with a retry. Figures reload quietly when a sync finishes.
- **Subjects:** grouped by the saved label, so deleted subjects keep their name; null shows as General study.
- **Goal:** optional, daily 15–480 min or weekly 60–3000 min, saved on the device (`unifyd:focus-goal:<userId>`), like other per-student preferences. There are no streaks.

**Tests performed:**
- Mobile typecheck and lint clean. Unit **159/159** (8 new in `focusInsights.test.mjs`): Monday–Sunday local weeks, local versus UTC days, recorded time only and partial rounds, rounds crossing midnight (and Sunday→Monday), merge without double counting, subjects with deleted labels, General study and the 100% total, the empty state, durations rounded down, and goal limits and progress.
- Playwright: `focusInsights` **5/5** (figures with device and synced rounds and a fixed KL clock; the empty state; a failed read with device rounds; history paging 20 + 5; the goal set, changed, kept after reload, and turned off). `focus` **9/9**, `focusLive` **2/2**, `studies` **6/6**.
- Full Playwright suite: **110/110** (the intermittent Wallet test passed this run).
- Screenshots at 390 and 320 pt (top, chart and subjects, history, goal editor) checked by eye.
- Not run: phone checks (alerts, lock screen, Expo Go restart, insights on a device).

**Issues or decisions:**
- One fix during testing: on equal time, named subjects now sort before General study.
- The history loader uses offset paging. A round synced while paging could shift a page; rows are de-duplicated by ID, so nothing repeats.

**Next action:**
- Owner reviews Phase 4 and decides on Phase 5 (Poof companion, optional reflection, rule-based study suggestions; any Groq use aggregate-only).

### 2026-10-16 — Unifyd Focus, Phase 3: Supabase persistence and sync (branch `ui-revamp`)

**Requirements implemented:**
- SRS-FR-1010 to SRS-FR-1012 (new). The app side is done and tested with mocks. The migration is **written, not applied**; live verification waits for the owner.

**Changed files:**
- New: `supabase/migrations/20261016_001_focus_sessions.sql`, `mobile/lib/focusSyncCore.ts`, `mobile/lib/focusSync.ts`, `mobile/tests/focusSync.test.mjs`, `mobile/e2e/focusLive.spec.ts`.
- Changed: `mobile/lib/focusTimer.ts` (rounds keep `taskTitle`), `mobile/lib/focusStorage.ts` (outbox remove/re-ID; unreadable entries and lists are kept, never overwritten), `mobile/hooks/useFocusSession.ts` (sync after a kept round), `mobile/app/focus.tsx` (sync on focus; status line), `mobile/app/_layout.tsx` (sync on sign-in and foreground; 60 s retry while rounds wait), `mobile/constants/i18n.ts` (6 `focus.sync*` keys, English and Malay), `mobile/tests/focusTimer.test.mjs`, `mobile/e2e/focus.spec.ts` (`focus_sessions` mocked; 3 new sync tests).
- Docs: `CLAUDE.md`, `PROJECT_PROGRESS.md`, `DEVELOPMENT_HANDOVER.md`, `UNIFYD_SRS.md` (§5.11, data table, traceability), `UNIFYD_SDD.md` (§6.2, §6.3, §7.10), `UNIFYD_PRD.md` (FR-09).

**What changed:**
- **Table `focus_sessions`:** one row per kept round, keyed by the app's UUID.
  - Owner-only select, insert, and delete; no update.
  - The insert policy allows only the student's own task and semester subject (`exists` checks).
  - Links are set to null on delete, and the copied `task_title` / `subject_label` remain.
  - Checks: planned 300–7200 s; focus ≤ planned and ≤ the start–end span; completed = planned; partial ≥ 60 s and < planned.
- **Sync:**
  - The outbox → database rules are in `focusSyncCore.ts`.
  - A round is removed only after the database confirms it, or confirms that the same ID is already the student's own row.
  - A deleted or foreign link: saved without the link. A refused row: kept and counted. No network, a timeout, or a missing table: wait.
  - The signed-in user is checked before every insert, and each student's outbox is separate. Sign-out never clears it.
- **Status line** under the stats: "N rounds are saved on this device and will sync when you’re online", "Saving…", "couldn’t be synced. They stay saved on this device", or "Your focus rounds are synced to your account."
- The timer, the Phase 2 UI, task completion, and subject/task filtering are unchanged.

**Tests performed:**
- Mobile typecheck and lint clean. Unit **151/151** (12 new in `focusSync.test.mjs`): row mapping and checks, error classes, sync and repeat runs, a duplicate the student owns, a duplicate owned by someone else (new ID), a failed duplicate check, partial network loss then recovery, a missing table, deleted or foreign links, refused rows, the wrong account, and sign-out mid-run.
- Playwright `focus.spec.ts` **9/9**, with `focus_sessions` mocked: the Phase 2 timer tests now also check the saved rows. New: offline → kept on the device → survives sign-out → syncs once after sign-in; rounds left from an earlier session sync and another account's outbox is never sent; a lost confirmation does not duplicate, and a taken ID is saved under a new one.
- `studies.spec.ts` and `unifyd.spec.ts` (sign-in, profile, sign-out): **13/13**.
- **Not run yet:** `e2e/focusLive.spec.ts` (RLS, grants, checks, linked-row deletion, a real round from the app). It needs the migration applied.
- Not run: phone checks (alerts, lock screen, Expo Go restart).

**Issues or decisions:**
- No reflection column yet (Phase 5 is not approved); it would need a small later migration.
- A real cross-account RLS test still needs a second test account; `focusLive` uses IDs the test account does not own.
- Before the migration is applied, rounds stay on the device and the line says they will sync later (`PGRST205` is treated as temporary).

**Next action:**
- Owner applies `20261016_001_focus_sessions.sql` in the Supabase SQL Editor and reports back; then run `npx playwright test e2e/focusLive.spec.ts` and record the result here and in `CLAUDE.md` §6.

### 2026-10-16 — Unifyd Focus, Phase 2: timer engine and Focus screen (branch `ui-revamp`)

**Requirements implemented:**
- SRS-FR-1001 to SRS-FR-1009 (new §5.11). Owner-approved scope addition on 2026-10-16, part of Planner; the eight-module classification is unchanged. SRS-FR-1010 (database sync) is Phase 3.

**Owner decisions (Phase 1 review, 2026-10-16):**
- Option B: shared grid, Ionicons `timer-outline`, balanced 3 + 2 (no Lucide, no horizontal scroll).
- Completed = reached the planned length; partial = ended early with ≥ 1 minute of focus; discarded = reset or ended with less, after confirmation. Breaks and paused time never count. After a break, the next round waits for Start. Reset affects only the current round.
- Study insights: rule-based first. Any later Groq use gets aggregate data only (no subject names, task titles, or academic details).

**Changed files:**
- New: `mobile/lib/focusTimer.ts`, `mobile/lib/focusStorage.ts`, `mobile/lib/focusNotifications.ts`, `mobile/hooks/useFocusSession.ts`, `mobile/app/focus.tsx`, `mobile/components/focus/FocusDial.tsx`, `mobile/components/focus/FocusSetup.tsx`, `mobile/components/focus/FocusPickerSheet.tsx`, `mobile/tests/focusTimer.test.mjs`, `mobile/e2e/focus.spec.ts`.
- Changed: `mobile/app/(tabs)/planner.tsx` (Focus mode tile, 3 columns), `mobile/components/IconQuickActions.tsx` (optional `columns`, default 4), `mobile/app/_layout.tsx` (`focus` route; alerts refreshed on sign-in and language change; alert taps open Focus; sign-out clears alerts and pauses the timer), `mobile/constants/i18n.ts` (76 `focus.*` keys in English and Malay), `mobile/e2e/studies.spec.ts` (five shortcuts, 3 + 2 layout).
- Docs: `CLAUDE.md`, `PROJECT_PROGRESS.md`, `DEVELOPMENT_HANDOVER.md`, `UNIFYD_SRS.md` (§5.11, traceability), `UNIFYD_SDD.md` (§4.1, §7.10, traceability), `UNIFYD_PRD.md` (FR-09), `UNIFYD_PROJECT_BRIEF.md` (one line), `UNIFYD_DESIGN_SYSTEM.md` (Planner shortcuts, Unifyd Focus).

**What changed:**
- Timer: remaining time comes from stored timestamps (`runStartedAt`, `bankedMs`); ticks only redraw. Catching up runs on screen focus, on return to the foreground, at zero, and before each action, so locked phones, backgrounding, and restarts keep the right time. A clock moved backwards counts as no time.
- Presets: Classic 25/5, Deep 50/10, Quick 15/3, and Custom (focus 5–120 in steps of 5, short break 1–30, long break 5–60 in steps of 5). The long break (default 15) follows every 4th completed round.
- Kept rounds (completed or partial) are stored on the device under `unifyd:focus-blocks:<userId>`, each with a random UUID, and added only once. They are never cleared by sign-out. The timer state lives under `unifyd:focus-session:<userId>`.
- Alerts: channel `unifyd-focus`, for the end of focus and the end of the following break; permission asked only on Start or Resume; the web shows "Round alerts aren’t available on the web". Alert text never names a subject or task.
- Subject and task links are read-only: semester subjects (`taskSubject` labels) or General study, and open tasks filtered by exact subject text with "Show all open tasks". Choosing a task links its own subject. Links and settings are locked while a round or break runs.
- No database change, no new dependency, no Poof changes (deferred to Phase 5).

**Tests performed:**
- Mobile typecheck and lint clean. Unit **139/139** (15 new in `focusTimer.test.mjs`: presets, custom limits, pause/resume, focus→break, waiting for Start, long break after 4 rounds, reset, partial/discarded, double taps, backwards clock, alerts, restore, clock text, UUIDs).
- Playwright `focus.spec.ts` 6/6 (fake clock: full round with pause, presets and custom, end/reset with confirmation, restart while running and paused, a round finished while closed, subject/task links) and `studies.spec.ts` 6/6.
- Full Playwright suite: 99/100 passed; the 1 failure is the known intermittent Wallet test "no budget and no expenses" (deck keeps its place), which also failed 1 of 2 runs on clean `main` (and 1 of 2 on `ui-revamp`).
- Screenshots at 390 and 320 pt (Planner 3 + 2 grid, Focus idle, running, custom) checked by eye; one fix made (shorter long-break stepper label, plus a note).
- Not executed: native alerts, a locked iPhone/Android phone, and Expo Go restart (owner to check on a phone).

**Issues or decisions:**
- RN Web needs `aria-checked` alongside `accessibilityState.checked` for radio rows (added, as in other screens).
- The timer uses 52/44 pt bold tabular numerals, larger than the Display style; recorded as an intentional difference in the design system.
- `tasks.subject` is free text, so subject→task filtering is by exact label; tasks typed by hand appear under "Show all open tasks".

**Next action:**
- Owner reviews Phase 2 (and checks alerts and lock-screen behaviour on a phone), then approves Phase 3: the `focus_sessions` migration (owner applies it) and sync of the kept rounds.

### 2026-10-14 — Receipt scan speed: no-risk fixes (warm-up, parallel sign-in check, single-pass photo)

**Requirements implemented:**
- Performance only. No change to image size or JPEG quality, the Vision request, the parser, the response, or the evaluation.

**Changed files:**
- Server: `server/src/vision-warmup.ts` (new), `server/src/scan-speed.test.ts` (new), `server/src/app.ts` (parallel sign-in check), `server/src/index.ts` (background warm-up), `server/src/scan-timing.ts` (+ `span`, `authCheck`/`authWait` stages), `server/src/scan-timing.test.ts`, `server/README.md`.
- Mobile: `mobile/lib/receiptImage.ts` (single pass with fallback; options argument), `mobile/lib/receiptImageTools.ts` (`encodeFile`), `mobile/lib/scanTiming.ts` (`singlePass`), `mobile/app/scan-receipt.tsx` (passes the picker's size), `mobile/tests/receiptImageSinglePass.test.mjs` (new), `mobile/tests/scanTiming.test.mjs`.
- Docs: `CLAUDE.md`, `PROJECT_PROGRESS.md`.

**What changed:**
- Owner's 5 timed iPhone scans (before): phone total median 6.9 s (3.9–9.9 s). Median stages: prepare 243 ms, server auth 517 ms (187–1106), upload receive after auth 1.9 s (0.8–5.5 s) plus about 0.8 s before the server starts timing, Vision 2.1 s (first scan 3.2 s), parse + items about 10 ms. The upload of about 1 MB is the largest and most variable cost (not changed here; to be decided with an accuracy check).
- Warm-up: at start-up, in the background, the server fetches the Google access token, prepares the Vision client, and opens its connection (no Vision request). Failures log one line without details, never stop start-up, and clear any cached failed set-up so the first scan connects as before. Real start-up logged `Google Vision ready (1677 ms)`.
- Parallel sign-in check: verification starts when the request arrives and runs while the upload is read; every path (including upload and content-type errors) awaits it before answering, and OCR runs only after it passed. One check per request, never cached.
- Single pass: the photo is read, resized to the same target size, and saved at the same quality in one manipulator pass using the picker's upright width and height; missing sizes, failures, or a result of a different size fall back to decode-then-encode.

**Tests performed:**
- Server typecheck, **119/119** (6 new: rejected and failing checks never reach OCR, OCR waits for a slow check, each request is checked again, upload errors still answer 401 to unverified callers, warm-up success and three failure cases), build.
- Mobile typecheck and lint clean; unit **124/124** (4 new: same output size as two passes for six photo sizes, quality retry, three fallbacks, timing flag); Playwright `scanFlow`, `unifyd`, `categorySuggestion` 22/22.
- `npm run eval:receipts:run` byte-identical to `reports/dev-after-improvements.txt`.
- Not executed: after-fix timed scans on the iPhone (owner to run).

**Next action:**
- Owner reruns the timed scans to compare; then decide on upload size with an accuracy check.

### 2026-10-14 — Receipt scan speed: stage timing (measurement only)

**Requirements implemented:**
- None (measurement). No behaviour, parser, response, image-quality, or evaluation change.

**Changed files:**
- Server: `server/src/scan-timing.ts` (new), `server/src/scan-timing.test.ts` (new), `server/src/app.ts` (receipt route marks stages), `server/src/index.ts` (`SCAN_TIMING` flag), `server/scripts/receipt-parse-timing.ts` (new), `server/package.json` (`timing:receipts:parse`), `server/.env.example`, `server/README.md`.
- Mobile: `mobile/lib/scanTiming.ts` (new), `mobile/tests/scanTiming.test.mjs` (new), `mobile/lib/receiptImage.ts` and `receiptImageTools.ts` (optional decode/encode timing callback), `mobile/lib/receiptOcr.ts` (optional session and upload+server timing), `mobile/app/scan-receipt.tsx` (one Metro log line per scan), `mobile/.env.example`.
- Docs: `CLAUDE.md`, `PROJECT_PROGRESS.md`.

**What changed:**
- Server, with `SCAN_TIMING=1` (off by default, ignored in production): one log line per receipt request with auth, upload, Vision, parse, items, and total durations, the status, the image size, and whether it is the first scan since start. The Vision and Supabase clients are created once and reused; the first scan includes the Google connection and token setup.
- Mobile, with `EXPO_PUBLIC_SCAN_TIMING=1` in a development build: one Metro log line per scan with prepare (decode and each encode), the image size and dimensions sent, the sign-in lookup, upload+server, the minimum-time wait, the total, and the outcome.
- Hosting: the server runs on the owner's Windows PC (`npm start`, LAN address); there is no cloud deployment, so no idle sleep, but the first scan after a restart sets up the Google connection.

**Tests performed:**
- Parser timing on cached OCR, 42 development receipts, 50 warm runs each (two runs): parse first call median 0.58–0.65 ms (max 4.65 ms); warm median 0.24–0.25 ms (p95 1.7 ms); items warm median 0.15 ms (p95 0.4 ms).
- Server typecheck, **113/113** (3 new), build; a real start with `SCAN_TIMING=1` logged `[scan-timing] scan=1 first=yes status=401 total=0ms` for an unauthenticated request (no Vision call).
- Mobile typecheck and lint clean; unit **120/120** (2 new); Playwright `scanFlow` + `unifyd` 18/18 (timing off).
- `npm run eval:receipts:run` byte-identical to `reports/dev-after-improvements.txt`.
- Not executed: a timed scan on the iPhone (owner to run), any Vision call.

**Next action:**
- Owner runs timed scans on the iPhone; then choose fixes from the ranked list.

### 2026-10-14 — Receipt scan flow: finish, minimal Start text, merge to main (Phase D)

**Requirements implemented:**
- Design system "Receipt scan flow" final details; owner request for less text on Start.

**Changed files:**
- `mobile/components/scan/ScanStart.tsx`, `mobile/constants/i18n.ts`, `mobile/e2e/scanFlow.spec.ts`, `UNIFYD_DESIGN_SYSTEM.md`, `PROJECT_PROGRESS.md`.

**What changed:**
- Start now shows only the icon tile, "Scan a receipt", one short privacy line ("Read by Google Cloud Vision. Photo not kept." / "Dibaca oleh Google Cloud Vision. Foto tidak disimpan."), the two buttons, and Add expense manually. The description line was removed. The privacy policy keeps the full wording (Unifyd server, Google Cloud Vision, photo and detected text not kept).
- Design doc brought in line with the build: lock icon on the privacy line, back arrow plus Cancel on Reading, suggestion above the Category row, iOS swipe-back off except on Start, the full list of error messages with Try again for upload, reading, and timeout failures.
- `scan-flow-redesign` (design doc, Phase B scan flow, Phase C items, this entry) merged into `main` locally; not pushed.

**Tests performed:**
- Branch contained `main` (0 behind, 3 ahead) before the final commit.
- Mobile typecheck and lint clean; unit 118/118. Server typecheck, 110/110, build.
- `npm run eval:receipts:run` byte-identical to `reports/dev-after-improvements.txt` (0 images read by Vision; `--final` not run).
- Full Playwright suite before the text change: 93 passed, 1 failed (`budget` "a failed save keeps the amount…", intermittent on `main` as well). After the text change: `scanFlow` 11/11 plus a screenshot check of Start at 390 × 844.
- Not executed: device test of the final build.

**Issues or decisions:**
- The gear button seen in the owner's iPhone screenshot is Expo Go's developer menu, not part of Unifyd.

**Next action:**
- Test the scan flow on the iPhone with the checklist from Phase C.

### 2026-10-14 — Receipt OCR: line items as an additive, optional field (Phase C)

**Requirements implemented:**
- Receipt review support (SRS-FR-203 editable review); design system "Receipt scan flow" Items card.

**Changed files:**
- New: `server/src/receipt-items.ts`, `server/src/receipt-items.test.ts`.
- Changed: `server/src/app.ts` (response adds `items` after `parseReceiptText`), `server/src/app.test.ts`, `server/README.md`; `mobile/lib/scanFlow.ts` (`unitPrice`, `shownUnitPrice`, `itemsIncomplete` flag), `mobile/components/scan/ReceiptItemsCard.tsx`, `mobile/components/scan/ScanReview.tsx`, `mobile/constants/i18n.ts`, `mobile/tests/scanFlow.test.mjs`, `mobile/e2e/scanFlow.spec.ts`.
- Docs: `UNIFYD_DESIGN_SYSTEM.md` (Items section), `CLAUDE.md`, `PROJECT_PROGRESS.md`.

**What changed:**
- `receipt-items.ts` reads lines from the same rebuilt rows as the total (text lines without word boxes): two-line "name / barcode qty × unit amount" layouts, one-line items, leading quantities, price-qty-discount-amount columns, "@ unit xN", amounts alone on the next line, promotion lines ("02 6.99 -2.00") and named or nameless negative lines as discounts. Names must be real words (no prices, mostly-number or code-only text); summary, payment, tax, change, count, address, staff, document, and OCR-damaged labels ("otal", "nge", "Chang", "TCTAL", "Iten") are excluded.
- Consistency: items must add up to the parsed total within RM 0.05, allowing printed rounding, tax, and service charge; when a line's printed amount disagrees with its own qty × unit, or an amount is illegible, the reading that adds up is used. A smaller gap adds `Items may be incomplete.`; more than 40% away, no total, or an unpaid order returns `[]`. The total is never changed.
- The response gains `items: [{ name, quantity, unitPrice, amount }]`; the other five fields are unchanged. The warning names no field, so it never marks merchant, date, or total (and is not matched by the evaluation's flag rules).
- Mobile shows "5 × RM 2.00" for printed unit prices and the incomplete note on the Items card only; editing drops a unit price that no longer agrees.

**Tests performed:**
- `npm run eval:receipts:run` output byte-identical to `reports/dev-after-improvements.txt` (twice; 0 images read by Vision; `final/` untouched; `--final` not run).
- Server typecheck, **110/110** tests (8 in `receipt-items.test.ts`, 1 new endpoint test), build.
- Mobile typecheck and lint clean; unit **118/118**; Playwright `scanFlow` 11/11 (items with the server's exact shape: unit price line, edit, add item and discount, incomplete note), `unifyd` + `categorySuggestion` 11/11.
- Development split, cached OCR only (held-out receipts skipped by the evaluation hash): 31 of 42 receipts return items; 26 add up to the total within RM 0.05, 5 carry the incomplete warning, 11 return none (no total, unpaid, handwritten, or unreliable).
- Not executed: held-out or final receipts (deliberately), device test.

**Issues or decisions:**
- Names are kept as printed, including chains' own truncation (a house brand's "HOUSEBRAND SCE") and OCR misspellings.
- Items are never saved; storing them would need a table and a scope decision.

**Next action:**
- Try item reading on the phone with a few fresh receipts (not from the final set).

### 2026-10-14 — Receipt scan flow redesign: Start, Reading, Review (Phase B)

**Requirements implemented:**
- SRS-FR-201 to SRS-FR-207 (receipt capture, OCR draft, editable review, fallback); design system "Receipt scan flow".

**Changed files:**
- New: `mobile/components/scan/` (`ScanStart`, `ScanReading`, `ReceiptReadingRing`, `ScanReview`, `ReceiptPhotoRow`, `DetectedTextSheet`, `ReceiptItemsCard`, `ReceiptItemSheet`, `ReviewFlag`), `mobile/lib/scanFlow.ts`, `mobile/hooks/useExpenseDraft.ts`, `mobile/tests/scanFlow.test.mjs`, `mobile/e2e/scanFlow.spec.ts`.
- Changed: `mobile/app/scan-receipt.tsx` (three-step flow), `mobile/lib/receiptOcr.ts` (abort signal; `network`, `timeout`, `cancelled` errors; optional `items`), `mobile/components/wallet/ExpenseForm.tsx` (uses the shared hook; same markup), `mobile/components/wallet/ExpenseDatePicker.tsx` (row `placeholder`, `accessory`, `a11ySuffix`), `mobile/constants/i18n.ts`, `mobile/e2e/unifyd.spec.ts`, `mobile/e2e/categorySuggestion.spec.ts`.
- Docs: `UNIFYD_DESIGN_SYSTEM.md` (section marked implemented; ring 66 dots of 3–5 pt, opacity 0.5–1; §5 scanned total now an editable system-font field), `CLAUDE.md`, `PROJECT_PROGRESS.md`.

**What changed:**
- Start: gradient icon tile, title, one line, privacy line ("sent to the Unifyd server and read with Google Cloud Vision. Unifyd doesn't keep the photo."), Scan with camera, Choose photo or screenshot, Add expense manually. Picking starts reading at once (no Extract details step). Both sources still go through `prepareReceiptImage`.
- Reading: full-screen dotted ring (RN `Animated`, native driver), "Preparing your photo…" then "Reading your receipt…", at least 1.2 s, Retry and Enter manually after 20 s, static ring under Reduce Motion, Cancel and Android back cancel the request.
- Review: photo row with full-screen viewer; Details (merchant wraps, date row, total, category with the optional suggestion, collapsed note); amber "Check" marks from the existing warnings that clear on edit; one notice for no readable text; Items card only when the response has `items` (collapsed after 4, discounts as minus lines, add/edit/remove, mismatch note, never saved); raw text only in the "View detected text" sheet; Save expense fixed outside the scroll area; Back asks "Discard this scan?". iOS swipe-back is off except on Start.
- Errors: unsupported or unpreparable photo, too large, upload failure (`network`), reading failure (`unavailable`), and timeout each have their own message; the last three offer Try again with the same prepared photo; manual entry is always on Start.
- Privacy policy text now names the Unifyd server and Google Cloud Vision and says the photo and detected text are not kept.
- No receipt image storage was added ("keep receipt image" would need Supabase Storage, a bucket policy, a column, and privacy wording).

**Tests performed:**
- Mobile typecheck and lint clean; unit **117/117** (7 new in `scanFlow.test.mjs`).
- Playwright `scanFlow` 10/10 (steps, ≥ 1.2 s measured in the page, 20 s slow state with a fake clock, warnings, detected-text sheet, errors, items, discard, Reduce Motion), `unifyd` + `categorySuggestion` 11/11; OCR always mocked, no Vision call.
- Full Playwright suite: **91 passed, 2 failed** (93 tests). `subscriptions` compact layout passed when re-run alone (load). `budget` "a failed save keeps the amount…" is intermittent: on this branch 3 failures in 9 spec runs, on `main` (temporary worktree) 1 in 8; the screen and its components are unchanged here.
- Server typecheck, 101/101, build.
- Not executed: iPhone or Android device test.

**Issues or decisions:**
- Total is an editable system-font field (design system §5 updated). Date placeholder shortened to "Not found" so it fits the row.

**Next action:**
- Phase C: server-side line items for the optional `items` field.

### 2026-10-14 — Receipt OCR evaluation: separate final test set

**Requirements implemented:**
- Phase 9 evaluation tooling (no app, API, parser, label, split, or scoring change).

**Changed files:**
- `server/scripts/receipt-eval-paths.ts`, `server/scripts/receipt-eval-setup.ts`, `server/scripts/receipt-ocr-cache.ts`, `server/scripts/receipt-eval.ts`, `server/scripts/receipt-final-check.ts` (new), `server/src/receipt-eval.ts`, `server/src/receipt-eval-report.ts` (new), `server/src/receipt-label-check.ts` (new), `server/src/receipt-eval-report.test.ts` (new), `server/package.json`, `server/README.md`.
- Docs: `CLAUDE.md`, `PROJECT_PROGRESS.md`.

**What changed:**
- New folder `server/local-data/receipt-eval/final/` (`images/`, `labels.csv`, `ocr/`), ignored by Git through `/local-data/`.
- `npm run eval:receipts:final-setup`: creates `final/labels.csv` from the same template with one empty row per image, then asks before sending new images to Google Vision (says how many; `-- --yes` when there is no terminal) and caches them in `final/ocr/`.
- `npm run eval:receipts:final-check`: format-only label check (header, types, conditions, dates, totals, duplicates, waiting rows, unknown and unlisted files, cached-OCR count). It imports no parser code and opens no OCR file.
- `--final` now prints the held-out split, the final set, and both combined (same columns, per type and condition, plus a per-field warnings breakdown: correct no warning, correct with warning, wrong flagged, wrong silent, blank). It refuses to score an incomplete final set.
- Report text moved into the pure `receipt-eval-report.ts`; the final set is loaded only through a callback used for `--final`. `readLabelsCsv` collects every invalid row (`parseLabelsCsv` still throws on the first, same messages). `ScoredReceipt` gained `warned` (outcomes unchanged).

**Tests performed:**
- Server typecheck, **101/101** tests (8 new: normal output never loads or prints the final set, `--final` has all three tables with type/condition/warning rows, incomplete final set stops before output, breakdown totals, all invalid rows listed, label check shows no parser output, check code cannot reach the parser or OCR text, normal scripts open `final/` only with `--final`), build; `scripts/` also type-checked with a temporary config.
- `npm run eval:receipts:run` output byte-identical to `reports/dev-after-improvements.txt` (and `--json` identical to before); no `final/` folder created.
- Scratch-copy smoke test (not the real data): final-setup created the labels file and, without a terminal, read no images; final-check reported a bad type and then "Labels OK"; normal output identical with and without `final/`.
- Not executed: `--final` (reserved for the one final run), any Vision call.

**Issues or decisions:**
- The label check reports the first problem on each row; fix it and re-run to see the next.

**Next action:**
- Collect 40–50 new receipts into `final/images/`, run final-setup and final-check, then the single `--final` run.
### 2026-10-14 — Receipt OCR: prepare camera and library photos as upright JPEGs before upload

**Requirements implemented:**
- SRS-FR-201 to SRS-FR-207 (camera and gallery receipt handling). Fix for iPhone photos being rejected.

**Changed files:**
- `mobile/lib/receiptImage.ts` (new, pure rules), `mobile/lib/receiptImageTools.ts` (new, `expo-image-manipulator` adapter), `mobile/lib/receiptOcr.ts`, `mobile/app/scan-receipt.tsx`, `mobile/constants/i18n.ts`, `mobile/package.json`, `mobile/package-lock.json`.
- Tests: `mobile/tests/receiptImage.test.mjs` (new), `mobile/e2e/unifyd.spec.ts`.
- Docs: `CLAUDE.md`, `PROJECT_PROGRESS.md`.

**What changed:**
- Root cause: both errors came from the app, before any upload. "Take photo" failed the app's own 5 MB check on the picked full-resolution photo (`scan-receipt.tsx`, `scan.tooLarge`); a library photo from the iPhone camera arrived as HEIC, which failed the app's JPEG/PNG/WEBP check in `scanReceipt` (`scan.invalidImage`). The server never received either file.
- Every picked photo (camera and library, iOS, Android, web) is now decoded with EXIF orientation applied, resized so the longest side is at most 2400 px (never upscaled, never below 1600 px), and saved as JPEG at quality 0.8; if that is still over 5 MiB it is saved once more at 0.6, and only then shows "Choose an image smaller than 5 MB."
- The upload is always `image/jpeg` (`receipt.jpg` on web; the manipulator's `<uuid>.jpg` on native). "Preparing photo…" shows while converting; a failed conversion shows a new error (`scan.prepareError`, English and Malay) and nothing is uploaded.
- Dependency added with owner approval: `expo-image-manipulator ~57.0.21` (`npx expo install`; included in Expo Go).
- Unchanged: server 5 MiB limit and JPEG/PNG/WEBP signature check, receipt parser, OCR evaluation, labels, API response.

**Tests performed:**
- Mobile: typecheck and lint clean; unit **110/110** (7 new: HEIC to JPEG, resize, no upscale, 1600 px floor, under 5 MB with one retry, tooLarge after retry, conversion failure).
- Playwright: `unifyd` + `categorySuggestion` 11/11 (upload now asserted as `receipt.jpg`, `image/jpeg`, JPEG bytes; new case: an undecodable HEIC shows the prepare error and is never uploaded; OCR endpoint mocked, no Vision call); `walletHome` + `home` 25/25.
- Server: typecheck, 93/93 tests, build.
- Not executed: iPhone or Android device test (needed to confirm HEIC decoding, orientation, and size on real photos).

**Issues or decisions:**
- Retry keeps the size and lowers quality only, so OCR resolution is never reduced below 2400 px by the retry.

**Next action:**
- Test camera and library scans on the iPhone in Expo Go (checklist in the session report), then on Android.

### 2026-10-14 — Maintenance: codebase review, safe cleanup, and documentation sync

**Requirements implemented:**
- None (maintenance). No behaviour, schema, API, or UI change.

**Changed files:**
- Cleanup: `mobile/constants/reminder-timing.ts` (removed unused `reminderLabel`), `mobile/lib/poofFacts.ts` (removed unused `CHECK_IN_STALE_DAYS`), `mobile/components/home/InsightDeck.tsx` (removed the `hintOnEveryCard` option no caller uses).
- Docs: `CLAUDE.md`, `PROJECT_PROGRESS.md` (status, phase table, test evidence, risks, this entry), `UNIFYD_SRS.md`, `UNIFYD_SDD.md`, `server/README.md`.

**What changed:**
- Review: `main` clean at `a5280d5`; no unused locals or parameters (`tsc --noUnusedLocals --noUnusedParameters`); no debug logging; no stray files. Only three symbols were provably unused and were removed.
- Docs now record: the receipt parser and evaluation workflow; the applied course-library and timetable migrations (previously described as pending in the SRS/SDD); current test counts; Phase 9 as started; RISK-001 closed.

**Tests performed:**
- Before cleanup on `main`: mobile typecheck and lint clean; mobile unit 103/103; server typecheck, 93/93 tests, build; full Playwright e2e **82/82**.
- After cleanup and the documentation edits (Phase 4 validation): mobile typecheck and lint clean; unit 103/103; server typecheck, 93/93, build; **full Playwright e2e 82/82** (second full run of the day); offline OCR scoring from the cache (no Vision call) unchanged at 78.6% all three, 0 silent; receipt data intact (57 images, 57 cached OCR results, 57 labels, 57 originals); `git diff --check` clean.
- Not executed: native/phone tests, live Vision calls (avoided to prevent API cost), `--final` (reserved for the final evaluation).

**Issues or decisions:**
- Applied on the owner's request (same day): `expo-web-browser` uninstalled (`npm uninstall`; no imports, no dependents, no config plugin; lockfile change removes only that package). The four `docs/design references/` images renamed with `git mv` to drop a doubled extension (contents unchanged; no references to the old names). Remote branch `claude/upbeat-clarke-chzhwi` merged so its two 2026-10-13 log entries and commits are kept (server files resolved to the newer `main` versions); fully merged branches then deleted.
- Corrected: `expo-symbols` is **not** removable. It is a regular dependency of `expo-router`, so it stays listed directly.
- Kept deliberately: `mobile/lib/insights.ts` and `/api/insights/generate`. Home no longer uses them (2026-10-10), but they implement approved Module 8 and are needed for the pending Phase 9 AI-summary samples.
- Not changed: about 100 exports used only within their own file (harmless).

**Next action:**
- Collect a fresh 40–50-receipt final OCR test set; run the physical-device checks.

### 2026-10-14 — Phase 9: receipt OCR parser improvements (merchant, total, date)

**Requirements implemented:**
- SRS-FR-203 (extraction) and SRS-FR-206 (warnings). API response shape unchanged; the app is unchanged.

**Changed files:**
- New: `server/src/receipt-merchants.ts`, `receipt-merchant.ts`, `receipt-layout.ts`, `receipt-total.ts`, `receipt-date.ts`, and tests `receipt-merchant.test.ts`, `receipt-total.test.ts`, `receipt-date.test.ts`.
- Edited: `server/src/receipt-parser.ts`, `app.ts` (accepts word boxes), `index.ts` (passes word boxes from the same Vision call), `scripts/receipt-eval.ts` (passes cached word boxes; scoring untouched), `app.test.ts`.
- Commits on `main`: `e08dc76` (merchant), `de45526` (total), `a5280d5` (date).

**What changed:**
- Diagnosis of the 48 wrong development fields: 35 parsing problems (value present in the OCR text), 5 recoverable OCR misreads, 3 recognition failures, 5 cases that should be blank.
- Merchant: general nationwide brand list; split logos; footer phrases; fuel brands over dealer companies; tight near-matches (6+ letters, flagged); generic header rules.
- Total: rows rebuilt from Vision word boxes pair labels with amounts; final labels beat a plain total; subtotal, cash, change, rounding, item counts never used; unpaid orders and outstanding bills return no total.
- Date: English/Malay month names; label or time context; due/expiry dates skipped; the `100CT2026` style correction only inside a date, flagged.

**Tests performed:**
- Development split (42 receipts; 15 held-out receipts never inspected, `--final` not run):

| Step | Merchant | Date | Total | All three | Silent errors |
|---|---|---|---|---|---|
| Baseline | 57.1% | 73.8% | 54.8% | 21.4% | 23 |
| Merchant | 90.5% | 73.8% | 54.8% | 38.1% | 5 |
| Total | 90.5% | 73.8% | 92.9% | 59.5% | 3 |
| Date | 90.5% | 95.2% | 92.9% | 78.6% | 0 |

- No per-receipt regressions in the final state (two found during development, 032 merchant and 040 total, were fixed before each commit).
- Correct values with a warning: merchant 11, date 10, total 7; wrong values all flagged.
- Server typecheck, 93/93 tests (19 new), build; mobile typecheck; mobile OCR e2e 2/2.

**Issues or decisions:**
- Remaining development failures, all flagged: totals 017 (subtotal only, never used by design), 040 (heavily tilted), 051 (no total label); merchants 004, 046, 052 (recognition) and 005 (labelled blank); dates 043 and 049-hw (labelled blank).
- Development figures are optimistic: the rules were developed against these receipts.

**Next action:**
- Fresh 40–50-receipt final set, scored once with `--final`; phone re-test after restarting the server.

### 2026-10-14 — Phase 9: receipt OCR evaluation set-up with 57 real receipts

**Requirements implemented:**
- Phase 9 evidence for RISK-002 (OCR accuracy). No app behaviour changed.

**Changed files:**
- From branch `claude/upbeat-clarke-chzhwi` (written 2026-10-13), server files only: `server/package.json` (`eval:receipts*` scripts), `server/README.md`, `server/scripts/receipt-eval*.ts`, `receipt-ocr-cache.ts`, `receipt-labels.template.csv`, `server/src/receipt-eval.ts`, `receipt-eval.test.ts` (commit `e5ec4e0`).

**What changed:**
- The owner's 57 receipts (52 `.jpeg`, 5 `.jpg`; no duplicates; none over 5 MiB; three `-hw` handwritten hints) were copied, not moved, from `local data/receipt-eval/images` to the tool's git-ignored `server/local-data/receipt-eval/images`.
- One `npm run eval:receipts:run`: `labels.csv` created with 57 empty rows; Vision OCR 57 read, 0 failed, 0 skipped; no empty OCR text.
- The owner labelled all 57 by hand (no OCR prefill). Split by file-name hash: 42 development, 15 held out.

**Tests performed:**
- Server typecheck, 74/74 tests, build before the run. Development baseline as in the table above.

**Issues or decisions:**
- Labels, split assignments, and scoring rules are never edited to raise scores.

**Next action:**
- Parser improvements (done in the entry above).


> The two entries below were written on branch `claude/upbeat-clarke-chzhwi` (commits `a90151e`, `6a92006`) and merged on 2026-10-14. The server files they describe are on `main` in their later, improved form.

### 2026-10-13 — Phase 9: one-command receipt evaluation setup

**Requirements implemented:**
- Phase 9 evidence: OCR accuracy evaluation (RISK-002). No app behaviour changed.

**Changed files:**
- New: `server/scripts/receipt-eval-setup.ts`, `server/scripts/receipt-eval-paths.ts`.
- Edited: `server/src/receipt-eval.ts`, `server/src/receipt-eval.test.ts`, `server/scripts/receipt-ocr-cache.ts`, `server/scripts/receipt-eval.ts`, `server/scripts/receipt-labels.template.csv`, `server/package.json` (`eval:receipts:setup`, `eval:receipts:run`), `server/README.md`, and this file.

**What changed:**
- `npm run eval:receipts:run` creates the folders and `labels.csv`, adds an empty row for each new image (any file name), reads new images once with Google Vision, and scores the labelled rows. Existing labels are never overwritten.
- Rows with only a file name are waiting for labels and are skipped, so labelling can be done in batches.
- Label dates accept `YYYY-MM-DD` or `DD/MM/YYYY`; Excel's byte-order mark, quoted or comma-padded comment lines, and trailing empty columns are accepted.
- Unsupported files (for example HEIC) are listed and skipped. Missing Google credentials stop the OCR step with the fix. Vision is not contacted when every image is cached.

**Tests performed:**
- Server unit tests 74/74 (8 in `receipt-eval.test.ts`). Typecheck and build pass; the scripts typecheck under the same strict options.
- Dry runs with placeholder files: the first run created `labels.csv` with empty rows, skipped a HEIC file and `desktop.ini`, and stopped at the missing-credentials message (this environment has no Google credentials). With one row labelled and fake cached OCR, the second run kept the label, skipped the waiting row, and scored without contacting Google. Placeholder files were deleted.

**Issues or decisions:**
- No real receipt has been read yet; the first live Vision run happens on the owner's computer.

**Next action:**
- Save receipt photos in `server/local-data/receipt-eval/images/`, run `npm run eval:receipts:run`, fill in `labels.csv`, and run it again for the baseline.

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

### 2026-10-13 — Wallet: Subscriptions as a standard quick-action tile in a 4-column grid

**What changed (layout only; routes, subscription logic, and Wallet figures are unchanged):**
- `IconQuickActions` is now a grid of 4 equal columns.
  - Extra actions continue the next row in order. An incomplete row is left-aligned, padded with spacers so tiles keep the same width.
  - Row gap is 12 pt. An optional `hint` gives the accessibility hint.
- Every label shares one size from `quickLabelSize`: 13 pt, stepping down only so the longest word fits. Measured on web: 13 pt at 390, about 12 pt at 360, and 10 pt at 320.
- **Wallet:** "Subscriptions" is the fifth action (`repeat-outline`, `quick-subscriptions`, with the same label and hint), first on row 2. The wide pill, its chevron, and its styles were removed.
- **Studies:** its single row of 4 is unchanged apart from the shared label sizing.

**Changed files:** `mobile/components/IconQuickActions.tsx`, `mobile/components/wallet/FinanceQuickActions.tsx`, `mobile/e2e/walletHome.spec.ts`. Docs: `UNIFYD_DESIGN_SYSTEM.md` (Wallet quick actions), `CLAUDE.md`, and this file.

**Tests performed:** typecheck and lint pass; unit tests 103/103; `git diff --check` is clean. E2E 45/45 across walletHome, subscriptions, subscriptionAdd, splitBills, studies, budget, and live unifyd. The Wallet quick-actions test now checks: Subscriptions at the same width and column as row 1, on row 2, 5 buttons, opening /subscriptions; and at 320 px, the tile no taller than Scan receipt (no broken word). Screenshots were checked at 320, 360, and 390 px in Dark and Light.

**Next action:** On the phone, check that the second-row Subscriptions tile lines up under Add expense and opens Subscriptions.

### 2026-10-13 — Planner: Studies layout aligned with Wallet (Academic focus as the blue main card)

**What changed (presentation only; task, priority, timetable, semester, and reminder logic are unchanged):**
- **Order:** header → Studies deck → dots → the four icon shortcuts → Priority tasks, as on Wallet. Before this, the shortcuts sat above the deck.
- **Deck order:** Academic focus (default) → Today → Semester.
  - Academic focus now uses `surface: 'hero'` (`colors.brandGradient`, as Wallet's overview), with an on-blue palette: white text, translucent tiles and track, and filled icons for counts above 0.
  - Its empty state is text only, because the Add task shortcut and the Priority tasks empty state follow it.
- **Guide:** shown only on Academic focus: "Swipe or tap the cards behind for Today and Semester" (`InsightDeck` no longer uses `hintOnEveryCard` here).
- **i18n:** `studies.deckHint` reworded; `studies.cardTasks` is now "Academic focus" / "Fokus akademik"; new `studies.focusEmpty`.

**Changed files:** `mobile/app/(tabs)/planner.tsx`, `mobile/components/planner/StudiesCards.tsx`, `mobile/constants/i18n.ts`, `mobile/e2e/studies.spec.ts`. Docs: `UNIFYD_DESIGN_SYSTEM.md` (Planner), `UNIFYD_SDD.md`, `CLAUDE.md`, and this file. Finance components are untouched.

**Tests performed:** typecheck and lint pass; unit tests 103/103; `git diff --check` is clean. E2E 44/44 across studies, planner, semester, timetable, reminders, walletHome, home, and budget. The rewritten studies deck test checks the layout order, Academic focus as the default gradient card with real counts, the guide only on that card and below the progress, the same box for every card, the shortcuts never moving, dots, and no Back to overview. Screenshots were checked: Dark, Light, Malay at 320 px, and the empty state.

**Next action:** On the phone, check the blue Academic focus card's contrast in sunlight, and swiping to Today and Semester.

### 2026-10-13 — Planner: Studies main page revamp (icon shortcuts, Studies deck, Priority tasks)

**Requirements implemented:**
- Presentation of the Planner tab (Module 5 tasks, Module 7 semester/timetable shortcuts). Task CRUD, completion, reminders, semester, timetable, routes, schema, and RLS are unchanged. SRS-NFR-008 is preserved.

**Changed files:**
- New: `mobile/components/IconQuickActions.tsx`, `mobile/components/home/InsightDeck.tsx`, `mobile/components/planner/StudiesCards.tsx`, `mobile/components/planner/TaskRow.tsx`, `mobile/components/planner/AllTasksSheet.tsx`, `mobile/lib/studiesOverview.ts`, `mobile/tests/studiesOverview.test.mjs`, `mobile/e2e/studies.spec.ts`.
- Edited: `mobile/app/(tabs)/planner.tsx`, `mobile/components/wallet/FinanceQuickActions.tsx` and `FinanceDeck.tsx` (now thin users of the shared components, with unchanged test IDs), `mobile/constants/i18n.ts` (`studies.*` in English and Malay; removed `task.helper`), `mobile/e2e/planner.spec.ts`.
- Docs: `UNIFYD_DESIGN_SYSTEM.md` (new Planner section), `UNIFYD_SDD.md`, `CLAUDE.md`, and this file.

**What changed:**
- **Removed:** the helper sentence, the large Add task button, and the My semester, My timetable, and Reminders rows.
- **Added:** four `IconQuickActions` tiles to the same routes, and the `studies-deck` (Today next class, Academic focus, Semester) on the shared `InsightDeck`/`CardDeck stableFront`, with a guide on every card.
- **Priority tasks:** up to 5 incomplete tasks from `priorityTasks`, with "View all (N)" opening `AllTasksSheet` (To do, then Completed).
- **Rows:** the compact `TaskRow` keeps the complete/reopen circle. Reopening a completed task moved from the main list to the sheet.
- **Narrow screens:** quick-action labels may use half of each gap, and the Malay tiles use shorter labels ("Semester saya", "Jadual waktu"), so 320 pt fits without broken words. The priority badge sits on the status line, so titles stay readable.

**Tests performed:**
- Typecheck and lint pass. Unit tests 103/103 (5 new in `studiesOverview.test.mjs`: the order rules, ties, local-day grouping, focus counts, and minutes until class).
- E2E 44/44 across `studies` (6, new), `planner`, `semester`, `timetable`, `reminders`, `walletHome`, `home`, and `budget`. The Expo Web dev server (`npm run web`) is started by Playwright for these.
- The new specs cover:
  - exactly four shortcuts opening their routes;
  - the exact preview order, 5 rows, no completed task, "View all (8)" with To do (7) and Completed (1);
  - deck cards with mocked real data, the same position and size for every card, and nothing below moving;
  - no Back to overview;
  - the calm empty and all-caught-up states;
  - 320 px Light mode with Reduce Motion and no horizontal overflow.
- Screenshots were checked: Dark, Light, Malay at 320 px, each card, and the sheet.

**Next action:** On the phone, check swiping the Studies deck, the sheet drag, the complete circle, and the Malay labels on a small screen.

### 2026-10-13 — Wallet: stable Finance deck with a guide, and the shared "Budget saved." toast

**Requirements implemented:**
- Wallet presentation only (SRS-FR budget and dashboard features unchanged); SRS-NFR-008 navigation preserved.

**Changed files:**
- `mobile/components/home/CardDeck.tsx`: removed the `backToFirstLabel` option (only Wallet used it); new opt-in `stableFront`.
- `mobile/components/wallet/FinanceDeck.tsx`: uses `stableFront`; new `hint` prop rendered at the bottom of the first card.
- `mobile/app/(tabs)/wallet.tsx`: passes the hint; "Budget saved." moved from the inline notice to `FinanceToast`.
- `mobile/components/finance/FinanceToast.tsx`: optional `testID` (default `subscriptions-toast`, so Subscriptions is unchanged).
- `mobile/constants/i18n.ts`: added `wallet.deckHint`, `wallet.deckHintCategories` (English and Malay); removed `wallet.deckBack`.
- `mobile/e2e/walletHome.spec.ts`, `mobile/e2e/budget.spec.ts`.
- Docs: `UNIFYD_DESIGN_SYSTEM.md` (Wallet insight deck, Manage budget), `UNIFYD_SDD.md`, `CLAUDE.md`, and this file.

**What changed:**
- **No Back to overview.** Away from the first card, the Finance deck showed a "Back to overview" button under the dots. It pushed the quick actions down by 44 pt. Removed.
- **Stable direct selection.** A swipe, a peeking edge, or a dot brings that card into the same front place and size. With `stableFront`, a card swiped past stays at 100% scale (it was 96%) and fades out over the last quarter of the slide. On a phone, the old shrunken card could otherwise stay visible in the left gutter, because the scroller is `overflow: visible`. Home's deck is unchanged.
- **Guide.** The bottom of the overview card shows a `swap-horizontal` icon and white text: "Swipe or tap the cards behind for spending by category and items that need attention". With no attention card it says "Swipe or tap the card behind for spending by category". The owner chose Wallet-accurate wording over Home's "Money, Studies and Wellbeing", because those cards are not in the Wallet deck.
- **Budget saved.** After a confirmed save, Manage budget returns to Wallet with `budgetSaved=1` (unchanged). Wallet now shows "Budget saved." in the same `FinanceToast` as "Subscription saved.": 2.5 s, the same animation, placement, green check, and announcement. A focus effect keyed on the parameter then clears it, so the toast never repeats. Save logic, queries, and the success overlay are untouched.

**Tests performed:**
- Typecheck and lint pass. Unit tests 98/98. `git diff --check` is clean.
- `budget.spec.ts` 4/4: the toast appears after Continue, is labelled "Budget saved.", leaves within 4 s, is not shown again after switching tabs, and never appears after a failed save.
- `walletHome.spec.ts`: the rewritten deck test passes. It checks that the guide sits inside the overview below the figures, the category and attention cards have the overview's exact box, the quick actions never move, and no Back to overview exists. The single-card test also passes.
- `home`, `subscriptions`, `subscriptionAdd`, and live `unifyd` pass.
- "no budget and no expenses" fails at its "deck keeps its place after returning" step. It failed 5/5 on the original committed `CardDeck`/`FinanceDeck`/`wallet.tsx` as well, so it is the order-dependent issue noted in the previous entry, not caused by this change.
- Screenshots were checked: the guide in Dark, Light, and Malay, a mid-swipe frame, and the second card at rest.

**Follow-up (same day, owner request):** the Manage budget amount input and its "RM" prefix now use the Space Mono finance font, matching the other finance pages. `FinanceNumber.tsx` exports `financeFontStyle` (the same style object) for the input, and the prefix uses `FinanceNumber`. The design system and `CLAUDE.md` record this one exception to "not for inputs". Typecheck, lint, and `budget.spec.ts` 4/4 pass, and the screenshot was checked.

**Next action:** On the phone, swipe the Finance deck and check that no strip of the previous card stays at the left edge, then save a budget and check the toast. Then investigate the "deck keeps its place" failure on Wallet return (web scroller remount).

### 2026-10-13 — Wallet: Manage budget redesign with the shared slide-to-save

**What changed:** only the `/set-budget` UI and save flow. Budget queries, period rules (Monday weeks, 1st-of-month months), validation, create-versus-update, RLS, and the schema are unchanged.
- **Removed:** the description paragraph (and its unused `budget.helper` string). The header is tighter.
- **Period:** a Weekly/Monthly segmented radio control replaces the dropdown, with a read-only current-period panel that updates immediately.
- **Amount:** a larger card with "RM", a divider, and a 28 pt system-font input. An existing budget shows "Updating this period’s budget, currently RM X".
- **Saving:** the existing `SwipeToSave` replaces "Save budget", plus "Or tap to save". The footer is hidden while the keyboard is open, and the iOS 26 full-screen back swipe is off on this screen (the edge swipe stays).
- **Shared overlay:** the blue success overlay was extracted from `SubscriptionSavedOverlay` into `components/finance/SaveSuccessOverlay.tsx`. Subscription now passes only its details, and its test IDs are unchanged.
  - Budget shows "Budget saved" or "Budget updated", the amount, "Monthly budget" or "Weekly budget", the range, and "Tap anywhere to continue" (which goes to Wallet as before).
  - Success appears only after the insert or update is confirmed. A failure restores the form, resets the slider, and allows a retry.
- New i18n (English and Malay): `budget.slideToSave`, `tapToSave`, `tapToSaveLabel`, `savedTitle`, `updatedTitle`, `weeklyBudget`, `monthlyBudget`, `savedA11y`, `tapToContinue`, `updatingExisting`.

**Changed files:**
- New: `mobile/components/finance/SaveSuccessOverlay.tsx`, `mobile/e2e/budget.spec.ts`.
- Edited: `mobile/app/set-budget.tsx`, `mobile/components/finance/SubscriptionSavedOverlay.tsx`, `mobile/constants/i18n.ts`, `mobile/e2e/unifyd.spec.ts` (budget steps).
- Docs: `UNIFYD_DESIGN_SYSTEM.md` (§8), `UNIFYD_SDD.md`, and this file.

**Tests performed:**
- Typecheck and lint pass. Unit tests 98/98. `git diff --check` is clean.
- E2E `budget.spec.ts` 4/4 (new, mocked budgets) covers:
  - no description, and the Monthly and Weekly ranges (1–31 Oct, 12–18 Oct 2026);
  - a partial swipe saving nothing, and empty or invalid amounts showing errors and focusing the field with no overlay;
  - loading while the insert is held, then success after it; one POST, and Wallet showing RM 500.00;
  - an existing budget giving "Manage budget", the update note, one PATCH, and no duplicate;
  - a failure keeping the amount and resetting the slider, with the retry saving one row;
  - the keyboard tap-to-save at 320 px in Light mode.
- Live `unifyd.spec.ts` "current monthly and weekly budgets…" passes against the real database, with its restore.
- `subscriptionAdd`, `subscriptions`, and `home` pass. `walletHome` passed 13/13 alone. In the combined run, its "no budget and no expenses" deck-dot test failed once, as seen earlier this session; it passes alone and on 3 repeats, so it is order-dependent and not caused by these changes.
- Screenshots were checked: new and existing budgets in Dark, Light, 320 × 640, and the success screen.

**Next action:** On the iPhone, slide to save a budget (check that it does not navigate back), check that the footer hides while typing, and check the success screen.

### 2026-10-13 — Subscriptions: 5-row previews grouped by renewal date, View all sheets, one icon accent

**What changed:** presentation of the Subscriptions overview only. Queries, calculations, reminders, CRUD, the summary card, Add, and the Add form are unchanged.
- **Needs attention** and **Active subscriptions** each show at most 5 rows in total, grouped by `next_billing_date` under "Today", "Tomorrow", "Yesterday", or a date with the year.
  - Each group is a Wallet-style card, with no day totals.
  - "View all (N)" appears only when N > 5. Before this, attention was capped at 3, and active had no cap.
- **Sorting:**
  - Attention is by urgency (overdue → today → soon), which is also date order.
  - Active is by next billing date.
  - Ties are broken by name, then id.
  - The limit is applied after sorting, then grouping.
- **View all sheets:** new `AllSubscriptionsSheet`, built on Wallet's `AllExpensesSheet` structure, plus `useSheetDrag`.
  - It shows the full count, sticky date headers, one virtualised `SectionList`, and loading, error, and empty states.
  - Rows open the details sheet (after the sheet closes on iOS). The sheet refreshes from the screen's state after actions.
- **Icons:** every `SubscriptionBrandIcon` kind is drawn in `brandCyan`, matching Wallet's expense icons. Brand marks were white before. All marks are vectors, so they tint cleanly; status colours are unchanged.
- **New lib helpers:** `SUBSCRIPTION_PREVIEW_LIMIT`, `groupSubscriptionsByDate`, `renewalDay`, and a name-then-id tie-breaker. `attentionSubscriptions` now returns every match; the optional limit is kept.
- New i18n (English and Malay): `subscription.viewAll`, `viewAllAttentionA11y`, `viewAllActiveA11y`, `viewAllHint`, `allAttention`, `allActive`, `countOne`, `countMany`, `closeAll`, `sheetEmpty`, `dayToday`, `dayTomorrow`, `dayYesterday`, `dayGroupA11y`.

**Changed files:**
- New: `mobile/components/finance/AllSubscriptionsSheet.tsx`, `SubscriptionDateHeader.tsx` (header plus `SubscriptionGroups`).
- Edited: `mobile/app/subscriptions.tsx`, `mobile/lib/subscriptions.ts`, `mobile/components/finance/SubscriptionBrandIcon.tsx`, `mobile/constants/i18n.ts`, `mobile/tests/subscriptions.test.mjs`, `mobile/tests/subscriptionBrands.test.mjs`, `mobile/e2e/subscriptions.spec.ts`.
- Docs: `UNIFYD_DESIGN_SYSTEM.md` (§8 Subscriptions), `UNIFYD_SDD.md`, and this file.

**Tests performed:**
- Typecheck and lint pass. Unit tests 98/98: grouping across the year boundary, 5 rows in total and not per date, ties, relative labels, the uncapped attention list, and the single icon accent.
- E2E: `subscriptions.spec.ts` 7/7. It has 2 new tests:
  - 8 plans: 5-row previews, View all (6) and (8), headers, same-date order, the cyan icon with red status untouched, sheets listing every plan, and pausing from the sheet updating the counts and the sheet;
  - 1 plan: one dated row and no View all.
  - It also now checks that exactly 5 active plans show no View all. The empty state is covered by the existing first test.
- `subscriptionAdd`, `walletHome`, and `financeLive` pass: 27/27 together with `subscriptions.spec.ts`. `git diff --check` is clean.
- Screenshots were checked in Dark, Light, and 320 × 640.

**Issues or decisions:** dark-on-dark rows inside the sheet match the All expenses sheet. Long names and metadata still truncate at 320 px, as before.

**Next action:** On the iPhone, open View all, tap a row (details should open after the sheet slides away), and check that the cyan marks read well.

### 2026-10-13 — Subscriptions: Add Subscription redesign with name suggestions and slide-to-save

**What changed:** only the Add Subscription screen. Edit, the list, validation rules, saved columns, billing calculations, reminder rules, the schema, and navigation targets are unchanged.
- **Layout:** `/subscription-entry` without `id` renders `components/finance/AddSubscriptionForm.tsx`.
  - A compact header leads into these cards: Identity (name, icon preview, and suggestions), Amount, Billing (frequency radio chips plus a date row), Reminder (switch plus timing row), and More details (category and notes).
  - Edit keeps `SubscriptionForm`. Validation is shared through the new `validateSubscription` export.
  - `SelectionField` and `ExpenseDatePicker` gained an opt-in `variant="row"`; their defaults are unchanged.
- **Name suggestions:** a local list of 12 names (`SUBSCRIPTION_SUGGESTIONS` in `lib/subscriptionBrands.ts`) in `SubscriptionNameField`.
  - Matching is case-insensitive, prefix-first, with keywords. Choosing fills only the name.
  - The icon is derived from the name each time through the existing Simple Icons, Ionicons, category, and initial fallbacks, so nothing new is stored and nothing is fetched.
- **Slide to save:** `SwipeToSave` uses RN responder props and `Animated`; no new dependency was added.
  - Releasing at ≥ 90% of the travel saves, and less springs back. Only sideways drags move the thumb. It saves once, then locks until reset.
  - "Or tap to save" runs the same handler, and the slider is hidden from screen readers.
  - Invalid input springs back, scrolls to the first invalid section, and sends nothing.
- **Saved overlay:** `SubscriptionSavedOverlay` grows the Home overview `brandGradient` from the thumb, then shows loading.
  - The minimal success state appears only after the insert is confirmed: check, "Subscription added", amount, and "Name · Frequency". A reminder is mentioned only when it failed, with a retry.
  - "Tap anywhere to continue" goes to the refreshed list. A failed insert shrinks the overlay away and keeps all values.
  - Reduce Motion skips the circle and spring.
- **Saving logic:** `lib/subscriptionCreate.ts` keeps the insert and the reminder separate. A reminder failure never leads to a second insert, and retrying calls only the reminder.
- **Owner-reported fixes from an iPhone:**
  1. The iOS 26 full-screen back swipe took the slider's drag. Add mode now sets `fullScreenGestureEnabled: false`; the edge swipe and the Back button remain.
  2. The footer rode up with the keyboard. It is now hidden while the keyboard is open (`hooks/useKeyboardVisible.ts`), and scrolling dismisses the keyboard.
  3. The success screen was simplified at the owner's request. A reminder problem now shows as a short pill (`subscription.reminderShort.*` in English and Malay), with the full sentence as its accessible label.
- **Subscriptions list result toast** (owner request): `components/finance/FinanceToast.tsx` replaces the static "Subscription saved." and reminder cards with one brief toast (2.5 s, or 4 s with a short reminder line). Errors stay on the page.
  - The returning route's `saved`/`updated`/`deleted`/`reminderIssue` parameters are now cleared after being read. Before this, they reappeared on every refocus, for example after Edit → back.
  - `REMINDER_ISSUE_TEXT` and `isReminderIssue` moved to `lib/subscriptionReminders.ts`.
- New i18n (English and Malay): `subscription.addIntro`, `suggestionsLabel`, `suggestionsNote`, `suggestionUse`, `suggestionSelected`, `sectionBilling`, `sectionReminder`, `sectionOptional`, `slideToSave`, `tapToSave`, `tapToSaveLabel`, `fixErrors`, `added`, `tapToContinue`, `retryReminder`, `retryingReminder`, `addedA11y`.

**Changed files:**
- New: `mobile/components/finance/AddSubscriptionForm.tsx`, `SubscriptionNameField.tsx`, `SwipeToSave.tsx`, `SubscriptionSavedOverlay.tsx`; `mobile/lib/subscriptionCreate.ts`, `swipeToSave.ts`; `mobile/hooks/useKeyboardVisible.ts`; `mobile/tests/subscriptionAdd.test.mjs`; `mobile/e2e/subscriptionAdd.spec.ts`.
- Edited: `mobile/app/subscription-entry.tsx`, `mobile/components/finance/SubscriptionForm.tsx`, `mobile/components/profile/SelectionField.tsx`, `mobile/components/wallet/ExpenseDatePicker.tsx`, `mobile/lib/subscriptionBrands.ts`, `mobile/constants/i18n.ts`, `mobile/e2e/subscriptions.spec.ts`.
- Docs: `UNIFYD_DESIGN_SYSTEM.md` (§8 Subscriptions), `UNIFYD_SDD.md`, and this file.

**Tests performed:**
- Typecheck and lint pass. Unit tests 96/96 (6 new). `git diff --check` is clean.
- E2E `subscriptionAdd.spec.ts` 4/4 (new) and `subscriptions.spec.ts` 5/5. The first test was updated: the toast content, its accessible label, auto-dismissal, and no reappearance after Edit → back.
- Full Expo Web suite: 69/70. The one failure was in `walletHome.spec.ts` (deck dot selection, untouched code) and passed 13/13 when re-run alone.
- Screenshots were checked in Dark, Light, and 320 × 640: the form, suggestions, mid-swipe, circle expansion, loading, and success.
- On an iPhone, the owner confirmed that saving worked by tapping and reported the swipe-back and keyboard bugs, which are fixed above. The fixes have not been re-checked on a device.

**Issues or decisions:**
- The insert grant has no `id` column, so a lost response after a successful insert cannot be made idempotent without a migration (not done). A client guard blocks repeat submits instead.
- Overlay text uses the dark action ink, because white is about 2:1 on the cyan end of the gradient.
- Keyboard visibility cannot be tested on Expo Web.

**Next action:** On the iPhone (after a full Expo Go reload), check that the swipe saves without going back, that the footer stays hidden while typing, and that it returns after scrolling. Then check Android keyboard behaviour.

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
| 2026-10-07 | `UNIFYD_DEVELOPMENT_ROADMAP.md` | Created controlled development roadmap (this file is not in the repository; see `CLAUDE.md` §11) |
| 2026-10-07 | `PROJECT_PROGRESS.md` | Created live project progress record |

## Test evidence log

| Date | Phase | Requirement IDs | Test/evidence | Result | Notes |
|---|---:|---|---|---|---|
| — | — | — | No implementation test yet | Pending | Begin after repository audit (historical row) |
| 2026-10-14 | 0–8 | All | Full Expo Web e2e suite; mobile unit; server tests | 82/82; 103/103; 93/93 | `main` at `a5280d5`; per-feature evidence is in the work log |
| 2026-10-14 | 7, 9 | SRS-FR-203, SRS-FR-206 | Receipt OCR evaluation, 42 development receipts | All three correct 78.6% (from 21.4%); 0 silent errors | 15 held-out receipts not scored; final evaluation pending |

## Active issues and risks

| ID | Status | Issue / risk | Impact | Next action |
|---|---|---|---|---|
| RISK-001 | Closed (2026-10-14) | Current codebase baseline is not yet audited in PSM 2 | Cannot safely start implementation without verifying structure and dependencies | Audited; see `CLAUDE.md` and the 2026-10-14 maintenance entry |
| RISK-002 | Open (mitigated) | OCR accuracy depends on receipt image quality and format | May require manual correction | 57-receipt evaluation done (development 78.6% all three, every wrong value flagged); collect a fresh final set and run `--final` once |
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
| Optional Focus alert sound (a shared notification handler so only Focus alerts play a sound in the foreground; an explicit `sound` on Focus alerts; a silent Android Focus channel; an on/off switch stored on the phone; Task and Subscription reminders unchanged) | Owner approved the approach on 2026-10-16 but postponed it until the iPhone sound tests are done (locked, Silent Mode off, Focus/DND off, Expo Go sounds on; foreground and background recorded separately). If background alerts stay silent with those settings, investigate further before any fix. | Pending enhancement |

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
