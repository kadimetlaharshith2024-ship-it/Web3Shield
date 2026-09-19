package com.web3shield.web3shieldbackend.honeypotintel.service;

public class ContractCheckResult {

    private String address;
    private boolean isContract;
    private String chainId;
    private int bytecodeLength;
    private boolean isProxy;
    private String implementationAddress;

    public ContractCheckResult(String address, boolean isContract, String chainId,
                               int bytecodeLength, boolean isProxy, String implementationAddress) {
        this.address = address;
        this.isContract = isContract;
        this.chainId = chainId;
        this.bytecodeLength = bytecodeLength;
        this.isProxy = isProxy;
        this.implementationAddress = implementationAddress;
    }

    public String getAddress() { return address; }
    public boolean isContract() { return isContract; }
    public String getChainId() { return chainId; }
    public int getBytecodeLength() { return bytecodeLength; }
    public boolean isProxy() { return isProxy; }
    public String getImplementationAddress() { return implementationAddress; }
}