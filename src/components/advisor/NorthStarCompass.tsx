"use client";

/** North-star compass — onCourse drives the needle; decorative (aria-hidden). */
export function NorthStarCompass({ onCourse }: { onCourse: number }) {
  // 0 = far off course (needle left), 1 = on course (needle up/north).
  const deg = -70 + onCourse * 140;
  return (
    <svg width={56} height={56} viewBox="0 0 56 56" aria-hidden className="shrink-0">
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
        <line x1={28} y1={28} x2={28} y2={12} stroke="#5FB3A8" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={28} cy={28} r={3} fill="#C9A227" />
      </g>
      <text x={28} y={48} textAnchor="middle" fill="#C9A227" fontSize={6} opacity={0.8}>
        N
      </text>
    </svg>
  );
}
