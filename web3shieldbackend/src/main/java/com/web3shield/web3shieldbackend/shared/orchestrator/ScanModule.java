package com.web3shield.web3shieldbackend.shared.orchestrator;

import com.web3shield.web3shieldbackend.shared.model.DetectionResult;
import com.web3shield.web3shieldbackend.shared.model.ScanRequest;

import java.util.List;

/**
 * Each module's SERVICE implements this so ScanOrchestrator finds it automatically
 * (Spring injects every ScanModule bean). Implementing it is the only wiring a module needs.
 *
 * Example:
 *   @Service
 *   public class WalletShieldService implements ScanModule {
 *       public String moduleName()               { return "walletshield"; }
 *       public boolean supports(ScanRequest r)   { return r.address() != null; }
 *       public List<DetectionResult> scan(ScanRequest r) { return analyze(r.address()); }
 *   }
 */
public interface ScanModule {

    /** Short unique name, e.g. "txanomaly". */
    String moduleName();

    /** True if this module can work with the request (e.g. it has the field the module needs). */
    boolean supports(ScanRequest request);

    /** Run all of this module's detectors. Called only when supports() returned true. */
    List<DetectionResult> scan(ScanRequest request);
}
