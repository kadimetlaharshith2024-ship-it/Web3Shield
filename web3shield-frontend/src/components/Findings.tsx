import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { DetectionResult, Evidence } from "../lib/types";
import { humanizeLabel, isHexRef, severityRank, shorten, toneForSeverity } from "../lib/utils";
import { CopyButton, ExplorerLink, MessageText, SeverityBadge, StateBadge } from "./ui";

export function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) return <p className="no-evidence">The detector did not record any evidence for this result.</p>;
  return (
    <dl className="evidence">
      {evidence.map((e, i) => {
        const hex = isHexRef(e.value);
        return (
          <div key={`${e.label}-${i}`}>
            <dt>{humanizeLabel(e.label)}</dt>
            <dd>
              {hex ? (
                <>
                  <span className="mono" title={e.value}>
                    {shorten(e.value, 10, 8)}
                  </span>
                  <CopyButton value={e.value} label={`Copy ${humanizeLabel(e.label).toLowerCase()}`} />
                  <ExplorerLink value={e.value} />
                </>
              ) : (
                <span>{e.value}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

type Kind = "finding" | "clear" | "inconclusive";

export function kindOf(r: DetectionResult): Kind {
  if (r.triggered) return "finding";
  return r.dataQuality === "INCONCLUSIVE" ? "inconclusive" : "clear";
}

export function FindingCard({ result, defaultOpen = false }: { result: DetectionResult; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const kind = kindOf(result);
  const tone = kind === "finding" ? toneForSeverity(result.severity) : kind === "clear" ? "clear" : "unknown";
  const confidence = Math.round(result.confidence * 100);
  const bodyId = `ev-${result.detectorId}-${result.detectorName.replace(/\W/g, "")}`;

  return (
    <article className="finding" data-tone={tone} data-open={open} data-quiet={kind !== "finding"}>
      <button className="finding-head" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
        <div className="finding-title">
          {kind === "finding" ? <SeverityBadge severity={result.severity} /> : <StateBadge kind={kind} />}
          <h4>{result.detectorName}</h4>
          <code>{result.detectorId}</code>
          {result.dataQuality === "PARTIAL" && <span className="badge plain">Limited data</span>}
        </div>
        <div className="finding-side">
          {kind === "finding" && (
            <div className="meter" title="How sure the detector is that this finding is real">
              <div className="bar">
                <i style={{ width: `${confidence}%` }} />
              </div>
              <small>{confidence}% confident</small>
            </div>
          )}
          <ChevronDown size={18} className="chev" aria-hidden="true" />
        </div>
        <p className="finding-summary">{result.summary ? <MessageText text={result.summary} /> : "No summary provided."}</p>
      </button>
      {open && (
        <div className="finding-body" id={bodyId}>
          <EvidenceList evidence={result.evidence} />
        </div>
      )}
    </article>
  );
}

function sortFindings(list: DetectionResult[]) {
  return [...list].sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.confidence - a.confidence);
}

export function tally(results: DetectionResult[]) {
  let findings = 0;
  let clear = 0;
  let inconclusive = 0;
  for (const r of results) {
    const k = kindOf(r);
    if (k === "finding") findings++;
    else if (k === "clear") clear++;
    else inconclusive++;
  }
  return { findings, clear, inconclusive };
}

export function FindingGroups({ results }: { results: DetectionResult[] }) {
  const findings = sortFindings(results.filter((r) => kindOf(r) === "finding"));
  const clear = results.filter((r) => kindOf(r) === "clear");
  const unknown = results.filter((r) => kindOf(r) === "inconclusive");

  if (!results.length) {
    return (
      <div className="empty">
        <h3>No detector results</h3>
        <p>No detector accepted this input, so there is nothing to report. Try a different address or transaction hash.</p>
      </div>
    );
  }

  return (
    <>
      {findings.length > 0 && (
        <section className="group">
          <div className="group-head">
            <h3>{findings.length === 1 ? "1 finding" : `${findings.length} findings`}</h3>
            <p>Most serious first. Open a card to see the on-chain evidence.</p>
          </div>
          {findings.map((r, i) => (
            <FindingCard key={r.detectorId + r.detectorName} result={r} defaultOpen={i === 0} />
          ))}
        </section>
      )}
      {clear.length > 0 && (
        <section className="group">
          <div className="group-head">
            <h3>Checked and clear</h3>
            <p>These detectors ran with data and found nothing suspicious.</p>
          </div>
          {clear.map((r) => (
            <FindingCard key={r.detectorId + r.detectorName} result={r} />
          ))}
        </section>
      )}
      {unknown.length > 0 && (
        <section className="group">
          <div className="group-head">
            <h3>Couldn't check</h3>
            <p>These detectors didn't have enough data to decide. That is not the same as safe.</p>
          </div>
          {unknown.map((r) => (
            <FindingCard key={r.detectorId + r.detectorName} result={r} />
          ))}
        </section>
      )}
    </>
  );
}
