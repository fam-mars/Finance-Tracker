import { useState } from "react";
import { useSync } from "../state/SyncContext";
import { Money } from "../components/ui";

interface OnboardingStep {
  id: string;
  title: string;
  subtitle: string;
  help: string;
}

const STEPS: OnboardingStep[] = [
  {
    id: "income",
    title: "Jouw inkomsten",
    subtitle: "Totale netto maandelijks",
    help: "Dit is het geld dat je maandelijks binnenkomt na belastingen.",
  },
  {
    id: "expenses",
    title: "Vaste lasten",
    subtitle: "Totale maandelijkse uitgaven",
    help: "Huis, eten, verzekeringen, abonnementen - alles wat je elke maand betaalt.",
  },
  {
    id: "savings",
    title: "Huisbezittingen",
    subtitle: "Huiswaarde en restschuld",
    help: "Huiswaarde helpt je net vermogen berekenen. Dit is meestal je grootste bezitting.",
  },
  {
    id: "investments",
    title: "Beleggingen",
    subtitle: "Aandelen, crypto, ETF's",
    help: "Geld dat je laat groeien voor je toekomst. Langetermijn vermogen opbouwen.",
  },
  {
    id: "debt",
    title: "Schulden",
    subtitle: "Hypotheek, studieschuld, leningen",
    help: "Al je schulden helpen ons berekenen hoelang tot financiële vrijheid.",
  },
];

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const { state } = useSync();
  const [currentStep, setCurrentStep] = useState(0);
  const step = STEPS[currentStep];

  if (!state) return null;

  const totalIncome = state.incomes.reduce((sum, inc) => sum + inc.amountPerMonth, 0);
  const totalExpenses = state.fixedExpenses.reduce((sum, exp) => sum + exp.amountPerMonth, 0);
  const totalInvested = state.portfolio.holdings.reduce((sum, h) => sum + ((h.quantity ?? 0) * (h.currentPrice ?? 0)), 0);
  const totalDebt = state.debts.reduce((sum, d) => sum + d.principalRemaining, 0);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <main className="screen" style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
          Welkom bij Financieel Overzicht 🎯
        </h1>
        <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "0.9rem" }}>
          Laten we je financiële situatie in kaart brengen. {currentStep + 1} van {STEPS.length}
        </p>
      </div>

      <div
        style={{
          width: "100%",
          height: "4px",
          backgroundColor: "var(--ink-soft)",
          borderRadius: "2px",
          overflow: "hidden",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            height: "100%",
            backgroundColor: "var(--teal)",
            width: `${progress}%`,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      <div
        style={{
          backgroundColor: "#f9f8f7",
          padding: "1.5rem",
          borderRadius: "8px",
          marginBottom: "2rem",
        }}
      >
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem" }}>{step.title}</h2>
        <p style={{ margin: "0 0 1rem", color: "var(--ink-soft)", fontSize: "0.9rem" }}>
          {step.subtitle}
        </p>
        <p style={{ margin: 0, padding: "0.75rem", backgroundColor: "#e8f5e9", borderRadius: "4px", fontSize: "0.85rem", color: "#2e7d32" }}>
          💡 {step.help}
        </p>
      </div>

      {step.id === "income" && (
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>Totaal maandelijks inkomen</span>
            <Money value={totalIncome} />
          </div>
          <p style={{ margin: "0.5rem 0", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
            {totalIncome > 0
              ? `Perfect! Je hebt €${totalIncome.toFixed(0)}/maand inkomsten.`
              : "Voeg inkomsten toe via het Cashflow scherm."}
          </p>
        </div>
      )}

      {step.id === "expenses" && (
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>Totaal maandelijkse lasten</span>
            <Money value={totalExpenses} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", padding: "0.75rem", backgroundColor: "#fff3e0", borderRadius: "4px" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>Maandelijks over</span>
            <Money value={Math.max(0, totalIncome - totalExpenses)} />
          </div>
          <p style={{ margin: "0.5rem 0", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
            Dit is wat je kunt sparen of beleggen!
          </p>
        </div>
      )}

      {step.id === "savings" && (
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>Huiswaarde</span>
            <Money value={state.mortgage.homeMarketValue} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>Restschuld hypotheek</span>
            <Money value={state.mortgage.principalRemaining} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", padding: "0.75rem", backgroundColor: "#e8f5e9", borderRadius: "4px" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Eigenwaarde</span>
            <Money value={state.mortgage.homeMarketValue - state.mortgage.principalRemaining} />
          </div>
        </div>
      )}

      {step.id === "investments" && (
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>Huidige beleggingen</span>
            <Money value={totalInvested} />
          </div>
          <p style={{ margin: "0.5rem 0", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
            {totalInvested > 0
              ? `Goed bezig! Je hebt €${totalInvested.toFixed(0)} belegd.`
              : "Voeg beleggingen toe via het Beleggen scherm."}
          </p>
        </div>
      )}

      {step.id === "debt" && (
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>Totale schulden</span>
            <Money value={totalDebt} />
          </div>
          {totalDebt === 0 && (
            <p style={{ margin: "0.5rem 0", padding: "0.75rem", backgroundColor: "#e8f5e9", borderRadius: "4px", fontSize: "0.85rem", color: "#2e7d32", fontWeight: 600 }}>
              🎉 Je bent schuldenvrij! Geweldig!
            </p>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
        <button
          onClick={handlePrev}
          disabled={currentStep === 0}
          style={{
            flex: 1,
            padding: "0.75rem",
            backgroundColor: currentStep === 0 ? "var(--ink-soft)" : "var(--ink)",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: currentStep === 0 ? "default" : "pointer",
            opacity: currentStep === 0 ? 0.5 : 1,
            fontWeight: 600,
          }}
        >
          Terug
        </button>
        <button
          onClick={handleNext}
          style={{
            flex: 1,
            padding: "0.75rem",
            backgroundColor: "var(--teal)",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {currentStep === STEPS.length - 1 ? "Klaar! Start" : "Volgende"}
        </button>
      </div>
    </main>
  );
}
