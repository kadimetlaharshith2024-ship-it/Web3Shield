package com.web3shield.web3shieldbackend.accessguard.detector;

import org.web3j.protocol.Web3j;
import java.math.BigInteger;
import java.util.List;

public interface Detector {

    record Finding(String detector, String severity, String message, String txHash) {}

    List<Finding> detect(Web3j web3j, String contract, BigInteger fromBlock, BigInteger toBlock) throws Exception;
}