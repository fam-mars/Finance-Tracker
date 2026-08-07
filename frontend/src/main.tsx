import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";
import App from "./App";

/**
 * /guide is een losstaande leespagina (ebook) zonder pincode of sync — de
 * vercel.json-rewrite serveert index.html voor elk pad. Lazy geladen zodat
 * de markdown-renderer niet in de hoofdbundel van de app zit.
 */
const GuidePage = lazy(() => import("./guide/GuidePage"));
const isGuide = window.location.pathname.replace(/\/+$/, "") === "/guide";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isGuide ? (
      <Suspense fallback={<main className="screen"><p style={{ color: "var(--ink-soft)" }}>Laden…</p></main>}>
        <GuidePage />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
