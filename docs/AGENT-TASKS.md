# Agent backlog

Ordered; each task is self-contained. Frontend already typechecks and
production-builds (`npm run build`). The backend was written compile-ready but
**no .NET build has run in this bundle's environment** — hence T1 first.

## T1 — Backend build + smoke test (blocker)
Run `dotnet build backend` and fix anything the compiler flags. Then
`dotnet run`, and verify: `GET /healthz` → 200; `GET /api/state` returns the
seeded document with `ETag: "1"`; `PUT /api/state` with `If-Match: "1"` and the
same body returns revision 2; a second PUT with `If-Match: "1"` returns 409;
a body with a duplicate income id returns 422. Add these as integration tests
(`WebApplicationFactory`) in `backend.Tests/`.

## T2 — Unit tests for calc.ts
Add Vitest. Assert against the workbook's known values (already hand-verified):
income 6158; fixed 3954.49; spaarquote 0.195438 (= sparen/inkomen, investing
excluded — this is the sheet's definition, keep it); `annuityPayment(500000,
0.038, 30)` ≈ 2329.79; forecast end value at 20y/7%/€1000 ≈ 526185.10;
LTV 0.869565; netHousingCost 1681.79; netWorth 61802. Also edge cases:
zero income, zero-rate annuity, extra repayment shortening the schedule.

## T3 — Add/remove rows
The sheet had blank rows for new items; the UI currently only edits existing
ones. Add "Voeg toe" / swipe-or-button "Verwijder" for: incomes, fixed
expenses, holdings, contributions, debts, savings goals, mutual loans. Ids:
`crypto.randomUUID()`. Deleting asks for confirmation. Keep `update()`
immutable-style as in existing screens.

## T4 — Schuld onderling screen
The `mutualLoans` collection is in the model and seed (empty) but has no UI.
Add it as a third segment under the Vermogen tab: list of loans (datum, wie,
omschrijving, bedrag), a "Terugbetaald" action stamping `repaidOn`, and the
sheet's "SCHULDENVRIJ ONDERLING ✔" status line when everything is repaid.

## T5 — Charts
Add a tiny chart layer (recharts or hand-rolled SVG; keep bundle small) using
only ink/green/amber on paper per UX-UI-SPEC: net-worth snapshots line
(Vermogen), restschuld/overwaarde area per year (Wonen), forecast growth line
(Beleggen), fixed-costs-by-category bars (Cashflow).

## T6 — Maandoverzicht polish
Month-to-month swipe navigation; a year summary row (totals + gem. p/m as in
the sheet); allow a per-month income override (the sheet's "vakantiegeld in
mei" case) — add `incomeOverrides: Partial<Record<MonthKey, number|null>>` to
`MonthOverview` in **both** the C# model and types.ts, and use it in
`monthColumns`.

## T7 — Harden auth (optional)
The API key ships in the client bundle. Either (a) put Vercel password
protection / basic auth on the site, or (b) add a Vercel serverless function
as `/api/*` proxy that injects the key server-side, and remove `VITE_API_KEY`.

## T8 — PWA
Add manifest + icons so it installs to the home screen (name "Financieel
Overzicht", theme `#F2F4F1`). **No offline caching of state** — the app is
stateless by design; cache the shell only, and show the existing error screen
when offline.

## T9 — Xlsx round-trip (nice-to-have)
Backend endpoint `GET /api/export.xlsx` generating a workbook from the current
document (ClosedXML), so the spreadsheet remains available as an offline
artifact. Mirror the original tab layout where practical.

## Invariants for every task
1. Backend stores inputs only; all math stays in `calc.ts`.
2. Full-document sync only; never introduce partial PATCH endpoints.
3. No client-side persistence (localStorage/IndexedDB) of financial data.
4. Keep C# models and `types.ts` in lockstep; bump `schemaVersion` on breaking
   changes and add a migration in `StateStore.Load()`.
5. Dutch UI copy, `nl-NL` number formatting, tabular numerals for money.
