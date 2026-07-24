import type { FinancialState } from "../domain/types";
import { dashboard } from "../domain/calc";

interface Tip {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  category: "spending" | "income" | "investment" | "tax" | "strategy";
  source?: string;
  condition: (dashboard_data: ReturnType<typeof dashboard>, s: FinancialState) => boolean;
}

const TIPS: Tip[] = [
  {
    title: "Verhoog je inkomsten",
    description: "Dit is meestal de grootste hefboom. Een €5k/jaar salarisstijging (€416/maand) verkort je weg naar FIRE met 2-3 jaar.",
    impact: "high",
    category: "income",
    source: "Research by Mr Money Mustache",
    condition: () => true,
  },
  {
    title: "Controleer je telefoonabonnement",
    description: "Veel telecomabonnementen zijn te duur. Vergelijk MVNO providers - je kan €20-30/maand besparen.",
    impact: "medium",
    category: "spending",
    condition: (dashboard_data) => dashboard_data.fixedPerMonth > 0,
  },
  {
    title: "Beleggen is cruciaal",
    description: "Sparen alleen leidt niet snel tot FIRE. Beleggen in lage-kosten ETF's (VWRL, IWDA) kan je doelstelling 5-7 jaar vervroegen.",
    impact: "high",
    category: "investment",
    condition: (dashboard_data) => dashboard_data.portfolioValue < dashboard_data.incomePerMonth * 24,
  },
  {
    title: "Rente-aftrek benutten",
    description: "Je betaalt hypotheek rente. Dit is aftrekbaar! Controleer of je huisarts dit correct doet.",
    impact: "medium",
    category: "tax",
    condition: (_dashboard_data, s) => s.mortgage.principalRemaining > 0,
  },
  {
    title: "Boodschappen & voeding",
    description: "Meal prep, merkloze producten en minder eten buiten huis. Vele huishoudens sparen €100-200/maand hier.",
    impact: "medium",
    category: "spending",
    condition: () => true,
  },
  {
    title: "Verzekeringen checken",
    description: "Check je verzekeringspremies jaarlijks. Vaak kan je 10-20% besparen met wisselen.",
    impact: "low",
    category: "spending",
    condition: (dashboard_data) => dashboard_data.fixedPerMonth > 200,
  },
  {
    title: "Automatische spaarplan",
    description: "Zet automatisch geld opzij van je salaris naar beleggingen. 'Uit het zicht, uit het hart' werkt!",
    impact: "high",
    category: "strategy",
    condition: (dashboard_data) => dashboard_data.investingPerMonth < dashboard_data.incomePerMonth * 0.2,
  },
  {
    title: "Pak je studieschuld aan",
    description: "Als je studieschuld betaalt, stop daar mee (tot 2% rente). Beleggen geeft meer return.",
    impact: "high",
    category: "strategy",
    condition: (_dashboard_data, s) => s.debts.some((debt) => debt.description.includes("studieschuld")),
  },
  {
    title: "Index trackers vs actief beleggen",
    description: "Index ETF's (VWRL, MSCI World) slaan actieve beleggers vrijwel altijd. Laag kosten, hoog rendement.",
    impact: "high",
    category: "investment",
    condition: () => true,
  },
  {
    title: "Noodfonds grootte",
    description: "Zorg dat je 6-12 maand lasten hebt gespaard. Dit geeft zekerheid en slaapt beter.",
    impact: "medium",
    category: "strategy",
    condition: (dashboard_data) => dashboard_data.netWorth < (dashboard_data.fixedPerMonth * 6),
  },
];

export function Optimization({ state }: { state: FinancialState }) {
  const dashboard_data = dashboard(state);
  const relevantTips = TIPS.filter((tip) => tip.condition(dashboard_data, state));

  const tipsByCategory = {
    spending: relevantTips.filter((t) => t.category === "spending"),
    income: relevantTips.filter((t) => t.category === "income"),
    investment: relevantTips.filter((t) => t.category === "investment"),
    tax: relevantTips.filter((t) => t.category === "tax"),
    strategy: relevantTips.filter((t) => t.category === "strategy"),
  };

  const categories = [
    { key: "income", label: "💰 Inkomen verhogen", icon: "📈" },
    { key: "spending", label: "💸 Lasten verlagen", icon: "📉" },
    { key: "investment", label: "📊 Slim beleggen", icon: "🎯" },
    { key: "tax", label: "🏛️ Belastingen optimaliseren", icon: "💡" },
    { key: "strategy", label: "🎲 Strategie & planning", icon: "📋" },
  ] as const;

  return (
    <main className="screen">
      <h1 className="screen-title">Financiële Optimalisatie 🚀</h1>
      <p className="screen-sub">
        Sneller naar financiële vrijheid. Persoonlijke tips gebaseerd op jouw situatie.
      </p>

      {/* Quick stats */}
      <section className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginBottom: "0.3rem" }}>
            Jaarlijkse belegging
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--teal)" }}>
            €{(dashboard_data.investingPerMonth * 12).toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginBottom: "0.3rem" }}>
            Spaarsquote
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--teal)" }}>
            {(dashboard_data.savingsRate * 100).toFixed(0)}%
          </div>
        </div>
      </section>

      {/* Tips by category */}
      {categories.map(({ key, label }) => {
        const tips = tipsByCategory[key as keyof typeof tipsByCategory];
        if (tips.length === 0) return null;

        return (
          <section key={key} className="card">
            <h2 className="card-title" style={{ marginBottom: "1rem" }}>
              {label}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {tips.map((tip, i) => (
                <div
                  key={i}
                  style={{
                    padding: "1rem",
                    backgroundColor: "#f9f8f7",
                    borderLeft: `4px solid ${
                      tip.impact === "high"
                        ? "#2e7d32"
                        : tip.impact === "medium"
                          ? "#f57c00"
                          : "#9e9e9e"
                    }`,
                    borderRadius: "4px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
                    <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>
                      {tip.title}
                    </h3>
                    <span
                      style={{
                        padding: "0.2rem 0.6rem",
                        backgroundColor:
                          tip.impact === "high"
                            ? "#e8f5e9"
                            : tip.impact === "medium"
                              ? "#fff3e0"
                              : "#f5f5f5",
                        color:
                          tip.impact === "high"
                            ? "#2e7d32"
                            : tip.impact === "medium"
                              ? "#f57c00"
                              : "#616161",
                        borderRadius: "3px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      {tip.impact === "high" ? "Grote impact" : tip.impact === "medium" ? "Gemiddeld" : "Klein"}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--ink-soft)", lineHeight: 1.5 }}>
                    {tip.description}
                  </p>
                  {tip.source && (
                    <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "#1976d2", fontStyle: "italic" }}>
                      Bron: {tip.source}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* General strategy */}
      <section className="card" style={{ backgroundColor: "#e3f2fd", borderLeft: "4px solid #1976d2" }}>
        <h2 className="card-title">🎯 Je FIRE Strategie</h2>
        <ol style={{ margin: "0", paddingLeft: "1.5rem", fontSize: "0.9rem", lineHeight: 2 }}>
          <li>
            <strong>Maximaliseer inkomen</strong> — Dit is je hefboom #1. Investeringen in jezelf (cursussen, skills) betalen het beste terug.
          </li>
          <li>
            <strong>Minimaliseer uitgaven</strong> — Niet door lijdzaam te leven, maar door slim uit te geven op wat telt.
          </li>
          <li>
            <strong>Investeer het verschil</strong> — De arbeidersmentaliteit + samengestelde rente = welvaart.
          </li>
          <li>
            <strong>Houd vol</strong> — FIRE is een marathon. Zichtbare voortgang elke maand helpt motivatie.
          </li>
        </ol>
      </section>

      {/* Recommended books/resources */}
      <section className="card">
        <h2 className="card-title">📚 Aanbevolen lectuur</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.9rem" }}>
          {[
            {
              title: "Your Money or Your Life",
              author: "Vicki Robin & Joe Dominguez",
              why: "Het klassieke FIRE boek. Laat zien hoe je je relatie met geld herdefiniëert.",
            },
            {
              title: "A Random Walk Down Wall Street",
              author: "Burton Malkiel",
              why: "Waarom indexbeleggen beter is dan proberen de markt te verslaan.",
            },
            {
              title: "The Simple Path to Wealth",
              author: "JL Collins",
              why: "Praktische gids naar financiële onafhankelijkheid. Nederlands: 'Het weg naar vrijheid'",
            },
          ].map((book, i) => (
            <div key={i} style={{ padding: "0.75rem", backgroundColor: "#f9f8f7", borderRadius: "4px" }}>
              <strong>{book.title}</strong>
              <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                {book.author} — {book.why}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
