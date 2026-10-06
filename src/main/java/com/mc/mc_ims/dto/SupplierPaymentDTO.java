package com.mc.mc_ims.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class SupplierPaymentDTO {

    @NotNull
    @Positive
    private BigDecimal amount;

    /** ISO date (YYYY-MM-DD). If null, the server uses today. */
    private String paymentDate;

    private String mode;

    private String reference;

    private String notes;
}
