# Payment Engine — hackathon reference repository

A runnable Node 24 HTTP API for engineering challenges. It simulates payment records
and provider outcomes; it does not move money, store payment credentials, or integrate
with a payment gateway. Data lives in a bounded in-memory store and resets on restart.

No external dependencies are required. Run `npm start`, `npm run build`, and `npm test`.
The default port is 9000; `PORT` selects another port. `npm run coverage` emits native
Node coverage. Use integer minor units, never floating-point currency amounts.

## Existing behavior to preserve

- `GET /health` returns `{ "ok": true }`.
- `POST /payments` takes `clientReference`, `amountMinor`, and `currency` (INR/USD/EUR).
  It creates a pending record with 201. Repeating the same reference and payment returns
  the same record with 200; a conflicting amount/currency returns 409.
- `GET /payments/pay_1` retrieves a record; unknown IDs return 404.
- Invalid input, oversized bodies and store capacity are bounded and rejected.

## Retry challenge baseline

`POST /payments/retry` takes an array of `success`, `temporary`, or `permanent`
outcomes and an integer `maxAttempts` from 1 through 10. The baseline validates input
but attempts only once. The assigned official challenge defines how temporary failures
must be retried while preserving permanent failure stopping and existing APIs.
Organizer-owned evaluation criteria live in Judge-C2C; participant edits here cannot
change them. Baselines are exact commits, not whatever `main` points at later.

See the official GitHub challenge issue for acceptance criteria and frozen baseline.
Keep this repository's tests and add regression coverage for your implementation.
