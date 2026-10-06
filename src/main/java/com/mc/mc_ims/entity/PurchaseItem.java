package com.mc.mc_ims.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import com.fasterxml.jackson.annotation.JsonBackReference;

/**
 * A single line of a {@link PurchaseInvoice} — one product, a quantity bought,
 * and the per-unit cost price paid. On save, this quantity is ADDED to the
 * matching Product's stock.
 */
@Data
@Entity
@Table(name = "purchase_items",
       indexes = @Index(name = "idx_purchase_id", columnList = "purchase_id"))
public class PurchaseItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The product being stocked. */
    @Column(name = "product_id", nullable = false, length = 50)
    private String productId;

    /** Snapshot of the product name at purchase time. */
    @Column(nullable = false, length = 150)
    private String description;

    @Column(length = 50)
    private String color;

    @Column(nullable = false)
    private Integer quantity;

    /** Cost price paid per unit for this purchase. */
    @Column(name = "cost_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal costPrice;

    @Column(name = "total_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalPrice;

    @JsonBackReference
    @ManyToOne
    @JoinColumn(name = "purchase_id")
    private PurchaseInvoice purchaseInvoice;
}
