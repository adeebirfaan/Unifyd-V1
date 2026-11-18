<p align="center">
  <img src="assets/brand/Unifyd-logo.png" alt="Unifyd logo" width="96">
</p>

<h1 align="center">Unifyd</h1>

<p align="center">
  An AI-assisted student life app that brings money, studies, and wellbeing into one place.<br>
  Built for Malaysian university students. English and Bahasa Melayu.
</p>

---

Unifyd replaces the separate budgeting, planner, and mood apps a student usually juggles. Expenses, receipts, budgets, tasks, reminders, a class timetable, focus sessions, and mood check-ins live in one Android-first mobile app, and the Home dashboard pulls them together.

AI is used where it saves typing, never to make decisions:

- **Google Cloud Vision** reads receipts and timetables into drafts that the student always reviews before saving.
- **Groq** writes short, descriptive summaries from figures the app has already calculated.
- **Every AI feature has a rule-based fallback**, so the app still works without it.

> Unifyd is a Final Year Project (PSM 2) at Universiti Malaysia Pahang Al-Sultan Abdullah (UMPSA). It is an academic prototype, not a production service.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Testing](#testing)
- [Privacy and AI approach](#privacy-and-ai-approach)
- [Project status](#project-status)
- [License](#license)

## Features

| Area | What a student can do |
|---|---|
| **Account and profile** | Sign up with email, complete onboarding (university, faculty, programme, study year), pick one of 12 avatars, and choose light or dark appearance and English or Malay. |
| **Wallet** | Record expenses by category, set a weekly or monthly budget, and see spent, remaining, daily average, and category shares. Track subscriptions with renewal reminders, and split bills to see who still owes what. |
| **Receipt scan** | Photograph or upload a receipt. Unifyd reads the shop, date, and total into an editable draft, flags anything uncertain, and suggests a retake when the photo is hard to read. Nothing is saved until the student taps **Save expense**. |
| **Planner** | Manage tasks with subjects, deadlines, priorities, and reminder notifications. Choose semester subjects from the UMPSA Faculty of Computing catalogue or add your own, and build a weekly timetable by hand or by importing a timetable image or PDF. |
| **Unifyd Focus** | Run Pomodoro-style focus rounds linked to a subject or task, review daily and weekly focus time, set a goal, and get gentle suggestions from Poof, the app's mascot. |
| **Mind** | Log mood and stress (1–5) as often as needed, view 7- and 30-day trends, and get supportive, non-clinical ideas. A gentle notice appears after several low-mood days. |
| **Home** | A swipeable card deck summarising money, studies, and wellbeing, plus customisable quick actions. |
| **Poof assistant** | Ask questions about your own data ("How much did I spend on food this month?") and get an AI answer or a rule-based quick answer. Poof can open the right screen but never changes data. |

## Tech stack

| Part | Technology |
|---|---|
| Mobile app | [Expo](https://expo.dev) SDK 58, React Native, Expo Router, TypeScript |
| Backend service | Node.js 24, Express, TypeScript |
| Database and auth | [Supabase](https://supabase.com) (PostgreSQL with Row Level Security) |
| OCR | Google Cloud Vision |
| AI text | Groq (optional) |
| Tests | Node test runner, Playwright on Expo Web |

## Project structure

```text
unifyd/
├── mobile/        Expo app: screens (app/), components, logic (lib/), translations (constants/i18n.ts)
├── server/        Express service: receipt OCR, timetable import, AI summaries, Poof chat
├── supabase/      SQL migrations and the course catalogue seed
└── assets/        Original logo, mascot, and avatar artwork
```

The app reads and writes Supabase directly. The server only handles work that needs secret keys (Vision and Groq) and never stores images or text.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) 24 or newer
- A [Supabase](https://supabase.com) project
- A Google Cloud project with the Vision API enabled, and the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
- [Expo Go](https://expo.dev/go) (SDK 58) on an Android or iPhone, or a web browser
- Optional: a [Groq](https://groq.com) API key for AI summaries and Poof answers

### 1. Clone the repository

```bash
git clone https://github.com/adeebirfaan/unifyd.git
cd unifyd
```

### 2. Set up the database

In the Supabase dashboard, open the **SQL Editor** and run every file in `supabase/migrations/` **in filename order**. Then run `supabase/seeds/2026_2027_fkom_catalog_courses.sql` to load the course catalogue.

### 3. Start the server

```bash
cd server
npm ci
cp .env.example .env      # then fill in the values (see Configuration)
gcloud auth application-default login
npm run dev
```

The server listens on `http://127.0.0.1:3001`. Open `http://127.0.0.1:3001/health` to check that it shows `{ "status": "ok" }`.

### 4. Start the app

In a second terminal:

```bash
cd mobile
npm ci
cp .env.example .env      # then fill in the values (see Configuration)
npx expo start
```

Scan the QR code with Expo Go, or press `w` to open the web version.

> **Testing on a phone?** Set `OCR_HOST=0.0.0.0` in `server/.env`, and set `EXPO_PUBLIC_OCR_API_URL` in `mobile/.env` to your computer's local IP address with port `3001` (for example `http://192.168.1.20:3001`). The phone and computer must be on the same network. After changing `mobile/.env`, fully reload Expo Go.

## Configuration

Both folders include a `.env.example`. The real `.env` files are ignored by Git.

**`mobile/.env`**

| Variable | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Your Supabase publishable key |
| `EXPO_PUBLIC_OCR_API_URL` | Yes | Address of the Unifyd server |
| `EXPO_PUBLIC_SCAN_TIMING` | No | `1` logs receipt scan timings in development |

**`server/.env`**

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | Yes | Same Supabase project as the app |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | Same publishable key as the app |
| `PORT` | No | Defaults to `3001` |
| `OCR_HOST` | No | `0.0.0.0` to accept connections from a phone on your network |
| `OCR_ALLOWED_ORIGINS` | No | Extra web origins allowed to call the server, comma-separated |
| `GROQ_API_KEY` | No | Turns on AI summaries and Poof AI answers |
| `GROQ_MODEL` | No | Groq model name (default `openai/gpt-oss-20b`) |
| `SCAN_TIMING` | No | `1` logs per-scan stage durations |

Google Vision uses Application Default Credentials from `gcloud auth application-default login`. No key file is needed. Only the publishable Supabase key is used anywhere; there is no service-role key.

More server details, including every endpoint, are in [`server/README.md`](server/README.md).

## Testing

```bash
# mobile/
npm run typecheck
npm run lint
TZ=Asia/Kuala_Lumpur node --test tests/*.test.mjs     # unit tests
npx playwright test e2e/<file>.spec.ts                # end-to-end tests on Expo Web

# server/
npm run typecheck && npm test && npm run build
```

End-to-end tests sign in with a real test account. Create `mobile/.env.test` with `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` first. Run spec files one at a time; the full suite can exhaust memory on smaller machines.

## Privacy and AI approach

- **Students only see their own data.** Every table is protected by Supabase Row Level Security.
- **Receipt and timetable images are never stored.** The server reads them and returns a draft; the photo and raw text are discarded.
- **Nothing from OCR is saved automatically.** The student reviews and edits every field first.
- **AI only receives totals and counts**, never task titles, notes, names, or dates. Every AI reply is checked against the facts it was given, and anything off-topic or unverifiable is replaced by a rule-based answer.
- **Wellbeing features are supportive, not clinical.** Unifyd does not diagnose, predict mood, or replace professional help. Malaysian help-line contacts are shown where relevant.

## Project status

All planned core features are built and covered by automated tests. Device testing and user acceptance testing are in progress as part of the project's evaluation phase.

## License

Copyright © 2026. All rights reserved. This repository is shared for academic assessment; please ask before reusing any part of it.
