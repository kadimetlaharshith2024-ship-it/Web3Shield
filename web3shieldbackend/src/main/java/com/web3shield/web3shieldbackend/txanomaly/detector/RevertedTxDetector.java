package com.web3shield.web3shieldbackend.txanomaly.detector;

import com.web3shield.web3shieldbackend.shared.detector.Detector;
import com.web3shield.web3shieldbackend.shared.enums.DataQuality;
import com.web3shield.web3shieldbackend.shared.enums.Severity;
import com.web3shield.web3shieldbackend.shared.model.DetectionResult;
import com.web3shield.web3shieldbackend.shared.model.Evidence;
import com.web3shield.web3shieldbackend.txanomaly.model.TxContext;
import com.web3shield.web3shieldbackend.txanomaly.util.RevertDecoder;
import com.web3shield.web3shieldbackend.txanomaly.util.RevertDecoder.Decoded;
import com.web3shield.web3shieldbackend.txanomaly.util.RevertDecoder.Kind;
import org.springframework.stereotype.Component;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameter;
import org.web3j.protocol.core.Response;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthCall;

import java.io.IOException;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * D06: Reverted transaction.
 *
 * A single revert is usually harmless (slippage, expired deadline, lost a race), so the base
 * severity is LOW. What matters is WHY it failed and whether it fits a pattern:
 *   - out of gas (gasUsed == gasLimit)
 *   - empty-reason revert on a token transfer (possible sell restriction, hand off to D08)
 *   - the same sender failing against the same contract again and again (probing)
 */
@Component
public class RevertedTxDetector implements Detector<TxContext> {

    private static final String ID = "D06";
    private static final String NAME = "Reverted Transaction";

    private static final String ERC20_TRANSFER = "0xa9059cbb";       // transfer(address,uint256)
    private static final String ERC20_TRANSFER_FROM = "0x23b872dd";  // transferFrom(address,address,uint256)
    private static final int REPEATED_FAILURES_THRESHOLD = 3;

    private final Web3j web3j;

    public RevertedTxDetector(Web3j web3j) {
        this.web3j = web3j;
    }

    @Override public String id() { return ID; }

    @Override public String name() { return NAME; }

    @Override
    public DetectionResult detect(TxContext ctx) {
        var receipt = ctx.receipt();
        String status = receipt.getStatus();

        if (status == null) {
            return DetectionResult.inconclusive(ID, NAME,
                    "Receipt has no status field (pre-Byzantium transaction).");
        }
        if (isSuccess(status)) {
            return DetectionResult.clean(ID, NAME, "Transaction succeeded; nothing reverted.",
                    DataQuality.FULL, List.of(new Evidence("status", status)));
        }

        var tx = ctx.tx();
        List<Evidence> evidence = new ArrayList<>();
        List<String> flags = new ArrayList<>();

        BigInteger gasUsed = receipt.getGasUsed();
        BigInteger gasLimit = tx.getGas();
        evidence.add(new Evidence("status", "0x0 (reverted)"));
        evidence.add(new Evidence("block", receipt.getBlockNumber().toString()));
        evidence.add(new Evidence("gas", gasUsed + " used of " + gasLimit + " limit"));

        // --- flag 1: out of gas ---
        if (gasLimit != null && gasUsed.equals(gasLimit)) {
            flags.add("Out of gas: the whole gas limit was consumed (possible infinite loop or gas griefing).");
        }

        // --- find out WHY it failed ---
        Replay replay = replay(ctx);
        evidence.add(new Evidence("replay", replay.note()));
        Decoded decoded = replay.decoded();
        String reasonText = "reason unavailable";
        if (decoded != null) {
            reasonText = decoded.reason();
            evidence.add(new Evidence("revertReason", decoded.reason()));
            if (decoded.selector() != null) {
                evidence.add(new Evidence("revertSelector", decoded.selector()));
            }
        }

        // --- flag 2: empty-reason revert on a token transfer ---
        if (decoded != null && decoded.kind() == Kind.EMPTY && isTokenTransfer(tx.getInput())) {
            flags.add("Token transfer reverted with no reason: this is how a sell restriction looks. Cross-check with D08 (honeypot).");
        }

        // --- flag 3: same sender keeps failing against this contract ---
        long sameSenderFailures = ctx.history().stream()
                .filter(TxContext.HistoricTx::failed)
                .filter(h -> h.from().equalsIgnoreCase(ctx.sender()))
                .filter(h -> !h.hash().equalsIgnoreCase(ctx.txHash()))
                .count();
        if (sameSenderFailures >= REPEATED_FAILURES_THRESHOLD) {
            flags.add(sameSenderFailures + " other failed transactions from this sender to the same contract in its recent history (possible probing).");
            evidence.add(new Evidence("repeatedFailures", String.valueOf(sameSenderFailures)));
        }
        for (String flag : flags) {
            evidence.add(new Evidence("flag", flag));
        }

        Severity severity = flags.isEmpty() ? Severity.LOW
                : flags.size() == 1 ? Severity.MEDIUM : Severity.HIGH;
        boolean reasonKnown = decoded != null
                && (decoded.kind() == Kind.ERROR_STRING || decoded.kind() == Kind.PANIC || decoded.kind() == Kind.CUSTOM_ERROR);
        double confidence = reasonKnown ? 0.75 : 0.5;
        DataQuality quality = replay.status() == ReplayStatus.REVERTED ? DataQuality.FULL : DataQuality.PARTIAL;

        String summary = "Transaction reverted (" + reasonText + ")"
                + (flags.isEmpty() ? "." : ". " + flags.size() + " pattern flag(s) raised.");
        return new DetectionResult(ID, NAME, true, severity, confidence, quality, summary, evidence);
    }

    // ------------------------------------------------------------------ replay

    private enum ReplayStatus { REVERTED, DID_NOT_REVERT, UNAVAILABLE }

    private record Replay(ReplayStatus status, Decoded decoded, String note) {}

    /**
     * Re-runs the call with eth_call at (blockNumber - 1) to obtain the revert payload.
     * Caveat: transactions earlier in the SAME block are not replayed, so the result can differ.
     */
    private Replay replay(TxContext ctx) {
        var tx = ctx.tx();
        if (tx.getTo() == null) {
            return new Replay(ReplayStatus.UNAVAILABLE, null, "Contract creation: replay skipped.");
        }
        BigInteger before = ctx.receipt().getBlockNumber().subtract(BigInteger.ONE);
        try {
            BigInteger callValue = tx.getValue() == null ? BigInteger.ZERO : tx.getValue();
            Transaction call = Transaction.createFunctionCallTransaction(
                    tx.getFrom(), null, null, null, tx.getTo(), callValue, tx.getInput());
            EthCall response = web3j.ethCall(call, DefaultBlockParameter.valueOf(before)).send();

            if (response.hasError()) {
                Response.Error err = response.getError();
                String message = err.getMessage() == null ? "" : err.getMessage();
                boolean isRevert = err.getCode() == 3 || message.toLowerCase(Locale.ROOT).contains("revert");
                if (!isRevert) {
                    return new Replay(ReplayStatus.UNAVAILABLE, null, "Replay failed: " + message);
                }
                String data = cleanHex(err.getData());
                Decoded decoded = RevertDecoder.decode(data);
                // some providers send only text such as "execution reverted: Insufficient balance"
                int idx = message.indexOf("reverted: ");
                if (decoded.kind() == Kind.EMPTY && idx >= 0) {
                    decoded = new Decoded(Kind.ERROR_STRING, message.substring(idx + "reverted: ".length()), null);
                }
                return new Replay(ReplayStatus.REVERTED, decoded, "Replayed at block " + before + ": reverted again.");
            }

            String output = response.getValue();
            if (output != null && (output.startsWith("0x08c379a0") || output.startsWith("0x4e487b71"))) {
                return new Replay(ReplayStatus.REVERTED, RevertDecoder.decode(output),
                        "Replayed at block " + before + ": reverted again.");
            }
            return new Replay(ReplayStatus.DID_NOT_REVERT, null,
                    "Replay at block " + before + " succeeded, so state changed inside the same block "
                            + "(likely front-run or ordering). Reason cannot be recovered.");
        } catch (IOException | RuntimeException e) {
            return new Replay(ReplayStatus.UNAVAILABLE, null, "Replay failed: " + e.getMessage());
        }
    }

    // ------------------------------------------------------------------ helpers

    /** Receipt status is a hex quantity: "0x1" success, "0x0" failure. */
    static boolean isSuccess(String status) {
        String s = status.toLowerCase(Locale.ROOT);
        if (s.startsWith("0x")) s = s.substring(2);
        s = s.replaceFirst("^0+", "");
        return s.equals("1");
    }

    static boolean isTokenTransfer(String input) {
        if (input == null || input.length() < 10) return false;
        String selector = input.substring(0, 10).toLowerCase(Locale.ROOT);
        return selector.equals(ERC20_TRANSFER) || selector.equals(ERC20_TRANSFER_FROM);
    }

    /** Some providers wrap the data in quotes. */
    static String cleanHex(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        if (s.length() >= 2 && s.startsWith("\"") && s.endsWith("\"")) {
            s = s.substring(1, s.length() - 1);
        }
        return s;
    }
}
