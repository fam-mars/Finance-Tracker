# Architecture

## Overview

```
┌────────────────────┐        HTTPS (CORS)        ┌──────────────────────────┐
│  Vercel            │  GET /api/state            │  VPS                     │
│  React SPA (Vite)  │ ─────────────────────────▶ │  .NET 8 minimal API      │
│  stateless client  │  PUT /api/state (full doc) │  StateStore (JSON file)  │
│  calc.ts derives   │ ◀───────────────────────── │  data/state.json         │
│  all formulas      │  ETag = revision           │  data/backups/*.json     │
└────────────────────┘                            └──────────────────────────┘
```

## Data ownership

| Concern | Lives in | Why |
|---|---|---|
| Input values (the sheet's blue/yellow cells) | Backend JSON document | Single source of truth, synced whole |
| Formulas (totals, spaarquote, amortisation, prognose, LTV, net worth, goals) | `frontend/src/domain/calc.ts` | Pure, instant recompute on every keystroke, unit-testable |
| Session draft | React memory only | The frontend is stateless by requirement: no localStorage, no IndexedDB |

## Sync model: full document, optimistic concurrency

1. On load the client `GET /api/state` → `{ revision, updatedAt, state }`.
2. Edits mutate an in-memory draft; a floating "Opslaan" pill appears.
3. Save `PUT /api/state` with `If-Match: "<revision>"` and the **entire** document.
4. Server compares revisions under a lock:
   - match → write temp file, atomic `File.Move`, backup previous version (keep 30), increment revision, return new envelope;
   - mismatch → `409` with `currentRevision`. The client shows a conflict banner and offers "Herladen"; the user redoes the edit on fresh data.

No partial patches, no merge logic. For a two-person household the 409 path is rare, and re-entering one number beats silently merged corruption.

## Backend design decisions

- **File store, not a database.** One document, atomic replace, human-readable, trivially backed up with the VPS's normal file backup. `Storage:DataDirectory` points it outside the deploy folder so redeploys never touch data.
- **Auth**: one shared API key (`X-Api-Key`), constant-time compared. It's a household app with one secret; add real users only if the household grows into a SaaS.
- **Validation** on PUT: schema version, unique non-empty ids, fraction-range rates, payDay 1–31, known month keys. Returns `422` with a `problems` list.
- **CORS** allows the Vercel production domain and `*.vercel.app` previews, configured — not hardcoded.

## Frontend design decisions

- **SyncContext** is the only stateful module: `status`, `state` (draft), `dirty`, `update(fn)`, `save()`, `reload()`.
- Inputs commit on blur/Enter (`EditableNumber`), so derived numbers across the whole app update the moment a field is left — the "alles rekent automatisch" feel of the sheet.
- Percentages are fractions in the document (`0.038`), percent numbers only at the input/display edge.
- `nl-NL` formatting throughout via `Intl`; decimal comma accepted in inputs.

## Failure modes

| Failure | Behaviour |
|---|---|
| Backend unreachable on load | Error screen with retry; nothing cached, nothing stale |
| Save fails (network/5xx) | Draft kept, error banner, save can be retried |
| 409 conflict | Conflict banner + reload action; draft discarded deliberately |
| Corrupt `state.json` | Store falls back to seed and logs a warning; backups dir holds last 30 good revisions |
