package com.web3shield.web3shieldbackend.walletshield.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class AlchemyTransfersClient {

    private final RestClient restClient;
    private final String rpcUrl;

    public AlchemyTransfersClient(
            @Value("${chainshield.alchemy.rpc-url:https://eth-mainnet.g.alchemy.com/v2/alch_GnMADts8UC15udqJeBV8R}")
            String rawRpcUrl) {

        String resolvedUrl = (rawRpcUrl == null || rawRpcUrl.isBlank() || rawRpcUrl.contains("${"))
                ? "https://eth-mainnet.g.alchemy.com/v2/alch_GnMADts8UC15udqJeBV8R"
                : rawRpcUrl.trim();

        this.rpcUrl = resolvedUrl;
        this.restClient = RestClient.builder()
                .baseUrl(this.rpcUrl)
                .build();

        log.info("[ALCHEMY_CLIENT] Initialized with endpoint: {}",
                this.rpcUrl.substring(0, Math.min(this.rpcUrl.length(), 38)) + "...");
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record RpcResponse(Result result) {
        @JsonIgnoreProperties(ignoreUnknown = true)
        record Result(List<TransferDto> transfers) {}
    }

    public List<TransferDto> getRecentOutboundTransfers(String walletAddress, int maxCount) {
        log.debug("[ALCHEMY_CLIENT] Fetching outbound transfers for: {}", walletAddress);
        return fetchTransfers(Map.of(
                "fromBlock", "0x0",
                "toBlock", "latest",
                "fromAddress", walletAddress.toLowerCase(),
                "category", List.of("external", "erc20"),
                "order", "desc",
                "withMetadata", true,
                "maxCount", "0x" + Integer.toHexString(maxCount),
                "excludeZeroValue", true
        ));
    }

    public List<TransferDto> getRecentInboundTransfers(String walletAddress, int maxCount) {
        log.debug("[ALCHEMY_CLIENT] Fetching inbound transfers for: {}", walletAddress);
        return fetchTransfers(Map.of(
                "fromBlock", "0x0",
                "toBlock", "latest",
                "toAddress", walletAddress.toLowerCase(),
                "category", List.of("external", "erc20"),
                "order", "desc",
                "withMetadata", true,
                "maxCount", "0x" + Integer.toHexString(maxCount),
                "excludeZeroValue", true
        ));
    }

    public List<TransferDto> getEarliestInboundTransfers(String walletAddress, int maxCount) {
        log.debug("[ALCHEMY_CLIENT] Fetching genesis transfers for: {}", walletAddress);
        return fetchTransfers(Map.of(
                "fromBlock", "0x0",
                "toBlock", "latest",
                "toAddress", walletAddress.toLowerCase(),
                "category", List.of("external", "erc20"),
                "order", "asc",
                "withMetadata", true,
                "maxCount", "0x" + Integer.toHexString(maxCount),
                "excludeZeroValue", true
        ));
    }

    private List<TransferDto> fetchTransfers(Map<String, Object> params) {
        try {
            Map<String, Object> payload = Map.of(
                    "jsonrpc", "2.0",
                    "id", 1,
                    "method", "alchemy_getAssetTransfers",
                    "params", List.of(params)
            );

            RpcResponse response = restClient.post()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(RpcResponse.class);

            if (response != null && response.result() != null && response.result().transfers() != null) {
                return response.result().transfers();
            }
        } catch (Exception e) {
            log.error("[ALCHEMY_CLIENT] RPC query error: {}", e.getMessage());
        }
        return List.of();
    }
}