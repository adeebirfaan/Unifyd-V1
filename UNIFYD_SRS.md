# Unifyd Software Requirements Specification (SRS)

## 1. Purpose

This SRS specifies the requirements for the Unifyd PSM 2 mobile application. It turns the approved product requirements into uniquely identified, testable requirements for implementation, verification, User Acceptance Testing (UAT), and thesis traceability.

## 2. Scope

Unifyd is an AI-assisted mobile application for Malaysian university students. It combines personal expense tracking, budget monitoring, academic task management, deadline reminders, daily mood tracking, and an integrated dashboard. It uses third-party AI services for OCR receipt extraction and descriptive summaries, supported by deterministic application rules and a non-AI fallback.

## 3. Actors

| Actor | Description |
|---|---|
| Student | Registered university student who owns and manages their personal records. |
| Supabase | Authentication, database, storage, and Row Level Security service. |
| OCR Service | Google Cloud Vision OCR service that extracts text from receipt images. |
| Insight Service | Groq AI service that converts verified structured facts into a short descriptive summary. |
| Notification Service | Device or Expo notification service that delivers scheduled task reminders. |

## 4. Requirement conventions

- **Priority:** Must = required for PSM 2 MVP; Should = implemented after the Must features and before final evaluation where feasible.
- **Verification:** Test = functional/UAT test; Inspection = code/configuration/document review; Demonstration = observed working flow.
- All requirements are subject to the approved scope boundaries in `UNIFYD_PROJECT_BRIEF.md` and `UNIFYD_PRD.md`.

## 5. Functional requirements

### 5.1 Authentication and profile

| ID | Requirement | Priority | Verification |
|---|---|---:|---|
| SRS-FR-001 | The system shall allow a student to register using a unique email address and password. | Must | Test |
| SRS-FR-002 | The system shall reject registration when the email address is already associated with an account. | Must | Test |
| SRS-FR-003 | The system shall authenticate a registered student using valid email and password credentials. | Must | Test |
| SRS-FR-004 | The system shall display a clear message when login credentials are invalid. | Must | Test |
| SRS-FR-005 | The system shall require a student to complete name, university, faculty/programme, and year of study before entering protected main features. | Must | Test |
| SRS-FR-006 | The system shall allow a student to view and update their own profile information and reminder preference. | Must | Test |
| SRS-FR-007 | The system shall allow an authenticated student to log out and end the application session. | Must | Test |
| SRS-FR-008 | Profile Settings shall offer System, Light, and Dark appearance choices, save the selected choice to the student's profile, and apply it immediately; Dark is the default saved choice. | Must | Test |
| SRS-FR-009 | Mandatory onboarding shall offer English and Bahasa Melayu; Profile Settings shall show the current language and offer both choices in a collapsible section. The choice shall be saved to the student's profile and applied to implemented interface copy immediately after saving. English shall be the default and fallback. | Must | Test |
| SRS-FR-010 | In Light appearance, the Profile Edit icon and Home greeting avatar outline shall remain visible; Profile Sign out shall use a filled red treatment with white icon and text in both appearances. | Must | Demonstration |
| SRS-FR-011 | Profile Settings shall initially show compact Appearance and Language rows with their current values. Tapping a row shall reveal its choices and tapping again shall close it; a successful save shall collapse the section, while a failed save shall keep it open with a translated error and prevent repeated taps during saving. | Must | Test |
| SRS-FR-012 | Profile Settings shall provide direct Privacy Policy and Terms of Use pages in English and Bahasa Melayu. Both shall identify Unifyd as an academic prototype, show an October 2026 update date, and explain relevant data use, safeguards, limitations, and user responsibilities without adding a blocking consent flow. | Must | Inspection/Test |

### 5.2 Financial tracking

| ID | Requirement | Priority | Verification |
|---|---|---:|---|
| SRS-FR-101 | The system shall allow a student to create a manual expense record with title, amount, category, date, and optional notes. | Must | Test |
| SRS-FR-102 | The system shall accept only a positive numeric expense amount. | Must | Test |
| SRS-FR-103 | The system shall require category and date before saving an expense record. | Must | Test |
| SRS-FR-104 | The system shall provide the categories Food, Transport, Academic Materials, Personal, and Other. | Must | Demonstration |
| SRS-FR-105 | The system shall display the authenticated student’s expense history and individual expense details. | Must | Test |
| SRS-FR-106 | The system shall allow a student to edit their own saved expense record. | Must | Test |
| SRS-FR-107 | The system shall require confirmation before permanently deleting an expense record. | Must | Test |
| SRS-FR-108 | The system shall recalculate displayed financial totals after an expense is created, updated, or deleted. | Must | Test |

**Phase 2 Wallet status:** Manual creation and validation (SRS-FR-101 through SRS-FR-104) remain implemented. Wallet loads the authenticated student's own expenses in descending expense-date and creation-time order, shows an all-expense RM total and count, and lists each saved record. A row opens its owner-scoped detail view (SRS-FR-105). The student can edit title, amount, category, date, and notes (SRS-FR-106), or delete after an explicit confirmation (SRS-FR-107). Wallet reloads on focus after create, edit, or delete so the total and list are recalculated (SRS-FR-108). Loading, error/retry, not-found, and empty states are included. Live authenticated and cross-user verification remains pending account access.

### 5.3 Receipt scanning and OCR

| ID | Requirement | Priority | Verification |
|---|---|---:|---|
| SRS-FR-201 | The system shall allow a student to capture a receipt image using the device camera or choose one from the device gallery. | Should | Demonstration |
| SRS-FR-202 | The mobile application shall transmit a selected receipt image to the Node.js/Express OCR endpoint using a secure request. | Should | Test |
| SRS-FR-203 | The OCR integration shall attempt to extract merchant name, purchase date, and total amount from the image. | Should | Test |
| SRS-FR-204 | The system shall show OCR-extracted fields in an editable expense-review form before saving. | Should | Test |
| SRS-FR-205 | The student shall be able to correct or complete extracted fields before confirming the expense. | Should | Test |
| SRS-FR-206 | The system shall warn the student if the receipt image is unclear or extraction is incomplete. | Should | Test |
| SRS-FR-207 | The system shall provide a manual expense-entry fallback when the OCR service is unavailable or the receipt cannot be processed. | Should | Test |

The Phase 1 receipt backend implements the protected OCR endpoint and draft extraction for SRS-FR-203 and SRS-FR-206. Phase 2 adds camera/gallery selection and an authenticated mobile multipart OCR request for SRS-FR-201 and SRS-FR-202. Phase 3 adds an editable review form for SRS-FR-204 and SRS-FR-205: OCR merchant, amount, and date are suggestions; missing values and category require student input; title, amount, category, date, and notes can be corrected before an explicit save. The manual-entry fallback remains available for SRS-FR-207. A confirmed record uses `entry_source = 'ocr'`; neither the receipt image nor raw OCR text is saved. The narrow INSERT grant migration for `entry_source` is prepared locally and must be reviewed and applied before live OCR expense saving works.

### 5.4 Budget and spending

| ID | Requirement | Priority | Verification |
|---|---|---:|---|
| SRS-FR-301 | The system shall allow a student to create or update a positive personal budget amount. | Must | Test |
| SRS-FR-302 | The system shall support weekly and monthly budget periods. | Must | Test |
| SRS-FR-303 | The system shall display total budget, total expenditure, and remaining balance for the selected period. | Must | Test |
| SRS-FR-304 | The remaining balance shall equal the budget amount minus qualifying expense records in the selected period. | Must | Test |
| SRS-FR-305 | The system shall display spending totals and percentages grouped by expense category. | Must | Test |
| SRS-FR-306 | The system shall display daily average spending for the selected budget period. | Must | Test |
| SRS-FR-307 | The system shall display a meaningful empty state when no relevant expense data exists. | Must | Test |

**Module 4, Phase 3 status:** The existing Set / Manage Budget flow remains available. Wallet lets a student switch between the current local Monday–Sunday week and first-to-last-day month. For the selected period, it shows the saved budget when present, real period spending, remaining or an explicit over-budget amount, percentage used, and daily average over elapsed calendar days (minimum one). The five-category breakdown shows only categories with period spending. Empty states distinguish no budget, no period expenses, and older expenses outside the period. The existing all-time expense history remains separate. Owner-scoped queries, focus refresh, expense/budget return refresh, and pull-to-refresh support SRS-FR-301 through SRS-FR-307. Cross-user RLS verification still needs a second account.

### 5.5 Academic task management

| ID | Requirement | Priority | Verification |
|---|---|---:|---|
| SRS-FR-401 | The system shall allow a student to create a task with title, subject/course, description, deadline, and priority. | Must | Test |
| SRS-FR-402 | The system shall require task title, subject/course, and deadline before saving a task. | Must | Test |
| SRS-FR-403 | The system shall display tasks under Pending, Ongoing, and Completed statuses. | Must | Test |
| SRS-FR-404 | The system shall sort active tasks by deadline. | Must | Test |
| SRS-FR-405 | The system shall allow a student to view, edit, and delete their own task records. | Must | Test |
| SRS-FR-406 | The system shall allow a student to mark a pending or ongoing task as completed. | Must | Test |
| SRS-FR-407 | The system shall update a task’s associated reminder when its deadline is changed. | Must | Test |
| SRS-FR-408 | The system shall cancel pending task reminders when the related task is completed or deleted. | Must | Test |
| SRS-FR-409 | A student shall be able to choose active curated Faculty of Computing subjects for an academic session and semester, or enter a custom subject. This is personal planning, not official registration. | Must | Test |
| SRS-FR-410 | A student shall be able to view, edit, and delete their own semester subject selections without changing existing task subjects. | Must | Test |
| SRS-FR-411 | The semester view shall total only verified known credits, identify unknown values, and give a non-blocking warning above 19 known credits. | Should | Test |
| SRS-FR-412 | A task form shall offer selected semester subjects as shortcuts while leaving its plain-text subject editable. | Must | Test |

**Module 5, Phase 2 status:** The project owner reports that the `public.tasks` migration has been applied. The authenticated Planner now creates, lists, views, edits, completes, reopens, and deletes owned academic tasks (SRS-FR-401 through SRS-FR-406). New tasks default to pending; completed tasks record a completion time, while reopened tasks clear it. Pending and ongoing tasks appear first by nearest deadline, followed by recently completed tasks. Past active deadlines are marked overdue. Required title, subject, and valid local deadline date/time are checked before saving. Owner-only RLS remains the security boundary. Reminder behaviour in SRS-FR-407 and SRS-FR-408 is reserved for a later phase.

**Module 7, Phase 1 course foundation:** A local, unexecuted migration defines an active-only, authenticated read-only UMPSA course catalogue and private student semester subject selections. Catalogue entries carry academic session, semester, faculty code, optional campus, course code/name, optional positive credit hours, and an approved-source label. A student selection may link to a catalogue entry or use a custom course name without one. The catalogue is a convenience reference, not UMPSA's official registration system; availability, sections, capacity, and final registration remain subject to UMPSA/faculty processes. A later UI may offer catalogue selection or manual custom entry and a configurable credit-load warning; offerings, timetable sections, conflict checks, prerequisites, and registration integration remain future work.

**Module 7, Phase 2:** A reviewed seed, applied by the project owner on 2026-10-08, curates Faculty of Computing degree offerings for academic session `2026/2027` (the current source session) from the local UMPSA Student Course Catalog, PDF pages 393–434. It includes 169 offering rows, 92 Semester 1 and 77 Semester 2, covering 105 distinct course/campus entries. The PDF supplies no explicit credit-hour values, so all seeded credits remain unknown and are never inferred from course codes. My Semester supports owned catalogue/custom selections, editing, deletion, code/name search, and non-blocking known-credit feedback (the source guidelines cite a 19-credit semester limit). A student can always add a custom subject or type a task subject manually. The Task form can copy a selected subject (`CODE — Name`) into its editable text field; tasks store that text as their own snapshot, so deleting a semester subject never changes an existing task. This feature does not register a student at UMPSA. Timetables, sections, conflict checks, prerequisites, and official registration remain future work.

### 5.6 Reminder notifications

| ID | Requirement | Priority | Verification |
|---|---|---:|---|
| SRS-FR-501 | The system shall optionally schedule one local on-device reminder for an active task. | Must | Test |
| SRS-FR-502 | The task reminder choices shall be None, at deadline, one hour before, and one day before. | Must | Test |
| SRS-FR-503 | The system shall store each task's selected reminder offset in `public.tasks.reminder_offset_minutes`; None is the default. | Must | Test |
| SRS-FR-504 | The system shall request device notification permission before attempting delivery where permission is required. | Must | Demonstration |
| SRS-FR-505 | The system shall open the related task when the student taps its delivered reminder. | Should | Demonstration |
| SRS-FR-506 | The system shall allow reminder dismissal without altering the related task’s status. | Must | Test |
| SRS-FR-507 | The system shall display a history of pending and past task reminders. | Should | Test |

**Module 5, Phase 3 status:** A local migration adds nullable `reminder_offset_minutes` (0, 60, or 1440) to owned tasks. The task form offers the four choices; local device scheduling follows the saved offset and deadline only for active tasks with a future fire time. Editing, completion, reopening, deletion, app foreground, and account changes reconcile scheduled device notifications. Permission is requested when a student chooses a reminder; denied permission does not prevent saving the task and produces clear feedback. Tapping a delivered reminder opens its task after the matching user is signed in. This phase does not create a `reminders` table or a notification history screen. The migration is reviewable locally and has not been executed.

**Native presentation:** Android task reminders use the original Unifyd mark as separate white small and full-colour large icons, the blue accent, and one translated task-reminder channel. The operating system retains control of the notification layout and any student-modified channel settings. Visible reminder text is brief and translated; iOS uses its normal app icon and presentation. A fresh native build is required to see Android icon changes.

### 5.7 Mood tracking and wellness awareness

| ID | Requirement | Priority | Verification |
|---|---|---:|---|
| SRS-FR-601 | The system shall allow a student to self-report mood on a 1–5 scale: very low, low, neutral, good, very good. | Must | Test |
| SRS-FR-602 | The system shall allow a student to self-report stress on a 1–5 scale: very low, low, moderate, high, very high, with an optional nonblank note. | Must | Test |
| SRS-FR-603 | The system shall allow multiple private check-ins by the same student on one calendar day. | Must | Test |
| SRS-FR-604 | Each new check-in shall record its creation time automatically; the student may create another check-in without changing an earlier one. | Must | Test |
| SRS-FR-605 | The system shall allow a student to view recent mood history for at least 7-day and 30-day periods. | Must | Test |
| SRS-FR-606 | The system shall show mood history in a visual form, such as a chart or emoji timeline. | Must | Demonstration |
| SRS-FR-607 | The system shall allow a student to edit or delete their own mood logs. | Must | Test |
| SRS-FR-608 | The backend shall detect a predefined repeated low-mood pattern from recent stored mood entries using transparent rules. | Must | Test |
| SRS-FR-609 | The system shall show a general, non-clinical self-care suggestion when the low-mood rule is satisfied. | Must | Test |
| SRS-FR-610 | The system shall present a disclaimer that wellness suggestions are not medical or professional mental-health advice. | Must | Inspection |

**Module 6, Phase 1 status:** The project owner reports that the `public.mood_entries` migration has been applied. It stores self-reported mood and stress check-ins, optional notes, and server timestamps. Authenticated students can access only their own rows through owner-only RLS; multiple check-ins per day are permitted. These scales are not clinical measurements or diagnoses.

**Module 6, Phase 2 status:** The protected Mind tab offers required 1–5 mood and stress choices, an optional private note, translated validation and feedback, and the ten most recent owned check-ins. A successful save clears the form and refreshes history. Each history entry shows its localised time and can be deleted only after confirmation. Pull-to-refresh, loading, empty, error, and retry states are available. Editing remains future work.

**Module 6, Phase 3 status:** Mind shows private 7-day (default) and 30-day views with check-in counts, average mood and stress, and a compact labelled daily visual. Multiple check-ins on a local calendar day contribute to that day's averages; days without entries remain empty. A neutral comparison to the preceding equal-length period appears only when both periods contain at least two entries. Up to two general ideas are chosen by fixed local rules from the latest saved mood/stress levels, with a non-professional-advice statement. Notes do not enter trend or suggestion calculations. AI, predictions, diagnosis, treatment, and notifications are not part of this phase.

### 5.8 Integrated dashboard and AI-assisted insights

| ID | Requirement | Priority | Verification |
|---|---|---:|---|
| SRS-FR-701 | The system shall display financial, academic, and wellness panels on an integrated dashboard. | Should | Demonstration |
| SRS-FR-702 | The financial panel shall display verified spending total, remaining budget, and category breakdown data. | Should | Test |
| SRS-FR-703 | The academic panel shall display verified pending, overdue, completed, and upcoming-deadline task information. | Should | Test |
| SRS-FR-704 | The wellness panel shall display verified recent mood trend information and any applicable rule-based low-mood notice. | Should | Test |
| SRS-FR-705 | The backend shall provide Groq only with structured, verified facts derived from the authenticated student’s records. | Should | Inspection |
| SRS-FR-706 | The system shall validate the AI response before displaying an AI-generated descriptive summary. | Should | Test |
| SRS-FR-707 | The system shall prevent AI-generated summaries from presenting diagnosis, prediction, harmful advice, or facts not contained in the supplied structured data. | Should | Inspection |
| SRS-FR-708 | When the insight service fails or returns an invalid response, the system shall still display rule-based data and a fallback message. | Should | Test |
| SRS-FR-709 | The system shall open the detailed module when the student taps an insight panel. | Should | Demonstration |
| SRS-FR-710 | The system shall provide a refresh action and an appropriate empty state for panels with insufficient data. | Should | Test |

**Module 8 status:** Home shows a gradient overview with current-month spending and budget status, the next deadline, and this week's average mood. Below it, three tappable panels open Wallet, Planner, and Mind (SRS-FR-701, SRS-FR-709):

- **Money:** expense count, percentage of the monthly budget used, and the top three categories (SRS-FR-702).
- **Studies:** pending, ongoing, overdue, due within 7 days, and completed within 7 days (SRS-FR-703).
- **Wellbeing:** last-7-day check-ins, average mood and stress, and a comparison with the previous 7 days (SRS-FR-704).

The device calculates these facts from the student's own records, so Home works even when the server is unreachable. The repeated low-mood rule (SRS-FR-608) is met when mood 1–2 is recorded on at least 3 different local days within the last 7 days. It shows a gentle notice with a non-professional-advice statement (SRS-FR-609, SRS-FR-610).

The authenticated server recalculates the same facts from the database and sends Groq only aggregate numbers, with no task titles, subjects, notes, names, or dates (SRS-FR-705). Groq returns a strict JSON schema. The server rejects any summary containing a number not in the facts, or diagnosis, prediction, advice, or link language (SRS-FR-706, SRS-FR-707). Any failure, a missing key, or an invalid reply returns facts with a fallback message (SRS-FR-708).

Pull-to-refresh and a summary refresh button are provided, and each panel has an empty state (SRS-FR-710). The AI text is labelled as AI-written and secondary to the figures.

## 6. Non-functional requirements

| ID | Requirement | Priority | Verification |
|---|---|---:|---|
| SRS-NFR-001 | The system shall use Supabase authentication and Row Level Security to prevent cross-user access to profiles, expenses, budgets, tasks, reminders, and mood records. | Must | Inspection/Test |
| SRS-NFR-002 | The system shall never embed Supabase service credentials, Google Vision credentials, or Groq API keys in the mobile application source code. | Must | Inspection |
| SRS-NFR-003 | The system shall validate required fields and input values before sending data to the backend or database. | Must | Test |
| SRS-NFR-004 | The system shall provide loading, success, empty, and error feedback for each core user action. | Must | Demonstration |
| SRS-NFR-005 | The system shall remain usable when an optional external service, including OCR or Groq, is unavailable by presenting a safe fallback or recovery path. | Must | Test |
| SRS-NFR-006 | The mobile interface shall use readable text, clear labels, adequate colour contrast, and understandable validation messages. | Must | Usability test |
| SRS-NFR-007 | The application shall run through Expo on the selected physical Android test device. | Must | Demonstration |
| SRS-NFR-008 | The implementation shall preserve the established Expo Router structure, including the `/(tabs)` route group, unless a documented project-wide design change is approved. | Must | Inspection |
| SRS-NFR-009 | The implementation shall keep frontend UI, backend integration, data access, OCR processing, and AI insight responsibilities separated into maintainable modules. | Must | Inspection |
| SRS-NFR-010 | The project shall maintain `PROJECT_PROGRESS.md` as the current record of work completed, tests performed, issues, decisions, and next actions. | Must | Inspection |

## 7. Data requirements

| Entity | Required data |
|---|---|
| Profile | User ID, name, university, faculty/programme, year of study, reminder preference |
| Expense | `id`, `user_id`, `title`, positive `amount` (`numeric(12,2)`), `category`, `expense_date`, optional `notes`, `entry_source`, `created_at`, `updated_at` |
| Receipt | Receipt ID, user ID, image reference if stored, extracted merchant, date, amount, OCR status |
| Budget | `id`, `user_id`, positive `amount` (`numeric(12,2)`), `period_type` (`weekly` or `monthly`), `period_start`, `created_at`, `updated_at` |
| Task | `id`, `user_id`, required nonblank `title` and `subject`, optional `description`, required `deadline` (`timestamptz`), `priority`, `status`, nullable `completed_at`, `created_at`, `updated_at` |
| Catalogue Course | `id`, nonblank `academic_session`, `faculty_code`, `course_code`, `course_name`, `source_label`; `semester` (1 or 2), optional `campus`, optional positive `credit_hours`, `is_active`, timestamps. Active reference rows are read-only to authenticated students. |
| Student Semester Course | `id`, `user_id`, nonblank `academic_session` and `course_name`, `semester` (1 or 2), nullable `catalog_course_id`, optional `course_code` and positive `credit_hours`, `is_custom`, timestamps. Each row is private to its student; custom rows have no catalogue link. |
| Reminder | Reminder ID, user ID, task ID, scheduled time, delivery status, history timestamp |
| Mood Entry | `id`, `user_id`, `mood_level` and `stress_level` (both 1–5), optional nonblank `note`, `recorded_at`, `created_at`, `updated_at` |

The manual expense category codes are `food`, `transport`, `academic_materials`, `personal`, and `other`. `entry_source` defaults to `manual`; `ocr` is reserved for a later reviewed receipt workflow. The expense date defaults to the current date when no date is supplied.

Budget data rules: a weekly budget's `period_start` is a Monday, and a monthly budget's `period_start` is the first day of its month. Each student may store only one budget for the same period type and start date. The project owner reports the migration was applied. Current-period budget setting and spending calculations are implemented; future budget periods and additional analysis remain outside this phase.

## 8. Constraints and exclusions

- The system is an individual student prototype, not a banking, university-portal, or clinical service.
- OCR accuracy depends on receipt image quality, lighting, format, and readable text; student confirmation is mandatory before saving.
- The system does not train a custom machine-learning model.
- The system does not predict future spending, grades, academic performance, or mood.
- AI-generated insight text is descriptive assistance only and must have a rule-based fallback.
- The system does not include bank/e-wallet integration, investment tracking, LMS/timetable integration, counselling, emergency intervention, social features, or shared accounts.

## 9. Initial test-traceability map

| Requirement group | Planned UAT/test area |
|---|---|
| SRS-FR-001 to SRS-FR-007 | Registration, login, profile completion, profile update, logout, RLS access |
| SRS-FR-101 to SRS-FR-108 | Expense CRUD, validation, totals recalculation |
| SRS-FR-201 to SRS-FR-207 | Camera/gallery receipt handling, OCR extraction, editable review, fallback |
| SRS-FR-301 to SRS-FR-307 | Budget setting, selected-period calculations, category analysis |
| SRS-FR-401 to SRS-FR-412 | Task CRUD, statuses, deadline ordering, reminder effects, semester subject selection and task-subject shortcuts |
| SRS-FR-501 to SRS-FR-507 | Reminder scheduling, preferences, tapping, dismissal, history |
| SRS-FR-601 to SRS-FR-610 | Private mood/stress check-ins, multiple entries per day, history, future trend rules and disclaimer |
| SRS-FR-701 to SRS-FR-710 | Dashboard accuracy, AI relevance, invalid-response and service-failure fallback, low-mood rule |
| SRS-NFR-001 to SRS-NFR-010 | Security, secret handling, usability, app operation, maintainability, progress tracking |
