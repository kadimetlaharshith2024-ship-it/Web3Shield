package com.web3shield.web3shieldbackend.honeypotintel.detector;

import com.web3shield.web3shieldbackend.honeypotintel.service.BlockchainService;
import com.web3shield.web3shieldbackend.honeypotintel.service.ContractCheckResult;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class HoneypotDetector {

    private final BlockchainService blockchainService;

    @Autowired
    public HoneypotDetector(BlockchainService blockchainService) {
        this.blockchainService = blockchainService;
    }

    public ContractCheckResult checkContract(String address) throws Exception {
        String bytecode = blockchainService.getBytecode(address);
        String chainId = blockchainService.getChainId();

        boolean isContract = bytecode != null
                && !bytecode.equals("0x")
                && bytecode.length() > 2;

        int bytecodeLength = isContract ? bytecode.length() : 0;

        boolean isProxy = false;
        String implementationAddress = null;

        if (isContract) {
            String slotValue = blockchainService.getImplementationSlot(address);
            implementationAddress = blockchainService.extractAddressFromSlot(slotValue);
            isProxy = implementationAddress != null;
        }

        return new ContractCheckResult(address, isContract, chainId, bytecodeLength, isProxy, implementationAddress);
    }
}