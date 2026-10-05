"use client";

import { useMemo, useRef, useState } from "react";

export type ChartPoint = { label: string; value: number };

type Range = "day" | "week" | "month" | "year";

const RANGES: { id: Range; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];

function formatValue(kind: "naira" | "count", value: number) {
  if (kind === "naira") {
    return `₦${(value / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
  }
  return `${value.toLocaleString("en-NG")}`;
}

export default function AdminChart({
  series,
  kind = "count",
}: {
  series: Record<Range, ChartPoint[]>;
  kind?: "naira" | "count";
}) {
  const [range, setRange] = useState<Range>("month");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const data = series[range] ?? [];
  const width = 640;
  const height = 180;
  const pad = { t: 16, r: 12, b: 28, l: 8 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const max = Math.max(...data.map((d) => d.value), 1);

  const points = useMemo(() => {
    if (data.length === 0) return [];
    return data.map((d, i) => {
      const x = pad.l + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
      const y = pad.t + innerH - (d.value / max) * innerH;
      return { ...d, x, y };
    });
  }, [data, innerH, innerW, max, pad.l, pad.t]);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = points.length
    ? `${path} L${points[points.length - 1].x.toFixed(1)} ${pad.t + innerH} L${points[0].x.toFixed(1)} ${pad.t + innerH} Z`
    : "";

  function onMove(event: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return;
    const box = svg.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * width;
    let best = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - x);
      if (dist < bestDist) {
        best = i;
        bestDist = dist;
      }
    });
    setHover(best);
  }

  const active = hover !== null ? points[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1">
        {RANGES.map((item) => (
          <button
            key={item.id}
            type="button"
            className="chart-range"
            data-active={range === item.id}
            onClick={() => {
              setRange(item.id);
              setHover(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {points.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No activity in this period.</p>
      ) : (
        <div className="relative">
          {active ? (
            <div
              className="chart-tip"
              style={{ left: `${(active.x / width) * 100}%` }}
            >
              <strong>{formatValue(kind, active.value)}</strong>
              <span>{active.label}</span>
            </div>
          ) : (
            <p className="mb-2 text-xs text-muted">Hover the line to inspect a point.</p>
          )}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="chart-svg"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          >
            <path d={area} fill="rgba(223,58,106,0.16)" />
            <path d={path} fill="none" stroke="#df3a6a" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
            {active ? (
              <>
                <line x1={active.x} x2={active.x} y1={pad.t} y2={pad.t + innerH} stroke="rgba(255,255,255,0.25)" />
                <circle cx={active.x} cy={active.y} r="4.5" fill="#fff" stroke="#df3a6a" strokeWidth="2" />
              </>
            ) : null}
          </svg>
        </div>
      )}
    </div>
  );
}
