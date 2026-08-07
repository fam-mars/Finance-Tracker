import { useEffect, useState } from "react";

/** Volgt het systeemkleurschema zodat diagrammen meekleuren met de app. */
export function usePrefersDark(): boolean {
  const [dark, setDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return dark;
}

let renderSeq = 0;

/**
 * Renders a ```mermaid block. The library (~1.5 MB) is imported lazily so it
 * only loads once a chapter with a diagram is opened. Diagrams render at
 * natural size inside a horizontally scrollable container — on phones you
 * pan the diagram instead of squinting at a scaled-down version.
 */
export function Mermaid({ chart }: { chart: string }) {
  const dark = usePrefersDark();
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setSvg(null);
    setFailed(false);
    (async () => {
      try {
        const [{ default: mermaid }, { default: elkLayouts }] = await Promise.all([
          import("mermaid"),
          import("@mermaid-js/layout-elk"),
        ]);
        // ELK legt geneste subgraphs compact neer; dagre maakt daar extreem
        // brede, grotendeels lege layouts van. Sequence diagrams gebruiken
        // hun eigen layout en blijven ongemoeid.
        mermaid.registerLayoutLoaders(elkLayouts);
        mermaid.initialize({
          startOnLoad: false,
          layout: "elk",
          theme: dark ? "dark" : "neutral",
          fontFamily: "Inter, system-ui, sans-serif",
          themeVariables: dark
            ? { primaryColor: "#242f29", lineColor: "#9fb0a8" }
            : { primaryColor: "#e9ede8", lineColor: "#52645b" },
          flowchart: { useMaxWidth: false },
          sequence: { useMaxWidth: false },
          state: { useMaxWidth: false },
        });
        const { svg: out } = await mermaid.render(`guide-mmd-${++renderSeq}`, chart);
        if (alive) setSvg(out);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [chart, dark]);

  if (failed) {
    // Diagram source is still readable content — show it rather than nothing.
    return (
      <div className="md-codewrap">
        <pre><code>{chart}</code></pre>
      </div>
    );
  }
  if (!svg) return <div className="mermaid-loading">Diagram wordt geladen…</div>;
  return (
    <div className="mermaid-wrap" role="img" aria-label="Diagram">
      <div className="mermaid-inner" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
