package com.mc.mc_ims.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonManagedReference;

/**
 * A purchase made from a supplier (goods bought INTO inventory).
 * This is the mirror of a sales {@link Invoice}: saving one INCREASES product
 * stock, and its total feeds the supplier balance in SupplierService.
 *
 * Uses manual getters/setters (like Invoice) to avoid Lombok toString/equals
 * recursion across the bidirectional items relationship.
 */
@Entity
@Table(name = "purchase_invoices",
       indexes = {
           @Index(name = "idx_purchase_supplier", columnList = "supplier_id"),
           @Index(name = "idx_purchase_date", columnList = "purchase_date")
       })
public class PurchaseInvoice {

    /** Internal id, generated as PUR0001, PUR0002, ... */
    @Id
    @Column(name = "purchase_id", nullable = false, unique = true, length = 20)
    private String purchaseId;

    /** The supplier this purchase is from. */
    @Column(name = "supplier_id", nullable = false, length = 20)
    private String supplierId;

    /** Snapshot of the supplier name at time of purchase (for display/history). */
    @Column(name = "supplier_name", nullable = false, length = 200)
    private String supplierName;

    /** The invoice/bill number printed on the supplier's own paper invoice (optional). */
    @Column(name = "supplier_invoice_no", length = 60)
    private String supplierInvoiceNo;

    @Column(name = "purchase_date", nullable = false)
    private LocalDate purchaseDate;

    @Column(name = "created_time", nullable = false)
    private LocalTime createdTime;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    /** How much was paid at the time of this purchase (0 = fully on credit). */
    @Column(name = "amount_paid", nullable = false, precision = 12, scale = 2,
            columnDefinition = "DECIMAL(12,2) DEFAULT 0")
    private BigDecimal amountPaid = BigDecimal.ZERO;

    @Column(name = "payment_mode", length = 50)
    private String paymentMode;

    @Column(length = 500)
    private String notes;

    /**
     * Stored filename of the uploaded bill/invoice photo (e.g. "PUR0001.jpg"),
     * living under the configured upload dir. NULL if no photo was attached.
     */
    @Column(name = "bill_photo", length = 255)
    private String billPhoto;

    @JsonManagedReference
    @OneToMany(
            mappedBy = "purchaseInvoice",
            cascade = CascadeType.ALL,
            orphanRemoval = true,
            fetch = FetchType.LAZY
    )
    private List<PurchaseItem> items;

    // Getters & Setters

    public String getPurchaseId() { return purchaseId; }
    public void setPurchaseId(String purchaseId) { this.purchaseId = purchaseId; }

    public String getSupplierId() { return supplierId; }
    public void setSupplierId(String supplierId) { this.supplierId = supplierId; }

    public String getSupplierName() { return supplierName; }
    public void setSupplierName(String supplierName) { this.supplierName = supplierName; }

    public String getSupplierInvoiceNo() { return supplierInvoiceNo; }
    public void setSupplierInvoiceNo(String supplierInvoiceNo) { this.supplierInvoiceNo = supplierInvoiceNo; }

    public LocalDate getPurchaseDate() { return purchaseDate; }
    public void setPurchaseDate(LocalDate purchaseDate) { this.purchaseDate = purchaseDate; }

    public LocalTime getCreatedTime() { return createdTime; }
    public void setCreatedTime(LocalTime createdTime) { this.createdTime = createdTime; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public BigDecimal getAmountPaid() { return amountPaid; }
    public void setAmountPaid(BigDecimal amountPaid) { this.amountPaid = amountPaid; }

    public String getPaymentMode() { return paymentMode; }
    public void setPaymentMode(String paymentMode) { this.paymentMode = paymentMode; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getBillPhoto() { return billPhoto; }
    public void setBillPhoto(String billPhoto) { this.billPhoto = billPhoto; }

    public List<PurchaseItem> getItems() { return items; }
    public void setItems(List<PurchaseItem> items) { this.items = items; }
}
