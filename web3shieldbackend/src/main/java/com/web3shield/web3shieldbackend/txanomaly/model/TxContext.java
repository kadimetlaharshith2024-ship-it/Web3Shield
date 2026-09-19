package com.web3shield.web3shieldbackend.txanomaly.model;

import org.web3j.protocol.core.methods.response.Transaction;
import org.web3j.protocol.core.methods.response.TransactionReceipt;

import java.math.BigInteger;
import java.util.List;

/**
 * Everything the txanomaly detectors need, fetched ONCE per scan by TxAnomalyService
 * (so D04 and D06 never repeat the same RPC calls). All data is pinned to the
 * block the transaction was mined in.
 *
 * @param history recent transactions to the same contract (newest first).
 *                Empty when the Etherscan key is missing or the call failed.
 */
public record TxContext(String txHash,
                        Transaction tx,
                        TransactionReceipt receipt,
                        List<HistoricTx> history) {

    /** One past transaction from Etherscan txlist. */
    public record HistoricTx(String hash,
                             String from,
                             BigInteger gasUsed,
                             BigInteger gasLimit,
                             BigInteger gasPrice,   // wei
                             int calldataBytes,
                             boolean failed,
                             BigInteger blockNumber) {}

    /** Contract that was called, or null for a contract creation. */
    public String target() { return tx.getTo(); }

    public String sender() { return tx.getFrom(); }

    public int calldataBytes() { return hexByteLength(tx.getInput()); }

    /** "0x" + 2 hex chars per byte. */
    public static int hexByteLength(String hex) {
        if (hex == null || hex.length() < 2) return 0;
        String h = hex.startsWith("0x") || hex.startsWith("0X") ? hex.substring(2) : hex;
        return h.length() / 2;
    }
}
