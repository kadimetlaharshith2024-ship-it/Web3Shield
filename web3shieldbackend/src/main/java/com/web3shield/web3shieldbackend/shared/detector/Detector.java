package com.web3shield.web3shieldbackend.shared.detector;

import com.web3shield.web3shieldbackend.shared.model.DetectionResult;

/**
 * Contract every detector implements.
 *
 * C is the input the detector needs, chosen by the module that owns it:
 *   txanomaly  -> Detector<TxContext>
 *   walletshield -> Detector<String> (wallet address) or your own context class
 *
 * Rules for implementers:
 *   1. Annotate the class with @Component so it is discovered automatically.
 *   2. detect() should not throw. If data is missing return DetectionResult.inconclusive(...).
 *   3. Never log API keys or full RPC URLs.
 */
public interface Detector<C> {

    /** Short stable id, e.g. "D06". */
    String id();

    /** Human readable name, e.g. "Reverted Transaction". */
    String name();

    DetectionResult detect(C context);
}
