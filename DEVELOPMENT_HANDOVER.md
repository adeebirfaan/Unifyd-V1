# Unifyd — Development Handover (2026-10-14)

Short, practical state for resuming work. Details: `PROJECT_PROGRESS.md` (handover summary and dated work log), `CLAUDE.md` (project rules), `UNIFYD_SRS.md` / `UNIFYD_SDD.md`.

## Current project status

- Unifyd is an Expo (SDK 57) + Node/Express + Supabase student app with eight approved modules: account/profile, financial tracking, receipt OCR, budgets, academic tasks, reminders, mood tracking, and the Home dashboard with the Poof assistant.
- All SRS Must and Should features are **implemented locally and pass automated tests** (Expo Web and server).
- **Not yet confirmed on a phone:** reminder delivery, native pickers, Poof feel, and OCR with the new parser.
- Phase 9 (evaluation and thesis evidence) has **started** with the receipt OCR evaluation.

## Session Closure — 16 October 2026

**Read this first.** Sections further down headed 2026-10-14 (Current focus, Next recommended task, Git status, Continuation prompt) are older and superseded by this one.

- **State:**
  - Branch `ui-revamp`, HEAD `b832a2f` (equal to `main`).
  - All Unifyd Focus work is **uncommitted**: 13 modified tracked files and 22 untracked paths, listed in `git status --short`.
  - Nothing has been committed, pushed, merged, or deployed. The untracked `completed receipt data.md` and the receipt evaluation are untouched; nothing under `server/` changed.
- **Implemented:** Unifyd Focus Phases 1–6. The details are in the section below; the design is in SDD §7.10 and SRS §5.11 (SRS-FR-1001 to 1022).
- **Focus status:** **development-complete; pending final device validation and UAT.** It is not user-accepted or production-ready.
- **UAT paused (owner decision, 2026-10-16):** iPhone UAT and full user acceptance testing are postponed until all planned features are built. Do not resume them until the owner asks. The remaining checklist items are marked **Deferred — Pending Full Application UAT** below. Unit, integration, and e2e tests still run after every change.
- **Database:**
  - `20261016_001_focus_sessions` and `20261016_002_focus_session_reflections` were applied per project owner on 2026-10-16.
  - Both were verified live by `mobile/e2e/focusLive.spec.ts` (3/3; test account only, cleaned up).
- **Latest automated results** (16 Oct, Phase 6; not rerun at closure):
  - typecheck and lint clean;
  - unit 167/167;
  - full Playwright 117/117 (includes `focusLive` 3/3).
  - The Wallet "no budget and no expenses" test is intermittent on `main` too.
- **Known limitations:**
  - A round that finishes while Focus is closed is saved but gets no celebration or reflection.
  - Midnight-crossing rounds count on the day they ended.
  - Subject-to-task matching uses exact text.
  - Web has no alerts.
  - In one combined run, "presets and custom durations" failed once; it was not reproduced.
- **Pending (not done):**
  1. ~~A final code review of the whole `ui-revamp` diff.~~ Done 2026-10-16: no blocking findings (see `PROJECT_PROGRESS.md`).
  2. The rest of the iPhone checklist below (**Deferred — Pending Full Application UAT**).
  3. A true cross-account RLS test (needs a second test account).
  4. User acceptance testing (deferred with the checklist).
  5. Owner approval to commit and merge into `main`.
  6. Pending enhancement: an optional Focus alert sound (`PROJECT_PROGRESS.md` "Deferred ideas").
- **Resuming safely:**
  1. Run `git status --short` and confirm `ui-revamp` and the files above.
  2. Never reset, clean, stash, or switch branches with this work uncommitted.
  3. The review is done. Continue with other unfinished work only as the owner directs; do not resume UAT unasked.
  4. Run tests from `mobile/` (commands under "Tests" below).
  5. Ask before any commit, push, merge, or database change.

## Unifyd Focus (branch `ui-revamp`, 2026-10-16; Phases 1–6 done and reviewed; development-complete, device checks and UAT deferred)

An owner-approved addition to Planner: a Pomodoro-style study timer. It is built one phase at a time, and each phase needs the owner's approval. Phases 1 (design), 2 (timer and screen), 3 (database sync), 4 (Focus insights), 5 (Poof companion, optional reflection, rule-based suggestions), and 6 (final QA) are done and uncommitted on `ui-revamp`. Both migrations (`20261016_001_focus_sessions`, `20261016_002_focus_session_reflections`) were applied per project owner on 2026-10-16 and verified live. Final tests: unit 167/167, full Playwright 117/117, live 3/3. The code review is done (no blocking findings). The iPhone checklist is paused until full-application UAT. **Next:** the owner decides on commit and merge.

- **Routes:** `/focus` (`mobile/app/focus.tsx`, opened from the Planner shortcut "Focus mode", `planner-quick-focus`; Planner's shortcut grid now uses 3 columns, 3 + 2) and `/focus-insights` (`mobile/app/focus-insights.tsx`, opened from the "Focus insights" row on Focus). Both are registered in `app/_layout.tsx`.
- **Logic:** `lib/focusTimer.ts` (pure timer rules, timestamps as the source of truth), `lib/focusStorage.ts` (AsyncStorage: `unifyd:focus-session:<userId>` for the timer, `unifyd:focus-blocks:<userId>` for kept rounds awaiting sync), `lib/focusNotifications.ts` (local alerts, Android channel `unifyd-focus`).
- **Insights:** `lib/focusInsights.ts` (pure rules: recorded time only, a round counts on the local day it ended, synced and device rounds merged by ID, percentages adding up to 100) and `lib/focusHistory.ts` (summary and paged history reads; optional goal at `unifyd:focus-goal:<userId>`).
- **UI:** `hooks/useFocusSession.ts`, then `components/focus/` (`FocusDial`, `FocusSetup`, `FocusPickerSheet`, `FocusInsightCards`, `FocusCompanion`).
- **Phase 5:**
  - Poof's poses come from `companionState` (`lib/focusTimer.ts`).
  - Reflections are kept at `unifyd:focus-reflections:<userId>` and sent by `runReflectionSync` (`lib/focusSyncCore.ts`).
  - Suggestions come from `focusSuggestions` (`lib/focusInsights.ts`), on the device only.
  - Poof hidden: `unifyd:focus-poof-hidden:<userId>`. `PoofMascot` and Poof chat are unchanged.
- **Supabase:**
  - Reads `student_semester_courses` and open `tasks`.
  - Writes and reads `focus_sessions` (migration `supabase/migrations/20261016_001_focus_sessions.sql`, **applied per project owner 2026-10-16**; live checks 2/2).
  - **Sync:** `lib/focusSync.ts` (wiring) and `lib/focusSyncCore.ts` (rules). The outbox is `unifyd:focus-blocks:<userId>`, and a round leaves it only after the database confirms it.
  - **Live check:** `npx playwright test e2e/focusLive.spec.ts` (test account only; it cleans up its rows).
- **Configuration:** none (no env variables, no new dependencies).
- **Tests:** `TZ=Asia/Kuala_Lumpur node --test tests/focusTimer.test.mjs tests/focusSync.test.mjs tests/focusInsights.test.mjs` and `npx playwright test e2e/focus.spec.ts e2e/focusInsights.spec.ts e2e/focusCompanion.spec.ts e2e/focusLive.spec.ts e2e/studies.spec.ts` (from `mobile/`; `focus` and `focusInsights` mock `focus_sessions`).
- **Phone check still needed:** the end-of-round and end-of-break alerts, a locked screen, reopening Expo Go mid-round, the insights screen, and Poof's poses and celebration on a real phone (iPhone and Android).
- **Not testable yet:** a true cross-account RLS test (needs a second test account).
### iPhone (Expo Go) checklist for Unifyd Focus — paused 2026-10-16; remaining items Deferred — Pending Full Application UAT

Automated tests ran on Expo Web only. Each item below still needs a real phone. Restart the server and fully reload Expo Go first.

| Item | Status (2026-10-16) |
|---|---|
| 1 Timer layout, 2 Lock screen, 3 Background | Deferred — Pending Full Application UAT (not reported) |
| 4 Alerts | Delivery **PASS** (both alerts); sound **silent** (minor finding, pending enhancement); sound retest and permission denial Deferred — Pending Full Application UAT |
| 5 Restart | Scenario 1 (running round restored) **PASS**; Scenario 2 (paused round stays paused) was given but no result was reported; Scenarios 2–4 Deferred — Pending Full Application UAT |
| 6–10 | Deferred — Pending Full Application UAT |

1. **Timer:** the ring, digits, and controls are fully visible and readable; Large Text (Settings → Accessibility) still fits; nothing sits under the notch or the home bar.
2. **Lock screen:** start a Quick study round, lock the phone for 3 minutes, and unlock. The time should be right, with no time added or lost.
3. **Background:** switch to another app during a round, wait, and come back. The time should be right; a round that ended meanwhile shows the break.
4. **Alerts:** allow notifications on the first Start. The "Focus round complete" and "Break's over" alerts should arrive on time with the screen locked. Deny them on a second install: the timer should still work, with the note shown. **Result 2026-10-16:** both alerts PASS; no sound (minor finding; cause and proposed fix in `PROJECT_PROGRESS.md`; denial not yet checked). Sound retest pending: locked, Silent Mode off, Focus/DND off, Expo Go sounds on, with foreground and background recorded separately. The fix is a pending enhancement (`PROJECT_PROGRESS.md` "Deferred ideas"), postponed until then.
5. **Restart:** force-quit Expo Go mid-round and reopen. The round resumes at the right time; a paused round stays paused.
   - Scenario 1, running round restored after force-quit (Custom 5/1/5): **PASS** (owner, 2026-10-16). The before and after dial and clock times were not recorded, so the ±5 s accuracy was judged by eye, not measured. No other observations.
6. **Start and complete:** finish a round. Poof celebrates once; the reflection card appears; answer it or Skip.
7. **Offline:** turn on Airplane mode, finish a round, and answer the reflection. The line should say the round is saved on this device. Turn Airplane mode off and reopen Focus: it should say synced, and Focus insights should show the round once.
8. **Insights:** today, this week, the chart, subjects, history (Load more), and the goal match what you did.
9. **Poof:** still while focusing or paused; floating when ready and on breaks; hide it and restart, and it stays hidden; with Reduce Motion on, Poof never moves.
10. **Navigation and safe area:** Planner → Focus mode → Focus insights → back. Bottom sheets (subject, task) open, scroll, drag to close, and clear the home bar.

- Design: `UNIFYD_SDD.md` §7.10, `UNIFYD_SRS.md` §5.11, `UNIFYD_DESIGN_SYSTEM.md` "Unifyd Focus". History: `PROJECT_PROGRESS.md` (the 2026-10-16 entries).

## Latest completed work (all on `main`, verified)

| Commit | Work |
|---|---|
| `950d231` | Wallet and Studies refresh: stable card decks (no Back to overview), shared quick-action grid (Subscriptions is a tile), "Budget saved." toast, budget amount in the finance font, Studies page with Academic focus and Priority tasks |
| `e5ec4e0` | Receipt OCR evaluation tool (`npm run eval:receipts:run`) |
| `e08dc76`, `de45526`, `a5280d5` | Receipt parser: merchant (brand list and generic rules), total (word-position row pairing; unpaid orders and bills return none), date (label or time context, Malay months) |
| uncommitted | 2026-10-14 maintenance: three unused symbols removed; documentation synchronised; this file |

OCR, on the 42 development receipts: all three fields correct rose from **21.4% to 78.6%**, and silent errors fell from **23 to 0**. These figures come from the receipts the rules were tuned on; there is no final score yet.

## Current focus (where we stopped) — 2026-10-14, superseded by Session Closure above

A maintenance pass: repository review, low-risk cleanup, documentation sync, and full validation. Before that: receipt OCR parser improvements against the labelled development set.

## Pending tasks

1. Commit and push the uncommitted maintenance changes (below), after review.
2. Phone checks: OCR with the new parser, task and subscription reminders, native pickers, Poof, and the new Wallet and Studies screens.
3. Final OCR evaluation: collect a fresh 40–50-receipt set, label it by hand, and run `--final` **once**. The 15 held-out receipts are still unscored.
4. An automated two-account RLS test (needs a second test account).
5. Phase 9 evidence: AI-summary samples, UAT, and the Likert questionnaire.

## Known issues and unverified behaviour

- **OCR limitations** (flagged with a review warning, never silent): strongly tilted photos, receipts with only a subtotal or no total label, logo-only merchant names, and handwritten dates with two-digit years.
- The phone still runs the **old parser until the server is restarted**.
- The Wallet e2e test "no budget and no expenses … deck keeps its place" failed intermittently on 2026-10-13; it passed in both full runs on 2026-10-14. Watch it.
- **Unverified:** native notifications and pickers, live Groq output, and cross-user RLS (manually confirmed by the owner only).
- **Technical debt:** `mobile/lib/insights.ts` and `/api/insights/generate` are unused by the app but **kept**: they are approved Module 8 and are needed for the Phase 9 AI-summary samples. `expo-symbols` must stay (`expo-router` depends on it). Cleaned up on 2026-10-14: `expo-web-browser` removed, design-reference file names fixed, leftover branches merged or deleted.

## Next recommended task — 2026-10-14, superseded by Session Closure above

**Start with a phone check of receipt OCR with the new parser.**
1. Restart the server: `cd server; npm run build; npm start`.
2. Reload Expo Go and scan 5–10 everyday receipts.
3. Note any wrong fields and whether each wrong one showed a review warning.

Why first: the parser changed significantly, and the evaluation ran only on cached OCR. This confirms the live endpoint, the word-position path, and the app's warning display before the final test set is collected. Collecting the fresh set comes after, because the parser must be frozen first.

## Environment and commands

- **Env files** (git-ignored; never print the values):
  - `mobile/.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_OCR_API_URL`.
  - `mobile/.env.test`: `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`.
  - `server/.env`: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `GROQ_API_KEY` (optional), `GROQ_MODEL`, `PORT`, `OCR_HOST`, `OCR_ALLOWED_ORIGINS`.
  - Google Vision uses Application Default Credentials: `gcloud auth application-default login`.
- **Receipt data** (git-ignored; never commit or delete): `server/local-data/receipt-eval/` holds `images/`, `labels.csv`, and the `ocr/` cache. The originals are in `local data/receipt-eval/images`.

```bash
# mobile/
npm run typecheck && npm run lint
TZ=Asia/Kuala_Lumpur node --test tests/*.test.mjs     # 103 unit tests
npx playwright test                                   # full Expo Web e2e (82); or e2e/<file>.spec.ts
npm run web                                           # dev server
# server/
npm run typecheck && npm test && npm run build        # 93 tests, no network
npm run build && npm start                            # 127.0.0.1:3001; OCR_HOST=0.0.0.0 for a phone on the LAN
npm run eval:receipts                                 # offline OCR scoring from the cache (no Vision cost)
npm run eval:receipts:run                             # also adds label rows and reads NEW images with Vision
npm run eval:receipts -- --final                      # ONLY for the final reported score
```

## Git status (end of 2026-10-14)

- **Branch:** `main`, pushed to `origin/main`; **nothing uncommitted**. The last commits are this handover update, `6ec2a0d` (merge of `claude/upbeat-clarke-chzhwi`, which keeps its receipt-evaluation history), and `f492668` (maintenance: cleanup, docs sync, handover). Check with `git log --oneline -5`.
- **Branches:** only `main`, locally and on GitHub. All feature branches were fully merged and then deleted on 2026-10-14; their commits remain in `main`'s history.
- **Git-ignored and kept locally:** `.env` files, `server/local-data/` and `local data/` (receipt data), `local-assets/`, build output.

## Continuation prompt — 2026-10-14, superseded by Session Closure above

```text
Continue Unifyd development from DEVELOPMENT_HANDOVER.md (2026-10-14). Read it, CLAUDE.md, and the
"Handover summary" at the top of PROJECT_PROGRESS.md first.

State: branch main (= origin/main), working tree clean, only the main branch left. All features are
implemented and pass automated tests (e2e 82, mobile unit 103, server 93). Receipt OCR parser improved
(development all-three 78.6%, 0 silent); final evaluation not yet run.

First: run `git status` and `git log --oneline -5` and confirm they match the handover.
Then help me with the next recommended task: a phone check of receipt OCR with the new parser
(restart the server, scan receipts, record wrong or flagged fields). Do not change the parser on
the basis of the held-out or final receipts, do not run --final, and do not commit, push, run SQL,
or edit labels.csv unless I ask.
```
