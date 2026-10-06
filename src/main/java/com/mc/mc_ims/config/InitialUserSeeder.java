package com.mc.mc_ims.config;

import com.mc.mc_ims.entity.AppUser;
import com.mc.mc_ims.repository.AppUserRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Creates the first sign-in account the very first time the app starts against
 * an empty app_users table. Does nothing on every start after that, so a
 * changed password is never silently reset back to the seed value.
 *
 * Both values are overridable, which matters for Render: set
 * MOKSHITHA_AUTH_SEED_USERNAME / MOKSHITHA_AUTH_SEED_PASSWORD as environment
 * variables there so the real credentials never live in the repository.
 */
@Component
public class InitialUserSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(InitialUserSeeder.class);

    /** The default that ships with the code — fine locally, change it in production. */
    private static final String DEFAULT_PASSWORD = "Inventory!2026";

    @Value("${mokshitha.auth.seed-username:mokshitha@inventory.local}")
    private String seedUsername;

    @Value("${mokshitha.auth.seed-password:" + DEFAULT_PASSWORD + "}")
    private String seedPassword;

    @Value("${mokshitha.auth.seed-display-name:Mokshitha}")
    private String seedDisplayName;

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public InitialUserSeeder(AppUserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {

        if (userRepository.count() > 0) {
            return;   // Already set up — never touch existing accounts.
        }

        String username = seedUsername == null ? "" : seedUsername.trim();
        if (username.isEmpty()) {
            log.error("No seed username configured — cannot create the first sign-in account.");
            return;
        }

        AppUser user = new AppUser();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(seedPassword));
        user.setDisplayName(seedDisplayName);
        user.setEnabled(true);
        user.setCreatedAt(LocalDateTime.now());
        user.setPasswordChangedAt(LocalDateTime.now());
        userRepository.save(user);

        log.info("Created the initial sign-in account: {}", username);

        if (DEFAULT_PASSWORD.equals(seedPassword)) {
            log.warn("""
                    ============================================================
                     This account was created with the DEFAULT password that is
                     committed to the repository. Anyone who can read the source
                     can sign in. Change it from the dashboard (Change Password)
                     as soon as you have logged in for the first time.
                    ============================================================""");
        }
    }
}
