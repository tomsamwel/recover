# AGENTS.md

## Project Context
- This repository is a React + Vite + TypeScript app.
- Default schedule JSON files live in `schedules/defaults`.
- `public/schedules/defaults` is synced from `schedules/defaults` via `npm run sync:defaults`.

## Dev Commands
- `npm install` installs dependencies.
- `npm run dev` starts the local development server.
- `npm run test` runs the test suite with Vitest.
- `npm run build` creates a production build.
- `predev` and `prebuild` automatically run `npm run sync:defaults`.

## Required Validation
- After code changes, run both `npm run test` and `npm run build`.
- Add or update tests whenever behavior changes.

## Dependency Policy
- Ask for confirmation before adding new runtime dependencies.
- Dev dependencies may be added when justified by implementation or tooling needs.

## PR Expectations
- Include a short summary of what changed.
- List the validation commands you ran and their outcomes.
- Attach a screenshot or GIF when UI behavior changes.

## Deployment Context
- GitHub Pages CI runs on Node 20.
- The Pages pipeline sets `PAGES_BASE_PATH`, and Vite uses that value for the app base path.
