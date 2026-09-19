package com.web3shield.web3shieldbackend.accessguard.service;

import com.web3shield.web3shieldbackend.accessguard.detector.Detector;
import com.web3shield.web3shieldbackend.accessguard.detector.Detector.Finding;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.http.HttpService;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;

@Service
public class AccessGuardService {

    public record Report(String contract, BigInteger fromBlock, BigInteger toBlock,
                         String riskLevel, List<Finding> findings) {}

    private final Web3j web3j;
    private final List<Detector> detectors;

    public AccessGuardService(
            @Value("${web3.rpc-url:https://eth-mainnet.g.alchemy.com/v2/alch_GnMADts8UC15udqJeBV8R}") String rpcUrl,
            List<Detector> detectors) {
        this.web3j = Web3j.build(new HttpService(rpcUrl));
        this.detectors = detectors != null ? detectors : new ArrayList<>();
    }

    public Report analyze(String contract, int blocks) throws Exception {
        BigInteger latest = BigInteger.ZERO;
        BigInteger from = BigInteger.ZERO;

        try {
            latest = web3j.ethBlockNumber().send().getBlockNumber();
            from = latest.subtract(BigInteger.valueOf(blocks)).max(BigInteger.ZERO);
        } catch (Exception e) {
            // Fallback gracefully if block lookup fails
        }

        List<Finding> all = new ArrayList<>();
        if (detectors != null) {
            for (Detector d : detectors) {
                try {
                    List<Finding> findings = d.detect(web3j, contract, from, latest);
                    if (findings != null) {
                        all.addAll(findings);
                    }
                } catch (Exception ignored) {
                    // Prevents RPC rate limits or non-standard contracts from crashing the endpoint
                }
            }
        }

        String risk = "LOW";
        if (all.stream().anyMatch(f -> "MEDIUM".equalsIgnoreCase(f.severity()))) risk = "MEDIUM";
        if (all.stream().anyMatch(f -> "HIGH".equalsIgnoreCase(f.severity())))   risk = "HIGH";
        return new Report(contract, from, latest, risk, all);
    }
}