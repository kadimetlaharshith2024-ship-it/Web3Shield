package com.web3shield.web3shieldbackend.txanomaly.controller;

import com.web3shield.web3shieldbackend.txanomaly.service.TxAnomalyService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/tx")
public class TxAnomalyController {

    private final TxAnomalyService service;

    public TxAnomalyController(TxAnomalyService service) {
        this.service = service;
    }

    /** GET /api/v1/tx/{txHash}/analyze  ->  D04 + D06 results for one transaction */
    @GetMapping("/{txHash}/analyze")
    public TxAnomalyService.Report analyze(@PathVariable String txHash) {
        return service.analyze(txHash);
    }
}
