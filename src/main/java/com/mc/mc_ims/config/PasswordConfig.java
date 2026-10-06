package com.mc.mc_ims.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * The password encoder lives in its own configuration class on purpose.
 *
 * SecurityConfig needs AppUserService (to resolve users), and AppUserService
 * needs the PasswordEncoder. If the encoder bean were declared inside
 * SecurityConfig, those two would form a cycle and the context would refuse to
 * start. Declaring it here gives both of them a dependency with no back edge.
 */
@Configuration
public class PasswordConfig {

    /**
     * Delegating encoder: hashes new passwords with bcrypt and stores them with
     * a {bcrypt} prefix. If a stronger algorithm is adopted later, existing
     * rows keep verifying instead of locking everyone out.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }
}
