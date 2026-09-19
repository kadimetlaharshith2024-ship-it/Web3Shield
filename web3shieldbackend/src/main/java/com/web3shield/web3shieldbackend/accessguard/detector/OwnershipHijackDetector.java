package com.web3shield.web3shieldbackend.accessguard.detector;

import org.springframework.stereotype.Component;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameter;
import org.web3j.protocol.core.methods.request.EthFilter;
import org.web3j.protocol.core.methods.response.EthLog;
import org.web3j.protocol.core.methods.response.Log;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;

/** D16: inspects OwnershipTransferred(address indexed previousOwner, address indexed newOwner). */
@Component
public class OwnershipHijackDetector implements Detector {

    private static final String OWNERSHIP_TOPIC =
            "0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0";
    private static final String ZERO_ADDR = "0x" + "0".repeat(40);

    @Override
    public List<Finding> detect(Web3j web3j, String contract, BigInteger from, BigInteger to) throws Exception {
        EthFilter filter = new EthFilter(
                DefaultBlockParameter.valueOf(from), DefaultBlockParameter.valueOf(to), contract);
        filter.addSingleTopic(OWNERSHIP_TOPIC);

        List<EthLog.LogResult> results = web3j.ethGetLogs(filter).send().getLogs();
        List<Finding> findings = new ArrayList<>();
        if (results == null) return findings;

        for (EthLog.LogResult r : results) {
            Log log = (Log) r.get();
            if (log.getTopics().size() < 3) continue;

            String prevOwner = "0x" + log.getTopics().get(1).substring(26);
            String newOwner  = "0x" + log.getTopics().get(2).substring(26);
            String txHash = log.getTransactionHash();
            String sender = web3j.ethGetTransactionByHash(txHash).send().getTransaction()
                    .map(t -> t.getFrom()).orElse("unknown");

            if (prevOwner.equalsIgnoreCase(ZERO_ADDR)) {
                findings.add(new Finding("D16-OwnershipHijack", "MEDIUM",
                        "Owner set from the zero address to " + newOwner
                                + " (initialisation). If the contract was already deployed, this may be an "
                                + "unprotected initializer being re-run.", txHash));
            } else if (!sender.equalsIgnoreCase(prevOwner)) {
                findings.add(new Finding("D16-OwnershipHijack", "HIGH",
                        "Ownership moved from " + prevOwner + " to " + newOwner
                                + " by a transaction sent by " + sender
                                + ", which is NOT the previous owner. Possible hijack (or a multisig/proxy; verify).",
                        txHash));
            } else {
                findings.add(new Finding("D16-OwnershipHijack", "INFO",
                        "Owner changed from " + prevOwner + " to " + newOwner
                                + " by the previous owner (normal transfer).", txHash));
            }
        }
        return findings;
    }
}