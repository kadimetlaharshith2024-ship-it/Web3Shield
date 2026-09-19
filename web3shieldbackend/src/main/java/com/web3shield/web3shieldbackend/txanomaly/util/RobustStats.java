package com.web3shield.web3shieldbackend.txanomaly.util;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Median / MAD based statistics. Robust: one huge outlier in the baseline
 * does not distort the result the way mean / standard deviation would.
 * Pure Java, no Spring, easy to unit test.
 */
public final class RobustStats {

    private RobustStats() {}

    public static double median(List<Double> values) {
        if (values == null || values.isEmpty()) {
            throw new IllegalArgumentException("median of empty list");
        }
        List<Double> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        int n = sorted.size();
        return n % 2 == 1
                ? sorted.get(n / 2)
                : (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2.0;
    }

    /** Median Absolute Deviation around the given median. */
    public static double mad(List<Double> values, double median) {
        List<Double> deviations = new ArrayList<>(values.size());
        for (double v : values) {
            deviations.add(Math.abs(v - median));
        }
        return median(deviations);
    }

    /**
     * Modified z-score: 0.6745 * (x - median) / MAD.
     * If MAD is 0 (baseline is almost constant) we fall back to 5% of the median,
     * or 1.0 when the median itself is 0, so a constant baseline still works.
     */
    public static double modifiedZ(double x, double median, double mad) {
        double scale = mad > 0 ? mad : (median != 0 ? 0.05 * Math.abs(median) : 1.0);
        return 0.6745 * (x - median) / scale;
    }
}
