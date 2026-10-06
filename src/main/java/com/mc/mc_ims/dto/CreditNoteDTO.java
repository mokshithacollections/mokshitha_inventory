package com.mc.mc_ims.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class CreditNoteDTO {

    @NotBlank
    private String supplierId;

    /** ISO date (YYYY-MM-DD). If null, the server uses today. */
    private String creditDate;

    private String reason;

    private String reference;

    /**
     * When true, the line items are removed from stock (goods sent back).
     * Ignored when there are no items.
     */
    private Boolean reduceStock;

    private String notes;

    /**
     * Total credit value. Required when there are no line items.
     * When items ARE provided, the server computes the total from them.
     */
    @PositiveOrZero
    private BigDecimal amount;

    /** Optional — present when the credit is tied to specific returned products. */
    @Valid
    private List<CreditNoteItemDTO> items;
}
