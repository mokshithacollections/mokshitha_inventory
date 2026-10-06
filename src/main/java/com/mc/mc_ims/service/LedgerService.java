package com.mc.mc_ims.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.mc.mc_ims.dto.LedgerEntryDTO;
import com.mc.mc_ims.dto.SupplierLedgerDTO;
import com.mc.mc_ims.entity.*;
import com.mc.mc_ims.repository.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Builds a supplier's running statement (ledger):
 *   opening balance, then every purchase (debit), payment (credit) and
 *   credit note (credit) in date order, with a running balance owed.
 */
@Service
public class LedgerService {

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private PurchaseInvoiceRepository purchaseRepository;

    @Autowired
    private SupplierPaymentRepository paymentRepository;

    @Autowired
    private CreditNoteRepository creditNoteRepository;

    public SupplierLedgerDTO buildLedger(String supplierId) {
        Supplier supplier = supplierRepository.findById(supplierId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Supplier not found: " + supplierId));

        BigDecimal opening = supplier.getOpeningBalance() == null
                ? BigDecimal.ZERO : supplier.getOpeningBalance();

        // Collect raw rows (with a time key for stable same-day ordering).
        List<Row> rows = new ArrayList<>();

        for (PurchaseInvoice p : purchaseRepository.findBySupplierIdOrderByPurchaseDateDescCreatedTimeDesc(supplierId)) {
            String desc = "Purchase " + p.getPurchaseId()
                    + (p.getSupplierInvoiceNo() != null ? " (inv " + p.getSupplierInvoiceNo() + ")" : "");
            rows.add(new Row(p.getPurchaseDate(), time(p.getCreatedTime()), "PURCHASE",
                    p.getPurchaseId(), desc, nz(p.getTotalAmount()), BigDecimal.ZERO));

            // A purchase paid at time of purchase counts as an immediate payment-in-kind.
            BigDecimal paidNow = nz(p.getAmountPaid());
            if (paidNow.signum() > 0) {
                rows.add(new Row(p.getPurchaseDate(), time(p.getCreatedTime()), "PAYMENT",
                        p.getPurchaseId(), "Paid with purchase " + p.getPurchaseId(),
                        BigDecimal.ZERO, paidNow));
            }
        }

        for (SupplierPayment pay : paymentRepository.findBySupplierIdOrderByPaymentDateDescCreatedTimeDesc(supplierId)) {
            String desc = "Payment " + pay.getPaymentId()
                    + (pay.getMode() != null ? " (" + pay.getMode() + ")" : "");
            rows.add(new Row(pay.getPaymentDate(), time(pay.getCreatedTime()), "PAYMENT",
                    pay.getPaymentId(), desc, BigDecimal.ZERO, nz(pay.getAmount())));
        }

        for (CreditNote c : creditNoteRepository.findBySupplierIdOrderByCreditDateDescCreatedTimeDesc(supplierId)) {
            String desc = "Credit Note " + c.getCreditNoteId()
                    + (c.getReason() != null ? " (" + c.getReason() + ")" : "");
            rows.add(new Row(c.getCreditDate(), time(c.getCreatedTime()), "CREDIT_NOTE",
                    c.getCreditNoteId(), desc, BigDecimal.ZERO, nz(c.getAmount())));
        }

        // Oldest first so the running balance builds forward.
        rows.sort(Comparator.comparing((Row r) -> r.date).thenComparing(r -> r.time));

        List<LedgerEntryDTO> entries = new ArrayList<>();
        BigDecimal running = opening;

        entries.add(new LedgerEntryDTO(supplier.getCreatedDate(), "OPENING", null,
                "Opening balance", BigDecimal.ZERO, BigDecimal.ZERO, running));

        for (Row r : rows) {
            running = running.add(r.debit).subtract(r.credit);
            entries.add(new LedgerEntryDTO(r.date, r.type, r.refId, r.description,
                    r.debit, r.credit, running));
        }

        SupplierLedgerDTO dto = new SupplierLedgerDTO();
        dto.setSupplierId(supplier.getSupplierId());
        dto.setSupplierName(supplier.getName());
        dto.setOpeningBalance(opening);
        dto.setEntries(entries);
        dto.setClosingBalance(running);
        return dto;
    }

    private static BigDecimal nz(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }
    private static LocalTime time(LocalTime t) { return t == null ? LocalTime.MIN : t; }

    /** Internal working row before it becomes a ledger entry. */
    private static class Row {
        final LocalDate date;
        final LocalTime time;
        final String type;
        final String refId;
        final String description;
        final BigDecimal debit;
        final BigDecimal credit;

        Row(LocalDate date, LocalTime time, String type, String refId,
            String description, BigDecimal debit, BigDecimal credit) {
            this.date = date;
            this.time = time;
            this.type = type;
            this.refId = refId;
            this.description = description;
            this.debit = debit;
            this.credit = credit;
        }
    }
}
