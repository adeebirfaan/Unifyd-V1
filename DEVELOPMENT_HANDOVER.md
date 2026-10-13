# Unifyd — Development Handover (2026-10-14)

Short, practical state for resuming work. Details: `PROJECT_PROGRESS.md` (handover summary and dated work log), `CLAUDE.md` (project rules), `UNIFYD_SRS.md` / `UNIFYD_SDD.md`.

## Current project status

- Unifyd is an Expo (SDK 57) + Node/Express + Supabase student app with eight approved modules: account/profile, financial tracking, receipt OCR, budgets, academic tasks, reminders, mood tracking, and the Home dashboard with the Poof assistant.
- All SRS Must and Should features are **implemented locally and pass automated tests** (Expo Web and server).
- **Not yet confirmed on a phone:** reminder delivery, native pickers, Poof feel, and OCR with the new parser.
- Phase 9 (evaluation and thesis evidence) has **started** with the receipt OCR evaluation.

## Latest completed work (all on `main`, verified)

| Commit | Work |
|---|---|
| `950d231` | Wallet and Studies refresh: stable card decks (no Back to overview), shared quick-action grid (Subscriptions is a tile), "Budget saved." toast, budget amount in the finance font, Studies page with Academic focus and Priority tasks |
| `e5ec4e0` | Receipt OCR evaluation tool (`npm run eval:receipts:run`) |
| `e08dc76`, `de45526`, `a5280d5` | Receipt parser: merchant (brand list and generic rules), total (word-position row pairing; unpaid orders and bills return none), date (label or time context, Malay months) |
| uncommitted | 2026-10-14 maintenance: three unused symbols removed; documentation synchronised; this file |

OCR, on the 42 development receipts: all three fields correct rose from **21.4% to 78.6%**, and silent errors fell from **23 to 0**. These figures come from the receipts the rules were tuned on; there is no final score yet.

## Current focus (where we stopped)

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

## Next recommended task

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

## Continuation prompt

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
