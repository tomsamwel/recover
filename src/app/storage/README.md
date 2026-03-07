# Storage adapter (`src/app/storage/store.ts`)

This folder contains a thin adapter around `localStorage` JSON reads/writes.

## Why

- Keep `try/catch` and JSON parsing in one place.
- Ensure consistent behavior on malformed payloads or storage failures.
- Keep domain defaults/shape logic in callers (for example, `scheduleViewModel`).

## API

- `readJson<T>(key, fallback): T`
  - Returns `fallback` when the key is missing, JSON is invalid, or `localStorage` fails.
- `writeJson<T>(key, value): void`
  - Best-effort write. Errors are swallowed (no-op).
- `updateJson<T>(key, fallback, mutate): void`
  - Read-modify-write helper.
  - Uses `fallback` when the current payload cannot be read.
  - No-op if mutate or write throws.

## Usage guideline

Use this adapter only for persistence concerns (I/O + serialization). Keep schema/domain validation in feature modules.
