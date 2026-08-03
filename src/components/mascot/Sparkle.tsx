/* eslint-disable @next/next/no-img-element */

// Sparkle, rendered.
//
// The nine character SVGs have been sitting in public/characters/ unreferenced
// since they were drawn — the mascot's WORDS were wired into the dashboard and
// the after-submit dialog, but never her face. This connects them.
//
// A plain <img>, not next/image: these are small hand-authored SVGs, already
// smaller than the JSON next/image would add, and vector art gains nothing from
// responsive raster resizing. It also keeps the CSP simple — same-origin
// img-src, no optimizer endpoint.
//
// Decorative by default. The line beside Sparkle already carries the meaning,
// so announcing "Sparkle the rainbow tooth" to a screen reader would just be
// noise between the user and the actual sentence.

export type CharacterId =
  | "sparkle"
  | "jayla"
  | "otto"
  | "benny"
  | "nova"
  | "callie"
  | "biscuit"
  | "olive"
  | "bo";

const FILES: Record<CharacterId, string> = {
  jayla: "01-jayla-bluejay-hygienist.svg",
  otto: "02-doc-otto-otter-dentist.svg",
  benny: "03-benny-bear-assistant.svg",
  sparkle: "04-sparkle-rainbow-tooth.svg",
  nova: "05-nova-astro-dino.svg",
  callie: "06-callie-calico-cat.svg",
  biscuit: "07-biscuit-retriever-puppy.svg",
  olive: "08-olive-barn-owl-professional.svg",
  bo: "09-dr-bo-bobcat-labcoat.svg"
};

const SIZES = { sm: 32, md: 48, lg: 72 } as const;

export function Character({
  id,
  size = "md",
  alt,
  className = ""
}: {
  id: CharacterId;
  size?: keyof typeof SIZES;
  /** Supply only when the image carries meaning the surrounding text does not. */
  alt?: string;
  className?: string;
}) {
  const px = SIZES[size];
  return (
    <img
      src={`/characters/${FILES[id]}`}
      width={px}
      height={px}
      // Explicit dimensions reserve the space before the SVG loads, so the
      // line of text beside it does not jump — a layout shift on the busiest
      // screen in the app.
      style={{ width: px, height: px }}
      alt={alt ?? ""}
      aria-hidden={alt ? undefined : true}
      // Below the fold on most screens, and never the thing a user is waiting
      // for.
      loading="lazy"
      decoding="async"
      className={`shrink-0 select-none ${className}`}
      draggable={false}
    />
  );
}

/** Sparkle beside her line — the pairing used on the dashboard. */
export function SparkleSays({ line, size = "md" }: { line: string; size?: keyof typeof SIZES }) {
  return (
    <div className="flex items-center gap-3">
      <Character id="sparkle" size={size} />
      <p className="text-sm text-slate-600">{line}</p>
    </div>
  );
}
