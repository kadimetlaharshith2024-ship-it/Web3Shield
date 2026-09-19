package com.web3shield.web3shieldbackend.walletshield.service;

import com.web3shield.web3shieldbackend.shared.enums.DataQuality;
import com.web3shield.web3shieldbackend.shared.model.DetectionResult;
import com.web3shield.web3shieldbackend.shared.model.Evidence;
import com.web3shield.web3shieldbackend.walletshield.client.WalletAnalysisModels.CombinedWalletReport;
import com.web3shield.web3shieldbackend.walletshield.detector.BurnerWalletDetector;
import com.web3shield.web3shieldbackend.walletshield.detector.WalletDrainDetector;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
@RequiredArgsConstructor
public class WalletShieldService {

    private final WalletDrainDetector drainDetector;
    private final BurnerWalletDetector burnerDetector;

    public CombinedWalletReport evaluateWallet(String address) {
        log.info("[WALLET_SERVICE] Executing concurrent D12 + D19 analysis for: {}", address);

        CompletableFuture<DetectionResult> drainFuture = CompletableFuture.supplyAsync(() -> drainDetector.detect(address));
        CompletableFuture<DetectionResult> burnerFuture = CompletableFuture.supplyAsync(() -> burnerDetector.detect(address));

        CompletableFuture.allOf(drainFuture, burnerFuture).join();

        DetectionResult drainResult = drainFuture.join();
        DetectionResult burnerResult = burnerFuture.join();

        List<DetectionResult> detections = List.of(drainResult, burnerResult);

        // Inconclusive check across both detectors
        boolean allInconclusive = detections.stream().allMatch(d -> d.dataQuality() == DataQuality.INCONCLUSIVE);
        if (allInconclusive) {
            return new CombinedWalletReport(
                    address,
                    false,
                    "INCONCLUSIVE",
                    0,
                    "INSUFFICIENT_DATA",
                    "Not enough historical activity is available to assess this address.",
                    detections,
                    List.of()
            );
        }

        // Composite scoring (D12 weight: 60, D19 weight: 30) using .triggered()
        int score = 0;
        if (drainResult.triggered()) {
            score += 60;
        }
        if (burnerResult.triggered()) {
            score += 30;
        }

        int finalScore = Math.min(100, score);
        String riskLevel = finalScore >= 60 ? "CRITICAL" : finalScore >= 30 ? "HIGH" : "LOW";
        String classification = finalScore >= 30 ? "SUSPICIOUS_BEHAVIOR" : "STANDARD_ACTIVITY";

        String warning = finalScore >= 30
                ? "⚠️ The account you are interacting with shows suspicious behavior. Please review the evidence carefully before proceeding."
                : "No significant anomalous patterns detected. Proceed with standard caution.";

        List<Evidence> consolidatedEvidence = new ArrayList<>();
        consolidatedEvidence.addAll(drainResult.evidence());
        consolidatedEvidence.addAll(burnerResult.evidence());

        return new CombinedWalletReport(
                address,
                false,
                riskLevel,
                finalScore,
                classification,
                warning,
                detections,
                consolidatedEvidence
        );
    }
}