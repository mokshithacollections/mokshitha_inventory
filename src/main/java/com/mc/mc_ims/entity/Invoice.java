package com.mc.mc_ims.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonManagedReference;

@Entity
@Table(name = "invoice")
public class Invoice {

    @Id
    @Column(name = "bill_no", nullable = false, unique = true, length = 20)
    private String billNo;

    @Column(name = "invoice_date", nullable = false)
    private LocalDate invoiceDate;

    @Column(name = "invoice_time", nullable = false)
    private LocalTime invoiceTime;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "payment_mode", nullable = false, length = 50)
    private String paymentMode;

    @Column(name = "seller_name", nullable = false, length = 100)
    private String sellerName;

    @Column(name = "buyer_name", nullable = false, length = 100)
    private String buyerName;

    @Column(name = "buyer_mobile", nullable = false, length = 15)
    private String buyerMobile;
    
    /**
     * If this invoice was created via an exchange flow, this links back
     * to the original bill being exchanged against. NULL for normal bills.
     */
    @Column(name = "related_bill_no", nullable = true, length = 20)
    private String relatedBillNo;

    @JsonManagedReference
    @OneToMany(
            mappedBy = "invoice",
            cascade = CascadeType.ALL,
            orphanRemoval = true,
            fetch = FetchType.LAZY
    )
    private List<InvoiceItem> items;

    // Getters & Setters

    public String getBillNo() { return billNo; }
    public void setBillNo(String billNo) { this.billNo = billNo; }

    public LocalDate getInvoiceDate() { return invoiceDate; }
    public void setInvoiceDate(LocalDate invoiceDate) { this.invoiceDate = invoiceDate; }

    public LocalTime getInvoiceTime() { return invoiceTime; }
    public void setInvoiceTime(LocalTime invoiceTime) { this.invoiceTime = invoiceTime; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public String getPaymentMode() { return paymentMode; }
    public void setPaymentMode(String paymentMode) { this.paymentMode = paymentMode; }

    public String getSellerName() { return sellerName; }
    public void setSellerName(String sellerName) { this.sellerName = sellerName; }

    public String getBuyerName() { return buyerName; }
    public void setBuyerName(String buyerName) { this.buyerName = buyerName; }

    public String getBuyerMobile() { return buyerMobile; }
    public void setBuyerMobile(String buyerMobile) { this.buyerMobile = buyerMobile; }
    
    public String getRelatedBillNo() { return relatedBillNo; }
    public void setRelatedBillNo(String relatedBillNo) { this.relatedBillNo = relatedBillNo; }

    public List<InvoiceItem> getItems() { return items; }
    public void setItems(List<InvoiceItem> items) { this.items = items; }
}