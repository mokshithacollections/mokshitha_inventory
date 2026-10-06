package com.mc.mc_ims.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * A person who may sign in to the system.
 *
 * The password is NEVER stored in readable form — only a one-way hash produced
 * by {@code PasswordEncoder} (bcrypt, written with a {bcrypt} prefix so the
 * algorithm can be upgraded later without invalidating existing rows). There is
 * deliberately no getter that can recover the original password; checking a
 * login means hashing the attempt and comparing, never decrypting.
 *
 * The table is seeded with one account on first start (see InitialUserSeeder);
 * more rows can be added later without any code change.
 */
@Data
@Entity
@Table(name = "app_users")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Login id. An email address in practice; compared case-insensitively. */
    @Column(nullable = false, unique = true, length = 150)
    private String username;

    /** Bcrypt hash, e.g. {bcrypt}$2a$10$... — around 68 characters. */
    @Column(name = "password_hash", nullable = false, length = 120)
    private String passwordHash;

    /** Shown in the account bar, e.g. "Mokshitha". */
    @Column(name = "display_name", length = 100)
    private String displayName;

    /** Soft-disable: an existing account can be locked out without deleting it. */
    @Column(nullable = false)
    private Boolean enabled = true;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    /** Last time the password was changed — surfaced on the change-password form. */
    @Column(name = "password_changed_at")
    private LocalDateTime passwordChangedAt;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;
}
