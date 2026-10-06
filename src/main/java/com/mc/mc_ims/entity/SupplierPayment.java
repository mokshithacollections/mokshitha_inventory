package com.mc.mc_ims.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * A payment made by the boutique TO a supplier. Reduces the balance owed.
 * Immutable once recorded (audit trail) — corrections are made with a new entry.
 */
@Data
@Entity
@Table(name = "supplier_payments",
       indexes = {
           @Index(name = "idx_payment_supplier", columnList = "supplier_id"),
           @Index(name = "idx_payment_date", columnList = "payment_date")
       })
public class SupplierPayment {

    /** Generated as PAY0001, PAY0002, ... */
    @Id
    @Column(name = "payment_id", nullable = false, unique = true, length = 20)
    private String paymentId;

    @Column(name = "supplier_id", nullable = false, length = 20)
    private String supplierId;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "payment_date", nullable = false)
    private LocalDate paymentDate;

    @Column(name = "created_time", nullable = false)
    private LocalTime createdTime;

    /** Cash / UPI / Bank Transfer / Cheque. */
    @Column(length = 50)
    private String mode;

    /** Optional reference — UPI txn id, cheque number, etc. */
    @Column(length = 100)
    private String reference;

    @Column(length = 500)
    private String notes;
}
