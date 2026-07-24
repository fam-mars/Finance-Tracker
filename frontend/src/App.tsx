import { useState } from "react";
import { SyncProvider, useSync } from "./state/SyncContext";
import { SaveBar, TabBar, type TabId } from "./components/ui";
import { AuthScreen } from "./components/auth";
import { Dashboard } from "./screens/Dashboard";
import { Cashflow } from "./screens/Cashflow";
import { Beleggen } from "./screens/Beleggen";
import { Wonen } from "./screens/Wonen";
import { Vermogen } from "./screens/Vermogen";
import { Retirement } from "./screens/Retirement";
import { Optimization } from "./screens/Optimization";
import { Onboarding } from "./screens/Onboarding";

function Shell() {
  const { status, errorMessage, state, reload } = useSync();
  const [tab, setTab] = useState<TabId>("dashboard");
  const [showOnboarding, setShowOnboarding] = useState(false);

  if (status === "loading" && !state) {
    return <main className="screen"><p style={{ color: "var(--ink-soft)" }}>Laden…</p></main>;
  }
  if (status === "error" && !state) {
    return (
      <main className="screen">
        <div className="banner banner--error">{errorMessage ?? "Er ging iets mis."}</div>
        <button className="btn btn-primary" onClick={() => void reload()}>Opnieuw proberen</button>
      </main>
    );
  }
  if (!state) return null;

  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <>
      {status === "error" && errorMessage && (
        <div className="screen" style={{ paddingBottom: 0 }}>
          <div className="banner banner--error">{errorMessage}</div>
          <button onClick={() => void reload()} style={{ margin: "0.5rem var(--sp-3) 0" }} className="btn btn-primary">
            Opnieuw
          </button>
        </div>
      )}
      {status === "conflict" && errorMessage && (
        <div className="screen" style={{ paddingBottom: 0 }}>
          <div className="banner banner--conflict">{errorMessage}</div>
        </div>
      )}
      {tab === "dashboard" && <Dashboard state={state} />}
      {tab === "cashflow" && <Cashflow state={state} />}
      {tab === "beleggen" && <Beleggen state={state} />}
      {tab === "retirement" && <Retirement state={state} />}
      {tab === "optimization" && <Optimization state={state} />}
      {tab === "wonen" && <Wonen state={state} />}
      {tab === "vermogen" && <Vermogen state={state} />}

      {/* Onboarding hint in dashboard */}
      {tab === "dashboard" && (
        <button
          onClick={() => setShowOnboarding(true)}
          style={{
            position: "fixed",
            bottom: "80px",
            right: "1rem",
            padding: "0.75rem 1rem",
            backgroundColor: "var(--accent)",
            color: "var(--ink)",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.85rem",
            fontWeight: 600,
            zIndex: 50,
          }}
          title="Stap-voor-stap gids"
        >
          📋 Gids
        </button>
      )}

      <SaveBar />
      <TabBar active={tab} onSelect={setTab} />
    </>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => {
    // Check if auth is disabled or already authenticated
    const authMode = import.meta.env.VITE_AUTH_MODE;
    const authCode = import.meta.env.VITE_AUTH_CODE;
    const authEnabled = authMode || authCode;

    if (import.meta.env.DEV) {
      console.log("Auth config:", { authMode, authCode, authEnabled });
    }

    if (!authEnabled) return true;
    return sessionStorage.getItem("auth_token") === "authenticated";
  });

  if (!authenticated) {
    return <AuthScreen onAuth={() => setAuthenticated(true)} />;
  }

  return (
    <SyncProvider>
      <Shell />
    </SyncProvider>
  );
}
