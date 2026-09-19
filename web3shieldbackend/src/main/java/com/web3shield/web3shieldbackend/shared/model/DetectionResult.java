package com.web3shield.web3shieldbackend.shared.model;

import com.web3shield.web3shieldbackend.shared.enums.DataQuality;
import com.web3shield.web3shieldbackend.shared.enums.Severity;

import java.util.List;
import java.util.Objects;

/**
 * Unified output of EVERY detector. The constructor cleans bad input (null lists, confidence
 * outside 0..1, null severity) so one careless detector cannot break the whole scan.
 *
 * @param detectorId  short stable id such as "D06"
 * @param triggered   true if the detector found something suspicious
 * @param severity    how bad it would be IF real
 * @param confidence  0.0 - 1.0, how sure we are that it IS real
 * @param dataQuality how much data the detector actually had
 */
public record DetectionResult(
        String detectorId,
        String detectorName,
        boolean triggered,
        Severity severity,
        double confidence,
        DataQuality dataQuality,
        String summary,
        List<Evidence> evidence) {

    public DetectionResult {
        detectorId = detectorId == null ? "UNKNOWN" : detectorId;
        detectorName = detectorName == null ? detectorId : detectorName;
        severity = severity == null ? Severity.INFO : severity;
        confidence = Double.isNaN(confidence) ? 0.0 : Math.max(0.0, Math.min(1.0, confidence));
        dataQuality = dataQuality == null ? DataQuality.FULL : dataQuality;
        summary = summary == null ? "" : summary;
        evidence = evidence == null ? List.of()
                : evidence.stream().filter(Objects::nonNull).toList();
    }

    /** Detector ran and found nothing suspicious. */
    public static DetectionResult clean(String id, String name, String summary,
                                        DataQuality quality, List<Evidence> evidence) {
        return new DetectionResult(id, name, false, Severity.INFO, 0.0, quality, summary, evidence);
    }

    /** Detector found something suspicious. */
    public static DetectionResult triggered(String id, String name, Severity severity, double confidence,
                                            DataQuality quality, String summary, List<Evidence> evidence) {
        return new DetectionResult(id, name, true, severity, confidence, quality, summary, evidence);
    }

    /** Detector could not run meaningfully (missing data, RPC failure...). Never report this as "safe". */
    public static DetectionResult inconclusive(String id, String name, String summary) {
        return new DetectionResult(id, name, false, Severity.INFO, 0.0,
                DataQuality.INCONCLUSIVE, summary, List.of());
    }
}
