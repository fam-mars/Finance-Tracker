import { useState } from "react";
import { SyncProvider, useSync } from "./state/SyncContext";
import { SaveBar, TabBar, type TabId } from "./components/ui";
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
  return (
    <SyncProvider>
      <Shell />
    </SyncProvider>
  );
}
