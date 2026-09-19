package com.web3shield.web3shieldbackend.honeypotintel.service;

import okhttp3.OkHttpClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.http.HttpService;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.response.EthChainId;
import org.web3j.protocol.core.methods.response.EthGetCode;
import org.web3j.protocol.core.methods.response.EthGetStorageAt;

import java.util.concurrent.TimeUnit;

@Service
public class BlockchainService {

    private final Web3j web3j;

    public BlockchainService(@Value("${chainshield.alchemy.rpc-url}") String rpcUrl) {
        if (rpcUrl == null || rpcUrl.isBlank()) {
            throw new IllegalStateException(
                    "chainshield.alchemy.rpc-url is not configured"
            );
        }

        OkHttpClient httpClient = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(10, TimeUnit.SECONDS)
                .writeTimeout(10, TimeUnit.SECONDS)
                .build();

        this.web3j = Web3j.build(new HttpService(rpcUrl, httpClient));
    }

    public String getBytecode(String address) throws Exception {
        EthGetCode response = web3j.ethGetCode(address, DefaultBlockParameterName.LATEST).send();

        if (response.hasError()) {
            throw new RuntimeException("RPC error (getBytecode): "
                    + response.getError().getCode() + " - " + response.getError().getMessage());
        }

        return response.getCode();
    }

    public String getChainId() throws Exception {
        EthChainId response = web3j.ethChainId().send();

        if (response.hasError()) {
            throw new RuntimeException("RPC error (getChainId): "
                    + response.getError().getCode() + " - " + response.getError().getMessage());
        }

        return response.getChainId().toString();
    }

    public String getImplementationSlot(String proxyAddress) throws Exception {
        String eip1967Slot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

        EthGetStorageAt response = web3j
                .ethGetStorageAt(proxyAddress, org.web3j.utils.Numeric.toBigInt(eip1967Slot), DefaultBlockParameterName.LATEST)
                .send();

        if (response.hasError()) {
            throw new RuntimeException("RPC error (getImplementationSlot): "
                    + response.getError().getCode() + " - " + response.getError().getMessage());
        }

        return response.getData();
    }

    public String extractAddressFromSlot(String slotValue) {

        if (slotValue == null || slotValue.isBlank()) {
            return null;
        }

        String hex = slotValue.startsWith("0x")
                ? slotValue.substring(2)
                : slotValue;

        if (hex.isEmpty() || hex.matches("0+")) {
            return null;
        }

        if (hex.length() < 40) {
            return null;
        }

        String address = hex.substring(hex.length() - 40);

        return "0x" + address;
    }
}