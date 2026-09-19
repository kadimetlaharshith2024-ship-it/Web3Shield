import type {
  AccessReport,
  ContractCheck,
  DetectionResult,
  DetectorInfo,
  ScanReport,
  ScanRequest,
  TxReport,
  User,
  WalletReport,
} from "./types";
import { computeScore, overallSeverity } from "./utils";

/**
 * Demo mode: the last hex character of what you type picks the story.
 *   0-5 -> clean,  6-9 -> moderate,  a-f -> critical
 * That makes it easy to show every state of the UI in a demo.
 */
export type Scenario = "clean" | "moderate" | "critical";

export const DEMO_SAMPLES: { label: string; scenario: Scenario; address: string; tx: string }[] = [
  {
    label: "Clean",
    scenario: "clean",
    address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96040",
    tx: "0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060",
  },
  {
    label: "Moderate",
    scenario: "moderate",
    address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F24888",
    tx: "0x88df016429689c079f3b2f6ad39fa052532c56795b733da78a91ebe6a7139448",
  },
  {
    label: "Critical",
    scenario: "critical",
    address: "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE",
    tx: "0xd6a9f1e07b3f4a5c9e0d1c2b3a49586776655443322110ffeeddccbbaa99887f",
  },
];

export function scenarioOf(input: string): Scenario {
  const c = (input.trim().slice(-1) || "0").toLowerCase();
  if ("012345".includes(c)) return "clean";
  if ("6789".includes(c)) return "moderate";
  return "critical";
}

// ---------------------------------------------------------------- helpers

function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function hex(seed: string, len: number): string {
  const r = rng(seed);
  let out = "0x";
  for (let i = 0; i < len; i++) out += Math.floor(r() * 16).toString(16);
  return out;
}

export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
export const demoDelay = () => sleep(900 + Math.random() * 700);

// ---------------------------------------------------------------- detectors

const DETECTORS: DetectorInfo[] = [
  { id: "D04", name: "Abnormal Gas & Calldata", className: "AbnormalTxDetector" },
  { id: "D06", name: "Reverted Transaction", className: "RevertedTxDetector" },
  { id: "D12", name: "Rapid Wallet Drain", className: "WalletDrainDetector" },
  { id: "D19", name: "Suspicious Burner Wallet", className: "BurnerWalletDetector" },
];

export function mockDetectors(): DetectorInfo[] {
  return DETECTORS;
}

const blockFor = (input: string) => 20418835 + Math.floor(rng(input)() * 9000);

function txResults(input: string, s: Scenario): DetectionResult[] {
  const sender = hex(input + "s", 40);
  if (s === "clean") {
    return [
      {
        detectorId: "D04",
        detectorName: "Abnormal Gas & Calldata",
        triggered: false,
        severity: "INFO",
        confidence: 0,
        dataQuality: "FULL",
        summary: "Gas and calldata size are in line with earlier transactions to this contract.",
        evidence: [{ label: "baseline", value: "174 successful past transactions to this contract" }],
      },
      {
        detectorId: "D06",
        detectorName: "Reverted Transaction",
        triggered: false,
        severity: "INFO",
        confidence: 0,
        dataQuality: "FULL",
        summary: "The transaction succeeded, so there is no revert to investigate.",
        evidence: [{ label: "status", value: "0x1 (success)" }],
      },
    ];
  }
  if (s === "moderate") {
    return [
      {
        detectorId: "D04",
        detectorName: "Abnormal Gas & Calldata",
        triggered: true,
        severity: "MEDIUM",
        confidence: 0.72,
        dataQuality: "FULL",
        summary: "Calldata is about 9x larger than typical calls to this contract. That can hide extra hidden transfers.",
        evidence: [
          { label: "baseline", value: "174 successful past transactions to this contract" },
          { label: "calldataBytes", value: "4,196 (median 452)" },
          { label: "gasUsed", value: "812,340 (median 141,020)" },
        ],
      },
      {
        detectorId: "D06",
        detectorName: "Reverted Transaction",
        triggered: false,
        severity: "INFO",
        confidence: 0,
        dataQuality: "FULL",
        summary: "The transaction succeeded, so there is no revert to investigate.",
        evidence: [{ label: "status", value: "0x1 (success)" }],
      },
    ];
  }
  return [
    {
      detectorId: "D04",
      detectorName: "Abnormal Gas & Calldata",
      triggered: true,
      severity: "HIGH",
      confidence: 0.84,
      dataQuality: "FULL",
      summary: "Gas use is 14x the norm for this contract, which matches the pattern of a multi-step drain.",
      evidence: [
        { label: "baseline", value: "174 successful past transactions to this contract" },
        { label: "gasUsed", value: "2,014,220 (median 141,020)" },
        { label: "from", value: sender },
      ],
    },
    {
      detectorId: "D06",
      detectorName: "Reverted Transaction",
      triggered: true,
      severity: "CRITICAL",
      confidence: 0.91,
      dataQuality: "FULL",
      summary: "The transaction reverted after the sender had already failed 4 times in a row. This is typical of probing for a weak spot.",
      evidence: [
        { label: "status", value: "0x0 (reverted)" },
        { label: "block", value: String(blockFor(input)) },
        { label: "gas", value: "412,884 used of 500,000 limit" },
        { label: "revertReason", value: "Ownable: caller is not the owner" },
        { label: "revertSelector", value: "0x08c379a0" },
        { label: "repeatedFailures", value: "4" },
      ],
    },
  ];
}

function walletResults(input: string, s: Scenario): DetectionResult[] {
  if (s === "clean") {
    return [
      {
        detectorId: "D12",
        detectorName: "Rapid Wallet Drain",
        triggered: false,
        severity: "INFO",
        confidence: 0,
        dataQuality: "FULL",
        summary: "No burst of token outflows found in this wallet's recent history.",
        evidence: [],
      },
      {
        detectorId: "D19",
        detectorName: "Suspicious Burner Wallet",
        triggered: false,
        severity: "INFO",
        confidence: 0,
        dataQuality: "FULL",
        summary: "The wallet is old and has steady activity. It does not look like a throwaway.",
        evidence: [
          { label: "WALLET_AGE", value: "41,208 hours (2,472,480 minutes)" },
          { label: "TRANSACTION_COUNT", value: "1,306" },
          { label: "CURRENT_BALANCE", value: "38.21 ETH" },
        ],
      },
    ];
  }
  const drain: DetectionResult =
    s === "critical"
      ? {
          detectorId: "D12",
          detectorName: "Rapid Wallet Drain",
          triggered: true,
          severity: "CRITICAL",
          confidence: 0.93,
          dataQuality: "FULL",
          summary: "Seven different tokens left this wallet within 94 seconds, all going to new accounts.",
          evidence: [
            { label: "DRAIN_CLUSTER", value: "7 token outflows detected within 94 seconds." },
            { label: "ASSETS_EVACUATED", value: "USDC, USDT, WETH, LINK, UNI, AAVE, stETH" },
            { label: "FIRST_OUTFLOW_TX", value: hex(input + "a", 64) },
            { label: "LAST_OUTFLOW_TX", value: hex(input + "b", 64) },
            { label: "DESTINATION_COUNT", value: "5 unique recipient accounts" },
          ],
        }
      : {
          detectorId: "D12",
          detectorName: "Rapid Wallet Drain",
          triggered: false,
          severity: "INFO",
          confidence: 0,
          dataQuality: "PARTIAL",
          summary: "No drain pattern found, but only a short history was available to check.",
          evidence: [],
        };
  const burner: DetectionResult = {
    detectorId: "D19",
    detectorName: "Suspicious Burner Wallet",
    triggered: true,
    severity: s === "critical" ? "HIGH" : "MEDIUM",
    confidence: s === "critical" ? 0.81 : 0.66,
    dataQuality: "FULL",
    summary:
      s === "critical"
        ? "The wallet is 3 hours old, was funded by one account, and moved almost everything out straight away."
        : "The wallet is less than a day old and was funded by a single account.",
    evidence: [
      { label: "WALLET_AGE", value: s === "critical" ? "3 hours (187 minutes)" : "19 hours (1,140 minutes)" },
      { label: "GENESIS_TX", value: hex(input + "g", 64) },
      { label: "SEED_FUNDER", value: hex(input + "f", 40) },
      { label: "CURRENT_BALANCE", value: "0.0021 ETH" },
      { label: "TRANSACTION_COUNT", value: s === "critical" ? "23" : "9" },
    ],
  };
  return [drain, burner];
}

// ---------------------------------------------------------------- reports

export function mockScan(req: ScanRequest): ScanReport {
  const seed = (req.address ?? "") + (req.txHash ?? "");
  const s = scenarioOf(req.txHash ?? req.address ?? "");
  const results: DetectionResult[] = [];
  const run: string[] = [];
  const skipped: string[] = [];

  if (req.txHash) {
    run.push("txanomaly");
    results.push(...txResults(req.txHash, s));
  } else skipped.push("txanomaly");

  if (req.address) {
    run.push("walletshield");
    results.push(...walletResults(req.address, s));
  } else skipped.push("walletshield");

  const inconclusive = results.filter((r) => r.dataQuality === "INCONCLUSIVE").length;
  return {
    scanId: crypto.randomUUID?.() ?? hex(seed, 32),
    scannedAt: new Date().toISOString(),
    request: { address: req.address ?? null, txHash: req.txHash ?? null },
    riskScore: computeScore(results),
    overallSeverity: overallSeverity(results),
    detectorsReported: results.length,
    detectorsInconclusive: inconclusive,
    modulesRun: run,
    modulesSkipped: skipped,
    note: inconclusive > 0 ? `${inconclusive} of ${results.length} detector result(s) were inconclusive. A low risk score does NOT mean the target is safe.` : "All reported detectors ran with data.",
    results,
  };
}

export function mockTx(txHash: string): TxReport {
  const s = scenarioOf(txHash);
  return {
    txHash,
    target: hex(txHash + "t", 40),
    blockNumber: blockFor(txHash),
    historySize: s === "clean" ? 174 : 200,
    results: txResults(txHash, s),
  };
}

export function mockWallet(address: string): WalletReport {
  const s = scenarioOf(address);
  const detections = walletResults(address, s);
  const drain = detections[0].triggered;
  const burner = detections[1].triggered;
  const score = Math.min(100, (drain ? 60 : 0) + (burner ? 30 : 0));
  const riskLevel = score >= 60 ? "CRITICAL" : score >= 30 ? "HIGH" : "LOW";
  return {
    targetAddress: address,
    isContract: false,
    riskLevel,
    riskScore: score,
    classification: score >= 30 ? "SUSPICIOUS_BEHAVIOR" : "STANDARD_ACTIVITY",
    warning:
      score >= 30
        ? "The account you are interacting with shows suspicious behavior. Please review the evidence carefully before proceeding."
        : "No significant anomalous patterns detected. Proceed with standard caution.",
    detections,
    consolidatedEvidence: detections.flatMap((d) => d.evidence),
  };
}

export function mockAccess(contract: string, blocks: number): AccessReport {
  const s = scenarioOf(contract);
  const latest = 20_845_120;
  const findings: AccessReport["findings"] = [];
  if (s === "critical") {
    findings.push({
      detector: "D16-OwnershipHijack",
      severity: "HIGH",
      message: `Ownership moved from ${hex(contract + "p", 40)} to ${hex(contract + "n", 40)} by a transaction sent by ${hex(contract + "x", 40)}, which is NOT the previous owner. Possible hijack (or a multisig/proxy; verify).`,
      txHash: hex(contract + "o", 64),
    });
    findings.push({
      detector: "D09-UnauthorizedMint",
      severity: "HIGH",
      message: "Minted 14.80% of total supply in this window, right after the ownership change.",
      txHash: hex(contract + "m", 64),
    });
  } else if (s === "moderate") {
    findings.push({
      detector: "D09-UnauthorizedMint",
      severity: "MEDIUM",
      message: "Minted 1.90% of total supply in this window. Owner minting can be legitimate, so check whether it was announced.",
      txHash: hex(contract + "m", 64),
    });
  }
  // A clean contract returns no findings, exactly like the real backend.
  const risk = findings.some((f) => f.severity === "HIGH") ? "HIGH" : findings.some((f) => f.severity === "MEDIUM") ? "MEDIUM" : "LOW";
  return { contract, fromBlock: latest - blocks, toBlock: latest, riskLevel: risk, findings };
}

export function mockContract(address: string): ContractCheck {
  const s = scenarioOf(address);
  const isContract = !address.toLowerCase().endsWith("0");
  return {
    address,
    contract: isContract,
    chainId: "1",
    bytecodeLength: isContract ? 24_576 + Math.floor(rng(address)() * 8000) : 0,
    proxy: s === "critical",
    implementationAddress: s === "critical" ? hex(address + "i", 40) : null,
  };
}

export function mockUser(email: string, name?: string): User {
  return {
    id: Math.floor(Math.random() * 900) + 100,
    email: email.trim().toLowerCase(),
    name: name?.trim() || email.split("@")[0],
    walletAddress: hex(email + "w", 40),
    createdAt: new Date().toISOString(),
  };
}

export const mockPrivateKey = (email: string) => hex(email + "k", 64);
