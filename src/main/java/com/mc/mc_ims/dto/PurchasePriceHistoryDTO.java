package com.mc.mc_ims.dto;

import java.math.BigDecimal;

/** One prior purchase of a product — what was paid, when, and to whom. */
public class PurchasePriceHistoryDTO {

    private String purchaseId;
    private String purchaseDate;   // ISO yyyy-MM-dd
    private String supplierName;
    private BigDecimal costPrice;
    private Integer quantity;

    public PurchasePriceHistoryDTO(String purchaseId, String purchaseDate,
                                   String supplierName, BigDecimal costPrice, Integer quantity) {
        this.purchaseId = purchaseId;
        this.purchaseDate = purchaseDate;
        this.supplierName = supplierName;
        this.costPrice = costPrice;
        this.quantity = quantity;
    }

    public String getPurchaseId() { return purchaseId; }
    public String getPurchaseDate() { return purchaseDate; }
    public String getSupplierName() { return supplierName; }
    public BigDecimal getCostPrice() { return costPrice; }
    public Integer getQuantity() { return quantity; }
}
