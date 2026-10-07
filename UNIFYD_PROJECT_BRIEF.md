# Unifyd Project Brief

## 1. Project identity

**Working title:** Unifyd: An AI-Assisted Smart Student Life Management Application with Financial, Academic, and Mental Wellness Analytics

**Project type:** Final Year Project (PSM 2) mobile application

**Target users:** University students in Malaysia

**Primary platform:** Android-first mobile application built with React Native and Expo

## 2. Problem statement

University students commonly manage expenses, academic deadlines, and emotional well-being through separate applications or informal methods. This creates fragmented information, makes expense recording easy to forget, and gives students limited visibility of how their financial habits, study workload, and mood relate to one another.

Unifyd provides one simple application for recording these areas and viewing an integrated overview. It is designed to support personal awareness and daily organisation; it does not provide financial, academic, medical, or clinical advice.

## 3. Project objective

Develop and evaluate an AI-assisted mobile application that helps Malaysian university students:

1. record and review daily expenses, including OCR-assisted receipt capture;
2. organise academic tasks and receive deadline reminders;
3. record daily mood and review mood patterns; and
4. view clear, integrated summaries based on their own recorded data.

## 4. Core product modules

| Module | Purpose | Essential capability |
|---|---|---|
| User Account & Profile | Provide private, personalised access | Email authentication, required profile, preferences, row-level security |
| Financial Tracking | Record daily spending | Manual expense create, read, update, delete, categories, history |
| Receipt Scanning | Reduce manual entry | Camera/gallery receipt image, OCR extraction, editable review, manual fallback |
| Budget & Spending | Support money awareness | Weekly/monthly budget, total spent, remaining balance, category breakdown |
| Academic Tasks | Organise workload | Task CRUD, subject, priority, deadline, completion status |
| Reminder Notifications | Prevent missed deadlines | Configurable task reminders and notification history |
| Mood Tracking | Support self-awareness | One mood log per day, note, history, trends, basic self-care suggestion |
| Integrated Dashboard | Combine the three domains | Financial, academic, and wellness panels with descriptive summaries |

## 5. AI-assisted design

Unifyd is **AI-assisted**, not a custom machine-learning or predictive system.

- **Google Cloud Vision OCR** extracts readable receipt information, such as merchant name, purchase date, and total amount.
- **Rule-based backend logic** calculates reliable facts: spending totals, budget balance, task counts, upcoming deadlines, and recent mood trends.
- **Groq AI** turns those verified facts into short, human-readable summaries.
- If Groq is unavailable or returns an invalid response, the dashboard must still show the rule-based facts and a simple fallback message.

The system must not claim to predict future spending, academic performance, or mood.

## 6. Approved technology stack

| Layer | Technology |
|---|---|
| Mobile application | React Native, Expo, Expo Router, TypeScript, NativeWind, Ionicons |
| Authentication, database, and storage | Supabase with Row Level Security (RLS) |
| Backend integration layer | Node.js and Express |
| Receipt extraction | Google Cloud Vision OCR API |
| Descriptive insight generation | Groq API |
| Notifications | Expo notifications/local or push-notification service |

## 7. Scope boundaries

The PSM 2 prototype will **not** include:

- bank, e-wallet, investment, or payment integration;
- direct UMPSA portal, LMS, timetable, or fee-data integration;
- custom model training, predictive analytics, or prediction claims;
- clinical mental-health diagnosis, counselling, or emergency support;
- social, collaboration, or multi-user features.

## 8. Product rules

- Students can access only their own records.
- OCR-extracted receipt data must always be reviewed and editable before it is saved.
- Each student can record one mood entry per day; an existing same-day entry must be edited instead of duplicated.
- Completing or deleting a task must cancel its pending reminders.
- Wellness suggestions must remain general, supportive, and non-clinical.
- AI summaries must use only verified data supplied by the system and must not invent facts.

## 9. Success criteria

The PSM 2 prototype is ready for evaluation when it:

- implements all eight approved modules end to end;
- stores and protects real user data through Supabase authentication and RLS;
- successfully processes sample receipts through OCR with editable confirmation;
- sends task reminders according to the saved preference;
- generates integrated, descriptive insights with a working rule-based fallback;
- passes module-level functional tests and User Acceptance Testing; and
- produces thesis-ready evidence: test results, screenshots, OCR evaluation, AI-summary evaluation, and usability-questionnaire findings.

## 10. Development operating rules

Every coding phase must follow this cycle:

1. Read this brief, the phase specification, and `PROJECT_PROGRESS.md`.
2. Implement only the approved scope for the current phase.
3. Preserve the existing Expo Router structure, including `/(tabs)`.
4. Do not rename, move, delete, reorganise, or duplicate unrelated screens or folders.
5. Run the app and test the phase before continuing.
6. Update `PROJECT_PROGRESS.md` with completed work, tests, bugs, decisions, and the next task.

## 11. Recommended phase order

1. Foundation: Supabase connection, authentication, profile, and RLS.
2. Financial tracking.
3. Budget and spending summaries.
4. Academic tasks.
5. Reminder notifications.
6. Mood tracking and wellness rules.
7. Receipt OCR.
8. Integrated dashboard and Groq summaries.
9. Testing, evaluation, thesis evidence, and deployment preparation.
