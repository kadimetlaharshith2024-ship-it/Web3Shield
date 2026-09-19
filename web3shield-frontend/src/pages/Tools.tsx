import { useState, type ReactNode } from "react";
import { useApp } from "../context/App";
import { api } from "../lib/api";
import type { AccessReport, ContractCheck, ScanReport, TxReport, WalletReport } from "../lib/types";
import { computeScore, detectInput, toneForLevel, type Tone } from "../lib/utils";
import { ToolPage } from "../components/ToolPage";
import { AccessView, ContractView, ScanView, TxView, WALLET_LABEL, WalletView, assess } from "../components/Views";

// ------------------------------------------------------------------ "what gets checked" panel

function Checks({ title, note, items }: { title: string; note?: string; items: { id: string; text: string }[] }) {
  return (
    <section className="engines">
      <div className="group-head">
        <h3>{title}</h3>
        {note && <p>{note}</p>}
      </div>
      <div className="engine-list">
        {items.map((i) => (
          <div className="engine" key={i.id}>
            <code>{i.id}</code>
            <span>{i.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ 1. full scan

export function ScanPage() {
  const app = useApp();
  const [tx, setTx] = useState("");
  const [showTx, setShowTx] = useState(false);
  const txKind = detectInput(tx);
  const txInvalid = tx.trim() !== "" && txKind !== "tx";

  const call = (value: string): Promise<ScanReport> => {
    const kind = detectInput(value);
    if (kind === "tx") return api.runUnifiedScan(undefined, value);
    if (txInvalid) return Promise.reject(new Error("The optional transaction hash isn't valid. It should be 0x followed by 64 hex characters."));
    return api.runUnifiedScan(value, tx.trim() || undefined);
  };

  const detectors = app.detectors.map((d) => ({ id: d.id, text: d.name }));

  return (
    <ToolPage<ScanReport>
      kind="scan"
      title="Check anything on Ethereum before you trust it"
      intro="Paste a wallet, contract or transaction. Web3Shield runs every detector that applies and shows the on-chain proof behind each finding."
      accept={["address", "tx"]}
      placeholder="0x… address or transaction hash"
      cta="Scan"
      inputLabel="Wallet, contract address or transaction hash"
      busyLabel="Running every detector that applies"
      call={call}
      render={(r) => <ScanView report={r} />}
      summarize={(r) => {
        const a = assess(r.riskScore, r.results, r.overallSeverity);
        return { verdict: a.label, tone: a.tone, score: a.unknown ? null : r.riskScore, target: r.request.address ?? r.request.txHash ?? "" };
      }}
      controls={(kind) =>
        kind === "address" ? (
          showTx ? (
            <div className="field">
              <label htmlFor="scan-tx">Transaction hash (optional)</label>
              <input id="scan-tx" className="input mono" value={tx} onChange={(e) => setTx(e.target.value)} placeholder="0x… 64 characters" spellCheck={false} autoComplete="off" aria-invalid={txInvalid} />
              {txInvalid ? <span className="error-text">A transaction hash is 0x followed by 64 hex characters.</span> : <span className="hint">Scanned together with the address, in one report.</span>}
            </div>
          ) : (
            <div>
              <button type="button" className="linklike" onClick={() => setShowTx(true)}>
                Also scan a transaction with this address
              </button>
            </div>
          )
        ) : null
      }
      idle={
        detectors.length > 0 ? (
          <Checks title={app.demo ? "Detectors (sample list)" : "Detectors on your backend"} note={app.demo ? "Demo mode shows a sample list." : "Loaded live from /api/v1/scans/detectors."} items={detectors} />
        ) : (
          <Checks
            title="What gets checked"
            items={[
              { id: "Transactions", text: "Unusual gas or calldata, and reverts that hint at probing" },
              { id: "Wallets", text: "Fast drains and brand-new burner wallets" },
              { id: "Contracts", text: "Ownership changes, unauthorized minting and proxy setups" },
            ]}
          />
        )
      }
    />
  );
}

// ------------------------------------------------------------------ 2. transaction

export function TxPage() {
  return (
    <ToolPage<TxReport>
      kind="tx"
      title="Transaction analyzer"
      intro="Check one transaction for odd gas use, suspicious calldata, and reverts that look like someone probing a contract."
      accept={["tx"]}
      placeholder="0x… transaction hash (66 characters)"
      cta="Analyze"
      inputLabel="Transaction hash"
      busyLabel="Fetching the transaction and its history"
      samples="tx"
      call={api.analyzeTx}
      render={(r) => <TxView report={r} />}
      summarize={(r) => {
        const score = computeScore(r.results);
        const a = assess(score, r.results);
        return { verdict: a.label, tone: a.tone, score: a.unknown ? null : score, target: r.txHash };
      }}
      idle={
        <Checks
          title="What gets checked"
          items={[
            { id: "D04", text: "Compares gas and calldata size with earlier transactions to the same contract" },
            { id: "D06", text: "Replays failed transactions to see why they reverted and whether the sender keeps failing" },
          ]}
        />
      }
    />
  );
}

// ------------------------------------------------------------------ 3. wallet

export function WalletPage() {
  return (
    <ToolPage<WalletReport>
      kind="wallet"
      title="Wallet shield"
      intro="Before you send funds to an account, see whether its history looks like a drain or a throwaway burner wallet."
      accept={["address"]}
      placeholder="0x… wallet address (42 characters)"
      cta="Check wallet"
      inputLabel="Wallet address"
      busyLabel="Reading the wallet's transfer history"
      call={api.analyzeWallet}
      render={(r) => <WalletView report={r} />}
      summarize={(r) => ({
        verdict: WALLET_LABEL[r.riskLevel] ?? r.riskLevel,
        tone: toneForLevel(r.riskLevel),
        score: r.riskLevel === "INCONCLUSIVE" ? null : r.riskScore,
        target: r.targetAddress,
      })}
      idle={
        <Checks
          title="What gets checked"
          items={[
            { id: "D12", text: "Three or more token transfers leaving the wallet within a five-minute window" },
            { id: "D19", text: "Wallets under a day old that moved funds out fast or are almost empty" },
          ]}
        />
      }
    />
  );
}

// ------------------------------------------------------------------ 4. access guard

const RANGES = [
  { blocks: 100, label: "100", hint: "about 20 minutes" },
  { blocks: 1000, label: "1,000", hint: "about 3 hours" },
  { blocks: 5000, label: "5,000", hint: "about 17 hours" },
];

export function AccessPage() {
  const [blocks, setBlocks] = useState(1000);
  const current = RANGES.find((r) => r.blocks === blocks);
  return (
    <ToolPage<AccessReport>
      kind="access"
      title="Access guard"
      intro="Look for ownership takeovers and surprise minting on a contract. Tokens and vaults are common targets."
      accept={["address"]}
      placeholder="0x… contract address (42 characters)"
      cta="Check contract"
      inputLabel="Contract address"
      busyLabel="Scanning recent blocks for ownership and mint events"
      call={(v) => api.checkAccessControl(v, blocks)}
      render={(r) => <AccessView report={r} />}
      summarize={(r) => {
        const level = r.riskLevel.toUpperCase();
        return { verdict: `${level.charAt(0)}${level.slice(1).toLowerCase()} risk`, tone: toneForLevel(level) as Tone, score: null, target: r.contract };
      }}
      controls={() => (
        <div className="range">
          <span className="label">Look back</span>
          <div className="seg" role="group" aria-label="Number of blocks to check">
            {RANGES.map((r) => (
              <button key={r.blocks} type="button" aria-pressed={blocks === r.blocks} onClick={() => setBlocks(r.blocks)}>
                {r.label} blocks
              </button>
            ))}
          </div>
          <span className="hint">{current?.hint}. Longer ranges take more time.</span>
        </div>
      )}
      idle={
        <Checks
          title="What gets checked"
          items={[
            { id: "D16", text: "Ownership moved by someone other than the previous owner, or set again from the zero address" },
            { id: "D09", text: "How much of the token supply was minted in the range you pick" },
          ]}
        />
      }
    />
  );
}

// ------------------------------------------------------------------ 5. contract check

export function ContractPage(): ReactNode {
  return (
    <ToolPage<ContractCheck>
      kind="contract"
      title="Contract check"
      intro="Find out whether an address is a smart contract or a plain wallet, and whether it hides behind a proxy."
      accept={["address"]}
      placeholder="0x… address (42 characters)"
      cta="Check address"
      inputLabel="Contract or wallet address"
      busyLabel="Reading the code stored at the address"
      call={api.checkHoneypot}
      render={(r) => <ContractView report={r} />}
      summarize={(r) => ({
        verdict: r.contract ? (r.proxy ? "Proxy contract" : "Smart contract") : "Wallet, no code",
        tone: r.proxy ? "medium" : "unknown",
        score: null,
        target: r.address,
      })}
      idle={
        <Checks
          title="What gets checked"
          items={[
            { id: "Code", text: "Whether any code is deployed at the address" },
            { id: "Proxy", text: "Reads the standard proxy storage slot to find the contract it forwards to" },
          ]}
        />
      }
    />
  );
}
