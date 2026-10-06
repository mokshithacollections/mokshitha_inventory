package com.mc.mc_ims.entity;

import jakarta.persistence.*;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonManagedReference;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * One row per return event. Audit-permanent — never deleted, never modified
 * after creation. If a customer brings something back, a record is created
 * here even if no exchange happens.
 */
@Entity
@Table(name = "return_transactions",
       indexes = {
           @Index(name = "idx_original_bill", columnList = "original_bill_no"),
           @Index(name = "idx_new_bill",      columnList = "new_bill_no"),
           @Index(name = "idx_return_date",   columnList = "return_date")
       })
@Data
public class ReturnTransaction {

    @Id
    @Column(name = "return_id", nullable = false, unique = true, length = 20)
    private String returnId;

    @Column(name = "original_bill_no", nullable = false, length = 20)
    private String originalBillNo;

    @Column(name = "new_bill_no", nullable = true, length = 20)
    private String newBillNo;

    @Column(name = "return_date", nullable = false)
    private LocalDate returnDate;

    @Column(name = "return_time", nullable = false)
    private LocalTime returnTime;

    /**
     * Signed refund amount.
     *   POSITIVE => we paid the customer (returned value > exchanged value)
     *   NEGATIVE => customer paid extra (exchanged value > returned value)
     *   ZERO     => even swap or pure return where customer chose store credit etc.
     */
    @Column(name = "refund_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal refundAmount;

    @Column(name = "refund_mode", nullable = false, length = 50)
    private String refundMode;

    @Column(name = "processed_by", nullable = false, length = 100)
    private String processedBy;

    @Column(name = "admin_override", nullable = false)
    private Boolean adminOverride = false;

    @Column(name = "notes", length = 500)
    private String notes;

    @JsonManagedReference("rt-items")
    @OneToMany(
            mappedBy = "returnTransaction",
            cascade = CascadeType.ALL,
            orphanRemoval = true,
            fetch = FetchType.LAZY
    )
    private List<ReturnItem> items;
}