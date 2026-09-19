package com.web3shield.web3shieldbackend.honeypotintel.service;

import com.web3shield.web3shieldbackend.honeypotintel.detector.HoneypotDetector;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class HoneypotIntelService {

    private final HoneypotDetector honeypotDetector;

    @Autowired
    public HoneypotIntelService(HoneypotDetector honeypotDetector) {
        this.honeypotDetector = honeypotDetector;
    }

    public ContractCheckResult analyzeContract(String address) throws Exception {
        if (address == null || address.isBlank()) {
            throw new IllegalArgumentException("Address must not be empty");
        }
        return honeypotDetector.checkContract(address);
    }
}