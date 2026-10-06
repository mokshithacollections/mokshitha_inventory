package com.mc.mc_ims.controller;

import com.mc.mc_ims.dto.ChangePasswordDTO;
import com.mc.mc_ims.entity.AppUser;
import com.mc.mc_ims.service.AppUserService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;

import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

/**
 * The signed-in user's own account: who am I, and change my password.
 */
@RestController
@RequestMapping("/api/account")
public class AccountRestController {

    private static final DateTimeFormatter STAMP =
            DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a");

    @Autowired
    private AppUserService appUserService;

    /** Drives the account bar at the bottom of the dashboard. */
    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication authentication) {
        AppUser user = appUserService.requireByUsername(authentication.getName());

        Map<String, Object> body = new HashMap<>();
        body.put("username",    user.getUsername());
        body.put("displayName", user.getDisplayName());
        body.put("lastLoginAt", user.getLastLoginAt() == null ? null
                                : user.getLastLoginAt().format(STAMP));
        body.put("passwordChangedAt", user.getPasswordChangedAt() == null ? null
                                : user.getPasswordChangedAt().format(STAMP));
        return ResponseEntity.ok(body);
    }

    /**
     * Change the signed-in user's password.
     *
     * On success the current session is invalidated: changing a password should
     * end any other session using the old one, and signing back in proves the
     * new password actually works before the user walks away from the till.
     */
    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody ChangePasswordDTO dto,
                                            Authentication authentication,
                                            HttpServletRequest request) {
        try {
            appUserService.changePassword(
                    authentication.getName(),
                    dto.getCurrentPassword(),
                    dto.getNewPassword(),
                    dto.getConfirmPassword());

            request.getSession().invalidate();

            return ResponseEntity.ok(Map.of(
                    "message",  "Password changed. Please sign in again with your new password.",
                    "signedOut", true));

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500)
                    .body(Map.of("error", "Could not change the password. Please try again."));
        }
    }
}
