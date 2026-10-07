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

### 5.6 Reminder notifications

| ID | Requirement | Priority | Verification |
|---|---|---:|---|
| SRS-FR-501 | The system shall create a reminder for a newly saved task that has a deadline. | Must | Test |
| SRS-FR-502 | The system shall support reminder times of one day, three days, and one week before a deadline. | Must | Test |
| SRS-FR-503 | The system shall use the student’s saved reminder preference for newly created task reminders. | Must | Test |
| SRS-FR-504 | The system shall request device notification permission before attempting delivery where permission is required. | Must | Demonstration |
| SRS-FR-505 | The system shall open the related task when the student taps its delivered reminder. | Should | Demonstration |
| SRS-FR-506 | The system shall allow reminder dismissal without altering the related task’s status. | Must | Test |
| SRS-FR-507 | The system shall display a history of pending and past task reminders. | Should | Test |

### 5.7 Mood tracking and wellness awareness

| ID | Requirement | Priority | Verification |
|---|---|---:|---|
| SRS-FR-601 | The system shall allow a student to log one of five moods: Very Happy, Happy, Neutral, Sad, or Very Sad. | Must | Test |
| SRS-FR-602 | The system shall allow an optional short note with a mood log. | Must | Test |
| SRS-FR-603 | The system shall allow only one mood log per student per calendar day. | Must | Test |
| SRS-FR-604 | When a mood log exists for the current day, the system shall direct the student to edit it instead of creating a duplicate record. | Must | Test |
| SRS-FR-605 | The system shall allow a student to view recent mood history for at least 7-day and 30-day periods. | Must | Test |
| SRS-FR-606 | The system shall show mood history in a visual form, such as a chart or emoji timeline. | Must | Demonstration |
| SRS-FR-607 | The system shall allow a student to edit or delete their own mood logs. | Must | Test |
| SRS-FR-608 | The backend shall detect a predefined repeated low-mood pattern from recent stored mood entries using transparent rules. | Must | Test |
| SRS-FR-609 | The system shall show a general, non-clinical self-care suggestion when the low-mood rule is satisfied. | Must | Test |
| SRS-FR-610 | The system shall present a disclaimer that wellness suggestions are not medical or professional mental-health advice. | Must | Inspection |

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
| Expense | Expense ID, user ID, title, amount, category, date, notes, created/updated timestamps |
| Receipt | Receipt ID, user ID, image reference if stored, extracted merchant, date, amount, OCR status |
| Budget | Budget ID, user ID, amount, period type, applicable period dates |
| Task | Task ID, user ID, title, subject/course, description, deadline, priority, status |
| Reminder | Reminder ID, user ID, task ID, scheduled time, delivery status, history timestamp |
| Mood Log | Mood log ID, user ID, mood score/type, optional note, log date |

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
| SRS-FR-401 to SRS-FR-408 | Task CRUD, statuses, deadline ordering, reminder effects |
| SRS-FR-501 to SRS-FR-507 | Reminder scheduling, preferences, tapping, dismissal, history |
| SRS-FR-601 to SRS-FR-610 | Mood entry, one-per-day rule, history, trend detection, disclaimer |
| SRS-FR-701 to SRS-FR-710 | Dashboard accuracy, AI relevance, invalid-response and service-failure fallback |
| SRS-NFR-001 to SRS-NFR-010 | Security, secret handling, usability, app operation, maintainability, progress tracking |
