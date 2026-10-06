package com.mc.mc_ims.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

/**
 * One line item the customer is returning, within a ReturnRequestDTO.
 */
@Data
public class ReturnedItemDTO {

    /** The InvoiceItem.id this return refers to. */
    @NotNull
    private Long originalInvoiceItemId;

    @NotNull
    @Min(1)
    private Integer quantityReturned;

    /** Damaged | Quality | Size | Color | Other */
    @NotBlank
    private String reason;

    private String reasonNotes;
}