package com.mc.mc_ims.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import com.fasterxml.jackson.annotation.JsonBackReference;

/**
 * A single line of a {@link CreditNote} — one product, a quantity credited,
 * and the per-unit value. If the parent note has reduceStock=true, this
 * quantity is removed from the product's stock.
 */
@Data
@Entity
@Table(name = "credit_note_items",
       indexes = @Index(name = "idx_credit_note_id", columnList = "credit_note_id"))
public class CreditNoteItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false, length = 50)
    private String productId;

    @Column(nullable = false, length = 150)
    private String description;

    @Column(length = 50)
    private String color;

    @Column(nullable = false)
    private Integer quantity;

    /** Credited value per unit. */
    @Column(name = "unit_value", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitValue;

    @Column(name = "total_value", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalValue;

    @JsonBackReference
    @ManyToOne
    @JoinColumn(name = "credit_note_id")
    private CreditNote creditNote;
}
