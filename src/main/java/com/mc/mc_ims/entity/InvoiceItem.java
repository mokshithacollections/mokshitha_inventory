package com.mc.mc_ims.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import com.fasterxml.jackson.annotation.JsonBackReference;

@Data
@Entity
@Table(name = "invoice_items",
       indexes = @Index(name = "idx_bill_no", columnList = "bill_no"))
public class InvoiceItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The product this line was sold from — used to decrement stock on sale. */
    @Column(name = "product_id", length = 50)
    private String productId;

    @Column(nullable = false, length = 150)
    private String description;

    @Column(name = "bill_on", nullable = false, length = 50)
    private String billOn;

    @Column(length = 50)
    private String color;

    @Column(length = 20)
    private String discount;

    @Column(name = "applied_on", length = 50)
    private String appliedOn;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "total_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalPrice;
    
    /**
     * Running count of how many units of this line item have been returned.
     * Starts at 0. When returnedQuantity == quantity, the line is fully returned.
     * Allows partial returns.
     */
    @Column(name = "returned_quantity", nullable = false, columnDefinition = "INT DEFAULT 0")
    private Integer returnedQuantity = 0;

    @JsonBackReference
    @ManyToOne
    @JoinColumn(name = "bill_no")
    private Invoice invoice;
}