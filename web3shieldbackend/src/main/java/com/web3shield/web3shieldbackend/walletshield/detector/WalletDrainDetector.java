package com.web3shield.web3shieldbackend.walletshield.detector;

import com.web3shield.web3shieldbackend.shared.detector.Detector;
import com.web3shield.web3shieldbackend.shared.enums.DataQuality;
import com.web3shield.web3shieldbackend.shared.enums.Severity;
import com.web3shield.web3shieldbackend.shared.model.DetectionResult;
import com.web3shield.web3shieldbackend.shared.model.Evidence;
import com.web3shield.web3shieldbackend.walletshield.client.AlchemyTransfersClient;
import com.web3shield.web3shieldbackend.walletshield.client.TransferDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;

import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class WalletDrainDetector implements Detector<String> {

    private final AlchemyTransfersClient transfersClient;
    private final Web3j web3j;

    private static final int DRAIN_WINDOW_SECONDS = 300; // 5-minute sliding window
    private static final int MIN_DRAIN_COUNT = 3;
    private static final Set<String> BURN_ADDRESSES = Set.of(
            "0x0000000000000000000000000000000000000000",
            "0x000000000000000000000000000000000000dead"
    );

    @Override
    public String id() {
        return "D12";
    }

    @Override
    public String name() {
        return "Rapid Wallet Drain";
    }

    @Override
    public DetectionResult detect(String targetAddress) {
        final String wallet = targetAddress.toLowerCase();
        log.info("[D12] Running Rapid Wallet Drain analysis on: {}", wallet);

        if (!wallet.matches("^0x[a-f0-9]{40}$")) {
            return new DetectionResult(
                    id(), name(), false, Severity.LOW, 0.0, DataQuality.INCONCLUSIVE,
                    "Invalid Ethereum address format.", List.of()
            );
        }

        // 1. Guard against Contract false positives
        if (isSmartContract(wallet)) {
            log.info("[D12] Target '{}' is a contract. High velocity is typical router behavior.", wallet);
            return new DetectionResult(
                    id(), name(), false, Severity.LOW, 1.0, DataQuality.FULL,
                    "Target is a verified contract/router. EOA drain heuristics suppressed.", List.of()
            );
        }

        // 2. Fetch outbound transfers
        List<TransferDto> rawOutflows = transfersClient.getRecentOutboundTransfers(wallet, 20);
        if (rawOutflows == null || rawOutflows.isEmpty()) {
            return new DetectionResult(
                    id(), name(), false, Severity.LOW, 1.0, DataQuality.FULL,
                    "No outbound transfers recorded for this address.", List.of()
            );
        }

        // 3. Exclude burn addresses and null recipients
        List<TransferDto> validOutflows = rawOutflows.stream()
                .filter(t -> t != null && t.to() != null && !BURN_ADDRESSES.contains(t.to().toLowerCase()))
                .sorted(Comparator.comparing(TransferDto::getTimestamp))
                .toList();

        if (validOutflows.size() < MIN_DRAIN_COUNT) {
            return new DetectionResult(
                    id(), name(), false, Severity.LOW, 1.0, DataQuality.FULL,
                    "Outbound transfer count is below burst threshold.", List.of()
            );
        }

        // 4. Sliding-Window Cluster Analysis
        for (int i = 0; i <= validOutflows.size() - MIN_DRAIN_COUNT; i++) {
            TransferDto start = validOutflows.get(i);
            List<TransferDto> cluster = new ArrayList<>();
            cluster.add(start);

            for (int j = i + 1; j < validOutflows.size(); j++) {
                TransferDto next = validOutflows.get(j);
                long delta = Math.abs(Duration.between(start.getTimestamp(), next.getTimestamp()).toSeconds());
                if (delta <= DRAIN_WINDOW_SECONDS) {
                    cluster.add(next);
                } else {
                    break;
                }
            }

            if (cluster.size() >= MIN_DRAIN_COUNT) {
                Set<String> uniqueAssets = cluster.stream()
                        .map(t -> t.asset() != null ? t.asset() : "UNKNOWN")
                        .collect(Collectors.toSet());

                Set<String> recipients = cluster.stream()
                        .map(t -> t.to().toLowerCase())
                        .collect(Collectors.toSet());

                long totalTime = Math.abs(Duration.between(cluster.getFirst().getTimestamp(), cluster.getLast().getTimestamp()).toSeconds());

                log.warn("[D12] DRAIN SIGNATURE CONFIRMED: {} transfers across {} assets within {}s for {}",
                        cluster.size(), uniqueAssets.size(), totalTime, wallet);

                List<Evidence> evidenceList = List.of(
                        new Evidence("DRAIN_CLUSTER", String.format("%d token outflows detected within %d seconds.", cluster.size(), totalTime)),
                        new Evidence("ASSETS_EVACUATED", String.join(", ", uniqueAssets)),
                        new Evidence("FIRST_OUTFLOW_TX", cluster.getFirst().hash()),
                        new Evidence("LAST_OUTFLOW_TX", cluster.getLast().hash()),
                        new Evidence("DESTINATION_COUNT", recipients.size() + " unique recipient accounts")
                );

                return new DetectionResult(
                        id(),
                        name(),
                        true,
                        Severity.CRITICAL,
                        0.96,
                        DataQuality.FULL,
                        String.format("High-velocity multi-asset drain detected: %d transfers executed within %d seconds.", cluster.size(), totalTime),
                        evidenceList
                );
            }
        }

        return new DetectionResult(
                id(), name(), false, Severity.LOW, 1.0, DataQuality.FULL,
                "No high-velocity outflow clusters detected.", List.of()
        );
    }

    private boolean isSmartContract(String address) {
        try {
            String code = web3j.ethGetCode(address, DefaultBlockParameterName.LATEST).send().getCode();
            return code != null && !code.equals("0x") && !code.equals("0x0");
        } catch (Exception e) {
            log.warn("[D12] Failed to verify bytecode for {}: {}", address, e.getMessage());
            return false;
        }
    }
}