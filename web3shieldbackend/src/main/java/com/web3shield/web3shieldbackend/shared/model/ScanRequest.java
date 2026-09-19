package com.web3shield.web3shieldbackend.shared.model;

import java.util.regex.Pattern;

/**
 * Body of POST /api/v1/scans. Every field is optional, but at least one is needed.
 * Each module decides whether it can use the request (see ScanModule.supports).
 *
 * @param address a wallet, token or contract address (0x + 40 hex characters)
 * @param txHash  a transaction hash (0x + 64 hex characters)
 */
public record ScanRequest(String address, String txHash) {

    private static final Pattern ADDRESS = Pattern.compile("^0x[0-9a-fA-F]{40}$");
    private static final Pattern TX_HASH = Pattern.compile("^0x[0-9a-fA-F]{64}$");

    public ScanRequest {
        address = blankToNull(address);
        txHash = blankToNull(txHash);
    }

    /** Returns a human readable problem, or null when the request is valid. */
    public String validationError() {
        if (address == null && txHash == null) {
            return "Provide at least one of: address, txHash";
        }
        if (address != null && !ADDRESS.matcher(address).matches()) {
            return "address must be 0x followed by 40 hex characters";
        }
        if (txHash != null && !TX_HASH.matcher(txHash).matches()) {
            return "txHash must be 0x followed by 64 hex characters";
        }
        return null;
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
