# API contract

Base URL: `https://api.<jouwdomein>.nl` (VPS). All endpoints are JSON.

## Auth

Every `/api/*` request must send `X-Api-Key: <key>` when `Auth:ApiKey` is set
(env var `AUTH__APIKEY` on the VPS). Missing/wrong key → `401 { "error": "invalid_api_key" }`.
Empty configured key disables auth (local dev only).

## GET /healthz

No auth. `200 { "status": "ok", "revision": 7, "updatedAt": "…" }` — use for uptime checks.

## GET /api/state

Returns the full document envelope:

```json
{
  "revision": 7,
  "updatedAt": "2026-07-24T10:15:00.000+00:00",
  "state": { "schemaVersion": 1, "meta": { … }, "incomes": [ … ], … }
}
```

- Response header `ETag: "7"`.
- Request header `If-None-Match: "7"` → `304 Not Modified` when unchanged.

The `state` shape is defined 1:1 in `backend/Models/FinancialState.cs` and
`frontend/src/domain/types.ts`; `backend/data/seed.json` is a complete example.
Conventions: money = plain numbers in EUR; rates = fractions (`0.038` = 3,8%);
month keys = `jan…dec` (Dutch); dates = ISO (`yyyy-MM-dd`, months `yyyy-MM`);
`null` = "not filled in", distinct from `0`.

## PUT /api/state

Replaces the whole document.

- Required header: `If-Match: "<revision from your last GET>"`.
- Body: the bare `state` object (no envelope).

Responses:

| Status | Meaning | Body |
|---|---|---|
| `200` | Saved | New envelope, `ETag` header with new revision |
| `400` | Missing If-Match / invalid JSON / empty body | `{ "error": "missing_if_match" \| "invalid_json" \| "empty_body", "detail": … }` |
| `409` | Revision conflict | `{ "error": "revision_conflict", "currentRevision": n, "detail": … }` |
| `422` | Validation failed | `{ "error": "validation_failed", "problems": ["…"] }` |

Client rule on `409`: GET fresh state, show it to the user, retry the PUT
against the new revision only after the user confirms/redoes the change.

## CORS

`GET, PUT, OPTIONS` from origins configured in `Cors:AllowedOrigins`
(supports wildcard subdomains, e.g. `https://*.vercel.app`). `ETag` is exposed.

## Versioning

`state.schemaVersion` is `1`. Any breaking change to the document shape bumps
it; the backend rejects unknown versions with `422`, and a migration is added
to `StateStore.Load()`.
