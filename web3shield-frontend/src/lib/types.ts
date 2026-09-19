// These types mirror the Java records/classes in the Spring Boot backend.

export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type DataQuality = "FULL" | "PARTIAL" | "INCONCLUSIVE";

/** shared/model/Evidence.java */
export interface Evidence {
  label: string;
  value: string;
}

/** shared/model/DetectionResult.java: the unified output of every detector */
export interface DetectionResult {
  detectorId: string;
  detectorName: string;
  triggered: boolean;
  severity: Severity;
  confidence: number; // 0..1
  dataQuality: DataQuality;
  summary: string;
  evidence: Evidence[];
}

/** shared/model/ScanRequest.java */
export interface ScanRequest {
  address?: string | null;
  txHash?: string | null;
}

/** POST /api/v1/scans */
export interface ScanReport {
  scanId: string;
  scannedAt: string;
  request: ScanRequest;
  riskScore: number; // 0..100
  overallSeverity: Severity;
  detectorsReported: number;
  detectorsInconclusive: number;
  modulesRun: string[];
  modulesSkipped: string[];
  note: string;
  results: DetectionResult[];
}

/** GET /api/v1/tx/{hash}/analyze */
export interface TxReport {
  txHash: string;
  target: string | null;
  blockNumber: number | string;
  historySize: number;
  results: DetectionResult[];
}

/** GET /api/v1/wallets/{address}/analyze */
export interface WalletReport {
  targetAddress: string;
  isContract: boolean;
  riskLevel: "LOW" | "HIGH" | "CRITICAL" | "INCONCLUSIVE" | string;
  riskScore: number;
  classification: string;
  warning: string;
  detections: DetectionResult[];
  consolidatedEvidence: Evidence[];
}

/** accessguard Detector.Finding */
export interface AccessFinding {
  detector: string;
  severity: string; // INFO | MEDIUM | HIGH (free-form string on the backend)
  message: string;
  txHash: string | null;
}

/** GET /api/v1/access/{contract}/analyze */
export interface AccessReport {
  contract: string;
  fromBlock: number | string;
  toBlock: number | string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | string;
  findings: AccessFinding[];
}

/** GET /api/honeypot/check */
export interface ContractCheck {
  address: string;
  contract: boolean;
  chainId: string;
  bytecodeLength: number;
  proxy: boolean;
  implementationAddress: string | null;
}

/** GET /api/v1/scans/detectors */
export interface DetectorInfo {
  id: string;
  name: string;
  className: string;
}

/** auth/AuthController.java */
export interface User {
  id: number;
  email: string;
  name: string;
  walletAddress: string;
  createdAt: string;
}

export interface SignupResult {
  user: User;
  walletPrivateKey: string;
  warning: string;
}

export type ToolKind = "scan" | "tx" | "wallet" | "access" | "contract";
