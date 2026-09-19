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
import org.web3j.utils.Convert;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Component
@RequiredArgsConstructor
public class BurnerWalletDetector implements Detector<String> {

    private final AlchemyTransfersClient transfersClient;
    private final Web3j web3j;

    private static final long ULTRA_FRESH_THRESHOLD_HOURS = 1;
    private static final long FRESH_THRESHOLD_HOURS = 24;
    private static final long SHORT_LIFESPAN_MINUTES = 60;
    private static final BigDecimal DEPLETED_BALANCE_THRESHOLD_ETH = new BigDecimal("0.005");

    @Override
    public String id() {
        return "D19";
    }

    @Override
    public String name() {
        return "Suspicious Burner Wallet";
    }

    @Override
    public DetectionResult detect(String targetAddress) {
        final String wallet = targetAddress.toLowerCase();
        log.info("[D19] Running Burner Wallet evaluation on: {}", wallet);

        if (!wallet.matches("^0x[a-f0-9]{40}$")) {
            return new DetectionResult(
                    id(), name(), false, Severity.LOW, 0.0, DataQuality.INCONCLUSIVE,
                    "Invalid Ethereum address format.", List.of()
            );
        }

        // Parallel Fetch: Genesis, Outflows, Balance, Nonce
        CompletableFuture<List<TransferDto>> genesisFuture = CompletableFuture.supplyAsync(() ->
                transfersClient.getEarliestInboundTransfers(wallet, 1));
        CompletableFuture<List<TransferDto>> outboundFuture = CompletableFuture.supplyAsync(() ->
                transfersClient.getRecentOutboundTransfers(wallet, 10));
        CompletableFuture<BigInteger> balanceFuture = CompletableFuture.supplyAsync(() -> fetchBalanceWei(wallet));
        CompletableFuture<BigInteger> nonceFuture = CompletableFuture.supplyAsync(() -> fetchNonce(wallet));

        CompletableFuture.allOf(genesisFuture, outboundFuture, balanceFuture, nonceFuture).join();

        List<TransferDto> genesisList = genesisFuture.join();
        List<TransferDto> outflows = outboundFuture.join();
        BigInteger balanceWei = balanceFuture.join();
        BigInteger nonce = nonceFuture.join();

        // Guard: Inconclusive state
        if (genesisList.isEmpty() && nonce.equals(BigInteger.ZERO)) {
            log.info("[D19] No on-chain activity observed for {}. Returning INCONCLUSIVE.", wallet);
            return new DetectionResult(
                    id(),
                    name(),
                    false,
                    Severity.LOW,
                    0.5,
                    DataQuality.INCONCLUSIVE,
                    "Not enough historical activity is available to assess this address.",
                    List.of(new Evidence("STATUS", "No on-chain transfers or nonce history found."))
            );
        }

        TransferDto genesis = genesisList.isEmpty() ? null : genesisList.getFirst();
        Instant genesisTime = genesis != null ? genesis.getTimestamp() : Instant.now();
        long ageMinutes = Math.max(0, Duration.between(genesisTime, Instant.now()).toMinutes());
        long ageHours = ageMinutes / 60;

        List<Evidence> evidenceList = new ArrayList<>();
        evidenceList.add(new Evidence("WALLET_AGE", ageHours + " hours (" + ageMinutes + " minutes)"));
        if (genesis != null) {
            evidenceList.add(new Evidence("GENESIS_TX", genesis.hash()));
            evidenceList.add(new Evidence("SEED_FUNDER", genesis.from() != null ? genesis.from() : "UNKNOWN"));
        }

        BigDecimal balanceEth = Convert.fromWei(new BigDecimal(balanceWei), Convert.Unit.ETHER);
        boolean isDepleted = balanceEth.compareTo(DEPLETED_BALANCE_THRESHOLD_ETH) <= 0;
        evidenceList.add(new Evidence("CURRENT_BALANCE", balanceEth.stripTrailingZeros().toPlainString() + " ETH"));
        evidenceList.add(new Evidence("TRANSACTION_COUNT", nonce.toString()));

        boolean hasShortLifespan = false;
        if (!outflows.isEmpty() && genesis != null) {
            long activitySpan = Math.abs(Duration.between(genesis.getTimestamp(), outflows.getFirst().getTimestamp()).toMinutes());
            evidenceList.add(new Evidence("ACTIVITY_SPAN", activitySpan + " minutes from genesis to latest outflow"));
            if (activitySpan <= SHORT_LIFESPAN_MINUTES && outflows.size() >= 2) {
                hasShortLifespan = true;
            }
        }

        // Multi-signal evaluations
        if (ageHours < ULTRA_FRESH_THRESHOLD_HOURS && (hasShortLifespan || isDepleted)) {
            log.warn("[D19] ULTRA-FRESH BURNER: {} is {}m old with depleted balance.", wallet, ageMinutes);
            return new DetectionResult(
                    id(),
                    name(),
                    true,
                    Severity.HIGH,
                    0.92,
                    DataQuality.FULL,
                    String.format("Account is only %d minutes old with an immediate burst-and-drain lifecycle.", ageMinutes),
                    evidenceList
            );
        }

        if (ageHours < FRESH_THRESHOLD_HOURS && hasShortLifespan && nonce.compareTo(BigInteger.valueOf(10)) <= 0) {
            log.warn("[D19] SHORT-LIVED DISPOSABLE ACCOUNT: {} is {}h old with single-session usage.", wallet, ageHours);
            return new DetectionResult(
                    id(),
                    name(),
                    true,
                    Severity.MEDIUM,
                    0.80,
                    DataQuality.FULL,
                    String.format("Created %d hours ago with single-session transaction concentration.", ageHours),
                    evidenceList
            );
        }

        return new DetectionResult(
                id(),
                name(),
                false,
                Severity.LOW,
                1.0,
                DataQuality.FULL,
                "Address age and transaction profile are within normal operational parameters.",
                evidenceList
        );
    }

    private BigInteger fetchBalanceWei(String address) {
        try {
            return web3j.ethGetBalance(address, DefaultBlockParameterName.LATEST).send().getBalance();
        } catch (Exception e) {
            log.warn("[D19] Balance query error for {}: {}", address, e.getMessage());
            return BigInteger.ZERO;
        }
    }

    private BigInteger fetchNonce(String address) {
        try {
            return web3j.ethGetTransactionCount(address, DefaultBlockParameterName.LATEST).send().getTransactionCount();
        } catch (Exception e) {
            log.warn("[D19] Nonce query error for {}: {}", address, e.getMessage());
            return BigInteger.ZERO;
        }
    }
}