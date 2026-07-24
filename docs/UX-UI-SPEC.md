# UX / UI specification

## Product framing

**Subject**: the household ledger of one Dutch couple — income, vaste lasten,
beleggen, hypotheek, schulden, vermogen. **Audience**: two adults, on their
phones, doing a ±10-minute monthly routine plus quick glances. **The screen's
single job**: answer "hoe staan we ervoor?" in one look, and make the monthly
inputs effortless to update.

## Identity: "het digitale grootboek"

The calm confidence of a bank ledger rather than a fintech growth app: no
confetti, no gamification, no red-alert dashboards. Money is shown plainly,
with tabular numerals, in Dutch.

### Tokens (implemented in `frontend/src/theme.css`)

| Token | Value | Use |
|---|---|---|
| `--paper` | `#F2F4F1` | App background (cool paper-green tint) |
| `--surface` | `#FFFFFF` | Cards |
| `--ink` | `#15281F` | Primary text, "vaste lasten" flow segment |
| `--ink-soft` | `#52645B` | Secondary text |
| `--line` | `#DCE2DB` | Dividers |
| `--action` | `#0E5C4A` | Buttons, active tab, "beleggen" segment |
| `--accent` | `#F0B429` | **Money in motion only**: Geldstroom "sparen" segment and progress fills. Never for chrome. |
| `--positive` / `--negative` | `#177B54` / `#B3372F` | Signed results only |

**Type**: display **Bricolage Grotesque** (titles, stat values), body **Inter**.
Every money value uses `font-variant-numeric: tabular-nums` so columns of
figures align — the ledger feel lives in this detail.

### Signature element: the Geldstroom

One horizontal bar at the top of the dashboard splitting the month's income
into vaste lasten (ink) → beleggen (green) → sparen (amber), widths animated
on load. It encodes the sheet's most important truth — where the money goes —
in a single glance, and it is the only place the amber accent shouts.
Boldness is spent here; everything else stays quiet.

## Information architecture

Thirteen spreadsheet tabs collapse into **five bottom tabs** (thumb-reachable,
≤5 per mobile convention), with a segmented switcher inside each:

| Tab | Segments | Sheet tabs absorbed |
|---|---|---|
| Overzicht | — | Dashboard |
| Cashflow | Inkomsten · Vaste lasten · Maandoverzicht | Inkomsten, Vaste lasten, Maandoverzicht |
| Beleggen | Portefeuille · Inleg · Prognose | Portefeuille, Prognose |
| Wonen | Hypotheek · Aflosschema · Schulden | Hypotheek & Woning, Schulden |
| Vermogen | Netto vermogen · Spaardoelen | Vermogen, Sparen, (Schuld onderling: see backlog) |

The "Uitleg" tab becomes inline helper text under fields (`row-sub`), not a
separate page — instruction lives where the action is.

## Mobile-first interaction rules

- **Layout**: single 640px column, content padded above a fixed bottom tab bar
  with `env(safe-area-inset-bottom)`. On desktop the column centers; nothing
  reflows into multi-pane complexity.
- **Touch targets** ≥ 44px; numeric inputs use `inputMode="decimal"` and
  16px font (prevents iOS zoom-on-focus); decimal comma accepted.
- **Edit → derive → save**: fields commit on blur/Enter; every derived number
  on screen updates instantly (the sheet's "alles rekent automatisch"). A
  floating **Opslaan** pill appears above the tab bar only when the draft is
  dirty — save is one explicit, whole-document action, mirroring the sync model.
- **Copy**: Dutch, sentence case, verbs on buttons ("Opslaan", "Herladen",
  "Peiling van vandaag vastleggen"). Errors say what happened and what to do;
  the conflict banner explains the household scenario in plain words.
- **Numbers**: `nl-NL` currency formatting; whole euros for large amounts,
  cents where the sheet used cents; percentages 1 decimal; negative = red +
  minus, positive results = green + plus, but neutral amounts stay ink.
- **Disclaimers carried over from the sheet**: the Prognose screen repeats
  "rekenmodel, geen financieel advies".

## Accessibility floor

Visible `:focus-visible` outlines; `prefers-reduced-motion` kills the flow-bar
animation; the Geldstroom has a full-sentence `aria-label`; progress bars use
`role="progressbar"` with values; contrast of all text tokens on their
backgrounds ≥ 4.5:1.

## What "modern" must not become

No skeuomorphic cards of credit cards, no gradient meshes, no dark-mode-only
neon. If a future change needs a chart library, charts stay ink/green/amber on
paper and keep tabular axes — the ledger identity survives the feature.
