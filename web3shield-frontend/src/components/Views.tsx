import { Link } from "react-router-dom";
import { Blocks, FileCode2, GitBranch, ScanSearch, UserRound, Wallet } from "lucide-react";
import type { AccessReport, ContractCheck, DetectionResult, ScanReport, TxReport, WalletReport } from "../lib/types";
import { computeScore, explorerBlockUrl, formatDate, severityRank, shorten, toneForLevel, toneForScore, toneForSeverity, type Tone } from "../lib/utils";
import { Gauge } from "./Gauge";
import { FindingGroups, EvidenceList, tally } from "./Findings";
import { Banner, CopyButton, ExplorerLink, MessageText, SeverityBadge } from "./ui";

// ------------------------------------------------------------------ shared pieces

export function RefValue({ value, head = 8, tail = 6 }: { value: string; head?: number; tail?: number }) {
  return (
    <>
      <span className="mono" title={value}>
        {shorten(value, head, tail)}
      </span>
      <CopyButton value={value} />
      <ExplorerLink value={value} />
    </>
  );
}

interface Assessment {
  label: string;
  tone: Tone;
  blurb: string;
  unknown: boolean;
}

/** Turns detector results into the words on the verdict panel, without ever calling "no data" safe. */
export function assess(score: number, results: DetectionResult[], topSeverity?: string): Assessment {
  const c = tally(results);
  if (results.length > 0 && c.inconclusive === results.length) {
    return { label: "Couldn't assess", tone: "unknown", unknown: true, blurb: "None of the detectors had enough data to reach a conclusion. That is not a sign the target is safe." };
  }
  if (c.findings === 0) {
    return {
      label: "No threats found",
      tone: "clear",
      unknown: false,
      blurb: c.inconclusive > 0
        ? `Nothing suspicious turned up, but ${c.inconclusive} detector${c.inconclusive > 1 ? "s" : ""} couldn't run. Treat this result as partial.`
        : "Every detector ran with data and none of them flagged anything. Always stay careful with unfamiliar contracts.",
    };
  }
  const tone = toneForScore(score);
  const label = score >= 75 ? "Critical risk" : score >= 50 ? "High risk" : score >= 25 ? "Moderate risk" : "Low risk";
  const worst = topSeverity ?? results.filter((r) => r.triggered).sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0]?.severity;
  return {
    label,
    tone,
    unknown: false,
    blurb: `${c.findings} detector${c.findings > 1 ? "s" : ""} flagged something. The most serious finding is rated ${String(worst ?? "").toLowerCase()}, and the score weighs each finding by how confident its detector is.`,
  };
}

interface VerdictProps {
  score: number;
  a: Assessment;
  results: DetectionResult[];
  targets?: { label: string; value: string }[];
  when?: string;
}

function Verdict({ score, a, results, targets = [], when }: VerdictProps) {
  const c = tally(results);
  return (
    <section className="verdict" data-tone={a.tone} aria-label="Result summary">
      <Gauge score={score} tone={a.tone} unknown={a.unknown} />
      <div className="verdict-body">
        <div className="verdict-title">
          <h2>{a.label}</h2>
        </div>
        <p>{a.blurb}</p>
        {targets.map((t) => (
          <div className="verdict-target" key={t.label}>
            <span>{t.label}</span>
            <RefValue value={t.value} />
          </div>
        ))}
        {when && <div className="verdict-target faint">Scanned {formatDate(when)}</div>}
        <div className="tally">
          <div data-tone={c.findings ? "high" : undefined}>
            <b>{c.findings}</b>
            <span>{c.findings === 1 ? "finding" : "findings"}</span>
          </div>
          <div data-tone={c.clear ? "clear" : undefined}>
            <b>{c.clear}</b>
            <span>checked and clear</span>
          </div>
          <div>
            <b>{c.inconclusive}</b>
            <span>couldn't check</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ 1. unified scan

export function ScanView({ report }: { report: ScanReport }) {
  const a = assess(report.riskScore, report.results, report.overallSeverity);
  const targets = [
    ...(report.request.address ? [{ label: "Address", value: report.request.address }] : []),
    ...(report.request.txHash ? [{ label: "Transaction", value: report.request.txHash }] : []),
  ];
  const showNote = report.detectorsInconclusive > 0 || report.results.length === 0;

  return (
    <div className="result">
      <Verdict score={report.riskScore} a={a} results={report.results} targets={targets} when={report.scannedAt} />
      {showNote && <Banner tone="medium" title="Read this before trusting the score">{report.note}</Banner>}
      <FindingGroups results={report.results} />
      <section className="group">
        <div className="group-head">
          <h3>What ran</h3>
          <p>Each input is sent only to the modules that can use it.</p>
        </div>
        <div className="chips">
          {report.modulesRun.map((m) => (
            <span className="chip" key={m}>{m}</span>
          ))}
          {report.modulesSkipped.map((m) => (
            <span className="chip skipped" key={m} title="Didn't apply to this input">{m} (skipped)</span>
          ))}
        </div>
        <p className="faint mono" style={{ fontSize: 12.5 }}>Scan ID {report.scanId}</p>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ 2. transaction

export function TxView({ report }: { report: TxReport }) {
  const score = computeScore(report.results);
  const a = assess(score, report.results);
  return (
    <div className="result">
      <Verdict score={score} a={a} results={report.results} targets={[{ label: "Transaction", value: report.txHash }]} />
      <dl className="stat-grid">
        <div className="stat">
          <dt>Sent to</dt>
          <dd>{report.target ? <RefValue value={report.target} /> : "Contract creation (no recipient)"}</dd>
        </div>
        <div className="stat">
          <dt>Block</dt>
          <dd>
            <a href={explorerBlockUrl(report.blockNumber)} target="_blank" rel="noreferrer noopener">
              {Number(report.blockNumber).toLocaleString()}
            </a>
          </dd>
        </div>
        <div className="stat">
          <dt>Earlier transactions compared</dt>
          <dd className="big">{report.historySize.toLocaleString()}</dd>
        </div>
      </dl>
      <FindingGroups results={report.results} />
    </div>
  );
}

// ------------------------------------------------------------------ 3. wallet

export const WALLET_LABEL: Record<string, string> = { CRITICAL: "Critical risk", HIGH: "High risk", LOW: "Low risk", INCONCLUSIVE: "Couldn't assess" };

export function WalletView({ report }: { report: WalletReport }) {
  const tone = toneForLevel(report.riskLevel);
  const unknown = report.riskLevel === "INCONCLUSIVE";
  const a: Assessment = {
    label: WALLET_LABEL[report.riskLevel] ?? report.riskLevel,
    tone,
    unknown,
    blurb: report.warning.replace(/^⚠️\s*/, ""),
  };
  return (
    <div className="result">
      <Verdict score={report.riskScore} a={a} results={report.detections} targets={[{ label: "Wallet", value: report.targetAddress }]} />
      {report.isContract && (
        <Banner tone="medium" title="This address is a contract, not a personal wallet">
          Wallet checks look for drain and burner patterns, which mostly apply to personal wallets. Use the Contract and Access pages for contracts.
        </Banner>
      )}
      <FindingGroups results={report.detections} />
      {report.consolidatedEvidence.length > 0 && (
        <details className="disclosure">
          <summary>All evidence in one list ({report.consolidatedEvidence.length})</summary>
          <EvidenceList evidence={report.consolidatedEvidence} />
        </details>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ 4. access guard

const LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;

export function AccessView({ report }: { report: AccessReport }) {
  const level = report.riskLevel.toUpperCase();
  const tone = toneForLevel(level);
  const rank = Math.max(0, LEVELS.indexOf(level as (typeof LEVELS)[number])) + 1;
  const findings = [...report.findings].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  const real = findings.filter((f) => severityRank(f.severity) > 0);
  const range = Number(report.toBlock) - Number(report.fromBlock);

  const headline =
    level === "HIGH" ? "Signs of an ownership or minting attack" : level === "MEDIUM" ? "Some activity is worth a closer look" : "No access-control problems found";
  const blurb =
    findings.length === 0
      ? `No ownership changes or suspicious minting turned up in the last ${range.toLocaleString()} blocks. If the blockchain node was rate-limited the backend skips checks silently, so a wider range is a good second opinion.`
      : `Looked at ${range.toLocaleString()} recent blocks for ownership changes and unauthorized minting. ${real.length ? `${real.length} finding${real.length > 1 ? "s" : ""} need attention.` : "Nothing needs attention."}`;

  return (
    <div className="result">
      <section className="verdict" data-tone={tone} aria-label="Result summary">
        <div className="level">
          <div className="level-word">{level.charAt(0) + level.slice(1).toLowerCase()}</div>
          <div className="level-meter" aria-hidden="true">
            {LEVELS.map((l, i) => (
              <i key={l} data-on={i < rank} />
            ))}
          </div>
          <div className="level-labels" aria-hidden="true">
            <span>Low</span>
            <span>Medium</span>
            <span>High</span>
          </div>
        </div>
        <div className="verdict-body">
          <div className="verdict-title">
            <h2>{headline}</h2>
          </div>
          <p>{blurb}</p>
          <div className="verdict-target">
            <span>Contract</span>
            <RefValue value={report.contract} />
          </div>
        </div>
      </section>

      <dl className="stat-grid">
        <div className="stat">
          <dt>From block</dt>
          <dd className="big">{Number(report.fromBlock).toLocaleString()}</dd>
        </div>
        <div className="stat">
          <dt>To block</dt>
          <dd className="big">{Number(report.toBlock).toLocaleString()}</dd>
        </div>
        <div className="stat">
          <dt>Blocks checked</dt>
          <dd className="big">{range.toLocaleString()}</dd>
        </div>
      </dl>

      {findings.length > 0 && (
        <section className="group">
          <div className="group-head">
            <h3>What the detectors saw</h3>
            <p>Most serious first.</p>
          </div>
          <ol className="timeline">
            {findings.map((f, i) => {
              const t = toneForSeverity(f.severity);
              return (
                <li key={i} data-tone={t}>
                  <span className="pin"><i /></span>
                  <div className="t-card">
                    <div className="t-head">
                      <SeverityBadge severity={f.severity} />
                      <code>{f.detector}</code>
                    </div>
                    <p><MessageText text={f.message} /></p>
                    {f.txHash && (
                      <div className="tx-line">
                        <span>Transaction</span>
                        <RefValue value={f.txHash} head={10} tail={8} />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ 5. contract check

function networkName(id: string) {
  const names: Record<string, string> = { "1": "Ethereum Mainnet", "11155111": "Sepolia testnet", "5": "Goerli testnet", "137": "Polygon", "42161": "Arbitrum One", "10": "Optimism", "8453": "Base" };
  return names[id] ?? `Chain ID ${id}`;
}

function formatBytes(hexLength: number) {
  const bytes = Math.max(0, Math.floor((hexLength - 2) / 2));
  return { bytes, kb: (bytes / 1024).toFixed(1) };
}

export function ContractView({ report }: { report: ContractCheck }) {
  const tone: Tone = report.proxy ? "medium" : report.contract ? "low" : "unknown";
  const size = formatBytes(report.bytecodeLength);
  const Icon = report.contract ? FileCode2 : UserRound;
  return (
    <div className="result">
      <section className="verdict" data-tone={tone} aria-label="Result summary">
        <div className="contract-icon">
          <Icon size={44} />
        </div>
        <div className="verdict-body">
          <div className="verdict-title">
            <h2>{report.contract ? (report.proxy ? "A smart contract behind a proxy" : "A smart contract") : "A regular wallet, no code"}</h2>
          </div>
          <p>
            {report.contract
              ? report.proxy
                ? "Calls to this address are forwarded to another contract, and whoever controls the proxy may be able to change that target later."
                : "There is code deployed at this address. It behaves the way that code says it does."
              : "No code is deployed here, so this is an ordinary account controlled by a private key."}
          </p>
          <div className="verdict-target">
            <span>Address</span>
            <RefValue value={report.address} />
          </div>
        </div>
      </section>

      <dl className="stat-grid">
        <div className="stat">
          <dt>Type</dt>
          <dd>{report.contract ? "Smart contract" : "Wallet (externally owned)"}</dd>
        </div>
        <div className="stat">
          <dt>Proxy</dt>
          <dd>{report.contract ? (report.proxy ? "Yes" : "No") : "Not applicable"}</dd>
        </div>
        {report.proxy && report.implementationAddress && (
          <div className="stat">
            <dt>Runs code from</dt>
            <dd><RefValue value={report.implementationAddress} /></dd>
          </div>
        )}
        <div className="stat">
          <dt>Code size</dt>
          <dd>{report.contract ? `${size.bytes.toLocaleString()} bytes (${size.kb} KB)` : "None"}</dd>
        </div>
        <div className="stat">
          <dt>Network</dt>
          <dd>{networkName(report.chainId)}</dd>
        </div>
      </dl>

      <Banner tone="unknown" title="What this check can and can't tell you">
        It reads the code stored at the address. It doesn't simulate buying and selling, so it can't confirm a honeypot on its own. Run the other checks for a fuller picture.
      </Banner>

      <div className="actions">
        <Link className="btn btn-primary" to={`/?q=${report.address}`}><ScanSearch size={18} /> Run a full scan</Link>
        {report.contract && <Link className="btn" to={`/access?q=${report.address}`}><Blocks size={18} /> Check access controls</Link>}
        {!report.contract && <Link className="btn" to={`/wallet?q=${report.address}`}><Wallet size={18} /> Check wallet behavior</Link>}
        {report.proxy && report.implementationAddress && (
          <Link className="btn" to={`/contract?q=${report.implementationAddress}`}><GitBranch size={18} /> Check the implementation</Link>
        )}
      </div>
    </div>
  );
}

