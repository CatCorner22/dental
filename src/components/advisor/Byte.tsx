"use client";

import type { ByteMood } from "@/lib/advisor/advisor";

// BYTE — an 8-bit tooth living inside a little CRT monitor.
//
// Hand-placed pixels on a 16x16 grid, rendered as SVG rects, because pixel art
// IS a grid and an SVG grid scales crisply to any size the layout wants. No
// image asset, no font trickery, nothing to load: the mascot costs a few
// hundred bytes and inherits the app's CSP for free.
//
// THE FACE FOLLOWS THE NUMBERS. Byte's mood is computed by the advisor engine
// from the same analysis the gauges show — a mascot whose expression disagrees
// with the dashboard is a mascot nobody trusts, so the expression IS the
// dashboard, summarized to one face.
//
// Decorative to assistive tech (aria-hidden): everything Byte communicates is
// also present as text in the panel beside him, so the character is an
// accelerator for sighted users and never the only channel. Animation is a
// slow blink and nothing else, disabled under prefers-reduced-motion by the
// app's global rule.

const PIXEL = 1; // grid units; the viewBox scales

// The tooth, as 16x16 pixel-art rows. '.'=empty, 'W'=enamel, 'S'=shade,
// 'O'=outline. Eyes and mouth are drawn separately per mood so one body serves
// every expression.
const TOOTH_ROWS = [
  "....OOOOOOOO....",
  "...OWWWWWWWWO...",
  "..OWWWWWWWWWWO..",
  ".OWWWWWWWWWWWWO.",
  ".OWWWWWWWWWWWWO.",
  ".OWWWWWWWWWWWWO.",
  ".OWWWWWWWWWWWWO.",
  ".OWWWWWWWWWWWWO.",
  ".OWWWWWWWWWWWWO.",
  ".OWWSWWWWWWSWWO.",
  ".OWWSWWWWWWSWWO.",
  "..OWSWOOOWSWO...",
  "..OWWO...OWWO...",
  "..OWWO...OWWO...",
  "...OO.....OO....",
  "................"
];

const COLOR: Record<string, string> = {
  W: "#FFFFFF",
  S: "#DCE8F2",
  O: "#1E3A5F"
};

function ToothPixels() {
  const rects = [];
  for (let y = 0; y < TOOTH_ROWS.length; y++) {
    for (let x = 0; x < TOOTH_ROWS[y].length; x++) {
      const c = TOOTH_ROWS[y][x];
      if (c === ".") continue;
      rects.push(<rect key={`${x}-${y}`} x={x * PIXEL} y={y * PIXEL} width={PIXEL} height={PIXEL} fill={COLOR[c]} />);
    }
  }
  return <>{rects}</>;
}

/** Eyes and mouth per mood, as pixel rects on the same grid. */
function Face({ mood }: { mood: ByteMood }) {
  const eye = "#1E3A5F";
  const blush = "#F2A6A6";
  switch (mood) {
    case "happy":
      return (
        <>
          {/* Closed happy eyes: two little arcs of pixels. */}
          <rect x={4} y={5} width={1} height={1} fill={eye} />
          <rect x={5} y={4} width={1} height={1} fill={eye} />
          <rect x={6} y={5} width={1} height={1} fill={eye} />
          <rect x={9} y={5} width={1} height={1} fill={eye} />
          <rect x={10} y={4} width={1} height={1} fill={eye} />
          <rect x={11} y={5} width={1} height={1} fill={eye} />
          {/* Big smile. */}
          <rect x={6} y={7} width={4} height={1} fill={eye} />
          <rect x={5} y={6} width={1} height={1} fill={eye} />
          <rect x={10} y={6} width={1} height={1} fill={eye} />
          <rect x={4} y={6} width={1} height={1} fill={blush} />
          <rect x={11} y={6} width={1} height={1} fill={blush} />
        </>
      );
    case "concerned":
      return (
        <>
          {/* Wide eyes and a small flat mouth: alert, never scolding. */}
          <rect x={4} y={4} width={2} height={2} fill={eye} />
          <rect x={10} y={4} width={2} height={2} fill={eye} />
          <rect x={6} y={7} width={4} height={1} fill={eye} />
          {/* A raised pixel brow. */}
          <rect x={4} y={3} width={2} height={1} fill={eye} opacity={0.35} />
        </>
      );
    case "thinking":
      return (
        <>
          {/* One eye squinted, one open: reading. */}
          <rect x={4} y={5} width={2} height={1} fill={eye} />
          <rect x={10} y={4} width={2} height={2} fill={eye} />
          <rect x={6} y={7} width={3} height={1} fill={eye} />
        </>
      );
    default:
      return (
        <>
          {/* Idle: soft open eyes, small smile, with a slow blink. */}
          <g className="byte-blink">
            <rect x={4} y={4} width={2} height={2} fill={eye} />
            <rect x={10} y={4} width={2} height={2} fill={eye} />
          </g>
          <rect x={6} y={7} width={3} height={1} fill={eye} />
          <rect x={9} y={6} width={1} height={1} fill={eye} />
        </>
      );
  }
}

export function Byte({ mood, size = 72 }: { mood: ByteMood; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-3 -3 22 24"
      aria-hidden
      className="shrink-0"
      style={{ imageRendering: "pixelated" }}
    >
      {/* The CRT monitor: bezel, screen, stand — the "digital glass" made
          literal. Byte lives BEHIND it; the frame is the design language for
          "read-only". */}
      <rect x={-3} y={-3} width={22} height={20} rx={1.5} fill="#334155" />
      <rect x={-2} y={-2} width={20} height={18} rx={1} fill="#0B1B2E" />
      {/* Scanlines, faint. */}
      {[0, 3, 6, 9, 12].map((y) => (
        <rect key={y} x={-2} y={y} width={20} height={0.5} fill="#FFFFFF" opacity={0.04} />
      ))}
      <ToothPixels />
      <Face mood={mood} />
      {/* Screen glint. */}
      <rect x={-1} y={-1} width={5} height={1} fill="#FFFFFF" opacity={0.12} />
      {/* Monitor stand. */}
      <rect x={5} y={17} width={6} height={1.5} fill="#334155" />
      <rect x={3} y={18.5} width={10} height={1.5} rx={0.75} fill="#334155" />
      {/* Power light: teal when engaged, dim when idle. Chrome colour, never a
          severity colour — the andon lives in the audit panel, not on a pet. */}
      <circle cx={15.5} cy={15.5} r={0.8} fill={mood === "idle" ? "#475569" : "#5FB3A8"} />
    </svg>
  );
}
