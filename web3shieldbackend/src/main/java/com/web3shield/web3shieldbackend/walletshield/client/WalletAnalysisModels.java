package com.web3shield.web3shieldbackend.walletshield.client;

import com.web3shield.web3shieldbackend.shared.model.DetectionResult;
import com.web3shield.web3shieldbackend.shared.model.Evidence;

import java.util.List;

public class WalletAnalysisModels {

    public record CombinedWalletReport(
            String targetAddress,
            boolean isContract,
            String riskLevel,
            int riskScore,
            String classification,
            String warning,
            List<DetectionResult> detections,
            List<Evidence> consolidatedEvidence
    ) {}
}