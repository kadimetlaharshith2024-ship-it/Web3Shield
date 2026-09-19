package com.web3shield.web3shieldbackend.shared.orchestrator;

import com.web3shield.web3shieldbackend.shared.model.ScanReport;
import com.web3shield.web3shieldbackend.shared.model.ScanRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/v1/scans")
public class ScanController {

    private final ScanOrchestrator orchestrator;

    public ScanController(ScanOrchestrator orchestrator) {
        this.orchestrator = orchestrator;
    }

    /**
     * POST /api/v1/scans
     * body: { "address": "0x...40 hex", "txHash": "0x...64 hex" }   (at least one)
     * Runs every module that can use the request and returns one merged report.
     */
    @PostMapping
    public ScanReport create(@RequestBody(required = false) ScanRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }
        String problem = request.validationError();
        if (problem != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, problem);
        }
        return orchestrator.scan(request);
    }

    /** GET /api/v1/scans/detectors : which detectors were auto-discovered (use it to check your wiring). */
    @GetMapping("/detectors")
    public List<ScanOrchestrator.DetectorInfo> detectors() {
        return orchestrator.listDetectors();
    }
}
