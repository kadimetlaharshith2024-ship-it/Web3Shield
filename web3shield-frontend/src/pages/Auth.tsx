import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AlertCircle, Download, Eye, EyeOff, Loader2, Moon, Sun } from "lucide-react";
import { useApp } from "../context/App";
import { useAuth } from "../context/Auth";
import { api } from "../lib/api";
import type { SignupResult } from "../lib/types";
import { downloadTextFile } from "../lib/utils";
import { Gauge } from "../components/Gauge";
import { Banner, CopyButton, Logo } from "../components/ui";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// ------------------------------------------------------------------ one-time wallet key

function KeyModal({ result, onDone }: { result: SignupResult; onDone: () => void }) {
  const [reveal, setReveal] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <div className="backdrop" role="dialog" aria-modal="true" aria-labelledby="key-title">
      <div className="modal">
        <div style={{ display: "grid", gap: 8 }}>
          <h2 id="key-title">Save your wallet key now</h2>
          <p className="muted">We created a test wallet for your account. The private key appears only this once, and the server doesn't keep a copy.</p>
        </div>

        <div className="keybox">
          <span className="label">Wallet address</span>
          <span className="mono" style={{ display: "flex", alignItems: "center", gap: 6, wordBreak: "break-all" }}>
            {result.user.walletAddress}
            <CopyButton value={result.user.walletAddress} label="Copy wallet address" />
          </span>
        </div>

        <div className="keybox">
          <span className="label">Private key</span>
          <span className="mono" aria-live="polite">{reveal ? result.walletPrivateKey : "•".repeat(66)}</span>
          <div className="keybox-actions">
            <button type="button" className="btn btn-sm" onClick={() => setReveal((r) => !r)}>
              {reveal ? <EyeOff size={15} /> : <Eye size={15} />} {reveal ? "Hide" : "Reveal"}
            </button>
            <CopyButton value={result.walletPrivateKey} label="Copy private key" className="btn btn-sm icon-only" />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() =>
                downloadTextFile(
                  "web3shield-wallet-key.txt",
                  `Web3Shield test wallet\nAddress: ${result.user.walletAddress}\nPrivate key: ${result.walletPrivateKey}\n\nTest use only. Never put real funds in this wallet.\n`,
                )
              }
            >
              <Download size={15} /> Download
            </button>
          </div>
        </div>

        <Banner tone="medium">{result.warning}</Banner>

        <label className="check">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          <span>I've saved this private key somewhere safe.</span>
        </label>

        <button className="btn btn-primary btn-block" disabled={!saved} onClick={onDone}>
          Continue to Web3Shield
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ page

export function AuthPage() {
  const app = useApp();
  const auth = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<SignupResult | null>(null);

  if (auth.session && !created) return <Navigate to="/" replace />;

  const validate = (): string | null => {
    if (!EMAIL_RE.test(email.trim())) return "Enter a valid email address.";
    if (mode === "signup") {
      if (password.length < 8) return "Use a password with at least 8 characters.";
      if (new TextEncoder().encode(password).length > 72) return "That password is too long. The limit is 72 bytes.";
      if (name.trim().length > 60) return "Keep your name to 60 characters or fewer.";
    } else if (!password) return "Enter your password.";
    return null;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) return setError(problem);
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        const user = await api.login(email.trim(), password);
        auth.signIn(user);
        navigate("/", { replace: true });
      } else {
        setCreated(await api.signup(email.trim(), password, name.trim() || undefined));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const offline = app.status === "offline" && !app.demo;

  return (
    <div className="auth">
      <aside className="auth-aside">
        <div className="brand" style={{ padding: 0 }}>
          <Logo size={36} />
          <b>Web3Shield</b>
        </div>

        <div>
          <h1>See what a wallet or contract has done before you trust it</h1>
          <p>Web3Shield reads public Ethereum data and shows the evidence behind every warning, including the checks it couldn't finish.</p>
        </div>

        <div>
          <div className="auth-sample" aria-hidden="true">
            <Gauge score={78} tone="critical" />
            <ul>
              <li data-tone="critical">
                <b>Rapid wallet drain</b>
                <span>7 tokens left in 94 seconds</span>
              </li>
              <li data-tone="high">
                <b>Suspicious burner wallet</b>
                <span>3 hours old, one funder</span>
              </li>
              <li data-tone="clear">
                <b>Abnormal gas and calldata</b>
                <span>In line with past activity</span>
              </li>
            </ul>
          </div>
          <p className="auth-sample-cap">Example report</p>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-top">
            <div className="brand">
              <Logo />
              <b>Web3Shield</b>
            </div>
            <button className="icon-btn bordered" onClick={app.toggleTheme} aria-label={app.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} style={{ marginLeft: "auto" }}>
              {app.theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <h2 style={{ fontSize: "1.7rem" }}>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p className="muted">{mode === "login" ? "Log in to run scans and keep your history." : "You'll also get a test wallet. Its key is shown once."}</p>
          </div>

          <div className="seg" role="tablist" aria-label="Log in or create an account" style={{ width: "100%" }}>
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                style={{ flex: 1 }}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
              >
                {m === "login" ? "Log in" : "Create account"}
              </button>
            ))}
          </div>

          {offline && (
            <Banner
              tone="critical"
              title="Backend not reachable"
              actions={
                <>
                  <button className="btn btn-sm" onClick={app.recheck}>Retry</button>
                  <button className="btn btn-sm btn-primary" onClick={() => app.setDemo(true)}>Use demo mode</button>
                </>
              }
            >
              Start the Spring Boot app on port 8085, or explore with sample data.
            </Banner>
          )}
          {app.demo && <Banner tone="medium" title="Demo mode is on">Accounts and scans use sample data. Nothing is sent to your backend.</Banner>}

          <form onSubmit={submit} noValidate>
            {mode === "signup" && (
              <div className="field">
                <label htmlFor="name">Name (optional)</label>
                <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input-wrap">
                <input
                  id="password"
                  className="input"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  aria-describedby="pw-hint"
                />
                <button type="button" className="icon-btn" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {mode === "signup" && <span className="hint" id="pw-hint">At least 8 characters.</span>}
            </div>

            {error && (
              <div className="error-text" role="alert">
                <AlertCircle size={16} style={{ flex: "none", marginTop: 2 }} /> {error}
              </div>
            )}

            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy && <Loader2 size={18} className="spin" />}
              {mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          <div className="divider">or</div>
          <button
            className="btn btn-block"
            onClick={() => {
              auth.continueAsGuest();
              navigate("/", { replace: true });
            }}
          >
            Continue without an account
          </button>
        </div>
      </main>

      {created && (
        <KeyModal
          result={created}
          onDone={() => {
            auth.signIn(created.user);
            setCreated(null);
            navigate("/", { replace: true });
          }}
        />
      )}
    </div>
  );
}
