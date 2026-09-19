package com.web3shield.web3shieldbackend.shared.model;

/** One piece of on-chain proof behind a finding, e.g. ("txHash", "0xabc...") or ("gasUsed", "812,340"). */
public record Evidence(String label, String value) {

    public Evidence {
        label = label == null ? "" : label;
        value = value == null ? "" : value;
    }

    /** Convenience: Evidence.of("blockNumber", 123456). */
    public static Evidence of(String label, Object value) {
        return new Evidence(label, String.valueOf(value));
    }
}
