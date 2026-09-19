package com.web3shield.web3shieldbackend.accessguard.controller;

import com.web3shield.web3shieldbackend.accessguard.service.AccessGuardService;
import com.web3shield.web3shieldbackend.accessguard.service.AccessGuardService.Report;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/access")
public class AccessController {

    private final AccessGuardService service;

    public AccessController(AccessGuardService service) {
        this.service = service;
    }

    @GetMapping("/{contract}/analyze")
    public ResponseEntity<?> analyze(@PathVariable("contract") String contract,
                                     @RequestParam(name = "blocks", defaultValue = "1000") int blocks) {
        if (!contract.matches("^0x[0-9a-fA-F]{40}$")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid contract address"));
        }
        int safeBlocks = Math.min(Math.max(blocks, 1), 5000);
        try {
            Report report = service.analyze(contract, safeBlocks);
            return ResponseEntity.ok(report);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }
}