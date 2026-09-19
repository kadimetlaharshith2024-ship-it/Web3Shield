package com.web3shield.web3shieldbackend.shared.orchestrator;

import com.web3shield.web3shieldbackend.shared.enums.Severity;
import com.web3shield.web3shieldbackend.shared.model.DetectionResult;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Component
public class RiskScorer {

    public record VectorAssessment(
            ThreatVector vector,
            int priority,
            double weight,
            double severityFactor,
            boolean detected,
            double scoreContribution,
            double floorEnforced,
            String description
    ) {}

    public record MaliciousnessAssessment(
            double maliciousnessPercentage,
            Severity severity,
            ThreatVector primaryThreat,
            List<VectorAssessment> breakdown
    ) {}

    /**
     * Static accessor for ScanOrchestrator.java
     */
    public static int score(List<DetectionResult> detections) {
        return (int) Math.round(assess(detections).maliciousnessPercentage());
    }

    /**
     * Static accessor for ScanOrchestrator.java
     */
    public static Severity overallSeverity(List<DetectionResult> detections) {
        return assess(detections).severity();
    }

    /**
     * Maps the final percentage score to a high-level severity category.
     */
    public static Severity calculateSeverity(int score) {
        if (score >= 85) return Severity.CRITICAL;
        if (score >= 65) return Severity.HIGH;
        if (score >= 40) return Severity.MEDIUM;
        if (score >= 15) return Severity.LOW;
        return Severity.INFO;
    }

    /**
     * Core Hybrid Evaluation Engine:
     * Score = min(100, max(sum(Weight_i * Severity_i), max(Floor_i)))
     */
    public static MaliciousnessAssessment assess(List<DetectionResult> detections) {
        Map<ThreatVector, Double> vectorSeverities = new EnumMap<>(ThreatVector.class);

        if (detections != null) {
            for (DetectionResult dr : detections) {
                ThreatVector tv = mapToVector(dr);
                if (tv != null) {
                    double currentMax = vectorSeverities.getOrDefault(tv, 0.0);
                    double incoming = severityToFactor(dr.severity());
                    vectorSeverities.put(tv, Math.max(currentMax, incoming));
                }
            }
        }

        double weightedSum = 0.0;
        double highestActiveFloor = 0.0;
        ThreatVector primaryThreat = null;
        List<VectorAssessment> breakdown = new ArrayList<>(ThreatVector.values().length);

        for (ThreatVector tv : ThreatVector.values()) {
            double factor = vectorSeverities.getOrDefault(tv, 0.0);
            boolean detected = factor > 0.0;
            double contribution = tv.getWeight() * factor;
            weightedSum += contribution;

            double floorEnforced = 0.0;
            // Floor activates when confidence is HIGH (0.8) or CRITICAL (1.0)
            if (factor >= 0.8 && tv.getFloor() > 0.0) {
                floorEnforced = tv.getFloor();
                if (tv.getFloor() > highestActiveFloor) {
                    highestActiveFloor = tv.getFloor();
                    primaryThreat = tv;
                }
            }

            breakdown.add(new VectorAssessment(
                    tv,
                    tv.getPriority(),
                    tv.getWeight(),
                    factor,
                    detected,
                    Math.round(contribution * 100.0) / 100.0,
                    floorEnforced,
                    detected ? tv.getDescription() : "Clean"
            ));
        }

        double finalScore = Math.min(100.0, Math.max(weightedSum, highestActiveFloor));
        finalScore = Math.round(finalScore * 10.0) / 10.0;
        Severity finalSeverity = calculateSeverity((int) Math.round(finalScore));

        return new MaliciousnessAssessment(finalScore, finalSeverity, primaryThreat, breakdown);
    }

    public static ThreatVector mapToVector(DetectionResult dr) {
        if (dr == null) return null;
        String id = dr.detectorId() != null ? dr.detectorId().toUpperCase() : "";
        String name = dr.detectorName() != null ? dr.detectorName().toUpperCase() : "";

        // Priority 1: Draining (D12)
        if (id.contains("D12") || name.contains("DRAIN") || name.contains("SWEEPER")) {
            return ThreatVector.DRAINING;
        }
        // Priority 2: Threat Memory
        if (name.contains("THREATMEMORY") || name.contains("THREAT_MEMORY") || name.contains("REINCARNATION")) {
            return ThreatVector.THREAT_MEMORY;
        }
        // Priority 3: Ownership Hijack (D16 / D08)
        if (id.contains("D16") || id.contains("D08") || name.contains("OWNERSHIP") || name.contains("HIJACK")) {
            return ThreatVector.OWNERSHIP_HIJACK;
        }
        // Priority 4: Infinite Mint (D09)
        if (id.contains("D09") || name.contains("MINT") || name.contains("INFLATION")) {
            return ThreatVector.INFINITE_MINT;
        }
        // Priority 5: Honeypot Trap
        if (name.contains("HONEYPOT") || name.contains("DECEPTIVE") || name.contains("PROXY_TRAP")) {
            return ThreatVector.HONEYPOT_TRAP;
        }
        // Priority 6: Burner Wallet (D19)
        if (id.contains("D19") || name.contains("BURNER") || name.contains("SYBIL")) {
            return ThreatVector.BURNER_WALLET;
        }
        // Priority 7: Revert Exploit (D06)
        if (id.contains("D06") || name.contains("REVERT") || name.contains("REPLAY")) {
            return ThreatVector.REVERT_EXPLOIT;
        }
        // Priority 8: Abnormal Gas (D04)
        if (id.contains("D04") || name.contains("ABNORMAL") || name.contains("GAS") || name.contains("CALLDATA")) {
            return ThreatVector.ABNORMAL_GAS;
        }

        return null;
    }

    private static double severityToFactor(Severity severity) {
        if (severity == null) return 0.0;
        return switch (severity) {
            case CRITICAL -> 1.0;
            case HIGH -> 0.8;
            case MEDIUM -> 0.5;
            case LOW -> 0.25;
            case INFO -> 0.1;
        };
    }
}