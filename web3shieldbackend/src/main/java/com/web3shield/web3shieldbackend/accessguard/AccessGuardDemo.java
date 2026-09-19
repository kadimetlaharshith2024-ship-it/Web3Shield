package com.web3shield.web3shieldbackend.accessguard;

import com.web3shield.web3shieldbackend.accessguard.detector.Detector;
import com.web3shield.web3shieldbackend.accessguard.detector.OwnershipHijackDetector;
import com.web3shield.web3shieldbackend.accessguard.detector.UnauthorizedMintDetector;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.http.HttpService;

import java.math.BigInteger;
import java.util.List;

public class AccessGuardDemo {

    public static void main(String[] args) throws Exception {
        String contract = args.length > 0 ? args[0]
                : "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC, for testing

        Web3j web3j = Web3j.build(new HttpService("https://ethereum-rpc.publicnode.com"));
        BigInteger latest = web3j.ethBlockNumber().send().getBlockNumber();
        BigInteger from = latest.subtract(BigInteger.valueOf(100));   // small window, stays "recent"

        List<Detector> detectors = List.of(new UnauthorizedMintDetector(), new OwnershipHijackDetector());

        System.out.println("Scanning " + contract + " from block " + from + " to " + latest);
        int count = 0;
        for (Detector d : detectors) {
            try {
                for (Detector.Finding f : d.detect(web3j, contract, from, latest)) {
                    System.out.println("[" + f.severity() + "] " + f.detector() + ": " + f.message());
                    count++;
                }
            } catch (Exception e) {
                System.out.println("Detector " + d.getClass().getSimpleName() + " skipped: " + e.getMessage());
            }
        }
        System.out.println("Done. Findings: " + count);
        web3j.shutdown();
    }
}