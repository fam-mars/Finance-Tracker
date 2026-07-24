import { useState } from "react";
import { SyncProvider, useSync } from "./state/SyncContext";
import { SaveBar, TabBar, type TabId } from "./components/ui";
import { AuthScreen } from "./components/auth";
import { Dashboard } from "./screens/Dashboard";
import { Cashflow } from "./screens/Cashflow";
import { Beleggen } from "./screens/Beleggen";
import { Wonen } from "./screens/Wonen";
import { Vermogen } from "./screens/Vermogen";

function Shell() {
  const { status, errorMessage, state, reload } = useSync();
  const [tab, setTab] = useState<TabId>("dashboard");

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

  return (
    <>
      {status === "error" && errorMessage && (
        <div className="screen" style={{ paddingBottom: 0 }}>
          <div className="banner banner--error">{errorMessage}</div>
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
      {tab === "wonen" && <Wonen state={state} />}
      {tab === "vermogen" && <Vermogen state={state} />}
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
