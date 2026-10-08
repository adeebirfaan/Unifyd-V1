# Unifyd OCR service

This local Node.js/Express service accepts one signed-in student's receipt image and returns an OCR draft for review. It does not save images, OCR output, or expenses.

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
