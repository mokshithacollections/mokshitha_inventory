package com.mc.mc_ims.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A supplier from whom Mokshitha purchases inventory.
 * The current balance owed is NOT stored — it's computed dynamically from
 * PurchaseInvoices, CreditNotes, and SupplierPayments (see SupplierService).
 */
@Entity
@Table(name = "suppliers",
       indexes = {
           @Index(name = "idx_supplier_name", columnList = "name"),
           @Index(name = "idx_supplier_active", columnList = "active")
       })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Supplier {

    @Id
    @Column(name = "supplier_id", nullable = false, unique = true, length = 20)
    private String supplierId;

    @NotBlank
    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "contact_person", length = 100)
    private String contactPerson;

    @Column(length = 15)
    private String phone;

    @Column(length = 150)
    private String email;

    @Column(length = 500)
    private String address;

    @Column(name = "gst_number", length = 30)
    private String gstNumber;

    /** Free text — e.g., "Net 30", "Cash on Delivery", "Advance 50%". */
    @Column(name = "payment_terms", length = 100)
    private String paymentTerms;

    /**
     * If you already owe this supplier money on the day you onboard them,
     * record it here. Defaults to 0 for new suppliers. NEVER touched after
     * creation — historical purchases / credits get logged as their own records.
     */
    @NotNull
    @Column(name = "opening_balance", nullable = false, precision = 12, scale = 2,
            columnDefinition = "DECIMAL(12,2) DEFAULT 0")
    private BigDecimal openingBalance = BigDecimal.ZERO;

    @Column(length = 500)
    private String notes;

    @NotNull
    @Column(name = "created_date", nullable = false)
    private LocalDate createdDate;

    /**
     * Soft-disable flag. When false, supplier is hidden from new purchase forms
     * but still appears in historical reports. Existing records are never deleted.
     */
    @NotNull
    @Column(nullable = false, columnDefinition = "BOOLEAN DEFAULT TRUE")
    private Boolean active = true;
}