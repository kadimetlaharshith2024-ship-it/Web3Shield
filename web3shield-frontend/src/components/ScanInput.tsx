import type { FormEvent, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2, Search, X } from "lucide-react";
import { detectInput, type InputKind } from "../lib/utils";

export type Accept = "address" | "tx";

const KIND_NAME: Record<Accept, string> = { address: "wallet or contract address", tx: "transaction hash" };
const KIND_LENGTH: Record<Accept, number> = { address: 42, tx: 66 };

export function describe(kind: InputKind, value: string, accept: Accept[]): { ok: boolean; text: string } | null {
  if (kind === "empty") return null;
  if (kind === "address" || kind === "tx") {
    if (accept.includes(kind)) return { ok: true, text: kind === "address" ? "Wallet or contract address" : "Transaction hash" };
    const need = accept.map((a) => KIND_NAME[a]).join(" or ");
    return { ok: false, text: `That's a ${kind === "address" ? "wallet or contract address" : "transaction hash"}. This check needs a ${need}.` };
  }
  if (kind === "partial") {
    const target = accept.length === 1 ? KIND_LENGTH[accept[0]] : value.trim().length < 42 ? 42 : 66;
    return { ok: false, text: `${value.trim().length} of ${target} characters. Keep pasting.` };
  }
  return { ok: false, text: "Doesn't look like an address or hash. They start with 0x and use only 0-9 and a-f." };
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  accept: Accept[];
  placeholder: string;
  cta: string;
  label: string;
  children?: ReactNode;
}

export function ScanInput({ value, onChange, onSubmit, busy, accept, placeholder, cta, label, children }: Props) {
  const kind = detectInput(value);
  const info = describe(kind, value, accept);
  const canSubmit = kind === "address" || kind === "tx" ? accept.includes(kind) : false;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (canSubmit && !busy) onSubmit();
  };

  return (
    <form className="scanner" data-busy={busy} onSubmit={submit} noValidate>
      <div className="scan-row">
        <div className="scan-input-wrap">
          <Search size={20} aria-hidden="true" />
          <label className="sr-only" htmlFor="scan-input">
            {label}
          </label>
          <input
            id="scan-input"
            className="input scan-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            inputMode="text"
            aria-describedby="scan-hint"
            aria-invalid={info ? !info.ok : undefined}
            disabled={busy}
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={!canSubmit || busy}>
          {busy ? <Loader2 size={18} className="spin" /> : null}
          {busy ? "Scanning" : cta}
        </button>
      </div>
      <div className="scan-meta" id="scan-hint" aria-live="polite">
        {info ? (
          <span className="kind-chip" data-ok={info.ok}>
            {info.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            {info.text}
          </span>
        ) : (
          <span>
            Paste {accept.map((a) => `a ${KIND_NAME[a]}`).join(" or ")}. Ethereum mainnet only.
          </span>
        )}
        {value && !busy && (
          <button type="button" className="linklike" onClick={() => onChange("")} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <X size={13} /> Clear
          </button>
        )}
      </div>
      {children}
    </form>
  );
}
