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
| SRS-FR-013 | The student shall choose a profile avatar from a curated library of 12 bundled illustrations during onboarding or in Edit Profile. Only the avatar's stable ID shall be stored; a missing, legacy, or unknown value shall display a default avatar; the same avatar shall appear on Home and Profile; and avatar images shall not be requested from the network. | Must | Test |

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

The Phase 1 receipt backend implements the protected OCR endpoint and draft extraction for SRS-FR-203 and SRS-FR-206. Phase 2 adds camera/gallery selection and an authenticated mobile multipart OCR request for SRS-FR-201 and SRS-FR-202. Phase 3 adds an editable review form for SRS-FR-204 and SRS-FR-205: OCR merchant, amount, and date are suggestions; missing values and category require student input; title, amount, category, date, and notes can be corrected before an explicit save. The manual-entry fallback remains available for SRS-FR-207. A confirmed record uses `entry_source = 'ocr'`; neither the receipt image nor raw OCR text is saved. The narrow INSERT grant migration for `entry_source` is applied. This was confirmed on 2026-10-09 by a check that wrote no data. Students cannot change `entry_source` after saving.

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
| SRS-FR-411 | The semester view shall total only verified known credits, identify unknown values, and give a non-blocking warning above 19 known credits. Any positive load is valid, including fewer than 12 credits: there is no minimum-credit rule, warning, or prerequisite. | Should | Test |
| SRS-FR-412 | A task form shall offer selected semester subjects as shortcuts while leaving its plain-text subject editable. | Must | Test |

**Module 5, Phase 2 status:** The project owner reports that the `public.tasks` migration has been applied. The authenticated Planner now creates, lists, views, edits, completes, reopens, and deletes owned academic tasks (SRS-FR-401 through SRS-FR-406). New tasks default to pending; completed tasks record a completion time, while reopened tasks clear it. Pending and ongoing tasks appear first by nearest deadline, followed by recently completed tasks. Past active deadlines are marked overdue. Required title, subject, and valid local deadline date/time are checked before saving. Owner-only RLS remains the security boundary. Reminder behaviour in SRS-FR-407 and SRS-FR-408 is reserved for a later phase.

**Module 7, Phase 1 course foundation:** A local, unexecuted migration defines an active-only, authenticated read-only UMPSA course catalogue and private student semester subject selections. Catalogue entries carry academic session, semester, faculty code, optional campus, course code/name, optional positive credit hours, and an approved-source label. A student selection may link to a catalogue entry or use a custom course name without one. The catalogue is a convenience reference, not UMPSA's official registration system; availability, sections, capacity, and final registration remain subject to UMPSA/faculty processes. A later UI may offer catalogue selection or manual custom entry and a configurable credit-load warning; offerings, timetable sections, conflict checks, prerequisites, and registration integration remain future work.

**Credit-load rule (correction, 2026-10-09):** Unifyd has no minimum credit-hour requirement. A student may save any positive credit load, for example 13 credits or fewer than 12. A minimum load can matter for UMPSA recognition such as Dean's List eligibility, but Unifyd never uses it for validation, progress, or as a timetable prerequisite. The 19-credit figure is only a visible, non-blocking academic-load warning.

**Module 7, Phase 2:** A reviewed seed, applied by the project owner on 2026-10-08, curates Faculty of Computing degree offerings for academic session `2026/2027` (the current source session) from the local UMPSA Student Course Catalog, PDF pages 393–434. It includes 169 offering rows, 92 Semester 1 and 77 Semester 2, covering 105 distinct course/campus entries. The PDF supplies no explicit credit-hour values, so all seeded credits remain unknown and are never inferred from course codes. My Semester supports owned catalogue/custom selections, editing, deletion, code/name search, and non-blocking known-credit feedback (the source guidelines cite a 19-credit semester limit). A student can always add a custom subject or type a task subject manually. The Task form can copy a selected subject (`CODE — Name`) into its editable text field; tasks store that text as their own snapshot, so deleting a semester subject never changes an existing task. This feature does not register a student at UMPSA. Timetables, sections, conflict checks, prerequisites, and official registration remain future work.

**Module 7, Phase 3: personal timetable (implemented locally; migration awaiting review):**
- **What it is.** My timetable is a student's own weekly plan of recurring classes for one academic session and semester. It is not official UMPSA registration, and Unifyd never reads the UMPSA portal.
- **Manual entry.** The student can add, edit, and delete classes. Each class has a required class name, day (Monday–Sunday), start time, and end time. The end time must come after the start time. Course code, location, and section are optional.
- **Import.** The student uploads a PNG, JPEG, or PDF of up to 5 MB. For a PDF, only the first three pages are read. The Unifyd server checks the sign-in, reads the text with Google Vision, and turns it into draft classes using fixed rules. No AI model, prediction, or outside timetable service is involved.
- **Mandatory review, partial save.** Nothing is saved automatically. Every draft class appears in an editable review list. Complete drafts start ticked, and the student can untick any to leave it out. Incomplete drafts show what is missing and cannot be ticked until completed; they never block saving the others. Details the document does not show are left blank, never guessed. The student can also remove drafts, add classes, and leave without saving. Save stores only the complete, ticked classes. For example, of five candidates, three can be saved while one wrong one is removed and one incomplete one is left out.
- **Subject links.** A class can be linked to a My Semester subject only by the student's choice. A draft whose course code exactly matches a selected subject (ignoring case and spaces) shows that subject as a suggestion only.
- **Clashes.** Two classes clash when they fall on the same day and their times overlap. Classes that only touch, such as 10:00–11:00 and 11:00–12:00, do not clash. Clashes are warnings: they never block saving.
- **Partial and empty timetables are valid.** A timetable may be empty, hold a single class, or have no classes on several or all days. The week view lists all seven days and marks free days with a neutral “No classes”. Nothing reports a missing class, and no other Unifyd feature requires a timetable.
- **Manual entry** validates only the class being saved: class name, day, start time, and end time. The student can cancel without creating a class, and need not add every subject or session.
- **Next class.** It is worked out from saved classes only, using the device's local time. It appears on My timetable and in Planner. With no upcoming class it shows the neutral note “No upcoming classes in your timetable”, not an error. Planner hides the note only if the timetable could not be loaded.
- **No file kept.** The uploaded file, its raw text, and the unsaved draft are never stored. Saved classes keep their own course code/name snapshot, so deleting a My Semester subject only removes the link.
- **Not included:** attendance, calendar sync, notifications, automatic task creation, and timetable scraping.

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

**Module 5, Phase 3 status:** A local migration adds nullable `reminder_offset_minutes` (0, 60, or 1440) to owned tasks. The task form offers the four choices; local device scheduling follows the saved offset and deadline only for active tasks with a future fire time. Editing, completion, reopening, deletion, app foreground, and account changes reconcile scheduled device notifications. Permission is requested when a student chooses a reminder; denied permission does not prevent saving the task and produces clear feedback. Tapping a delivered reminder opens its task after the matching user is signed in. This phase does not create a `reminders` table. The migration is applied. This was confirmed on 2026-10-09 by a check that wrote no data: the column is readable and insertable/updatable, and the 0/60/1440 rule is enforced.

**Reminder history (SRS-FR-507):** Planner links to a Reminders screen with two lists, worked out from saved tasks using the scheduler's rule (deadline minus the chosen offset, active tasks only):

- **Upcoming:** reminders not yet due, soonest first.
- **Past 30 days:** reminders whose time has passed, newest first. A task completed before its reminder time is left out, because completion cancels the reminder.

Each item shows the task, subject, reminder time and offset, and deadline, and opens the task. The screen shows scheduled reminder times. It does not record whether the device displayed a notification or whether the student dismissed it; that would need device-side delivery tracking, which is outside PSM 2 scope. No database change was needed.

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

**Module 6, Phase 2 status:** The protected Mind tab offers required 1–5 mood and stress choices, an optional private note, translated validation and feedback, and the ten most recent owned check-ins. A successful save clears the form and refreshes history. Each history entry shows its localised time and can be deleted only after confirmation. Pull-to-refresh, loading, empty, error, and retry states are available.

**Check-in editing (SRS-FR-607):** Each history card has Edit and Delete actions. Edit opens a sheet pre-filled with the saved mood, stress, and note. Saving changes only those three fields on the student's own row. The original recorded time is kept so trends stay accurate, and a cleared note is stored as empty (null). History and trends refresh after a successful edit; a failed save keeps the sheet and the student's changes open with an error.

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

**Module 8 status:** Home shows a gradient overview with current-month spending and budget status, the next deadline, and this week's average mood. Home presents these as a swipeable deck: Overview in front, then Money, Studies, and Wellbeing cards. Each module card has an Open action for Wallet, Planner, or Mind (SRS-FR-701, SRS-FR-709):

- **Money:** expense count, percentage of the monthly budget used, and the top three categories (SRS-FR-702).
- **Studies:** pending, ongoing, overdue, due within 7 days, and completed within 7 days (SRS-FR-703).
- **Wellbeing:** last-7-day check-ins, average mood and stress, and a comparison with the previous 7 days (SRS-FR-704).

The device calculates these facts from the student's own records, so Home works even when the server is unreachable. The repeated low-mood rule (SRS-FR-608) is met when mood 1–2 is recorded on at least 3 different local days within the last 7 days. It shows a gentle notice with a non-professional-advice statement (SRS-FR-609, SRS-FR-610).

The authenticated server recalculates the same facts from the database and sends Groq only aggregate numbers, with no task titles, subjects, notes, names, or dates (SRS-FR-705). Groq returns a strict JSON schema. The server rejects any summary containing a number not in the facts, or diagnosis, prediction, advice, or link language (SRS-FR-706, SRS-FR-707). Any failure, a missing key, or an invalid reply returns facts with a fallback message (SRS-FR-708).

Pull-to-refresh and a summary refresh button are provided, and each panel has an empty state (SRS-FR-710). The AI text is labelled as AI-written and secondary to the figures.

### 5.9 Finance planning: subscription reminders and split bills

Added at the project owner's request on 2026-10-12. Both features are private, manual planning and tracking records. They are not verified charges or debts, and they never move money.

| ID | Requirement | Priority | Verification |
|---|---|---:|---|
| SRS-FR-801 | The system shall let a student create, view, edit, pause/resume, and delete their own subscription records with a name, positive amount, optional Wallet category, billing frequency (weekly, monthly, quarterly, or yearly), next billing date, reminder timing (0–30 days before), a notification toggle, and optional notes. | Should | Test |
| SRS-FR-802 | The system shall require confirmation before deleting a subscription. | Should | Test |
| SRS-FR-803 | The system shall advance a subscription's next billing date by exactly one billing cycle only after the student confirms "Mark as renewed". It shall keep the amount and reminder settings and never renew automatically when the date passes. | Should | Test |
| SRS-FR-804 | The system shall list upcoming renewals (active subscriptions due within 30 days, including passed dates) and show a monthly equivalent only when it can be calculated from active subscriptions. | Should | Test |
| SRS-FR-805 | The system shall schedule at most one local device reminder per active, reminder-enabled subscription at 09:00 on the next billing date minus the reminder days. It shall skip past times, and update or cancel the reminder after edit, pause, renewal, or deletion. | Should | Test/Demonstration |
| SRS-FR-806 | The system shall request notification permission only when the student saves or resumes a subscription with reminders on. A denied or unavailable permission shall not block subscription tracking. Notification text shall never include notes. | Should | Test/Demonstration |
| SRS-FR-807 | The system shall not create, change, or include any expense because of a subscription. | Must | Test |
| SRS-FR-808 | The system shall let a student create, view, edit, and delete their own split bill with a title, positive total, bill date, optional category, optional notes, and 2–20 people including "You". Other people are plain names and need no Unifyd account. | Should | Test |
| SRS-FR-809 | The system shall include "You" automatically as one participant, settled from the start because the student paid the bill. | Should | Test |
| SRS-FR-810 | The system shall split a bill equally in integer cents so that the shares add up to the total exactly. Leftover cents go one each to the first participants, starting with "You". A split that would give anyone a zero share is not allowed. | Should | Test |
| SRS-FR-811 | The system shall support custom amounts, show the amount left to assign or over the total, and block saving until every share is positive and all shares equal the total exactly. | Should | Test |
| SRS-FR-812 | The system shall let the student mark another participant as fully paid or unpaid. Partial payments are not supported. | Should | Test |
| SRS-FR-813 | The system shall calculate the outstanding amount as the sum of unsettled shares belonging to other people, and show a bill as Settled only when every other participant is settled. | Should | Test |
| SRS-FR-814 | The system shall not contact participants, send payment requests, invitations, or messages, or give participants any access. | Must | Inspection/Test |
| SRS-FR-815 | Wallet shall show a compact summary of renewals in the next 7 days and the total still owed, linked to each screen. These records shall not be included in spending totals. | Should | Test |

**Status (2026-10-12):** Implemented locally and covered by unit and Expo Web E2E tests with the new tables mocked. The migration `20261012_001_finance_subscriptions_split_bills.sql` was applied per project owner on 2026-10-12, and live database checks pass. Reminder delivery, the permission prompt, and tapping a reminder still need a physical-device check.

### 5.10 Smart expense category suggestion

Added as a formal scope decision by the project owner on 2026-10-13. It is a narrow exception to the "no custom ML" exclusion. The system predicts only an expense's category from its title, never spending, grades, or mood.

| ID | Requirement | Priority | Verification |
|---|---|---:|---|
| SRS-FR-901 | The system shall suggest at most one existing expense category for a draft expense title, using a Multinomial Naive Bayes classifier trained only on the signed-in student's own saved expense titles and categories. | Should | Test |
| SRS-FR-902 | The classifier shall train on at most the student's latest 500 labelled expenses, rebuilt in memory for each request and never stored. | Should | Inspection/Test |
| SRS-FR-903 | The system shall offer a suggestion only when the student has at least 15 usable labelled expenses across at least 2 categories, the title contains at least one word seen in training, the top confidence is at least 0.70, and it leads the second category by at least 0.15. Otherwise it shall return a typed `not_enough_data` or `low_confidence` result. | Should | Test |
| SRS-FR-904 | The suggestion endpoint shall verify the Supabase access token, take the user ID only from the verified token, accept only `{ title }` (1–120 characters), apply a per-session rate limit, and never log tokens, titles, history, or vocabulary. | Must | Test |
| SRS-FR-905 | The manual Add Expense form shall request a suggestion only for titles of at least 3 characters, after a short debounce, and show it as an optional card with "Use {category}" and "Choose myself". | Should | Test |
| SRS-FR-906 | "Use {category}" shall only fill the category field. A suggestion shall never save an expense, lock the field, or override a category the student chose. | Must | Test |
| SRS-FR-907 | The OCR review form shall request a suggestion using only the draft title, never raw OCR text, while keeping OCR extraction and the explicit save unchanged. | Should | Test |
| SRS-FR-908 | When data is insufficient, the system shall show a friendly translated note. Low-confidence results show no suggestion. | Should | Test |
| SRS-FR-909 | The project shall provide a deterministic evaluation utility reporting accuracy, per-category precision, recall, F1, macro F1, and a confusion matrix for labelled fixtures. | Should | Test |

**Status (2026-10-13):** Implemented locally. The server and mobile unit tests and the Expo Web E2E tests pass with the endpoint mocked in E2E. A live call with the test account (0 expenses) returned `not_enough_data`. No migration, Groq/LLM call, remote ML API, or model storage is used.

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
| Subscription | `id`, `user_id`, nonblank `name`, positive `amount` (`numeric(12,2)`), optional Wallet `category`, `billing_frequency` (`weekly`, `monthly`, `quarterly`, `yearly`), `next_billing_date`, `reminder_days_before` (0–30, default 3), `notifications_enabled`, `is_active`, optional nonblank `notes`, timestamps |
| Split Bill | `id`, `user_id`, nonblank `title`, positive `total_amount` (`numeric(12,2)`), `bill_date` (default today), optional Wallet `category`, optional nonblank `notes`, timestamps |
| Split Bill Participant | `id`, `split_bill_id` (cascade delete), nonblank `participant_name`, positive `share_amount`, `is_self` (at most one per bill, always settled), `is_settled`, `settled_at` (set exactly when settled), timestamps. There is no `user_id`; access is through the owned parent bill only. |

The manual expense category codes are `food`, `transport`, `academic_materials`, `personal`, and `other`. `entry_source` defaults to `manual`; `ocr` is reserved for a later reviewed receipt workflow. The expense date defaults to the current date when no date is supplied.

Budget data rules: a weekly budget's `period_start` is a Monday, and a monthly budget's `period_start` is the first day of its month. Each student may store only one budget for the same period type and start date. The project owner reports the migration was applied. Current-period budget setting and spending calculations are implemented; future budget periods and additional analysis remain outside this phase.

## 8. Constraints and exclusions

- The system is an individual student prototype, not a banking, university-portal, or clinical service.
- OCR accuracy depends on receipt image quality, lighting, format, and readable text; student confirmation is mandatory before saving.
- The system does not train a custom machine-learning model, except the owner-approved category suggester in §5.10: an in-memory Multinomial Naive Bayes model over the student's own expense titles that only suggests a category. Nothing is stored, and the student always decides.
- The system does not predict future spending, grades, academic performance, or mood.
- AI-generated insight text is descriptive assistance only and must have a rule-based fallback.
- The system does not include bank/e-wallet integration, investment tracking, LMS/timetable integration, counselling, emergency intervention, social features, or shared accounts.
- Subscriptions and split bills are private planning records. The system does not process payments, transfers, DuitNow/QR payments, or payment links. It does not verify subscriptions, collect debts, invite or contact participants, share bills between accounts, or create expenses automatically.

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
| SRS-FR-801 to SRS-FR-815 | Subscription CRUD, renewal confirmation, local reminder reconcile, permission denial, no automatic expense; equal/custom split rules, You as settled, paid/unpaid outstanding totals, settled status, Wallet summary |
| SRS-FR-901 to SRS-FR-909 | Classifier thresholds and tokenisation, authenticated endpoint and privacy, optional suggestion in Add Expense and OCR review, insufficient-data note, evaluation metrics |
| SRS-NFR-001 to SRS-NFR-010 | Security, secret handling, usability, app operation, maintainability, progress tracking |
