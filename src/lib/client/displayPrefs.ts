// DISPLAY PREFERENCES: text size and contrast, per device.
//
// Pure and framework-free so it can be tested, and so the same logic can run in
// the pre-paint inline script and in the settings control without drifting.
//
// PER DEVICE, NOT PER ACCOUNT, and that is deliberate. These are properties of the
// screen and the eyes in front of it, not of the person's record: the wall-mounted
// tablet in operatory two needs a bigger size than the front-desk monitor, and the
// same hygienist uses both. Storing it on the account would fight the user every
// time they moved rooms. It also means no server round-trip and nothing to sync.
//
// A shared workstation therefore keeps whatever the last person chose, which is the
// right default for a room-scoped setting and worth stating plainly rather than
// discovering.

export const TEXT_SCALES = [
  { value: 1, label: "Normal" },
  { value: 1.15, label: "Larger" },
  { value: 1.3, label: "Large" },
  { value: 1.5, label: "Largest" }
] as const;

export type Contrast = "normal" | "high";

export interface DisplayPrefs {
  /** Multiplier on the browser's own default size, never a replacement for it. */
  textScale: number;
  contrast: Contrast;
}

export const DEFAULT_PREFS: DisplayPrefs = { textScale: 1, contrast: "normal" };

export const PREFS_STORAGE_KEY = "smilenotes.display";

/**
 * Read preferences from whatever a browser handed us.
 *
 * Total tolerance for junk: a corrupted value, a hand-edited one, a value from a
 * future version with fields this build has never heard of. A display preference
 * is never worth an exception on a screen someone is trying to work in, so
 * anything unrecognised falls back to the default silently.
 */
export function parsePrefs(raw: string | null | undefined): DisplayPrefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<DisplayPrefs>;
    const scale = TEXT_SCALES.some((s) => s.value === parsed.textScale)
      ? (parsed.textScale as number)
      : DEFAULT_PREFS.textScale;
    const contrast: Contrast = parsed.contrast === "high" ? "high" : "normal";
    return { textScale: scale, contrast };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function serializePrefs(prefs: DisplayPrefs): string {
  return JSON.stringify(prefs);
}

/**
 * The script that runs BEFORE first paint.
 *
 * Inline and blocking on purpose. Applied from a React effect instead, the page
 * paints at the default size and then jumps — which for the person who set a larger
 * size because they cannot read the default is the one moment the setting most
 * needs to already be true. CSP allows inline script here and next.config.mjs says
 * why; this is the kind of thing that exemption exists for.
 *
 * Wrapped in try/catch because localStorage throws outright in a locked-down
 * private mode, and a display preference must never be able to stop the app
 * rendering.
 */
export function prefsBootScript(): string {
  return `try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(
    PREFS_STORAGE_KEY
  )})||"{}");var s=[1,1.15,1.3,1.5].indexOf(p.textScale)>=0?p.textScale:1;var d=document.documentElement;d.style.setProperty("--text-scale",String(s));if(p.contrast==="high")d.setAttribute("data-contrast","high");}catch(e){}`;
}

/** Apply preferences to the live document. Used by the settings control. */
export function applyPrefs(prefs: DisplayPrefs, root: HTMLElement): void {
  root.style.setProperty("--text-scale", String(prefs.textScale));
  if (prefs.contrast === "high") root.setAttribute("data-contrast", "high");
  else root.removeAttribute("data-contrast");
}
