import { useEffect, useState } from "react";
import type { Tone } from "../lib/utils";

const CX = 120;
const CY = 112;
const R = 92;
const START = 135; // degrees, clockwise from 3 o'clock: bottom-left
const SWEEP = 270;

const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (deg: number, r: number) => ({ x: CX + r * Math.cos(rad(deg)), y: CY + r * Math.sin(rad(deg)) });

// One arc path from START sweeping 270deg clockwise. pathLength=100 lets us use % for dashes.
const a = pt(START, R);
const b = pt(START + SWEEP, R);
const ARC = `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 1 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;

// The four risk bands drawn faintly behind the value: they show where "moderate" and "high" begin.
const BANDS: { from: number; to: number; color: string }[] = [
  { from: 0, to: 25, color: "var(--clear)" },
  { from: 25, to: 50, color: "var(--medium)" },
  { from: 50, to: 75, color: "var(--high)" },
  { from: 75, to: 100, color: "var(--critical)" },
];

const TICKS = Array.from({ length: 21 }, (_, i) => {
  const major = i % 5 === 0;
  const deg = START + (SWEEP * i) / 20;
  const p1 = pt(deg, 101);
  const p2 = pt(deg, major ? 110 : 106);
  return { key: i, major, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
});

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Counts from 0 to `target` so the arc and the number move together. */
function useCountUp(target: number, ms = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setV(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

interface Props {
  score: number;
  tone: Tone;
  /** show "-" instead of a number, for results that couldn't be assessed */
  unknown?: boolean;
  caption?: string;
}

export function Gauge({ score, tone, unknown = false, caption = "risk score" }: Props) {
  const clamped = Math.max(0, Math.min(100, score));
  const v = useCountUp(unknown ? 0 : clamped);

  return (
    <div className="gauge" data-tone={tone} role="img" aria-label={unknown ? "Risk score unavailable" : `Risk score ${clamped} out of 100`}>
      <svg viewBox="0 0 240 210" aria-hidden="true">
        {BANDS.map((band) => (
          <path
            key={band.from}
            d={ARC}
            pathLength={100}
            className="g-band"
            style={{ stroke: band.color }}
            strokeDasharray={`${band.to - band.from - 1.2} ${100 - (band.to - band.from) + 1.2}`}
            strokeDashoffset={-band.from - 0.6}
          />
        ))}
        {TICKS.map((t) => (
          <line key={t.key} className={`g-tick${t.major ? " major" : ""}`} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
        ))}
        <path d={ARC} pathLength={100} className="g-value" strokeDasharray={`${v} 100`} opacity={v < 0.4 ? 0 : 1} />
      </svg>
      <div className="g-num">
        <b>{unknown ? "–" : Math.round(v)}</b>
        <small>{unknown ? "not enough data" : caption}</small>
      </div>
    </div>
  );
}
