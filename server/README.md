# Unifyd service

This local Node.js/Express service accepts one signed-in student's receipt image and returns an OCR draft for review. It also reads an uploaded class timetable into editable draft classes, and produces the Home dashboard's optional AI summary. It does not save images, PDFs, OCR output, expenses, timetables, or summaries.

## Run locally

Use Node.js 24 or newer. From `server/`, run `npm ci`. Copy `.env.example` to `.env` and set the Supabase project URL and **publishable** key for the same project used by the mobile app. These are the only Supabase values required. Set `PORT` if needed. `.env` is ignored by Git.

The Google Vision client uses Application Default Credentials already configured on this computer through the Google Cloud CLI. No service-account JSON key is needed or used. Run `npm run dev` for development, or `npm run build` then `npm start`.

The default listener is `127.0.0.1:3001`. For a physical phone on the same trusted network, set `OCR_HOST=0.0.0.0` in the ignored server `.env` and point the mobile `EXPO_PUBLIC_OCR_API_URL` to the computer's reachable address with port `3001`. Use HTTPS when the service is deployed beyond local development. Expo Web origins on `localhost` or `127.0.0.1` are allowed for browser preflight; additional exact origins can be comma-separated in `OCR_ALLOWED_ORIGINS`. These settings do not change bearer-token verification.

For phone testing, start this server with `npm start` from `server/`, then start Expo from `mobile/`. The phone and computer need a reachable local network path when the OCR URL uses a private address. A phone providing a hotspot to the computer may work too; its cellular indicator is expected. From the phone's browser, open `<EXPO_PUBLIC_OCR_API_URL>/health` to verify routing and firewall access. It should show `{ "status": "ok" }` before attempting a scan. After changing `mobile/.env`, fully reload Expo Go or the development build so the new `EXPO_PUBLIC_OCR_API_URL` is included in its JavaScript bundle. An installed production build needs a rebuild or an update made with the intended environment value. The URL contains no Supabase or Google credentials.

## Endpoints

- `GET /health` returns `{ "status": "ok" }`.
- `POST /api/ocr/receipt` requires `Authorization: Bearer <Supabase access token>` and one `multipart/form-data` file in field `image`. JPEG, PNG and WEBP are accepted up to 5 MiB. Other fields or files are rejected. The service verifies the token with Supabase Auth before reading the upload, checks the image signature, then calls Google Vision document text detection.

The success response contains only `merchantName`, `purchaseDate`, `totalAmount`, `rawText`, and `warnings`. Missing or uncertain parsed values are `null` with review warnings. No expense is created; a student must review the draft in a later phase. Error responses use safe codes and messages without provider details, receipt contents, or tokens.

Run `npm run typecheck`, `npm test`, and `npm run build` to verify the service. Automated tests inject a fake verifier and OCR result, so they do not use network access or Google credentials.

## Timetable import

`POST /api/timetable/import` requires the same bearer token and one `multipart/form-data` file in field `file`.

- **Accepted files:** PNG, JPEG, or PDF, up to 5 MiB. The file signature must match the declared type.
- **Checks before OCR:** the token is verified before the upload is read. Password-protected (encrypted) PDFs return `422 PDF_PROTECTED`. Truncated or unreadable PDFs return `422 INVALID_DOCUMENT`.
- **Other errors:** `401 UNAUTHORIZED`, `400 MISSING_FILE`, `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_FILE`, and `502 OCR_UNAVAILABLE`. Error messages contain no provider details, file contents, or tokens.
- **Reading:** images use Google Vision document text detection. PDFs are sent to Vision `batchAnnotateFiles` inline from memory, so no temporary file or Cloud Storage object is created. Only the first three pages are parsed; a longer PDF adds the `PAGES_TRUNCATED` warning.
- **Parsing:** fixed rules turn the text into candidate classes. Each has course code/name, day, start/end time, location, section, and a `high`/`medium`/`low` confidence. Anything the document does not show is `null`; nothing is guessed. No AI model or outside timetable service is used.
- **Response:** `{ candidates, warnings, pagesProcessed, totalPages }`. `warnings` always contains `REVIEW_REQUIRED` and may contain `NO_CLASSES_FOUND` or `INCOMPLETE_DETAILS`. Raw OCR text is never returned.
- **Nothing is stored:** the upload stays in memory for the request only, and no class is saved. The app requires the student to review the draft and then save it to their own `timetable_entries` rows.
- **OCR limitations:** results depend on image quality and layout. Merged grid cells, handwriting, rotated pages, or unusual time formats may produce incomplete or misplaced candidates. That is why review is mandatory.

## Dashboard insights

`POST /api/insights/generate` requires the same bearer token and a JSON body `{ "language": "en" | "ms", "timeZone": "Asia/Kuala_Lumpur" }`.

1. The service reads only that student's records, using their own token, so database row-level security still applies.
2. It calculates verified finance, task, and wellbeing facts.
3. It sends Groq only aggregate numbers: no task titles, subjects, notes, names, or dates.
4. It returns the facts plus a validated summary, or `summary: null` with a `fallbackReason`.

To enable summaries, create a key at console.groq.com and set `GROQ_API_KEY` in the ignored `server/.env`. `GROQ_MODEL` defaults to `openai/gpt-oss-20b`. Without a key, the endpoint returns facts with `fallbackReason: "not_configured"`, and the app shows its fallback message. The startup log states whether AI summaries are enabled. Automated tests use fake data loaders and a fake Groq client; they never call Groq.

## Poof chat

`POST /api/poof/chat` requires the same bearer token and a JSON body `{ "language": "en" | "ms", "message": "...", "facts": { ... } }`.

1. `message` is the student's question, at most 500 characters.
2. `facts` is the aggregate-only snapshot built by the app (`poofAiPayload` in `mobile/lib/poofFacts.ts`). It holds only amounts, counts, percentages, and fixed category labels. The service accepts this exact shape only, so task titles, notes, names, or other free text are rejected with `400 INVALID_REQUEST`.
3. Crisis wording is never sent to Groq; the response is a `safety` fallback, and the app shows support contacts.
4. Groq replies with `{ reply, actions, scope }` under a strict schema. A reply is rejected (`invalid_response`) if it contains a number not in the facts, diagnosis or guarantee wording, or a claim to have changed data. Actions are limited to known in-app navigation IDs.
5. The response is `{ source: "ai", reply, actions, scope }` or `{ source: "fallback", fallbackReason }`. On any fallback, the app answers with its built-in rules.

Each signed-in session may send 30 questions per 10 minutes (`429 RATE_LIMITED`). Questions, facts, and replies are not stored or logged. Poof is read-only: it never creates, changes, or deletes any record.

## Expense category suggestion

`POST /api/ml/expense-category-suggestion` requires the same bearer token and a JSON body of exactly `{ "title": "..." }` (1–120 characters).

1. The token is verified first. The service then reads only that student's latest 500 expense titles and categories, using their own token, so row-level security applies. The user ID comes from the verified token, never from the request.
2. It trains a small Multinomial Naive Bayes model in memory (`src/expense-classifier.ts`) and discards it after the request. No model is stored.
3. It returns `{ available: true, category, confidence, trainingExpenseCount }` only when there are ≥ 15 usable labelled expenses across ≥ 2 categories, the title has a known word, confidence is ≥ 0.70, and the lead over the second category is ≥ 0.15. Otherwise it returns `{ available: false, reason: "not_enough_data" | "low_confidence", trainingExpenseCount }`.
4. Errors: `401 UNAUTHORIZED`, `400 INVALID_REQUEST` (any other field, such as a user ID, is refused), `429 RATE_LIMITED` (60 per 10 minutes per session), and `503 AUTH_UNAVAILABLE`, `HISTORY_UNAVAILABLE`, or `SUGGESTION_UNAVAILABLE`.

No Groq or other LLM, remote model, or keyword table is used. Titles, history, vocabulary, and tokens are not stored or logged. The app treats a suggestion as optional and never saves an expense because of one. Automated tests use fictional fixtures and a fake history loader.

## Receipt OCR evaluation (offline)

Measures receipt parser accuracy against hand-made labels for Phase 9 evidence. Real receipts, their OCR text, and labels stay in `server/local-data/receipt-eval/`, which Git ignores.

1. Save receipt photos in `local-data/receipt-eval/images/`. Any file name works; JPEG, PNG, and WEBP are read and other files (such as iPhone HEIC) are listed and skipped.
2. Run `npm run eval:receipts:run`. It:
   - creates the folders and `labels.csv` (from `scripts/receipt-labels.template.csv`), adding an empty row for each new image and keeping every row already filled in;
   - reads each new image once with Google Vision (the same call the receipt endpoint uses) and caches the text and word boxes in `local-data/receipt-eval/ocr/`; Vision is not contacted when everything is cached;
   - scores every labelled receipt.
3. Fill in the empty rows of `labels.csv` (`type,condition,merchant,date,total`; the template explains each column), then run the same command again. Rows still empty are skipped, so labelling can be done in batches. Dates may be `YYYY-MM-DD` or `DD/MM/YYYY`, and files re-saved by Excel are accepted.

The score lists accuracy for merchant, date, and total, the share of receipts with all three correct, and a breakdown by receipt type and condition. Each field is scored `correct`, `flagged` (wrong, but the review warning was shown), or `silent` (wrong with no warning). Every wrong field in the development split is listed. Scoring is offline, so it is free and fast to repeat after each parser change. The steps can also run separately: `eval:receipts:setup`, `eval:receipts:ocr`, and `eval:receipts`.

About 20% of receipts are held out as a test split, chosen from a hash of the file name, so the choice is stable as receipts are added. Their results stay hidden until `npm run eval:receipts -- --final`, which should be used only for the final reported score. `--json` prints machine-readable results. Scoring rules: the parsed merchant is correct when its words begin with the labelled trading name (case, punctuation, and "Sdn Bhd" ignored); the date must match exactly; the total must match to the cent. A blank label expects no value.

If Google credentials are missing, the OCR step stops with the fix: run `gcloud auth application-default login`, as for the receipt endpoint.
