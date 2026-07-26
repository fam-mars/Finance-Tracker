# Financieel Overzicht — app bundle

This bundle turns `Financieel_Overzicht_2_0.xlsx` into a mobile-first web app:

- **Frontend**: React + Vite + TypeScript, deployed on **Vercel**. Zonder backend is localStorage de bron van waarheid (autosave bij elke wijziging); met backend syncthij via volledige GET/PUT met revisies.
- **Backend**: **.NET 8 minimal API** on your VPS. Stores the spreadsheet's *input values* as one JSON document with revisions, atomic writes and rolling backups. Sinds de backend-refactor bevat hij óók de volledige domeinlaag (`backend/Domain/Calc.cs` + `Validation.cs`): `POST /api/derive` rekent alle afgeleide cijfers uit, `POST /api/calc/*` de losse wat-als-berekeningen.
- **Data**: `backend/data/seed.json` — every prefilled input value extracted from the workbook. All spreadsheet *formulas* exist twice, in lockstep: pure TypeScript in `frontend/src/domain/calc.ts` en dezelfde formules in C# in `backend/Domain/Calc.cs` (pariteitsgetest: 6.612 vergelijkingen identiek).

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

**Alleen invoerwaarden worden opgeslagen; afgeleide cijfers worden altijd berekend.** The spreadsheet's blue/yellow cells became the JSON document; its black formula cells became the domain layer. Never store a derived number — this keeps sync trivial (one document, one revision) and the math testable.

Sinds de backend-refactor leeft die domeinlaag op twee plekken, achter een feature-flag:

- **Zonder `VITE_API_BASE_URL`** (huidige situatie tot de VPS er is): de app werkt volledig lokaal — `calc.ts` rekent, localStorage bewaart. Exact het gedrag van vóór de refactor.
- **Met `VITE_API_BASE_URL`**: de server is de rekenautoriteit. `SyncContext` stuurt het document naar `POST /api/derive`, de bundel afgeleide cijfers wordt in `frontend/src/domain/engine.ts` gecachet en de functies in `calc.ts` serveren die transparant aan de schermen. Is de VPS onbereikbaar, dan rekent de app stil weer lokaal (identieke formules). Uitzetten kan met `VITE_BACKEND_LOGIC=off`.
- Serverside **validatie** draait op elke `PUT /api/state` (422 met een lijst problemen); alleen formuliervalidatie (invoer parsen) blijft puur frontend.

Wijzig je een formule, wijzig hem dan op beide plekken: `frontend/src/domain/calc.ts` **en** `backend/Domain/Calc.cs` (en houd `types.ts` ↔ `Models/FinancialState.cs`, `engine.ts` ↔ `Domain/DerivedModels.cs` in lockstep).

## Feeding this to coding agents

Give an agent this whole folder plus `docs/AGENT-TASKS.md`. Each task there is self-contained, references the exact files, and states its acceptance criteria. Start with T1 (backend build + smoke test) before anything else.
