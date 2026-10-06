package com.mc.mc_ims.entity;

import jakarta.persistence.*;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonBackReference;

import java.math.BigDecimal;

@Entity
@Table(name = "return_items",
       indexes = @Index(name = "idx_return_id", columnList = "return_id"))
@Data
public class ReturnItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "original_invoice_item_id", nullable = false)
    private Long originalInvoiceItemId;

    @Column(name = "product_id", length = 50)
    private String productId;

    @Column(name = "description", nullable = false, length = 150)
    private String description;

    @Column(name = "quantity_returned", nullable = false)
    private Integer quantityReturned;

    /** Damaged / Quality / Size / Color / Other */
    @Column(name = "reason", nullable = false, length = 30)
    private String reason;

    @Column(name = "reason_notes", length = 300)
    private String reasonNotes;

    /**
     * Whether the stock was returned to inventory.
     * Forced false when reason == "Damaged" (server-controlled).
     */
    @Column(name = "stock_returned", nullable = false)
    private Boolean stockReturned = true;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @JsonBackReference("rt-items")
    @ManyToOne
    @JoinColumn(name = "return_id", nullable = false)
    private ReturnTransaction returnTransaction;
}