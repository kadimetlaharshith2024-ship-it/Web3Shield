package com.web3shield.web3shieldbackend.auth;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.web3j.crypto.ECKeyPair;
import org.web3j.crypto.Keys;
import org.web3j.utils.Numeric;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * POST /api/auth/signup  and  POST /api/auth/login
 *
 * Baseline accounts: email + password (BCrypt hashed), plus an auto-generated wallet.
 * There is NO session or token yet: login only proves the credentials are right and returns the profile.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final int MAX_EMAIL = 254;
    private static final int MIN_PASSWORD = 8;
    private static final int MAX_PASSWORD_BYTES = 72;   // BCrypt ignores anything longer
    private static final int MAX_NAME = 60;
    private static final String WALLET_WARNING =
            "This private key is shown ONLY ONCE and is not stored by the server. Save it now. "
                    + "Use this wallet for testing only; never put real funds in it.";

    private final AuthUserRepository users;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    /** Compared against when the email is unknown, so login takes similar time either way. */
    private final String dummyHash = encoder.encode("not-a-real-password");

    public AuthController(AuthUserRepository users) {
        this.users = users;
    }

    // ------------------------------------------------------------------ DTOs

    public record SignupRequest(String email, String password, String name) {}

    public record LoginRequest(String email, String password) {}

    public record UserResponse(Long id, String email, String name, String walletAddress, String createdAt) {}

    /** The private key appears here and nowhere else. */
    public record SignupResponse(UserResponse user, String walletPrivateKey, String warning) {}

    private record Wallet(String address, String privateKey) {}

    // ------------------------------------------------------------------ endpoints

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public SignupResponse signup(@RequestBody(required = false) SignupRequest request) {
        if (request == null) {
            throw bad("Request body is required");
        }
        String email = normalizeEmail(request.email());
        if (email == null || email.length() > MAX_EMAIL || !EMAIL.matcher(email).matches()) {
            throw bad("A valid email is required");
        }
        String password = request.password();
        if (password == null || password.length() < MIN_PASSWORD) {
            throw bad("Password must be at least " + MIN_PASSWORD + " characters");
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > MAX_PASSWORD_BYTES) {
            throw bad("Password is too long (max " + MAX_PASSWORD_BYTES + " bytes)");
        }
        String name = request.name() == null || request.name().isBlank()
                ? email.substring(0, email.indexOf('@'))
                : request.name().trim();
        if (name.length() > MAX_NAME) {
            throw bad("Name must be at most " + MAX_NAME + " characters");
        }

        if (users.existsByEmail(email)) {
            throw conflict();
        }

        Wallet wallet = generateWallet();
        AppUser user = new AppUser(email, name, encoder.encode(password), wallet.address());
        try {
            user = users.save(user);
        } catch (DataIntegrityViolationException e) {
            throw conflict();   // two signups with the same email raced each other
        }
        return new SignupResponse(toResponse(user), wallet.privateKey(), WALLET_WARNING);
    }

    @PostMapping("/login")
    public UserResponse login(@RequestBody(required = false) LoginRequest request) {
        if (request == null || request.email() == null || request.email().isBlank()
                || request.password() == null || request.password().isEmpty()) {
            throw bad("email and password are required");
        }
        Optional<AppUser> user = users.findByEmail(normalizeEmail(request.email()));
        String hash = user.map(AppUser::getPasswordHash).orElse(dummyHash);
        boolean passwordOk = encoder.matches(request.password(), hash);

        if (user.isEmpty() || !passwordOk) {
            // same message for "no such user" and "wrong password" so emails cannot be probed
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
        return toResponse(user.get());
    }

    // ------------------------------------------------------------------ helpers

    private static Wallet generateWallet() {
        try {
            ECKeyPair keyPair = Keys.createEcKeyPair();
            String address = Keys.toChecksumAddress(Keys.getAddress(keyPair));
            String privateKey = Numeric.toHexStringWithPrefixZeroPadded(keyPair.getPrivateKey(), 64);
            return new Wallet(address, privateKey);
        } catch (GeneralSecurityException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not generate wallet");
        }
    }

    private static String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    private static UserResponse toResponse(AppUser u) {
        return new UserResponse(u.getId(), u.getEmail(), u.getName(), u.getWalletAddress(),
                u.getCreatedAt().toString());
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static ResponseStatusException conflict() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists");
    }
}
