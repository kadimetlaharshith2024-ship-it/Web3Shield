import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, Blocks, ChevronDown, FileCode2, History as HistoryIcon, ScanSearch, Trash2, Wallet } from "lucide-react";
import { useApp, type HistoryEntry } from "../context/App";
import type { AccessReport, ContractCheck, ScanReport, ToolKind, TxReport, WalletReport } from "../lib/types";
import { shorten, timeAgo } from "../lib/utils";
import { AccessView, ContractView, ScanView, TxView, WalletView } from "../components/Views";

const KIND: Record<ToolKind, { name: string; icon: typeof ScanSearch }> = {
  scan: { name: "Full scan", icon: ScanSearch },
  tx: { name: "Transaction", icon: ArrowLeftRight },
  wallet: { name: "Wallet", icon: Wallet },
  access: { name: "Access guard", icon: Blocks },
  contract: { name: "Contract check", icon: FileCode2 },
};

function Detail({ entry }: { entry: HistoryEntry }) {
  switch (entry.kind) {
    case "scan":
      return <ScanView report={entry.report as ScanReport} />;
    case "tx":
      return <TxView report={entry.report as TxReport} />;
    case "wallet":
      return <WalletView report={entry.report as WalletReport} />;
    case "access":
      return <AccessView report={entry.report as AccessReport} />;
    case "contract":
      return <ContractView report={entry.report as ContractCheck} />;
  }
}

export function HistoryPage() {
  const { history, removeHistory, clearHistory } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <header className="page-head">
        <h1>Scan history</h1>
        <p>Reports you've run in this browser. Open one to read it again without scanning.</p>
      </header>

      {history.length === 0 ? (
        <div className="empty">
          <HistoryIcon size={36} />
          <h3>No scans yet</h3>
          <p>Every check you run is saved here, in this browser only, so you can compare results later.</p>
          <Link className="btn btn-primary" to="/">
            <ScanSearch size={18} /> Run your first scan
          </Link>
        </div>
      ) : (
        <>
          <div className="actions" style={{ justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
            <span className="muted">
              {history.length} saved {history.length === 1 ? "report" : "reports"}
            </span>
            <button
              className="btn btn-sm"
              onClick={() => {
                if (window.confirm("Delete all saved reports from this browser?")) clearHistory();
              }}
            >
              <Trash2 size={15} /> Clear all
            </button>
          </div>
          <div className="history">
            {history.map((h) => {
              const { name, icon: Icon } = KIND[h.kind];
              const open = openId === h.id;
              return (
                <div className="history-item" key={h.id}>
                  <div className="history-row">
                    <span className="history-icon">
                      <Icon size={20} />
                    </span>
                    <div className="history-main">
                      <span style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <b>{name}</b>
                        <span className="badge" data-tone={h.tone}>
                          {h.verdict}
                          {h.score !== null ? ` (${h.score})` : ""}
                        </span>
                        {h.demo && <span className="badge plain">Demo</span>}
                      </span>
                      <span className="mono" title={h.target}>
                        {shorten(h.target, 14, 10)}
                      </span>
                    </div>
                    <span className="when faint" style={{ fontSize: 13.5 }}>
                      {timeAgo(h.at)}
                    </span>
                    <span style={{ display: "flex", gap: 4 }}>
                      <button className="icon-btn bordered" aria-expanded={open} aria-label={open ? "Hide report" : "Show report"} onClick={() => setOpenId(open ? null : h.id)}>
                        <ChevronDown size={18} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .2s" }} />
                      </button>
                      <button className="icon-btn" aria-label="Delete this report" onClick={() => removeHistory(h.id)}>
                        <Trash2 size={17} />
                      </button>
                    </span>
                  </div>
                  {open && (
                    <div className="history-detail">
                      <Detail entry={h} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
