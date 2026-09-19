package com.web3shield.web3shieldbackend.walletshield.controller;

import com.web3shield.web3shieldbackend.walletshield.client.WalletAnalysisModels.CombinedWalletReport;
import com.web3shield.web3shieldbackend.walletshield.service.WalletShieldService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/wallets")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class WalletController {

    private final WalletShieldService shieldService;

    @GetMapping("/{address}/analyze")
    public ResponseEntity<CombinedWalletReport> analyzeWallet(@PathVariable String address) {
        log.info("[REST_API] Wallet analysis request received for: {}", address);
        CombinedWalletReport report = shieldService.evaluateWallet(address);
        return ResponseEntity.ok(report);
    }
}