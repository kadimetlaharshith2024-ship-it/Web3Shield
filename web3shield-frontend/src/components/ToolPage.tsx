import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Info } from "lucide-react";
import { useApp } from "../context/App";
import { DEMO_SAMPLES } from "../lib/mock";
import type { ToolKind } from "../lib/types";
import { detectInput, type InputKind, type Tone } from "../lib/utils";
import { ScanInput, type Accept } from "./ScanInput";
import { Banner, Busy, ErrorBanner, useRunner, useScrollTo } from "./ui";

const LIVE_EXAMPLES = [
  { label: "Vitalik's wallet", value: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
  { label: "USDT contract", value: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
  { label: "Uniswap V2 router", value: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" },
];

interface Props<R> {
  kind: ToolKind;
  title: string;
  intro: string;
  accept: Accept[];
  placeholder: string;
  cta: string;
  inputLabel: string;
  busyLabel?: string;
  call: (value: string) => Promise<R>;
  render: (result: R) => ReactNode;
  summarize: (result: R, value: string) => { verdict: string; tone: Tone; score: number | null; target?: string };
  /** extra controls shown inside the scanner card, under the input */
  controls?: (kind: InputKind) => ReactNode;
  /** what to fill in when a sample chip is clicked */
  samples?: "address" | "tx" | "none";
  idle?: ReactNode;
}

export function ToolPage<R>({ kind, title, intro, accept, placeholder, cta, inputLabel, busyLabel, call, render, summarize, controls, samples = "address", idle }: Props<R>) {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const inputKind = detectInput(value);

  const runner = useRunner(call, (result, [v]) => {
    const s = summarize(result, v);
    app.addHistory({ kind, target: s.target ?? v, verdict: s.verdict, tone: s.tone, score: s.score, report: result });
  });
  const resultRef = useScrollTo(runner.state === "done");

  // Links from other pages (?q=0x...) run straight away.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    const q = params.get("q");
    if (!q) return;
    autoRan.current = true;
    const k = detectInput(q);
    if ((k === "address" || k === "tx") && accept.includes(k)) void runner.run(q.trim());
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = runner.state === "busy";
  const submit = () => void runner.run(value.trim());

  return (
    <>
      <header className="page-head">
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>

      {app.demo && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="medium" title="Demo mode is on">
            Results are sample data, not from your backend. The last character of what you paste picks the story: 0 to 5 looks clean, 6 to 9 moderate, a to f critical.
          </Banner>
        </div>
      )}

      <ScanInput value={value} onChange={setValue} onSubmit={submit} busy={busy} accept={accept} placeholder={placeholder} cta={cta} label={inputLabel}>
        {controls?.(inputKind)}
      </ScanInput>

      {samples !== "none" && !busy && (
        <div className="samples">
          <span>{app.demo ? "Try a sample:" : "Try an example:"}</span>
          {app.demo
            ? DEMO_SAMPLES.map((s) => (
                <button key={s.label} type="button" className="sample-chip" onClick={() => setValue(samples === "tx" ? s.tx : s.address)}>
                  {s.label}
                </button>
              ))
            : samples === "address"
              ? LIVE_EXAMPLES.map((s) => (
                  <button key={s.label} type="button" className="sample-chip" onClick={() => setValue(s.value)}>
                    {s.label}
                  </button>
                ))
              : (
                <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <Info size={14} /> copy any transaction hash from Etherscan
                </span>
              )}
        </div>
      )}

      <div ref={resultRef} style={{ scrollMarginTop: 16 }}>
        {busy && <Busy label={busyLabel} />}
        {runner.state === "error" && (
          <div style={{ marginTop: 30 }}>
            <ErrorBanner error={runner.error} onRetry={runner.retry} onDemo={() => app.setDemo(true)} />
          </div>
        )}
        {runner.state === "done" && runner.data !== null && render(runner.data)}
      </div>

      {runner.state === "idle" && idle}
    </>
  );
}
