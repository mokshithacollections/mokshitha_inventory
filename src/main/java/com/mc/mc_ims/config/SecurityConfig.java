package com.mc.mc_ims.config;

import com.mc.mc_ims.service.AppUserService;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.event.InteractiveAuthenticationSuccessEvent;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.http.HttpStatus;

/**
 * Locks the whole application behind a form login.
 *
 * Everything is denied by default — only the login page itself and the static
 * assets it needs are public. That includes every /api/** endpoint, which
 * previously answered to anyone who could reach the port.
 *
 * Note this sits ALONGSIDE, not instead of, the existing admin-password prompt
 * on Analysis and Purchases. One shared login account means staff and owner
 * sign in as the same user, so that second prompt is what still separates
 * day-to-day billing from margins, supplier costs and the ledger.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final AppUserService appUserService;

    public SecurityConfig(AppUserService appUserService) {
        this.appUserService = appUserService;
    }

    // NOTE: the PasswordEncoder bean deliberately lives in PasswordConfig, not
    // here. AppUserService needs it, and this class needs AppUserService —
    // declaring it here would make those two a circular dependency.

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        http
            .authorizeHttpRequests(auth -> auth
                // The login page and the assets required to render it.
                .requestMatchers("/login", "/error",
                                 "/css/**", "/js/**", "/img/**",
                                 "/favicon.ico").permitAll()
                // Everything else — pages AND the whole REST API.
                .anyRequest().authenticated()
            )

            .formLogin(form -> form
                .loginPage("/login")
                .loginProcessingUrl("/login")
                .usernameParameter("username")
                .passwordParameter("password")
                // Always land on the dashboard, rather than replaying whatever
                // deep link or API URL happened to trigger the redirect.
                .defaultSuccessUrl("/", true)
                .failureUrl("/login?error")
                .permitAll()
            )

            .logout(logout -> logout
                // With CSRF enabled this is POST-only by default, so a stray
                // link or <img src="/logout"> cannot sign you out. The account
                // bar submits a real form carrying the token.
                .logoutUrl("/logout")
                .logoutSuccessUrl("/login?logout")
                .invalidateHttpSession(true)
                .clearAuthentication(true)
                // Must match server.servlet.session.cookie.name in application.properties.
                .deleteCookies("MCIMSSESSION")
                .permitAll()
            )

            .sessionManagement(session -> session
                // New session id on login, so a session id captured beforehand
                // cannot be reused afterwards (session fixation).
                .sessionFixation(fixation -> fixation.migrateSession())
                .invalidSessionUrl("/login?expired")
            )

            // An expired session hitting /api/** must answer 401, not redirect to
            // the login page. A redirect is followed transparently by fetch(), so
            // the JS would otherwise receive the login HTML with a 200 and try to
            // parse it as JSON — producing a baffling error instead of "signed
            // out". Page requests still redirect as normal.
            .exceptionHandling(ex -> ex
                .defaultAuthenticationEntryPointFor(
                        new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                        PathPatternRequestMatcher.withDefaults().matcher("/api/**"))
            )

            // CSRF stays ON. The token is published to each page as a <meta> tag
            // and auth.js attaches it to every mutating fetch, so the existing
            // JS call sites did not need changing.
            //
            // CsrfTokenEagerFilter generates the token before any of the page
            // body is written — see that class for why a lazily created token
            // breaks on a page larger than the response buffer.
            .csrf(csrf -> { })
            .addFilterAfter(new CsrfTokenEagerFilter(), CsrfFilter.class)

            .userDetailsService(appUserService);

        return http.build();
    }

    /** Stamp last_login_at after a real (interactive) sign-in. */
    @EventListener
    public void onLoginSuccess(InteractiveAuthenticationSuccessEvent event) {
        try {
            appUserService.recordLogin(event.getAuthentication().getName());
        } catch (Exception ignored) {
            // Never let bookkeeping block a successful login.
        }
    }
}
