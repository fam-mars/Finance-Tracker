# Financieel Overzicht — app bundle

This bundle turns `Financieel_Overzicht_2_0.xlsx` into a mobile-first web app:

- **Frontend**: React + Vite + TypeScript, deployed on **Vercel**. Stateless — it holds the document in memory for the session only and syncs via full GET/PUT.
- **Backend**: **.NET 8 minimal API** on your VPS. Stores the spreadsheet's *input values* as one JSON document with revisions, atomic writes and rolling backups.
- **Data**: `backend/data/seed.json` — every prefilled input value extracted from the workbook. All spreadsheet *formulas* are ported to pure TypeScript in `frontend/src/domain/calc.ts` and verified against the workbook's computed values (spaarquote 19,5%, annuity €2.329,79, prognose €526.185, LTV 87%, netto woonlast €1.681,79, netto vermogen €61.802 — all match).

## Layout

```
backend/    .NET 8 API (complete, compile-ready — no build ran here; run `dotnet build`)
frontend/   React app (typechecked + production build verified)
docs/
  ARCHITECTURE.md   system design & sync model
  API-CONTRACT.md   REST contract, headers, error shapes
  UX-UI-SPEC.md     design system, IA, interaction rules
  DEPLOYMENT.md     Vercel + VPS (systemd or Docker, nginx, HTTPS, CORS, API key)
  AGENT-TASKS.md    prioritized backlog for coding agents
```

## Quick start (local)

```bash
# terminal 1 — backend (seeds itself from data/seed.json on first run)
cd backend && dotnet run          # http://localhost:5080

# terminal 2 — frontend (Vite proxies /api to :5080)
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## The one rule to preserve

**The backend stores inputs; the frontend derives everything.** The spreadsheet's blue/yellow cells became the JSON document; its black formula cells became `calc.ts`. Never store a derived number, and never compute in the backend — this keeps sync trivial (one document, one revision) and the math testable.

## Feeding this to coding agents

Give an agent this whole folder plus `docs/AGENT-TASKS.md`. Each task there is self-contained, references the exact files, and states its acceptance criteria. Start with T1 (backend build + smoke test) before anything else.
