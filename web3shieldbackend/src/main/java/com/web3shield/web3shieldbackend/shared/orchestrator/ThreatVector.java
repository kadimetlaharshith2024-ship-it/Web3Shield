package com.web3shield.web3shieldbackend.shared.orchestrator;

public enum ThreatVector {
    DRAINING(1, 25.0, 95.0, "Rapid wallet draining & sweeper bot liquidation"),
    THREAT_MEMORY(2, 20.0, 90.0, "Known exploit bytecode or blacklisted deployer fingerprint"),
    OWNERSHIP_HIJACK(3, 16.0, 80.0, "Unauthorized ownership transfer or privilege escalation"),
    INFINITE_MINT(4, 14.0, 75.0, "Unconstrained or unauthorized token supply inflation"),
    HONEYPOT_TRAP(5, 11.0, 70.0, "Deceptive contract bytecode, hidden proxy, or sell restriction"),
    BURNER_WALLET(6, 7.0, 0.0, "Fresh disposable burner identity with zero transaction history"),
    REVERT_EXPLOIT(7, 4.0, 0.0, "EVM state replay reverted with hostile assertion"),
    ABNORMAL_GAS(8, 3.0, 0.0, "Statistical anomaly in gas parameters or calldata size");

    private final int priority;
    private final double weight;
    private final double floor;
    private final String description;

    ThreatVector(int priority, double weight, double floor, String description) {
        this.priority = priority;
        this.weight = weight;
        this.floor = floor;
        this.description = description;
    }

    public int getPriority() { return priority; }
    public double getWeight() { return weight; }
    public double getFloor() { return floor; }
    public String getDescription() { return description; }
}