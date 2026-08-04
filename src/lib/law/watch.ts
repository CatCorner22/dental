import type { GenerateListFn } from "@/lib/assist/service";

// LEGAL WATCH — agents that look for changes in the law this library cites.
//
// One agent per source. Each agent fetches a PUBLIC page (no PHI is anywhere
// near this path — the inputs are government and professional-body websites),
// scans it deterministically for dental-relevant signals, and — when the AI
// layer is enabled — asks the model to summarize what changed and why a
// Tennessee dental practice should care. The model's output is display-only
// and every item carries the source URL, so a human verifies against the
// primary source in one click. The agents never modify the authority library:
// a change lands there only when a human edits the table, reviewed like any
// other code change.
//
// Failure posture: agents are independent. One source being down, moved, or
// hostile costs that one row, never the sweep.

export interface WatchSource {
  id: string;
  label: string;
  url: string;
  /** What kind of change this agent watches for. */
  watches: string;
  /** Keywords that make a page region interesting to this agent. */
  keywords: readonly string[];
}

export const WATCH_SOURCES: readonly WatchSource[] = [
  {
    id: "sos-rules",
    label: "TN Secretary of State — Rule filings (0460)",
    url: "https://publications.tnsosfiles.com/rules/0460/0460.htm",
    watches: "Amendments and new filings to Board of Dentistry rule chapters",
    keywords: ["0460", "dentist", "dental", "hygien", "amend", "effective"]
  },
  {
    id: "board-news",
    label: "TN Board of Dentistry",
    url: "https://www.tn.gov/health/health-program-areas/health-professional-boards/dentistry-board.html",
    watches: "Board notices, meeting minutes, disciplinary and policy updates",
    keywords: ["dentist", "dental", "board", "notice", "rule", "policy", "discipline"]
  },
  {
    id: "general-assembly",
    label: "TN General Assembly",
    url: "https://www.capitol.tn.gov/",
    watches: "New public chapters and bills touching Title 63 Chapter 5",
    keywords: ["dental", "dentist", "hygien", "63-5", "public chapter", "oral health"]
  },
  {
    id: "csmd",
    label: "TN CSMD program",
    url: "https://www.tn.gov/health/health-program-areas/health-professional-boards/csmd-board.html",
    watches: "Controlled-substance monitoring requirements and prescriber duties",
    keywords: ["csmd", "controlled substance", "opioid", "prescriber", "monitoring"]
  },
  {
    id: "hhs-hipaa",
    label: "HHS HIPAA newsroom",
    url: "https://www.hhs.gov/hipaa/for-professionals/index.html",
    watches: "Privacy and Security Rule changes and enforcement guidance",
    keywords: ["security rule", "privacy rule", "final rule", "enforcement", "ephi"]
  },
  {
    id: "ada-news",
    label: "ADA — standards and advocacy",
    url: "https://www.ada.org/",
    watches: "Professional-conduct updates and national standards movement",
    keywords: ["ethics", "code of professional conduct", "standard", "guideline"]
  }
] as const;

export interface WatchItem {
  /** Model-written or heuristically derived headline. */
  title: string;
  /** Why a TN dental practice should care — one or two sentences. */
  whyRelevant: string;
  /** Always the watched source's URL family; a human verifies at the source. */
  url: string;
}

export interface WatchSourceReport {
  sourceId: string;
  label: string;
  url: string;
  status: "ok" | "fetch-failed" | "no-signal";
  /** Deterministic signal: how many watch keywords the page matched. */
  keywordHits: number;
  /** Present only when the AI layer summarized; display-only, source-linked. */
  items: WatchItem[];
  /** Set when the AI pass was skipped or its output failed validation. */
  note?: string;
}

export interface WatchSweep {
  at: string;
  sources: WatchSourceReport[];
  aiEnabled: boolean;
}

/** Injected so tests never touch the network. */
export type FetchPage = (url: string) => Promise<string>;

const MAX_PAGE_CHARS = 12_000;

const WATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "whyRelevant"],
        properties: {
          title: { type: "string" },
          whyRelevant: { type: "string" }
        }
      }
    }
  }
} as const;

const WATCH_SYSTEM_PROMPT = `You scan a public government or professional-body web page for a Tennessee dental practice's compliance team. Report ONLY items plausibly relevant to Tennessee dental practice: rule amendments, new public chapters, board notices, controlled-substance requirements, HIPAA changes, professional-conduct updates.

Rules:
- Report what the PAGE says. Never invent a rule change, a date, or a citation the text does not contain.
- "title": the item as the page states it, shortened. "whyRelevant": one or two sentences on why a Tennessee dental practice should care.
- If nothing on the page is relevant, return an empty items array. An empty answer is a good answer.
- No preamble, no advice, no legal conclusions.`;

function stripMarkup(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countKeywordHits(text: string, keywords: readonly string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const k of keywords) {
    if (lower.includes(k.toLowerCase())) hits += 1;
  }
  return hits;
}

function validateItems(raw: unknown, sourceUrl: string): WatchItem[] | null {
  if (!raw || typeof raw !== "object") return null;
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length > 5) return null;
  const out: WatchItem[] = [];
  for (const it of items) {
    if (!it || typeof it !== "object") return null;
    const o = it as Record<string, unknown>;
    if (typeof o.title !== "string" || typeof o.whyRelevant !== "string") return null;
    const title = o.title.trim().slice(0, 200);
    const whyRelevant = o.whyRelevant.trim().slice(0, 400);
    if (!title || !whyRelevant) return null;
    // The URL is OURS, always: the model never supplies links, so a
    // hallucinated destination cannot be rendered as a citation.
    out.push({ title, whyRelevant, url: sourceUrl });
  }
  return out;
}

async function watchOne(
  source: WatchSource,
  fetchPage: FetchPage,
  generateList?: GenerateListFn
): Promise<WatchSourceReport> {
  let text: string;
  try {
    text = stripMarkup(await fetchPage(source.url)).slice(0, MAX_PAGE_CHARS);
  } catch {
    return {
      sourceId: source.id,
      label: source.label,
      url: source.url,
      status: "fetch-failed",
      keywordHits: 0,
      items: [],
      note: "Source unreachable from this deployment."
    };
  }

  const keywordHits = countKeywordHits(text, source.keywords);
  if (keywordHits === 0) {
    return {
      sourceId: source.id,
      label: source.label,
      url: source.url,
      status: "no-signal",
      keywordHits,
      items: []
    };
  }

  if (!generateList) {
    return {
      sourceId: source.id,
      label: source.label,
      url: source.url,
      status: "ok",
      keywordHits,
      items: [],
      note: "Keyword signal present. Enable AI assist for summarized items, or review the source directly."
    };
  }

  try {
    const raw = await generateList({
      system: WATCH_SYSTEM_PROMPT,
      prompt: `Source: ${source.label} (${source.url})\nWatching for: ${source.watches}\n\nPage text (markup stripped, truncated):\n\n${text}`,
      schemaName: "law-watch",
      schema: WATCH_SCHEMA as unknown as Record<string, unknown>
    });
    const items = validateItems(raw, source.url);
    if (items === null) {
      return {
        sourceId: source.id,
        label: source.label,
        url: source.url,
        status: "ok",
        keywordHits,
        items: [],
        note: "AI summary failed validation and was discarded; review the source directly."
      };
    }
    return { sourceId: source.id, label: source.label, url: source.url, status: "ok", keywordHits, items };
  } catch {
    return {
      sourceId: source.id,
      label: source.label,
      url: source.url,
      status: "ok",
      keywordHits,
      items: [],
      note: "AI summary unavailable; keyword signal stands. Review the source directly."
    };
  }
}

export async function runLegalWatch(
  fetchPage: FetchPage,
  generateList?: GenerateListFn
): Promise<WatchSweep> {
  const sources = await Promise.all(WATCH_SOURCES.map((s) => watchOne(s, fetchPage, generateList)));
  return { at: new Date().toISOString(), sources, aiEnabled: Boolean(generateList) };
}
