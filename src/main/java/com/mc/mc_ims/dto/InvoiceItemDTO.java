package com.mc.mc_ims.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class InvoiceItemDTO {

    @NotBlank
    private String productId;

    @NotBlank
    private String description;

    @NotBlank
    private String billOn;

    private String color;
    private String discount;
    private String appliedOn;

    @NotNull
    private BigDecimal price;

    @NotNull
    private Integer quantity;

}