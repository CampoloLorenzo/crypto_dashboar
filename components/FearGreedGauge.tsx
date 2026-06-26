"use client";

import type { FearGreed } from "@/types";

// Gauge semicircolare con needle posizionato sul valore 0-100.
export default function FearGreedGauge({ data }: { data: FearGreed | null }) {
  const value = data?.value ?? 50;
  const label = data?.label ?? "—";

  // Semicerchio: angolo da 180° (0) a 0° (100).
  const angle = 180 - (value / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  const cx = 100;
  const cy = 100;
  const r = 80;
  const nx = cx + r * Math.cos(rad);
  const ny = cy - r * Math.sin(rad);

  const color =
    value < 25
      ? "#ef4444"
      : value < 45
      ? "#f97316"
      : value < 55
      ? "#eab308"
      : value < 75
      ? "#84cc16"
      : "#22c55e";

  return (
    <div className="card p-4 flex flex-col items-center">
      <h3 className="text-sm font-semibold text-slate-300 self-start mb-2">
        Fear &amp; Greed
      </h3>
      <svg viewBox="0 0 200 120" className="w-full max-w-[220px]">
        {/* arco colorato a segmenti */}
        {[
          { from: 180, to: 144, c: "#ef4444" },
          { from: 144, to: 108, c: "#f97316" },
          { from: 108, to: 72, c: "#eab308" },
          { from: 72, to: 36, c: "#84cc16" },
          { from: 36, to: 0, c: "#22c55e" },
        ].map((seg, i) => {
          const a1 = (seg.from * Math.PI) / 180;
          const a2 = (seg.to * Math.PI) / 180;
          const x1 = cx + r * Math.cos(a1);
          const y1 = cy - r * Math.sin(a1);
          const x2 = cx + r * Math.cos(a2);
          const y2 = cy - r * Math.sin(a2);
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
              fill="none"
              stroke={seg.c}
              strokeWidth={12}
              strokeLinecap="butt"
            />
          );
        })}
        {/* needle */}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke="#e2e8f0"
          strokeWidth={2.5}
        />
        <circle cx={cx} cy={cy} r={5} fill="#e2e8f0" />
      </svg>
      <div className="text-center -mt-2">
        <div className="text-3xl font-bold" style={{ color }}>
          {value}
        </div>
        <div className="text-sm text-slate-400">{label}</div>
      </div>
    </div>
  );
}
