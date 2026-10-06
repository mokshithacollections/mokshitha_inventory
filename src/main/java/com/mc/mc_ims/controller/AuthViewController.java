package com.mc.mc_ims.controller;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Serves the sign-in page. The POST is handled by Spring Security itself
 * (loginProcessingUrl), so there is no login form handler here.
 */
@Controller
public class AuthViewController {

    @GetMapping("/login")
    public String login() {
        // Already signed in? Don't show the form again — go to the dashboard.
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean signedIn = auth != null
                && auth.isAuthenticated()
                && !(auth instanceof AnonymousAuthenticationToken);

        return signedIn ? "redirect:/" : "login";
    }
}
