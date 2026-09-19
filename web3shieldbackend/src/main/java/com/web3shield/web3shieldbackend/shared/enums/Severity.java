package com.web3shield.web3shieldbackend.shared.enums;

/** Threat weight of a finding. Order matters: later constants are more severe. */
public enum Severity {
    INFO(0), LOW(1), MEDIUM(2), HIGH(3), CRITICAL(4);

    private final int weight;

    Severity(int weight) { this.weight = weight; }

    public int weight() { return weight; }

    /** The more severe of two values (null-safe). */
    public static Severity max(Severity a, Severity b) {
        if (a == null) return b == null ? INFO : b;
        if (b == null) return a;
        return a.weight >= b.weight ? a : b;
    }
}
