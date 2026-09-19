package com.web3shield.web3shieldbackend.shared.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.http.HttpService;

@Slf4j
@Configuration
public class AlchemyConfig {

    @Bean
    public Web3j web3j(
            @Value("${chainshield.alchemy.rpc-url:https://eth-mainnet.g.alchemy.com/v2/alch_GnMADts8UC15udqJeBV8R}")
            String rpcUrl) {

        String cleanUrl = (rpcUrl == null || rpcUrl.isBlank() || rpcUrl.contains("${"))
                ? "https://eth-mainnet.g.alchemy.com/v2/alch_GnMADts8UC15udqJeBV8R"
                : rpcUrl.trim();

        log.info("[WEB3J_CONFIG] Initializing Web3j with endpoint: {}", cleanUrl.substring(0, Math.min(cleanUrl.length(), 38)) + "...");
        return Web3j.build(new HttpService(cleanUrl));
    }
}