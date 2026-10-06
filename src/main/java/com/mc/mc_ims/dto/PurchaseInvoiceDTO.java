package com.mc.mc_ims.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class PurchaseInvoiceDTO {

    @NotBlank
    private String supplierId;

    /** Number printed on the supplier's own paper invoice (optional). */
    private String supplierInvoiceNo;

    /** ISO date (YYYY-MM-DD). If null, the server uses today. */
    private String purchaseDate;

    /** How much was paid now (0 = fully on credit). Defaults to 0. */
    @PositiveOrZero
    private BigDecimal amountPaid;

    private String paymentMode;

    private String notes;

    @NotEmpty
    @Valid
    private List<PurchaseItemDTO> items;
}
