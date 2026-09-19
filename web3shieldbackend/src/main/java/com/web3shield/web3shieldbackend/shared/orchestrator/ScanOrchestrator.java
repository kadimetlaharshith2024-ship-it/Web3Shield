package com.web3shield.web3shieldbackend.shared.orchestrator;

import com.web3shield.web3shieldbackend.shared.detector.Detector;
import com.web3shield.web3shieldbackend.shared.enums.DataQuality;
import com.web3shield.web3shieldbackend.shared.model.DetectionResult;
import com.web3shield.web3shieldbackend.shared.model.ScanReport;
import com.web3shield.web3shieldbackend.shared.model.ScanRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Finds every ScanModule and Detector bean automatically (no manual registration),
 * runs the modules that accept the request, and merges everything into one report.
 *
 * ObjectProvider is used on purpose: the app still starts when a module has not been
 * written yet, and no module can create a startup dependency cycle.
 * One failing module never breaks the scan: it shows up as an INCONCLUSIVE result.
 */
@Service
public class ScanOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(ScanOrchestrator.class);

    private final ObjectProvider<ScanModule> modules;
    private final ObjectProvider<Detector<?>> detectors;

    public ScanOrchestrator(ObjectProvider<ScanModule> modules, ObjectProvider<Detector<?>> detectors) {
        this.modules = modules;
        this.detectors = detectors;
    }

    /** What GET /api/v1/scans/detectors returns: proof that a detector was discovered. */
    public record DetectorInfo(String id, String name, String className) {}

    public List<DetectorInfo> listDetectors() {
        return detectors.orderedStream()
                .map(d -> new DetectorInfo(d.id(), d.name(), d.getClass().getSimpleName()))
                .sorted(Comparator.comparing(DetectorInfo::id))
                .toList();
    }

    public ScanReport scan(ScanRequest request) {
        List<DetectionResult> results = new ArrayList<>();
        List<String> run = new ArrayList<>();
        List<String> skipped = new ArrayList<>();

        for (ScanModule module : modules.orderedStream().toList()) {
            String name = module.moduleName() == null ? module.getClass().getSimpleName() : module.moduleName();

            boolean supported;
            try {
                supported = module.supports(request);
            } catch (RuntimeException e) {
                log.warn("Module {} failed in supports(): {}", name, e.getMessage());
                supported = false;
            }
            if (!supported) {
                skipped.add(name);
                continue;
            }

            run.add(name);
            try {
                List<DetectionResult> found = module.scan(request);
                if (found != null) {
                    results.addAll(found.stream().filter(Objects::nonNull).toList());
                }
            } catch (RuntimeException e) {
                log.error("Module {} failed", name, e);
                results.add(DetectionResult.inconclusive(name, name + " module",
                        "Module failed: " + e.getMessage()));
            }
        }

        int inconclusive = (int) results.stream()
                .filter(r -> r.dataQuality() == DataQuality.INCONCLUSIVE).count();

        String note;
        if (run.isEmpty()) {
            note = "No module accepted this request. Modules available: " + skipped;
        } else if (inconclusive > 0) {
            note = inconclusive + " of " + results.size()
                    + " detector result(s) were inconclusive. A low risk score does NOT mean the target is safe.";
        } else {
            note = "All reported detectors ran with data.";
        }

        return new ScanReport(
                UUID.randomUUID().toString(),
                Instant.now().toString(),
                request,
                RiskScorer.score(results),
                RiskScorer.overallSeverity(results),
                results.size(),
                inconclusive,
                run,
                skipped,
                note,
                results);
    }
}
