"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_PREFS,
  PREFS_STORAGE_KEY,
  TEXT_SCALES,
  applyPrefs,
  parsePrefs,
  serializePrefs,
  type DisplayPrefs
} from "@/lib/client/displayPrefs";

// Text size and contrast, as one-click buttons.
//
// Buttons rather than a select, and the reason is the audience: the person who
// needs this most is the person who finds a dropdown hardest to operate, and a
// dropdown hides the options until you already know they are there. Four visible
// targets cost nothing and can be hit with a knuckle.
//
// Each button previews the thing it does — the size buttons are rendered AT the
// size they set — because "Larger" as a word requires you to imagine the result,
// and imagining is exactly what someone struggling to read the screen cannot do.

export function DisplaySettings() {
  const [prefs, setPrefs] = useState<DisplayPrefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);

  // Read on mount rather than during render: localStorage does not exist on the
  // server, and the pre-paint boot script has already applied the real values, so
  // this is only catching the state UP to what the document already shows.
  useEffect(() => {
    try {
      setPrefs(parsePrefs(window.localStorage.getItem(PREFS_STORAGE_KEY)));
    } catch {
      setPrefs(DEFAULT_PREFS);
    }
    setReady(true);
  }, []);

  const update = (next: DisplayPrefs) => {
    setPrefs(next);
    applyPrefs(next, document.documentElement);
    try {
      window.localStorage.setItem(PREFS_STORAGE_KEY, serializePrefs(next));
    } catch {
      // A locked-down private mode refuses to store. The change still applies for
      // this session, which is better than refusing to change anything at all.
    }
  };

  return (
    <section className="rounded-xl bg-white ring-1 ring-slate-200 p-4">
      <h2 className="section-title">Text size and contrast</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Saved on <strong>this device</strong>, not to your account — the tablet in an operatory and
        the front-desk monitor need different sizes, and the same person uses both. A shared
        computer keeps whatever was chosen last.
      </p>

      <fieldset className="mt-4">
        <legend className="field-label">Text size</legend>
        <div className="flex flex-wrap gap-2">
          {TEXT_SCALES.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={ready && prefs.textScale === s.value}
              onClick={() => update({ ...prefs, textScale: s.value })}
              // Rendered AT the size it sets, so the choice is shown rather than
              // described. "Larger" as a word asks you to imagine the result.
              style={{ fontSize: `${s.value}rem` }}
              className={`tap rounded-full border px-3 font-medium ${
                ready && prefs.textScale === s.value
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-slate-400 bg-white text-slate-800 hover:bg-brand-blue/10"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="field-label">Contrast</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["normal", "Normal"],
              ["high", "Stronger text and borders"]
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={ready && prefs.contrast === value}
              onClick={() => update({ ...prefs, contrast: value })}
              className={`tap rounded-full border px-3 text-sm font-medium ${
                ready && prefs.contrast === value
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-slate-400 bg-white text-slate-800 hover:bg-brand-blue/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 max-w-2xl text-xs text-slate-600">
          Darkens help text, timestamps and placeholders, and thickens borders and focus rings.
          Status colours are deliberately unchanged: red, orange, amber and green have fixed
          meanings here, and every one of them is paired with an icon and a word so colour is never
          the only signal.
        </p>
      </fieldset>
    </section>
  );
}
