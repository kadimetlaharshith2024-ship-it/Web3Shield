package com.web3shield.web3shieldbackend.shared.model;

import com.web3shield.web3shieldbackend.shared.enums.Severity;

import java.util.List;

/**
 * JSON returned by POST /api/v1/scans.
 *
 * @param riskScore             0-100, built only from findings that triggered
 * @param detectorsInconclusive how many detectors could not run: a low score with many of these is NOT "safe"
 */
public record ScanReport(
        String scanId,
        String scannedAt,
        ScanRequest request,
        int riskScore,
        Severity overallSeverity,
        int detectorsReported,
        int detectorsInconclusive,
        List<String> modulesRun,
        List<String> modulesSkipped,
        String note,
        List<DetectionResult> results) {}
