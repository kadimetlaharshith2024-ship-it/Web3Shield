import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, HelpCircle, Info, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { ApiError } from "../lib/api";
import { SEVERITY_LABEL, explorerUrl, shorten, toneForSeverity, type Tone } from "../lib/utils";
import type { Severity } from "../lib/types";

// ------------------------------------------------------------------ logo

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--bg)" stroke="var(--line)" />
      <path d="M16 5.5l9 3.4v7.1c0 5-3.5 8.9-9 11.2-5.5-2.3-9-6.2-9-11.2V8.9z" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M11.6 16l3.1 3.1 5.9-6.2" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ------------------------------------------------------------------ toast

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  const next = useRef(1);
  const push = useCallback((msg: string) => {
    const id = next.current++;
    setItems((prev) => [...prev, { id, msg }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 2200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-host" role="status" aria-live="polite">
        {items.map((t) => (
          <div className="toast" key={t.id}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ------------------------------------------------------------------ copy / explorer

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function CopyButton({ value, label = "Copy", className = "ref-btn" }: { value: string; label?: string; className?: string }) {
  const toast = useToast();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      title={label}
      onClick={async (e) => {
        e.stopPropagation();
        if (await copyText(value)) {
          setDone(true);
          toast("Copied to clipboard");
          setTimeout(() => setDone(false), 1400);
        }
      }}
    >
      {done ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}

export function ExplorerLink({ value }: { value: string }) {
  const url = explorerUrl(value);
  if (!url) return null;
  return (
    <a className="ref-btn" href={url} target="_blank" rel="noreferrer noopener" aria-label="Open on Etherscan" title="Open on Etherscan" onClick={(e) => e.stopPropagation()}>
      <ExternalLink size={15} />
    </a>
  );
}

/** Backend messages often embed full 42-char addresses. Shorten them so sentences stay readable. */
export function MessageText({ text }: { text: string }) {
  const parts = text.split(/(0x[0-9a-fA-F]{40}(?![0-9a-fA-F]))/g);
  return (
    <>
      {parts.map((part, i) =>
        /^0x[0-9a-fA-F]{40}$/.test(part) ? (
          <a key={i} className="mono" href={explorerUrl(part) ?? undefined} target="_blank" rel="noreferrer noopener" title={part}>
            {shorten(part, 8, 6)}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

// ------------------------------------------------------------------ badges

export function SeverityBadge({ severity }: { severity: string }) {
  const s = severity.toUpperCase() as Severity;
  const tone = toneForSeverity(s);
  const label = SEVERITY_LABEL[s] ?? severity;
  const Icon = tone === "critical" || tone === "high" ? ShieldAlert : AlertTriangle;
  return (
    <span className="badge" data-tone={tone === "unknown" ? "unknown" : tone}>
      <Icon size={14} /> {label}
    </span>
  );
}

export function StateBadge({ kind }: { kind: "clear" | "inconclusive" }) {
  return kind === "clear" ? (
    <span className="badge" data-tone="clear">
      <CheckCircle2 size={14} /> Clear
    </span>
  ) : (
    <span className="badge" data-tone="unknown">
      <HelpCircle size={14} /> Couldn't check
    </span>
  );
}

// ------------------------------------------------------------------ banners

export function Banner({ tone = "unknown", title, children, actions }: { tone?: Tone; title?: string; children?: ReactNode; actions?: ReactNode }) {
  const Icon = tone === "critical" ? XCircle : tone === "medium" || tone === "high" ? AlertTriangle : tone === "clear" ? CheckCircle2 : Info;
  return (
    <div className="banner" data-tone={tone} role={tone === "critical" ? "alert" : undefined}>
      <Icon size={20} />
      <div>
        {title && <b>{title}</b>}
        {children && <p>{children}</p>}
        {actions && <div className="banner-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function ErrorBanner({ error, onRetry, onDemo }: { error: unknown; onRetry?: () => void; onDemo?: () => void }) {
  const e = error instanceof ApiError ? error : null;
  const message = e ? e.message : error instanceof Error ? error.message : "Something went wrong.";
  const offline = e?.status === 0;
  return (
    <Banner
      tone="critical"
      title={offline ? "Backend not reachable" : "The scan didn't finish"}
      actions={
        <>
          {onRetry && (
            <button className="btn btn-sm" onClick={onRetry}>
              Try again
            </button>
          )}
          {offline && onDemo && (
            <button className="btn btn-sm btn-primary" onClick={onDemo}>
              Switch to demo mode
            </button>
          )}
        </>
      }
    >
      {message}
    </Banner>
  );
}

// ------------------------------------------------------------------ busy

export function Busy({ label = "Running detectors" }: { label?: string }) {
  return (
    <div className="busy" aria-live="polite" aria-busy="true">
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-2)" }}>
        <Loader2 size={18} className="spin" />
        <span>{label}. Reading from the blockchain can take up to half a minute.</span>
      </div>
      <div className="skeleton" style={{ height: 230 }} />
      <div className="skeleton" style={{ height: 86 }} />
      <div className="skeleton" style={{ height: 86, opacity: 0.6 }} />
    </div>
  );
}

// ------------------------------------------------------------------ hooks

/** Runs an async tool call and tracks idle / busy / done / error. */
export function useRunner<A extends unknown[], R>(fn: (...args: A) => Promise<R>, onDone?: (result: R, args: A) => void) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [data, setData] = useState<R | null>(null);
  const [error, setError] = useState<unknown>(null);
  const lastArgs = useRef<A | null>(null);
  const ticket = useRef(0);

  const run = useCallback(
    async (...args: A) => {
      const mine = ++ticket.current;
      lastArgs.current = args;
      setState("busy");
      setError(null);
      try {
        const result = await fn(...args);
        if (mine !== ticket.current) return;
        setData(result);
        setState("done");
        onDone?.(result, args);
      } catch (err) {
        if (mine !== ticket.current) return;
        setError(err);
        setState("error");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn],
  );

  const retry = useCallback(() => {
    if (lastArgs.current) void run(...lastArgs.current);
  }, [run]);

  const reset = useCallback(() => {
    ticket.current++;
    setState("idle");
    setData(null);
    setError(null);
  }, []);

  return { state, data, error, run, retry, reset };
}

/** Scroll the results into view once they arrive. */
export function useScrollTo(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [active]);
  return ref;
}
