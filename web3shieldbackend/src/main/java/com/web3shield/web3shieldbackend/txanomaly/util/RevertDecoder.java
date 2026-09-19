package com.web3shield.web3shieldbackend.txanomaly.util;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Decodes the raw "revert data" returned by eth_call for a failed transaction.
 *
 * Solidity revert data has three shapes:
 *   0x08c379a0 + ABI(string)   -> require(..., "reason") / revert("reason")
 *   0x4e487b71 + uint256       -> Panic(code): overflow, div by zero, assert...
 *   any other 4-byte selector  -> a custom error (needs a signature lookup)
 * Empty data ("0x") means a bare revert() or a failed require() with no message.
 *
 * Pure Java on purpose: no web3j, no Spring. Easy to unit test.
 */
public final class RevertDecoder {

    public enum Kind { EMPTY, ERROR_STRING, PANIC, CUSTOM_ERROR, UNDECODABLE }

    public record Decoded(Kind kind, String reason, String selector) {}

    private static final String ERROR_SELECTOR = "08c379a0";
    private static final String PANIC_SELECTOR = "4e487b71";

    private static final Map<Integer, String> PANIC_CODES = Map.ofEntries(
            Map.entry(0x00, "Generic compiler panic"),
            Map.entry(0x01, "assert() failed"),
            Map.entry(0x11, "Arithmetic overflow or underflow"),
            Map.entry(0x12, "Division or modulo by zero"),
            Map.entry(0x21, "Invalid enum conversion"),
            Map.entry(0x22, "Incorrectly encoded storage byte array"),
            Map.entry(0x31, "pop() on an empty array"),
            Map.entry(0x32, "Array index out of bounds"),
            Map.entry(0x41, "Too much memory allocated"),
            Map.entry(0x51, "Call to a zero-initialized function pointer"));

    private RevertDecoder() {}

    public static Decoded decode(String revertHex) {
        if (revertHex == null) {
            return new Decoded(Kind.EMPTY, "No revert data", null);
        }
        String hex = revertHex.startsWith("0x") || revertHex.startsWith("0X")
                ? revertHex.substring(2) : revertHex;
        hex = hex.toLowerCase();

        if (hex.isEmpty()) {
            return new Decoded(Kind.EMPTY, "Reverted with no reason (bare revert or failed require)", null);
        }
        if (hex.length() % 2 != 0 || !hex.matches("[0-9a-f]+") || hex.length() < 8) {
            return new Decoded(Kind.UNDECODABLE, "Malformed revert data", null);
        }

        String selector = hex.substring(0, 8);
        String body = hex.substring(8);

        try {
            if (selector.equals(ERROR_SELECTOR)) {
                return new Decoded(Kind.ERROR_STRING, decodeString(body), "0x" + selector);
            }
            if (selector.equals(PANIC_SELECTOR)) {
                int code = new BigInteger(body.isEmpty() ? "0" : body, 16).intValueExact();
                String meaning = PANIC_CODES.getOrDefault(code, "Unknown panic code");
                return new Decoded(Kind.PANIC,
                        String.format("Panic 0x%02x: %s", code, meaning), "0x" + selector);
            }
        } catch (RuntimeException e) {
            return new Decoded(Kind.UNDECODABLE, "Could not decode revert payload", "0x" + selector);
        }
        return new Decoded(Kind.CUSTOM_ERROR, "Custom error " + "0x" + selector, "0x" + selector);
    }

    /** ABI-decodes a single dynamic string: [offset][length][bytes...]. */
    private static String decodeString(String bodyHex) {
        int offset = new BigInteger(bodyHex.substring(0, 64), 16).intValueExact() * 2;
        int length = new BigInteger(bodyHex.substring(offset, offset + 64), 16).intValueExact();
        int start = offset + 64;
        String strHex = bodyHex.substring(start, start + length * 2);
        byte[] bytes = new byte[length];
        for (int i = 0; i < length; i++) {
            bytes[i] = (byte) Integer.parseInt(strHex.substring(i * 2, i * 2 + 2), 16);
        }
        return new String(bytes, StandardCharsets.UTF_8);
    }
}
