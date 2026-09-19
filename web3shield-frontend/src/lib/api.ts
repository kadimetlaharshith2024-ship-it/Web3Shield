import type {
  AccessReport,
  ContractCheck,
  DetectorInfo,
  ScanReport,
  ScanRequest,
  SignupResult,
  TxReport,
  User,
  WalletReport,
} from "./types";
import * as mock from "./mock";

export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "http://localhost:8085";

/** Thrown for every failed call so the UI can show one friendly message. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// ------------------------------------------------------------------ demo mode
// The Settings context flips this. When on, nothing touches the network.
let demoMode = false;
export const setDemoMode = (on: boolean) => {
  demoMode = on;
};
export const isDemoMode = () => demoMode;

// ------------------------------------------------------------------ plumbing

type Overrides = Partial<Record<number, string>>;

const DEFAULT_MESSAGES: Record<number, string> = {
  400: "The backend rejected that input. Check the address or hash and try again.",
  401: "Wrong email or password.",
  404: "Nothing was found for that input on Ethereum mainnet.",
  409: "That email is already registered.",
  429: "Too many requests. Wait a few seconds and try again.",
  500: "The backend hit an error while running the scan. Check its console for details.",
  502: "The backend could not reach the blockchain node. Check the Alchemy URL in its settings.",
  503: "The backend is temporarily unavailable. Try again in a moment.",
};

async function readMessage(res: Response): Promise<string | null> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    const body = JSON.parse(text);
    // Spring's default error body has {timestamp,status,error,path}: "error" is just "Bad Request".
    // A custom body (AccessController) has only {error: "..."}, which IS useful.
    if (typeof body.message === "string" && body.message.trim()) return body.message;
    if (typeof body.error === "string" && body.status === undefined) return body.error;
    return null;
  } catch {
    // Plain-text bodies (HoneypotController)
    return text.length < 240 ? text : null;
  }
}

async function request<T>(path: string, init: RequestInit = {}, overrides: Overrides = {}, timeoutMs = 60_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new ApiError("The scan is taking too long. The blockchain node may be slow, so try again.", 0);
    }
    throw new ApiError(`Can't reach the Web3Shield backend at ${API_BASE}. Make sure it's running.`, 0);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const serverMessage = await readMessage(res);
    const message = overrides[res.status] ?? serverMessage ?? DEFAULT_MESSAGES[res.status] ?? `Request failed (${res.status}).`;
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// Jackson turns isContract()/isProxy() getters into "contract"/"proxy",
// and record components into "isContract". Accept both so the UI never breaks.
function normalizeWallet(r: WalletReport & { contract?: boolean }): WalletReport {
  return { ...r, isContract: r.isContract ?? r.contract ?? false, detections: r.detections ?? [], consolidatedEvidence: r.consolidatedEvidence ?? [] };
}
function normalizeContract(r: ContractCheck & { isContract?: boolean; isProxy?: boolean }): ContractCheck {
  return { ...r, contract: r.contract ?? r.isContract ?? false, proxy: r.proxy ?? r.isProxy ?? false, implementationAddress: r.implementationAddress ?? null };
}

// ------------------------------------------------------------------ the API

export const api = {
  // ---- Authentication (POST /api/auth/*)
  // NOTE: the backend has no sessions or tokens yet. login() just proves the
  // credentials and returns the profile, so the frontend keeps that profile locally.
  signup: async (email: string, password: string, name?: string): Promise<SignupResult> => {
    if (demoMode) {
      await mock.demoDelay();
      return { user: mock.mockUser(email, name), walletPrivateKey: mock.mockPrivateKey(email), warning: "This private key is shown ONLY ONCE and is not stored by the server. Save it now. Use this wallet for testing only; never put real funds in it." };
    }
    return request<SignupResult>("/api/auth/signup", json({ email, password, name: name || undefined }), {
      400: "Use a valid email and a password with at least 8 characters.",
      409: "An account with this email already exists. Try logging in instead.",
    });
  },

  login: async (email: string, password: string): Promise<User> => {
    if (demoMode) {
      await mock.demoDelay();
      return mock.mockUser(email);
    }
    return request<User>("/api/auth/login", json({ email, password }), {
      401: "Wrong email or password.",
    });
  },

  // ---- Security engines
  runUnifiedScan: async (address?: string, txHash?: string): Promise<ScanReport> => {
    const body: ScanRequest = { address: address || null, txHash: txHash || null };
    if (demoMode) {
      await mock.demoDelay();
      return mock.mockScan(body);
    }
    return request<ScanReport>("/api/v1/scans", json(body));
  },

  analyzeTx: async (txHash: string): Promise<TxReport> => {
    if (demoMode) {
      await mock.demoDelay();
      return mock.mockTx(txHash);
    }
    return request<TxReport>(`/api/v1/tx/${encodeURIComponent(txHash)}/analyze`, {}, {
      404: "Transaction not found on Ethereum mainnet, or it is still pending.",
    });
  },

  analyzeWallet: async (address: string): Promise<WalletReport> => {
    if (demoMode) {
      await mock.demoDelay();
      return mock.mockWallet(address);
    }
    return normalizeWallet(await request<WalletReport>(`/api/v1/wallets/${encodeURIComponent(address)}/analyze`));
  },

  checkAccessControl: async (contractAddress: string, blocks: number = 1000): Promise<AccessReport> => {
    if (demoMode) {
      await mock.demoDelay();
      return mock.mockAccess(contractAddress, blocks);
    }
    return request<AccessReport>(`/api/v1/access/${encodeURIComponent(contractAddress)}/analyze?blocks=${blocks}`, {}, {
      400: "That doesn't look like a contract address (0x followed by 40 hex characters).",
    });
  },

  checkHoneypot: async (contractAddress: string): Promise<ContractCheck> => {
    if (demoMode) {
      await mock.demoDelay();
      return mock.mockContract(contractAddress);
    }
    return normalizeContract(await request<ContractCheck>(`/api/honeypot/check?address=${encodeURIComponent(contractAddress)}`));
  },

  // ---- Health / discovery (GET /api/v1/scans/detectors)
  listDetectors: async (): Promise<DetectorInfo[]> => {
    if (demoMode) return mock.mockDetectors();
    return request<DetectorInfo[]>("/api/v1/scans/detectors", {}, {}, 6_000);
  },
};
