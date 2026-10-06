package com.mc.mc_ims.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/** Full running statement for one supplier. */
@Data
public class SupplierLedgerDTO {

    private String supplierId;
    private String supplierName;
    private BigDecimal openingBalance;
    private List<LedgerEntryDTO> entries;
    private BigDecimal closingBalance;
}
