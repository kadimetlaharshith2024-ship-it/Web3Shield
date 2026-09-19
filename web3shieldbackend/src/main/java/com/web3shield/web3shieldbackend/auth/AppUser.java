package com.web3shield.web3shieldbackend.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * A registered user with the wallet generated for them at signup.
 * Only the PUBLIC wallet address is stored. The private key is shown to the user once
 * in the signup response and is never saved by the server.
 *
 * Table is named app_users because "user" is a reserved word in PostgreSQL.
 * (Spring Boot 2 project? change every "jakarta.persistence" import to "javax.persistence".)
 */
@Entity
@Table(name = "app_users")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 254)
    private String email;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;   // BCrypt hash, never the raw password

    @Column(name = "wallet_address", nullable = false, unique = true, length = 42)
    private String walletAddress;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /** Required by JPA. */
    protected AppUser() {}

    public AppUser(String email, String name, String passwordHash, String walletAddress) {
        this.email = email;
        this.name = name;
        this.passwordHash = passwordHash;
        this.walletAddress = walletAddress;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getName() { return name; }
    public String getPasswordHash() { return passwordHash; }
    public String getWalletAddress() { return walletAddress; }
    public Instant getCreatedAt() { return createdAt; }
}
