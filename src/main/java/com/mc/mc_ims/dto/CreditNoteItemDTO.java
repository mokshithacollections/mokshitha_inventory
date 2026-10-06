package com.mc.mc_ims.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreditNoteItemDTO {

    @NotBlank
    private String productId;

    @NotBlank
    private String description;

    private String color;

    @NotNull
    @Min(1)
    private Integer quantity;

    /** Credited value per unit. */
    @NotNull
    @PositiveOrZero
    private BigDecimal unitValue;
}
