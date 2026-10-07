# Unifyd Product Requirements Document (PRD)

## 1. Document purpose

This Product Requirements Document defines the approved PSM 2 product requirements for Unifyd. It is the main reference for implementation prompts, design decisions, testing, and User Acceptance Testing (UAT).

**Product:** Unifyd — an AI-assisted smart student life management mobile application

**Primary users:** University students in Malaysia

**Product goal:** Help students manage personal spending, academic responsibilities, and daily mood in one private mobile application.

## 2. User problem and product value

Students often record expenses inconsistently, manage deadlines using separate tools, and have little visibility of changes in their mood over time. Switching between separate applications makes daily management fragmented and discourages consistent tracking.

Unifyd provides one simple mobile workspace that lets a student record information quickly, receive deadline reminders, and understand their recorded patterns through an integrated dashboard. The system supports awareness and organisation; it does not replace professional financial, academic, or mental-health advice.

## 3. Product principles

- **Fast to record:** Common actions such as adding an expense, task, or mood should be simple on a mobile device.
- **Private by default:** A student can see and manage only their own records.
- **Trust facts first:** Calculated totals, task counts, and mood trends must remain usable even when an AI service is unavailable.
- **AI assists, not decides:** AI may extract receipt text and explain verified patterns, but it must not diagnose, predict, or invent facts.
- **Build only the approved scope:** New features require a deliberate scope decision before implementation.

## 4. Target user

### Primary persona: Malaysian university student

The user has regular expenses, assignments or quizzes with deadlines, and may want a quick way to reflect on daily mood. They use a smartphone often, need low-effort data entry, and benefit from reminders and simple summaries rather than complex financial or clinical tools.

## 5. MVP feature scope

| Module | Priority | Outcome for the student |
|---|---:|---|
| Account & Profile | Must | Private access and personal preferences |
| Financial Tracking | Must | Record, edit, delete, and review daily expenses |
| Budget & Spending | Must | Compare spending against a weekly or monthly budget |
| Academic Tasks | Must | Organise tasks and monitor deadlines and completion |
| Reminder Notifications | Must | Receive reminders before a saved deadline |
| Mood Tracking | Must | Record daily mood and review recent patterns |
| Receipt OCR | Should | Convert a receipt photo into an editable expense record |
| Integrated Dashboard & AI Summary | Should | View a combined, understandable snapshot of the three modules |

## 6. Functional requirements

### FR-01: Account and profile

**User story:** As a student, I want to register, sign in, and manage my profile so that my data is private and personalised.

**Requirements:**

- The system shall allow registration and login using email and password.
- The system shall show useful feedback for invalid credentials and duplicate email registration.
- The system shall require completion of essential profile fields before entering the main application.
- The profile shall store name, university, faculty or programme, year of study, and reminder preference.
- The student shall be able to edit profile information and log out.
- The system shall enforce Supabase Row Level Security so that one student cannot access another student’s data.

**Acceptance criteria:**

- A new student can create an account, complete the profile, and reach the dashboard.
- An authenticated student can update their own profile and see the updated values after reopening the screen.
- An unauthenticated student cannot access protected application data.

### FR-02: Financial tracking

**User story:** As a student, I want to manage my expenses so that I understand my daily spending.

**Requirements:**

- The student shall be able to create an expense with title, amount, category, date, and optional notes.
- The system shall require a valid positive amount, category, and date before saving.
- The student shall be able to view expense history and individual expense details.
- The student shall be able to edit or delete their own expense records.
- The system shall provide categories: Food, Transport, Academic Materials, Personal, and Other.
- The system shall recalculate financial totals after an expense is created, edited, or deleted.

**Acceptance criteria:**

- A saved expense appears in the history and contributes to the displayed total.
- Editing or deleting an expense updates the history and calculations without showing outdated values.
- Invalid or incomplete expense input is not saved and shows a clear error.

### FR-03: Receipt scanning with OCR

**User story:** As a student, I want to scan a receipt so that I can reduce manual expense entry.

**Requirements:**

- The student shall be able to capture a receipt using the camera or select one from the gallery.
- The mobile app shall send the image to a Node.js/Express backend for Google Vision OCR processing.
- The system shall attempt to extract merchant name, purchase date, and total amount.
- The system shall display OCR results in an editable review form before an expense is saved.
- The student shall be able to correct, complete, or reject OCR-extracted values.
- The system shall show a meaningful message for unclear images, incomplete extraction, or service failure.
- When OCR is unavailable, the system shall direct the student to manual expense entry.

**Acceptance criteria:**

- A clear sample receipt produces an editable review form before any expense is saved.
- The student can correct extracted information and save the confirmed expense.
- OCR failure does not block manual expense recording.

### FR-04: Budget and spending analysis

**User story:** As a student, I want to set a budget and compare it with my spending so that I can manage my money better.

**Requirements:**

- The student shall be able to set or update a positive budget amount.
- The system shall support weekly and monthly budget periods.
- The budget view shall display total budget, total spent, and remaining balance.
- The system shall show spending summary and daily average for the selected period.
- The system shall group expense totals by category and show a percentage breakdown.
- The system shall show an empty state when the selected period has no expenses.

**Acceptance criteria:**

- Remaining balance equals the saved budget minus expenses in the selected period.
- Category totals equal the total expenses included in the selected period.
- A student with no relevant expenses receives an empty state rather than an error.

### FR-05: Academic task management

**User story:** As a student, I want to manage academic tasks and deadlines so that I can prioritise my workload.

**Requirements:**

- The student shall be able to create a task with title, subject or course, description, deadline, and priority.
- The student shall be able to view pending, ongoing, and completed tasks.
- Active tasks shall be sorted by deadline.
- The student shall be able to view, edit, delete, and mark tasks as completed.
- Editing a deadline shall update the related reminder schedule.
- Completing or deleting a task shall cancel its pending reminders.

**Acceptance criteria:**

- A saved task appears in the correct status group and deadline order.
- Marking a task complete moves it to the completed group.
- Deleting a task removes its record and associated pending reminder.

### FR-06: Reminder notifications

**User story:** As a student, I want task reminders before my deadlines so that I am less likely to overlook them.

**Requirements:**

- Saving a task with a deadline shall create a reminder based on the student’s preference.
- Supported reminder times shall include one day, three days, and one week before the deadline.
- The system shall ask for device notification permission when it is needed.
- Tapping a reminder shall open the related task.
- The student shall be able to dismiss a notification without changing the task status.
- The system shall show a history of pending and past reminders.

**Acceptance criteria:**

- A scheduled reminder is created for a valid task deadline when permission is granted.
- Updating a task deadline updates its future reminder.
- Completing or deleting a task cancels its future reminder.

### FR-07: Mood tracking and wellness awareness

**User story:** As a student, I want to record my daily mood and review recent patterns so that I can be more aware of my well-being.

**Requirements:**

- The student shall be able to select one daily mood: Very Happy, Happy, Neutral, Sad, or Very Sad.
- The student may add an optional short note.
- The system shall allow only one mood entry per student per day; a same-day entry must be edited instead of duplicated.
- The student shall be able to view mood history for recent periods, including 7 and 30 days.
- The system shall visualise mood history using a chart or emoji timeline.
- The system shall allow the student to edit or delete their own mood entries.
- Backend rules shall detect repeated recent low-mood entries and show general self-care suggestions.
- Wellness suggestions shall include a non-clinical disclaimer.

**Acceptance criteria:**

- A student cannot create two separate mood entries for the same date.
- Mood history accurately reflects the student’s saved entries.
- A configured repeated low-mood test dataset produces the appropriate general suggestion and disclaimer.

### FR-08: Integrated dashboard and AI-assisted insights

**User story:** As a student, I want one dashboard that combines my financial, academic, and mood information so that I can understand my current situation quickly.

**Requirements:**

- The dashboard shall show separate financial, academic, and wellness insight panels.
- The system shall calculate verified financial facts: spending total, remaining budget, and category breakdown.
- The system shall calculate verified academic facts: pending tasks, overdue tasks, recently completed tasks, and near deadlines.
- The system shall calculate verified wellness facts: recent mood trend and repeated low-mood notice where applicable.
- The backend shall send only structured, verified facts to Groq AI for a short descriptive summary.
- The AI prompt and response validation shall prevent diagnosis, prediction, unsafe advice, and invented information.
- If Groq AI is unavailable or invalid, the dashboard shall still show rule-based facts and a fallback message.
- Tapping a panel shall open the associated detailed module.
- The dashboard shall support refresh and module-specific empty states.

**Acceptance criteria:**

- Each panel shows correct figures derived from the authenticated student’s own records.
- A successful Groq response is relevant to the structured facts supplied by the backend.
- When the Groq request fails, dashboard facts remain visible and the app does not crash.

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Privacy and security | Use Supabase authentication, RLS, HTTPS API communication, and environment variables for all secrets. |
| Usability | Main recording flows should be understandable without training and usable on a typical Android phone. |
| Reliability | Handle loading, success, empty, and failure states for every core action. |
| Performance | Provide visible loading feedback; normal saved-data screens should feel responsive on a supported test device. |
| Accessibility | Use readable text, clear contrast, recognisable labels/icons, and meaningful validation messages. |
| Data integrity | Validate required fields and values before saving; recalculate summaries from stored records. |
| Maintainability | Keep frontend, backend, database access, OCR, and AI integrations separated into clear responsibilities. |

## 8. Out of scope

- Bank, e-wallet, payment, investment, or transaction integration.
- Automatic university-portal, LMS, timetable, or tuition-fee integration.
- A trained custom machine-learning model.
- Prediction of spending, grades, academic performance, or mood.
- Diagnosis, counselling, emergency help, or clinical mental-health treatment.
- Social features, collaboration, or shared student accounts.

## 9. Measurement and evaluation

The product will be evaluated through:

- functional and User Acceptance Testing for all eight modules;
- OCR extraction assessment with representative receipt samples;
- rule-based low-mood trend test cases;
- AI-summary checks for relevance, clarity, usefulness, and safety;
- a five-point Likert-scale usability questionnaire; and
- PSM 2 thesis evidence, including screenshots, test cases, results, and limitations.

## 10. Build constraints for AI-assisted development

Every implementation task must:

1. read `UNIFYD_PROJECT_BRIEF.md`, this PRD, the current phase specification, and `PROJECT_PROGRESS.md`;
2. implement only requirements approved for the current phase;
3. preserve the existing Expo Router structure, especially `/(tabs)`;
4. avoid renaming, moving, deleting, reorganising, or duplicating unrelated files;
5. run and test the affected flow; and
6. update `PROJECT_PROGRESS.md` with implementation status, tests, issues, and next actions.
