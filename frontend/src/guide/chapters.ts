import raw from "../content/event-sourcing-guide.md?raw";

/**
 * Splits the guide markdown into ebook chapters on numbered `## N. Title`
 * headings. The document's own `# title` + `## subtitle` head become the
 * cover; everything in between (only a `---` rule) is dropped.
 */
export interface Chapter {
  id: string;
  /** The guide's own chapter number (0–12) as written in the source. */
  number: string;
  title: string;
  /** Markdown body without the chapter heading itself. */
  body: string;
  /** Estimated reading time in minutes (~200 words/min). */
  minutes: number;
}

const lines = raw.split("\n");

const CHAPTER_RE = /^## (\d+)\. (.+)$/;

const titleLine = lines.find((l) => l.startsWith("# "));
const subtitleLine = lines.find((l) => l.startsWith("## ") && !CHAPTER_RE.test(l));

export const BOOK = {
  title: titleLine ? titleLine.slice(2).trim() : "Event Sourcing",
  subtitle: subtitleLine ? subtitleLine.slice(3).trim() : "",
};

function estimateMinutes(body: string): number {
  const words = body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function buildChapters(): Chapter[] {
  const chapters: Chapter[] = [];
  let current: { number: string; title: string; body: string[] } | null = null;

  let inFence = false;
  for (const line of lines) {
    // Fenced blocks may contain lines starting with "## " (SQL comments etc.);
    // never treat those as chapter boundaries.
    if (/^\s*```/.test(line)) inFence = !inFence;
    const m = !inFence ? CHAPTER_RE.exec(line) : null;
    if (m) {
      if (current) chapters.push(finish(current));
      current = { number: m[1], title: m[2].trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) chapters.push(finish(current));
  return chapters;

  function finish(c: { number: string; title: string; body: string[] }): Chapter {
    // Drop the trailing `---` that separates chapters in the source.
    const body = c.body.join("\n").replace(/\n---\s*$/, "").trim();
    return {
      id: `ch-${c.number}`,
      number: c.number,
      title: c.title,
      body,
      minutes: estimateMinutes(body),
    };
  }
}

export const CHAPTERS: Chapter[] = buildChapters();

export const TOTAL_MINUTES = CHAPTERS.reduce((t, c) => t + c.minutes, 0);
