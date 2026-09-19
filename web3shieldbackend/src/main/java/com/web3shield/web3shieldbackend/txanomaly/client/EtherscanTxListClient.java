package com.web3shield.web3shieldbackend.txanomaly.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.web3shield.web3shieldbackend.txanomaly.model.TxContext;
import com.web3shield.web3shieldbackend.txanomaly.model.TxContext.HistoricTx;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Component
public class EtherscanTxListClient {

    private static final Logger log = LoggerFactory.getLogger(EtherscanTxListClient.class);
    private static final String BASE_URL = "https://api.etherscan.io/v2/api";

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5)).build();
    private final ObjectMapper mapper = new ObjectMapper();
    private final String apiKey;
    private final long chainId;

    public EtherscanTxListClient(
            @Value("${chainshield.etherscan.api-key:${etherscan.api-key:${ETHERSCAN_API_KEY:HAI72QHPRV3THSVGYXR7UJ26F7F75WNGNY}}}") String rawApiKey,
            @Value("${chainshield.etherscan.chain-id:${etherscan.chain-id:${ETHERSCAN_CHAIN_ID:1}}}") long chainId) {

        this.apiKey = (rawApiKey == null || rawApiKey.isBlank() || rawApiKey.contains("${"))
                ? "HAI72QHPRV3THSVGYXR7UJ26F7F75WNGNY"
                : rawApiKey.trim();
        this.chainId = chainId;

        log.info("[ETHERSCAN_CLIENT] Initialized with chainId: {}, key configured: {}", this.chainId, isConfigured());
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    /** Up to {@code limit} transactions to/from {@code address}, newest first, ending at {@code endBlock}. */
    public List<HistoricTx> recentTxs(String address, BigInteger endBlock, int limit) {
        if (!isConfigured()) {
            log.warn("[ETHERSCAN_CLIENT] API key not set: skipping history lookup");
            return List.of();
        }

        String url = BASE_URL + "?chainid=" + chainId
                + "&module=account&action=txlist"
                + "&address=" + address
                + "&startblock=0&endblock=" + endBlock
                + "&page=1&offset=" + limit
                + "&sort=desc&apikey=" + apiKey;

        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(8)).GET().build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.warn("[ETHERSCAN_CLIENT] Etherscan returned HTTP {}", response.statusCode());
                return List.of();
            }

            JsonNode result = mapper.readTree(response.body()).path("result");
            if (!result.isArray()) {
                log.warn("[ETHERSCAN_CLIENT] Etherscan non-array response: {}", result.asText());
                return List.of();
            }

            List<HistoricTx> out = new ArrayList<>();
            for (JsonNode n : result) {
                out.add(new HistoricTx(
                        n.path("hash").asText(),
                        n.path("from").asText(),
                        big(n, "gasUsed"),
                        big(n, "gas"),
                        big(n, "gasPrice"),
                        TxContext.hexByteLength(n.path("input").asText()),
                        "1".equals(n.path("isError").asText()),
                        big(n, "blockNumber")));
            }
            log.info("[ETHERSCAN_CLIENT] Successfully retrieved {} past transactions for baseline.", out.size());
            return out;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return List.of();
        } catch (Exception e) {
            log.warn("[ETHERSCAN_CLIENT] History lookup error: {}", e.getMessage());
            return List.of();
        }
    }

    private static BigInteger big(JsonNode node, String field) {
        String text = node.path(field).asText("");
        return text.isBlank() ? BigInteger.ZERO : new BigInteger(text);
    }
}