import type { DetectionResult, Severity } from "./types";

// Same patterns the backend enforces (ScanRequest.java / AccessController.java)
export const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
export const TX_RE = /^0x[0-9a-fA-F]{64}$/;

export type InputKind = "empty" | "address" | "tx" | "partial" | "invalid";

export function detectInput(raw: string): InputKind {
  const v = raw.trim();
  if (!v) return "empty";
  if (ADDRESS_RE.test(v)) return "address";
  if (TX_RE.test(v)) return "tx";
  if (/^0x[0-9a-fA-F]*$/.test(v) && v.length < 66) return "partial";
  return "invalid";
}

export function shorten(value: string, head = 6, tail = 4): string {
  if (!value) return "";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export const EXPLORER = "https://etherscan.io";

export function explorerUrl(value: string): string | null {
  if (TX_RE.test(value)) return `${EXPLORER}/tx/${value}`;
  if (ADDRESS_RE.test(value)) return `${EXPLORER}/address/${value}`;
  return null;
}

export function explorerBlockUrl(block: number | string): string {
  return `${EXPLORER}/block/${block}`;
}

export const SEVERITY_ORDER: Severity[] = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function severityRank(s: string): number {
  const i = SEVERITY_ORDER.indexOf(s.toUpperCase() as Severity);
  return i < 0 ? 0 : i;
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  INFO: "Info",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

/** Same maths as RiskScorer.java, used by demo data so it behaves like the real thing. */
export function computeScore(results: DetectionResult[]): number {
  const factor: Record<Severity, number> = { INFO: 0, LOW: 0.1, MEDIUM: 0.3, HIGH: 0.6, CRITICAL: 0.9 };
  let untouched = 1;
  for (const r of results) {
    if (r.triggered) untouched *= 1 - factor[r.severity] * r.confidence;
  }
  return Math.round((1 - untouched) * 100);
}

export function overallSeverity(results: DetectionResult[]): Severity {
  let worst: Severity = "INFO";
  for (const r of results) {
    if (r.triggered && severityRank(r.severity) > severityRank(worst)) worst = r.severity;
  }
  return worst;
}

/** Bands for the dial. Score → tone key used by CSS (data-tone). */
export type Tone = "clear" | "low" | "medium" | "high" | "critical" | "unknown";

export function toneForScore(score: number): Tone {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "clear";
}

export function toneForLevel(level: string): Tone {
  switch (level.toUpperCase()) {
    case "CRITICAL":
      return "critical";
    case "HIGH":
      return "high";
    case "MEDIUM":
      return "medium";
    case "LOW":
      return "clear";
    default:
      return "unknown";
  }
}

export function toneForSeverity(s: string): Tone {
  switch (s.toUpperCase()) {
    case "CRITICAL":
      return "critical";
    case "HIGH":
      return "high";
    case "MEDIUM":
      return "medium";
    case "LOW":
      return "low";
    default:
      return "unknown";
  }
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} d ago`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** A value worth linking / copying: addresses, tx hashes. */
export function isHexRef(v: string): boolean {
  return ADDRESS_RE.test(v) || TX_RE.test(v);
}

/** Turn DRAIN_CLUSTER / revertReason into "Drain cluster" / "Revert reason". */
export function humanizeLabel(label: string): string {
  if (!label) return "";
  const spaced = label
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
