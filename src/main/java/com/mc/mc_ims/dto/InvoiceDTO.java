package com.mc.mc_ims.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.util.List;

@Data
public class InvoiceDTO {

    @NotBlank
    private String sellerName;

    @NotBlank
    private String buyerName;

    @NotBlank
    @Size(min = 10, max = 10)
    private String buyerMobile;

    @NotBlank
    private String paymentMode;

    @NotEmpty
    private List<InvoiceItemDTO> items;

    
}
