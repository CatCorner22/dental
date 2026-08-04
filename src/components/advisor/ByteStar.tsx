"use client";

import type { ByteMood } from "@/lib/advisor/advisor";

// BYTESTAR — the pioneer face. Same CRT glass as Byte, with a star on the
// enamel so the two advisors are unmistakable at a glance. Read-only chrome;
// decorative to assistive tech (aria-hidden); one slow blink under the same
// reduced-motion rule as Byte.

const PIXEL = 1;

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
  W: "#FFF8E7",
  S: "#F0E0B0",
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

function Star() {
  // A tiny 5-point star of pixels on the tooth — the pioneer mark.
  const star = "#C9A227";
  return (
    <>
      <rect x={7} y={2} width={1} height={1} fill={star} />
      <rect x={6} y={3} width={3} height={1} fill={star} />
      <rect x={7} y={4} width={1} height={1} fill={star} />
      <rect x={5} y={3} width={1} height={1} fill={star} opacity={0.7} />
      <rect x={9} y={3} width={1} height={1} fill={star} opacity={0.7} />
    </>
  );
}

function Face({ mood }: { mood: ByteMood }) {
  const eye = "#1E3A5F";
  switch (mood) {
    case "happy":
      return (
        <>
          <rect x={4} y={6} width={1} height={1} fill={eye} />
          <rect x={5} y={5} width={1} height={1} fill={eye} />
          <rect x={6} y={6} width={1} height={1} fill={eye} />
          <rect x={9} y={6} width={1} height={1} fill={eye} />
          <rect x={10} y={5} width={1} height={1} fill={eye} />
          <rect x={11} y={6} width={1} height={1} fill={eye} />
          <rect x={6} y={8} width={4} height={1} fill={eye} />
        </>
      );
    case "concerned":
      return (
        <>
          <rect x={4} y={5} width={2} height={2} fill={eye} />
          <rect x={10} y={5} width={2} height={2} fill={eye} />
          <rect x={6} y={8} width={4} height={1} fill={eye} />
        </>
      );
    case "thinking":
      return (
        <>
          <rect x={4} y={6} width={2} height={1} fill={eye} />
          <rect x={10} y={5} width={2} height={2} fill={eye} />
          <rect x={6} y={8} width={3} height={1} fill={eye} />
        </>
      );
    default:
      return (
        <>
          <g className="byte-blink">
            <rect x={4} y={5} width={2} height={2} fill={eye} />
            <rect x={10} y={5} width={2} height={2} fill={eye} />
          </g>
          <rect x={6} y={8} width={3} height={1} fill={eye} />
        </>
      );
  }
}

export function ByteStarFace({ mood, size = 72 }: { mood: ByteMood; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-3 -3 22 24"
      aria-hidden
      className="shrink-0"
      style={{ imageRendering: "pixelated" }}
    >
      <rect x={-3} y={-3} width={22} height={20} rx={1.5} fill="#3D2E14" />
      <rect x={-2} y={-2} width={20} height={18} rx={1} fill="#1A1205" />
      {[0, 3, 6, 9, 12].map((y) => (
        <rect key={y} x={-2} y={y} width={20} height={0.5} fill="#C9A227" opacity={0.08} />
      ))}
      <ToothPixels />
      <Star />
      <Face mood={mood} />
      <rect x={-1} y={-1} width={5} height={1} fill="#FFFFFF" opacity={0.12} />
      <rect x={5} y={17} width={6} height={1.5} fill="#3D2E14" />
      <rect x={3} y={18.5} width={10} height={1.5} rx={0.75} fill="#3D2E14" />
      {/* Pioneer power light — amber chrome, never a severity colour. */}
      <circle cx={15.5} cy={15.5} r={0.8} fill={mood === "idle" ? "#78716C" : "#C9A227"} />
    </svg>
  );
}
