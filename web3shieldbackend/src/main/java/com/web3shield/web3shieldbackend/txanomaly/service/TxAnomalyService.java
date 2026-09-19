package com.web3shield.web3shieldbackend.txanomaly.service;

import com.web3shield.web3shieldbackend.shared.detector.Detector;
import com.web3shield.web3shieldbackend.shared.model.DetectionResult;
import com.web3shield.web3shieldbackend.shared.model.ScanRequest;
import com.web3shield.web3shieldbackend.shared.orchestrator.ScanModule;
import com.web3shield.web3shieldbackend.txanomaly.client.EtherscanTxListClient;
import com.web3shield.web3shieldbackend.txanomaly.model.TxContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.methods.response.Transaction;
import org.web3j.protocol.core.methods.response.TransactionReceipt;

import java.io.IOException;
import java.math.BigInteger;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Fetches the transaction data once, then runs every txanomaly detector on it.
 * A detector that crashes never kills the scan: it is reported as INCONCLUSIVE.
 */
@Service
public class TxAnomalyService implements ScanModule {

    private static final Logger log = LoggerFactory.getLogger(TxAnomalyService.class);
    private static final Pattern TX_HASH = Pattern.compile("^0x[0-9a-fA-F]{64}$");
    private static final int HISTORY_LIMIT = 200;

    private final Web3j web3j;
    private final EtherscanTxListClient etherscan;
    private final List<Detector<TxContext>> detectors;

    public TxAnomalyService(Web3j web3j,
                            EtherscanTxListClient etherscan,
                            List<Detector<TxContext>> detectors) {
        this.web3j = web3j;
        this.etherscan = etherscan;
        this.detectors = detectors;
    }

    // ---- ScanModule: lets ScanOrchestrator (POST /api/v1/scans) discover this module automatically

    @Override
    public String moduleName() { return "txanomaly"; }

    @Override
    public boolean supports(ScanRequest request) { return request.txHash() != null; }

    @Override
    public List<DetectionResult> scan(ScanRequest request) { return analyze(request.txHash()).results(); }

    /** JSON returned by GET /api/v1/tx/{txHash}/analyze */
    public record Report(String txHash, String target, BigInteger blockNumber,
                         int historySize, List<DetectionResult> results) {}

    public Report analyze(String txHash) {
        if (txHash == null || !TX_HASH.matcher(txHash).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "txHash must be 0x followed by 64 hex characters");
        }
        try {
            Optional<Transaction> tx = web3j.ethGetTransactionByHash(txHash).send().getTransaction();
            Optional<TransactionReceipt> receipt = web3j.ethGetTransactionReceipt(txHash).send().getTransactionReceipt();
            if (tx.isEmpty() || receipt.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Transaction not found on this network, or it is still pending");
            }

            String target = tx.get().getTo();
            BigInteger block = receipt.get().getBlockNumber();   // everything is pinned to this block
            List<TxContext.HistoricTx> history = target == null
                    ? List.of()
                    : etherscan.recentTxs(target, block, HISTORY_LIMIT);

            TxContext ctx = new TxContext(txHash, tx.get(), receipt.get(), history);
            List<DetectionResult> results = detectors.stream().map(d -> runSafely(d, ctx)).toList();
            return new Report(txHash, target, block, history.size(), results);

        } catch (IOException e) {
            log.warn("RPC call failed: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Could not reach the blockchain node: " + e.getMessage());
        }
    }

    private DetectionResult runSafely(Detector<TxContext> detector, TxContext ctx) {
        try {
            return detector.detect(ctx);
        } catch (RuntimeException e) {
            log.error("Detector {} failed", detector.id(), e);
            return DetectionResult.inconclusive(detector.id(), detector.name(),
                    "Detector crashed: " + e.getMessage());
        }
    }
}
