package com.mc.mc_ims.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonManagedReference;

/**
 * A credit received FROM a supplier — for damaged goods, goods returned to
 * them, or a price adjustment. Reduces the balance owed to that supplier.
 *
 * May optionally carry line items; when {@code reduceStock} is true those
 * quantities are removed from inventory (goods physically sent back).
 * Manual getters/setters (like Invoice) to avoid Lombok recursion.
 */
@Entity
@Table(name = "credit_notes",
       indexes = {
           @Index(name = "idx_credit_supplier", columnList = "supplier_id"),
           @Index(name = "idx_credit_date", columnList = "credit_date")
       })
public class CreditNote {

    /** Generated as CN0001, CN0002, ... */
    @Id
    @Column(name = "credit_note_id", nullable = false, unique = true, length = 20)
    private String creditNoteId;

    @Column(name = "supplier_id", nullable = false, length = 20)
    private String supplierId;

    @Column(name = "supplier_name", nullable = false, length = 200)
    private String supplierName;

    @Column(name = "credit_date", nullable = false)
    private LocalDate creditDate;

    @Column(name = "created_time", nullable = false)
    private LocalTime createdTime;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    /** Damaged / Returned / Price Adjustment / Other. */
    @Column(length = 50)
    private String reason;

    /** Supplier's own credit note number (optional). */
    @Column(length = 60)
    private String reference;

    /** Whether the line items were removed from our stock (goods sent back). */
    @Column(name = "reduce_stock", nullable = false, columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean reduceStock = false;

    @Column(length = 500)
    private String notes;

    @JsonManagedReference
    @OneToMany(
            mappedBy = "creditNote",
            cascade = CascadeType.ALL,
            orphanRemoval = true,
            fetch = FetchType.LAZY
    )
    private List<CreditNoteItem> items;

    // Getters & Setters

    public String getCreditNoteId() { return creditNoteId; }
    public void setCreditNoteId(String creditNoteId) { this.creditNoteId = creditNoteId; }

    public String getSupplierId() { return supplierId; }
    public void setSupplierId(String supplierId) { this.supplierId = supplierId; }

    public String getSupplierName() { return supplierName; }
    public void setSupplierName(String supplierName) { this.supplierName = supplierName; }

    public LocalDate getCreditDate() { return creditDate; }
    public void setCreditDate(LocalDate creditDate) { this.creditDate = creditDate; }

    public LocalTime getCreatedTime() { return createdTime; }
    public void setCreatedTime(LocalTime createdTime) { this.createdTime = createdTime; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getReference() { return reference; }
    public void setReference(String reference) { this.reference = reference; }

    public Boolean getReduceStock() { return reduceStock; }
    public void setReduceStock(Boolean reduceStock) { this.reduceStock = reduceStock; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public List<CreditNoteItem> getItems() { return items; }
    public void setItems(List<CreditNoteItem> items) { this.items = items; }
}
