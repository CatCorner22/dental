"use client";

/**
 * North-star compass — onCourse drives the needle.
 *
 * 56px was too small to read at a glance from charting distance, which made
 * SuperByte's single most glanceable signal the one nobody glanced at. 88px,
 * a thicker needle, a brighter dial and a real reading underneath.
 *
 * The geometry is unchanged — same 56-unit viewBox, so every coordinate below
 * still means what it did; only the rendered size grew.
 *
 * No longer aria-hidden. A needle position is information, and a screen reader
 * got nothing at all from this; the role/label carry the same reading the
 * caption shows.
 */
export function NorthStarCompass({ onCourse }: { onCourse: number }) {
  // 0 = far off course (needle left), 1 = on course (needle up/north).
  const deg = -70 + onCourse * 140;
  const pct = Math.round(onCourse * 100);
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <svg
        width={88}
        height={88}
        viewBox="0 0 56 56"
        role="img"
        aria-label={`On course: ${pct} percent`}
        className="shrink-0"
      >
        <circle cx={28} cy={28} r={26} fill="#1A1205" stroke="#C9A227" strokeWidth={1.5} opacity={0.95} />
        <circle cx={28} cy={28} r={22} fill="none" stroke="#C9A227" strokeWidth={0.5} opacity={0.35} />
        {[0, 90, 180, 270].map((a) => (
          <line
            key={a}
            x1={28}
            y1={6}
            x2={28}
            y2={10}
            stroke="#C9A227"
            strokeWidth={1}
            opacity={0.5}
            transform={`rotate(${a} 28 28)`}
          />
        ))}
        <polygon points="28,8 31,18 28,16 25,18" fill="#C9A227" opacity={0.9} />
        <g transform={`rotate(${deg} 28 28)`}>
          <line x1={28} y1={28} x2={28} y2={11} stroke="#5FB3A8" strokeWidth={3.5} strokeLinecap="round" />
          <circle cx={28} cy={28} r={3.5} fill="#C9A227" />
        </g>
        <text x={28} y={48} textAnchor="middle" fill="#C9A227" fontSize={6} opacity={0.8}>
          N
        </text>
      </svg>
      {/* The number the needle is showing. A dial with no reading is a mood. */}
      <span className="text-xs font-semibold tabular-nums text-amber-900">{pct}% on course</span>
    </div>
  );
}
