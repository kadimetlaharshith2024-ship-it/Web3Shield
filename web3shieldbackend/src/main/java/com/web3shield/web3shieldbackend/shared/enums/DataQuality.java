package com.web3shield.web3shieldbackend.shared.enums;

/**
 * How much real data a detector had. Lets the report say "could not check" honestly
 * instead of pretending a skipped check was clean.
 */
public enum DataQuality {
    FULL,          // everything the detector wanted was available
    PARTIAL,       // ran, but with a fallback or a small sample
    INCONCLUSIVE   // could not run meaningfully; NOT the same as "safe"
}
