import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ArrowLeftRight, Blocks, ChevronDown, FileCode2, History, LogOut, Moon, ScanSearch, Sun, Wallet } from "lucide-react";
import { useApp, type BackendStatus } from "../context/App";
import { useAuth } from "../context/Auth";
import { API_BASE } from "../lib/api";
import { Banner, CopyButton, Logo } from "./ui";
import { shorten } from "../lib/utils";

const NAV = [
  { to: "/", icon: ScanSearch, long: "Full scan", short: "Scan" },
  { to: "/transaction", icon: ArrowLeftRight, long: "Transaction", short: "Tx" },
  { to: "/wallet", icon: Wallet, long: "Wallet", short: "Wallet" },
  { to: "/access", icon: Blocks, long: "Access guard", short: "Access" },
  { to: "/contract", icon: FileCode2, long: "Contract check", short: "Contract" },
  { to: "/history", icon: History, long: "History", short: "History" },
] as const;

const STATUS_TEXT: Record<BackendStatus, string> = {
  checking: "Checking backend",
  online: "Backend connected",
  offline: "Backend offline",
  demo: "Demo mode",
};

function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = user?.name || "Guest";
  return (
    <div className="usermenu" ref={ref}>
      <button className="usermenu-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="avatar">{label.charAt(0).toUpperCase()}</span>
        <span className="name">{label}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="popover" role="menu">
          {user ? (
            <>
              <div className="row">
                <b>{user.name}</b>
                <span className="muted">{user.email}</span>
              </div>
              <hr />
              <div className="row">
                <span className="label">Your test wallet</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span className="mono" title={user.walletAddress}>{shorten(user.walletAddress, 10, 8)}</span>
                  <CopyButton value={user.walletAddress} label="Copy wallet address" />
                </span>
              </div>
              <hr />
            </>
          ) : (
            <div className="row">
              <b>Guest</b>
              <span className="muted">Scans work without an account. Log in to keep a profile.</span>
            </div>
          )}
          <button className="btn btn-sm" role="menuitem" onClick={signOut}>
            <LogOut size={15} /> {user ? "Log out" : "Log in or sign up"}
          </button>
        </div>
      )}
    </div>
  );
}

export function Shell() {
  const app = useApp();
  const navigate = useNavigate();
  const offline = app.status === "offline" && !app.demo;

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Main">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          <Logo size={32} />
          <b>Web3Shield</b>
        </a>

        <div className="nav">
          {NAV.map(({ to, icon: Icon, long, short }, i) => (
            <span key={to} style={{ display: "contents" }}>
              {i === NAV.length - 1 && <div className="nav-sep" />}
              <NavLink to={to} end={to === "/"}>
                <Icon size={20} />
                <span className="long">{long}</span>
                <span className="short">{short}</span>
                {to === "/history" && app.history.length > 0 && <span className="nav-count">{app.history.length}</span>}
              </NavLink>
            </span>
          ))}
        </div>

        <div className="sidebar-foot">
          <p className="disclaimer">Web3Shield reads public on-chain data and can miss things. A clean result is never a guarantee of safety.</p>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <a className="brand" href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
            <Logo size={28} />
            <b>Web3Shield</b>
          </a>
          <div className="topbar-spacer" />
          <button className="status" data-state={app.status} onClick={app.recheck} title={app.status === "online" ? `${app.detectors.length} detectors loaded from ${API_BASE}` : "Check the connection again"}>
            <span className="dot" />
            <span className="status-text">{STATUS_TEXT[app.status]}</span>
          </button>
          <label className="switch" title="Use built-in sample data instead of your backend">
            <input type="checkbox" checked={app.demo} onChange={(e) => app.setDemo(e.target.checked)} />
            <span className="track" />
            <span className="switch-text">Demo</span>
          </label>
          <button className="icon-btn bordered" onClick={app.toggleTheme} aria-label={app.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
            {app.theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <UserMenu />
        </header>

        {offline && (
          <div className="top-banner">
            <Banner
              tone="critical"
              title="Can't reach the backend"
              actions={
                <>
                  <button className="btn btn-sm" onClick={app.recheck}>Retry</button>
                  <button className="btn btn-sm btn-primary" onClick={() => app.setDemo(true)}>Switch to demo mode</button>
                </>
              }
            >
              Nothing answered at {API_BASE}. Start the Spring Boot app (port 8085), or explore with sample data.
            </Banner>
          </div>
        )}

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
