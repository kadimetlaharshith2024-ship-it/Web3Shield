package com.web3shield.web3shieldbackend.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/** JPA persistence for AppUser. Spring generates the implementation automatically. */
public interface AuthUserRepository extends JpaRepository<AppUser, Long> {

    /** Emails are stored lower-cased, so callers must lower-case before searching. */
    Optional<AppUser> findByEmail(String email);

    boolean existsByEmail(String email);
}
