package com.web3shield.web3shieldbackend.walletshield.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.Instant;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TransferDto(
        String blockNum,
        String uniqueId,
        String hash,
        String from,
        String to,
        Double value,
        String erc721TokenId,
        String erc1155Metadata,
        String tokenId,
        String asset,
        String category,
        RawContract rawContract,
        Metadata metadata
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RawContract(String value, String address, String decimal) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Metadata(String blockTimestamp) {}

    /**
     * Parses metadata.blockTimestamp (ISO-8601 string) into Instant for window calculations.
     */
    public Instant getTimestamp() {
        if (metadata != null && metadata.blockTimestamp() != null && !metadata.blockTimestamp().isBlank()) {
            try {
                return Instant.parse(metadata.blockTimestamp());
            } catch (Exception ignored) {
                // Fallback if timestamp cannot be parsed
            }
        }
        return Instant.EPOCH;
    }
}