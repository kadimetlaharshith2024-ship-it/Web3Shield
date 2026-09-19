package com.web3shield.web3shieldbackend.accessguard.detector;

import org.springframework.stereotype.Component;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameter;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.EthFilter;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthLog;
import org.web3j.protocol.core.methods.response.Log;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** D09: a mint is a Transfer event whose "from" is the zero address. */
@Component
public class UnauthorizedMintDetector implements Detector {

    private static final String TRANSFER_TOPIC =
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    private static final String ZERO_TOPIC = "0x" + "0".repeat(64);
    private static final int MAX_CALLER_LOOKUPS = 10;   // sample callers to keep the scan fast

    @Override
    public List<Finding> detect(Web3j web3j, String contract, BigInteger from, BigInteger to) throws Exception {
        EthFilter filter = new EthFilter(
                DefaultBlockParameter.valueOf(from), DefaultBlockParameter.valueOf(to), contract);
        filter.addSingleTopic(TRANSFER_TOPIC);
        filter.addSingleTopic(ZERO_TOPIC);

        List<EthLog.LogResult> results = web3j.ethGetLogs(filter).send().getLogs();
        List<Finding> findings = new ArrayList<>();
        if (results == null || results.isEmpty()) return findings;

        BigInteger totalMinted = BigInteger.ZERO;
        Set<String> callers = new HashSet<>();
        String lastTx = null;
        int lookups = 0;

        for (EthLog.LogResult r : results) {
            Log log = (Log) r.get();
            if (log.getTopics().size() != 3) continue;          // skip NFT transfers
            String data = log.getData();
            if (data == null || data.length() <= 2) continue;

            totalMinted = totalMinted.add(new BigInteger(data.substring(2), 16));
            lastTx = log.getTransactionHash();

            if (lookups++ < MAX_CALLER_LOOKUPS) {
                web3j.ethGetTransactionByHash(lastTx).send().getTransaction()
                        .ifPresent(tx -> callers.add(tx.getFrom()));
            }
        }
        if (lastTx == null) return findings;

        BigInteger supply = totalSupply(web3j, contract);
        String severity = "INFO";
        String detail = "";
        if (supply != null && supply.signum() > 0) {
            BigDecimal pct = new BigDecimal(totalMinted).multiply(BigDecimal.valueOf(100))
                    .divide(new BigDecimal(supply), 2, RoundingMode.HALF_UP);
            detail = " = " + pct + "% of total supply";
            if (pct.compareTo(BigDecimal.TEN) > 0) severity = "HIGH";
            else if (pct.compareTo(BigDecimal.ONE) > 0) severity = "MEDIUM";
        }

        findings.add(new Finding("D09-UnauthorizedMint", severity,
                results.size() + " mint event(s) in range, total raw amount " + totalMinted
                        + detail + ", sample of callers: " + callers
                        + ". Verify each caller is the authorised minter.", lastTx));
        return findings;
    }

    private BigInteger totalSupply(Web3j web3j, String contract) {
        try {
            Function fn = new Function("totalSupply", List.of(), List.of(new TypeReference<Uint256>() {}));
            String out = web3j.ethCall(
                    Transaction.createEthCallTransaction(null, contract, FunctionEncoder.encode(fn)),
                    DefaultBlockParameterName.LATEST).send().getValue();
            List<Type> decoded = FunctionReturnDecoder.decode(out, fn.getOutputParameters());
            return decoded.isEmpty() ? null : (BigInteger) decoded.get(0).getValue();
        } catch (Exception e) {
            return null;
        }
    }
}