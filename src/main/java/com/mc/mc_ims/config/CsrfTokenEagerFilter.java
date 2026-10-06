package com.mc.mc_ims.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Forces the CSRF token to be generated at the START of each request.
 *
 * Since Spring Security 6 the token is loaded lazily: CsrfFilter only puts a
 * supplier in the request, and the token is created the first time something
 * asks for it. Creating it writes to the HTTP session.
 *
 * That breaks on a large server-rendered page. Tomcat's response buffer is 8KB,
 * and login.html's stylesheet alone is bigger than that — so by the time
 * Thymeleaf reaches the <form> and asks for the token, the response is already
 * committed and Tomcat refuses to start a session:
 *
 *     IllegalStateException: Cannot create a session after the response has
 *     been committed
 *
 * Touching the token here, before a single byte of the body is written, makes
 * the problem structural rather than a function of how long a page happens to
 * be. Cheap: one map lookup per request once the token already exists.
 */
public class CsrfTokenEagerFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        CsrfToken token = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        if (token != null) {
            token.getToken();   // materialise it now, while the response is still empty
        }

        filterChain.doFilter(request, response);
    }
}
