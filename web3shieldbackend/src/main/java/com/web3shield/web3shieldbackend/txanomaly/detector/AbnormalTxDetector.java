package com.web3shield.web3shieldbackend.txanomaly.detector;

import com.web3shield.web3shieldbackend.shared.detector.Detector;
import com.web3shield.web3shieldbackend.shared.enums.DataQuality;
import com.web3shield.web3shieldbackend.shared.enums.Severity;
import com.web3shield.web3shieldbackend.shared.model.DetectionResult;
import com.web3shield.web3shieldbackend.shared.model.Evidence;
import com.web3shield.web3shieldbackend.txanomaly.model.TxContext;
import com.web3shield.web3shieldbackend.txanomaly.model.TxContext.HistoricTx;
import com.web3shield.web3shieldbackend.txanomaly.util.RobustStats;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * D04: Gas price and calldata spike, judged against THIS contract's own history.
 *
 * A token transfer and a multi-hop swap differ by 100x in gas, so a global threshold is useless.
 * We compare gasUsed, gas price and calldata size with the median of the contract's recent
 * successful transactions, using a robust (median / MAD) z-score.
 *
 * Only upward spikes count, and a spike needs BOTH statistical significance (z above 3.5)
 * and practical significance (at least 1.5x the median).
 */
@Component
public class AbnormalTxDetector implements Detector<TxContext> {

    private static final String ID = "D04";
    private static final String NAME = "Abnormal Gas & Calldata";

    static final int MIN_BASELINE = 30;      // fewer past txs than this: INCONCLUSIVE
    static final int FULL_QUALITY_BASELINE = 100;
    static final double Z_THRESHOLD = 3.5;
    static final double MIN_RATIO = 1.5;
    private static final double WEI_PER_GWEI = 1e9;

    @Override public String id() { return ID; }

    @Override public String name() { return NAME; }

    @Override
    public DetectionResult detect(TxContext ctx) {
        if (ctx.target() == null) {
            return DetectionResult.inconclusive(ID, NAME,
                    "Contract creation: there is no target contract to build a baseline from.");
        }

        List<HistoricTx> baseline = ctx.history().stream()
                .filter(h -> !h.failed())                                // failed txs have odd gas
                .filter(h -> !h.hash().equalsIgnoreCase(ctx.txHash()))   // never compare a tx with itself
                .toList();

        if (baseline.size() < MIN_BASELINE) {
            return DetectionResult.inconclusive(ID, NAME,
                    "Only " + baseline.size() + " usable past transactions for this contract (need at least "
                            + MIN_BASELINE + "). Cannot judge what is abnormal. "
                            + "If this is 0, check ETHERSCAN_API_KEY and ETHERSCAN_CHAIN_ID.");
        }

        Check gas = check("gasUsed",
                ctx.receipt().getGasUsed().doubleValue(),
                baseline.stream().map(h -> h.gasUsed().doubleValue()).toList());

        Check calldata = check("calldataBytes",
                ctx.calldataBytes(),
                baseline.stream().map(h -> (double) h.calldataBytes()).toList());

        double priceGwei = ctx.tx().getGasPrice() == null ? 0 : ctx.tx().getGasPrice().doubleValue() / WEI_PER_GWEI;
        Check price = check("gasPriceGwei",
                priceGwei,
                baseline.stream().map(h -> h.gasPrice().doubleValue() / WEI_PER_GWEI).toList());

        List<Evidence> evidence = new ArrayList<>();
        evidence.add(new Evidence("baseline", baseline.size() + " successful past transactions to " + ctx.target()));
        for (Check c : List.of(gas, calldata, price)) {
            evidence.add(new Evidence(c.name, (c.flagged ? "SPIKE: " : "normal: ") + c.description));
        }

        DataQuality quality = baseline.size() >= FULL_QUALITY_BASELINE ? DataQuality.FULL : DataQuality.PARTIAL;

        // gas and calldata spikes are strong signals; a gas price spike alone is usually just congestion or MEV bidding
        int score = (gas.flagged ? 2 : 0) + (calldata.flagged ? 2 : 0) + (price.flagged ? 1 : 0);
        if (score == 0) {
            return DetectionResult.clean(ID, NAME,
                    "Gas, gas price and calldata are in line with this contract's recent history.",
                    quality, evidence);
        }

        Severity severity = score >= 4 ? Severity.HIGH : score >= 2 ? Severity.MEDIUM : Severity.LOW;
        double confidence = Math.min(0.85, 0.4 + baseline.size() / 500.0);

        List<String> names = new ArrayList<>();
        if (gas.flagged) names.add("gas used");
        if (calldata.flagged) names.add("calldata size");
        if (price.flagged) names.add("gas price");

        return new DetectionResult(ID, NAME, true, severity, confidence, quality,
                "Unusual spike versus this contract's own history: " + String.join(", ", names) + ".",
                evidence);
    }

    private record Check(String name, boolean flagged, String description) {}

    private Check check(String name, double x, List<Double> values) {
        double median = RobustStats.median(values);
        double mad = RobustStats.mad(values, median);
        double z = RobustStats.modifiedZ(x, median, mad);
        boolean flagged = z > Z_THRESHOLD && x >= MIN_RATIO * median && x > median;
        String ratio = median > 0 ? String.format(Locale.ROOT, "%.1fx", x / median) : "n/a";
        String description = String.format(Locale.ROOT, "%s (median %s, %s, z=%.1f)",
                fmt(x), fmt(median), ratio, z);
        return new Check(name, flagged, description);
    }

    private static String fmt(double v) {
        return v >= 100 ? String.format(Locale.ROOT, "%,.0f", v) : String.format(Locale.ROOT, "%.2f", v);
    }
}
