package com.mc.mc_ims.service;

import com.mc.mc_ims.entity.AppUser;
import com.mc.mc_ims.repository.AppUserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Bridges our {@link AppUser} table to Spring Security, and owns the
 * password-change rules.
 *
 * Spring Security calls {@link #loadUserByUsername} during login, then compares
 * the submitted password against the stored hash itself — this class never sees
 * a plaintext password except in {@link #changePassword}, where it is hashed
 * immediately and never stored or logged.
 */
@Service
public class AppUserService implements UserDetailsService {

    /** Minimum length for a new password. */
    public static final int MIN_PASSWORD_LENGTH = 10;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // =========================================================
    //  Spring Security entry point
    // =========================================================
    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        String lookup = username == null ? "" : username.trim();

        AppUser user = userRepository.findByUsernameIgnoreCase(lookup)
                .orElseThrow(() -> new UsernameNotFoundException("No account for " + lookup));

        return User.withUsername(user.getUsername())
                .password(user.getPasswordHash())
                .disabled(!Boolean.TRUE.equals(user.getEnabled()))
                .authorities("ROLE_USER")
                .build();
    }

    // =========================================================
    //  Account helpers
    // =========================================================
    @Transactional(readOnly = true)
    public AppUser requireByUsername(String username) {
        return userRepository.findByUsernameIgnoreCase(username == null ? "" : username.trim())
                .orElseThrow(() -> new IllegalArgumentException("Account not found: " + username));
    }

    /** Stamped after a successful interactive login, for the "last signed in" line. */
    @Transactional
    public void recordLogin(String username) {
        userRepository.findByUsernameIgnoreCase(username == null ? "" : username.trim())
                .ifPresent(u -> {
                    u.setLastLoginAt(LocalDateTime.now());
                    userRepository.save(u);
                });
    }

    // =========================================================
    //  Change password
    // =========================================================
    /**
     * Replace the signed-in user's password.
     *
     * Requires the current password, so someone who finds an unattended logged-in
     * screen still cannot lock the owner out of their own system.
     *
     * @throws IllegalArgumentException with a message safe to show the user
     */
    @Transactional
    public void changePassword(String username, String currentPassword,
                               String newPassword, String confirmPassword) {

        AppUser user = requireByUsername(username);

        if (currentPassword == null || currentPassword.isEmpty()) {
            throw new IllegalArgumentException("Enter your current password.");
        }
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect.");
        }
        if (newPassword == null || newPassword.isBlank()) {
            throw new IllegalArgumentException("Enter a new password.");
        }
        if (newPassword.length() < MIN_PASSWORD_LENGTH) {
            throw new IllegalArgumentException(
                    "New password must be at least " + MIN_PASSWORD_LENGTH + " characters.");
        }
        if (!newPassword.equals(confirmPassword)) {
            throw new IllegalArgumentException("New password and confirmation do not match.");
        }
        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("New password must be different from the current one.");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setPasswordChangedAt(LocalDateTime.now());
        userRepository.save(user);
    }
}
