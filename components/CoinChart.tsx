"use client";

// Mini sparkline 7d come SVG inline (leggera, nessuna dipendenza per card).
export default function CoinChart({
  data,
  width = 120,
  height = 36,
}: {
  data?: number[];
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center text-[10px] text-slate-600"
      >
        n/d
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const up = data[data.length - 1] >= data[0];
  const stroke = up ? "#22c55e" : "#ef4444";

  return (
    <svg width={width} height={height} className="block">
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
