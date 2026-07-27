import { useEffect, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { BOOK, CHAPTERS, TOTAL_MINUTES } from "./chapters";
import { Mermaid } from "./Mermaid";
import "./guide.css";

const LAST_CHAPTER_KEY = "finance-guide-last-chapter";
const FONT_KEY = "finance-guide-font-step";

/** Leesgroottes (rem) voor de A−/A+ knoppen — ebook-stijl. */
const FONT_STEPS = [0.9375, 1.0625, 1.1875, 1.3125];

/* ---------- markdown building blocks ---------- */

function CodeOrDiagram({ className, children }: { className?: string; children?: ReactNode }) {
  const text = String(children ?? "").replace(/\n$/, "");
  const lang = /language-([\w-]+)/.exec(className ?? "")?.[1];
  if (lang === "mermaid") return <Mermaid chart={text} />;

  const isBlock = lang != null || text.includes("\n");
  if (!isBlock) return <code className="md-inline">{children}</code>;

  // ASCII/box-drawing diagrams get a tighter line-height so the boxes connect.
  const isAsciiArt = lang == null && /[┌┐└┘│├┤▼▲]/.test(text);
  return (
    <div className={isAsciiArt ? "md-codewrap md-codewrap--diagram" : "md-codewrap"}>
      <pre><code>{text}</code></pre>
    </div>
  );
}

const mdComponents: Components = {
  // Unwrap <pre>: CodeOrDiagram renders its own scroll container.
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => (
    <CodeOrDiagram className={className}>{children}</CodeOrDiagram>
  ),
  // Tables scroll sideways inside their own container; the page never does.
  table: ({ children }) => (
    <div className="md-tablewrap">
      <table>{children}</table>
    </div>
  ),
  a: ({ href, children }) => (
    <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
      {children}
    </a>
  ),
};

/* ---------- hash-based chapter navigation (back button works) ---------- */

function readHash(): number | null {
  const m = /^#ch-(\d+)$/.exec(window.location.hash);
  if (!m) return null;
  const i = CHAPTERS.findIndex((c) => c.number === m[1]);
  return i >= 0 ? i : null;
}

function useChapterIndex(): [number | null, (i: number | null) => void] {
  const [idx, setIdx] = useState<number | null>(readHash);
  useEffect(() => {
    const onHash = () => setIdx(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const navigate = (i: number | null) => {
    window.location.hash = i == null ? "" : CHAPTERS[i].id;
  };
  return [idx, navigate];
}

/** Leesvoortgang binnen het hoofdstuk, voor de dunne balk onder de kop. */
function useScrollProgress(dep: unknown): number {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 1);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [dep]);
  return progress;
}

/* ---------- views ---------- */

function TableOfContents({ onOpen }: { onOpen: (i: number) => void }) {
  const lastRead = useMemo(() => {
    const stored = localStorage.getItem(LAST_CHAPTER_KEY);
    if (stored == null) return null;
    const i = CHAPTERS.findIndex((c) => c.id === stored);
    return i >= 0 ? i : null;
  }, []);

  return (
    <main className="guide-toc">
      <a className="guide-backlink" href="/">← Financieel Overzicht</a>
      <header className="guide-cover">
        <p className="guide-cover-badge">Engineering handbook</p>
        <h1 className="guide-cover-title">{BOOK.title}</h1>
        <p className="guide-cover-sub">{BOOK.subtitle}</p>
        <p className="guide-cover-meta">
          {CHAPTERS.length} hoofdstukken · ≈ {TOTAL_MINUTES} min leestijd
        </p>
        {lastRead != null && (
          <button className="guide-resume" onClick={() => onOpen(lastRead)}>
            ▶ Verder lezen — {CHAPTERS[lastRead].number}. {CHAPTERS[lastRead].title}
          </button>
        )}
      </header>
      <ol className="guide-toclist">
        {CHAPTERS.map((c, i) => (
          <li key={c.id}>
            <button className="guide-tocitem" onClick={() => onOpen(i)}>
              <span className="guide-tocnum">{c.number}</span>
              <span className="guide-toctext">
                <span className="guide-toctitle">{c.title}</span>
                <span className="guide-tocmin">≈ {c.minutes} min</span>
              </span>
              <span className="guide-tocarrow" aria-hidden>›</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="guide-colophon">
        Gids gegenereerd uit de platform.Ecommerce-broncode.
      </p>
    </main>
  );
}

function ChapterView({ index, onNavigate }: {
  index: number;
  onNavigate: (i: number | null) => void;
}) {
  const chapter = CHAPTERS[index];
  const progress = useScrollProgress(index);
  const [fontStep, setFontStep] = useState(() => {
    const stored = Number(localStorage.getItem(FONT_KEY));
    return Number.isInteger(stored) && stored >= 0 && stored < FONT_STEPS.length ? stored : 1;
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    localStorage.setItem(LAST_CHAPTER_KEY, chapter.id);
  }, [chapter.id]);

  useEffect(() => {
    localStorage.setItem(FONT_KEY, String(fontStep));
  }, [fontStep]);

  const prev = index > 0 ? CHAPTERS[index - 1] : null;
  const next = index < CHAPTERS.length - 1 ? CHAPTERS[index + 1] : null;

  return (
    <div className="guide-reader" style={{ "--reader-size": `${FONT_STEPS[fontStep]}rem` } as React.CSSProperties}>
      <header className="guide-topbar">
        <div className="guide-topbar-row">
          <button className="guide-topbtn" onClick={() => onNavigate(null)}>☰ Inhoud</button>
          <span className="guide-topbar-title">{chapter.number}. {chapter.title}</span>
          <span className="guide-fontbtns">
            <button className="guide-topbtn" aria-label="Kleinere letters"
              disabled={fontStep === 0} onClick={() => setFontStep(fontStep - 1)}>A−</button>
            <button className="guide-topbtn" aria-label="Grotere letters"
              disabled={fontStep === FONT_STEPS.length - 1} onClick={() => setFontStep(fontStep + 1)}>A+</button>
          </span>
        </div>
        <div className="guide-progress" aria-hidden>
          <div className="guide-progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      </header>

      <main className="guide-content">
        <p className="guide-kicker">
          Hoofdstuk {chapter.number} van {CHAPTERS[CHAPTERS.length - 1].number} · ≈ {chapter.minutes} min
        </p>
        <h1 className="guide-chaptertitle">{chapter.title}</h1>
        <article className="guide-article">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {chapter.body}
          </ReactMarkdown>
        </article>
      </main>

      <nav className="guide-pager" aria-label="Hoofdstuknavigatie">
        {prev ? (
          <button className="guide-pagebtn" onClick={() => onNavigate(index - 1)}>
            <span className="guide-pagedir">← Vorige</span>
            <span className="guide-pagename">{prev.number}. {prev.title}</span>
          </button>
        ) : <span />}
        {next ? (
          <button className="guide-pagebtn guide-pagebtn--next" onClick={() => onNavigate(index + 1)}>
            <span className="guide-pagedir">Volgende →</span>
            <span className="guide-pagename">{next.number}. {next.title}</span>
          </button>
        ) : (
          <button className="guide-pagebtn guide-pagebtn--next" onClick={() => onNavigate(null)}>
            <span className="guide-pagedir">Klaar ✓</span>
            <span className="guide-pagename">Terug naar de inhoud</span>
          </button>
        )}
      </nav>
    </div>
  );
}

export default function GuidePage() {
  const [index, navigate] = useChapterIndex();

  useEffect(() => {
    document.title = index == null
      ? BOOK.title
      : `${CHAPTERS[index].title} — ${BOOK.title}`;
  }, [index]);

  // Literata: echte ebook-letter, alleen op deze pagina geladen.
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;0,7..72,700;1,7..72,400&display=swap";
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  if (index == null) return <TableOfContents onOpen={(i) => navigate(i)} />;
  return <ChapterView index={index} onNavigate={navigate} />;
}
