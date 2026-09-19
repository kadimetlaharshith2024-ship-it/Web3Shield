package com.web3shield.web3shieldbackend.honeypotintel.controller;

import com.web3shield.web3shieldbackend.honeypotintel.service.ContractCheckResult;
import com.web3shield.web3shieldbackend.honeypotintel.service.HoneypotIntelService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/honeypot")
public class HoneypotController {

    private final HoneypotIntelService honeypotIntelService;

    @Autowired
    public HoneypotController(HoneypotIntelService honeypotIntelService) {
        this.honeypotIntelService = honeypotIntelService;
    }

    @GetMapping("/check")
    public ResponseEntity<?> checkContract(@RequestParam String address) {
        try {
            ContractCheckResult result = honeypotIntelService.analyzeContract(address);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Blockchain call failed: " + e.getMessage());
        }
    }
}