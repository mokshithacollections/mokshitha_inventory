package com.mc.mc_ims.dto;

/**
 * Payload for the Change Password form. Deliberately a plain carrier — the
 * values live only for the duration of the request and are never logged,
 * echoed back, or persisted in readable form.
 */
public class ChangePasswordDTO {

    private String currentPassword;
    private String newPassword;
    private String confirmPassword;

    public String getCurrentPassword() { return currentPassword; }
    public void setCurrentPassword(String currentPassword) { this.currentPassword = currentPassword; }

    public String getNewPassword() { return newPassword; }
    public void setNewPassword(String newPassword) { this.newPassword = newPassword; }

    public String getConfirmPassword() { return confirmPassword; }
    public void setConfirmPassword(String confirmPassword) { this.confirmPassword = confirmPassword; }

    /** Never let a password reach a log line or an error message. */
    @Override
    public String toString() {
        return "ChangePasswordDTO{***}";
    }
}
