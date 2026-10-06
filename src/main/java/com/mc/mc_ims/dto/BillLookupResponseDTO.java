package com.mc.mc_ims.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Response shape for GET /api/return/lookup/{billNo}.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BillLookupResponseDTO {

    private String billNo;
    private LocalDate invoiceDate;
    private LocalTime invoiceTime;
    private String sellerName;
    private String buyerName;
    private String buyerMobile;
    private String paymentMode;
    private BigDecimal totalAmount;

    private long daysSincePurchase;
    private boolean withinReturnWindow;
    private int returnWindowDays;

    private List<ItemView> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ItemView {
        private Long id;
        private String description;
        private String color;
        private String billOn;
        private String discount;
        private String appliedOn;
        private BigDecimal price;
        private Integer quantity;
        private Integer returnedQuantity;
        private Integer remainingReturnable;
        private BigDecimal totalPrice;
    }
}