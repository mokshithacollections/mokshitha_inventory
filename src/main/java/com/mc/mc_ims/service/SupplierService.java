package com.mc.mc_ims.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mc.mc_ims.entity.Supplier;
import com.mc.mc_ims.entity.SupplierPayment;
import com.mc.mc_ims.dto.SupplierPaymentDTO;
import com.mc.mc_ims.repository.SupplierRepository;
import com.mc.mc_ims.repository.PurchaseInvoiceRepository;
import com.mc.mc_ims.repository.SupplierPaymentRepository;
import com.mc.mc_ims.repository.CreditNoteRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

/**
 * All supplier-related business logic. CRUD + ID generation. The balance
 * computation is stubbed for Phase 1 (returns the opening balance) and will
 * be expanded in Phases 2 and 3 once PurchaseInvoice and CreditNote exist.
 */
@Service
public class SupplierService {

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private PurchaseInvoiceRepository purchaseRepository;

    @Autowired
    private SupplierPaymentRepository paymentRepository;

    @Autowired
    private CreditNoteRepository creditNoteRepository;

    // =========================================================
    //  ID generation
    // =========================================================
    /**
     * Generate the next supplier ID in the format SUP001, SUP002, ...
     * Pads to 3 digits, grows beyond if needed.
     */
    public synchronized String generateNextSupplierId() {
        List<Supplier> all = supplierRepository.findAll();
        int maxNum = 0;
        for (Supplier s : all) {
            String id = s.getSupplierId();
            if (id != null && id.startsWith("SUP")) {
                try {
                    int n = Integer.parseInt(id.substring(3));
                    if (n > maxNum) maxNum = n;
                } catch (NumberFormatException ignored) { /* skip non-numeric */ }
            }
        }
        return String.format("SUP%03d", maxNum + 1);
    }

    // =========================================================
    //  CRUD
    // =========================================================
    @Transactional
    public Supplier create(Supplier supplier) {
        if (supplier.getName() == null || supplier.getName().isBlank()) {
            throw new IllegalArgumentException("Supplier name is required");
        }
        // Block duplicate names (case-insensitive) to avoid accidental double entries
        if (supplierRepository.existsByNameIgnoreCase(supplier.getName().trim())) {
            throw new IllegalArgumentException(
                    "A supplier named \"" + supplier.getName() + "\" already exists.");
        }

        supplier.setSupplierId(generateNextSupplierId());
        supplier.setName(supplier.getName().trim());
        supplier.setCreatedDate(LocalDate.now());
        if (supplier.getActive() == null) supplier.setActive(true);
        if (supplier.getOpeningBalance() == null) supplier.setOpeningBalance(BigDecimal.ZERO);

        return supplierRepository.save(supplier);
    }

    @Transactional
    public Supplier update(String supplierId, Supplier updates) {
        Supplier existing = supplierRepository.findById(supplierId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Supplier not found: " + supplierId));

        if (updates.getName() == null || updates.getName().isBlank()) {
            throw new IllegalArgumentException("Supplier name is required");
        }

        // Block rename to an existing name (case-insensitive), but allow keeping own name
        String newName = updates.getName().trim();
        if (!existing.getName().equalsIgnoreCase(newName)
                && supplierRepository.existsByNameIgnoreCase(newName)) {
            throw new IllegalArgumentException(
                    "A supplier named \"" + newName + "\" already exists.");
        }

        existing.setName(newName);
        existing.setContactPerson(updates.getContactPerson());
        existing.setPhone(updates.getPhone());
        existing.setEmail(updates.getEmail());
        existing.setAddress(updates.getAddress());
        existing.setGstNumber(updates.getGstNumber());
        existing.setPaymentTerms(updates.getPaymentTerms());
        existing.setNotes(updates.getNotes());
        // openingBalance is intentionally NOT updatable after creation — keeps the
        // ledger trustworthy. Use a credit note / adjustment to fix mistakes.
        if (updates.getActive() != null) existing.setActive(updates.getActive());

        return supplierRepository.save(existing);
    }

    @Transactional
    public void setActive(String supplierId, boolean active) {
        Supplier s = supplierRepository.findById(supplierId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Supplier not found: " + supplierId));
        s.setActive(active);
        supplierRepository.save(s);
    }

    public List<Supplier> listAll() {
        return supplierRepository.findAllByOrderByNameAsc();
    }

    public List<Supplier> listActive() {
        return supplierRepository.findByActiveTrueOrderByNameAsc();
    }

    public Optional<Supplier> findById(String supplierId) {
        return supplierRepository.findById(supplierId);
    }

    public List<Supplier> search(String query) {
        if (query == null || query.isBlank()) return listAll();
        return supplierRepository.searchByName(query.trim());
    }

    // =========================================================
    //  Balance computation (stubbed for Phase 1)
    // =========================================================
    /**
     * Current balance owed to this supplier.
     *
     *   balance =  opening_balance
     *           +  SUM(purchase_invoice.total_amount)
     *           -  SUM(supplier_payment.amount)
     *           -  SUM(credit_note.total_amount)
     *
     * In Phase 1, only the first term contributes. Phases 2 and 3 will fold in
     * the rest as those entities arrive.
     *
     *   POSITIVE => boutique owes supplier
     *   NEGATIVE => supplier owes boutique (rare — credit notes exceed purchases)
     *   ZERO     => settled
     */
    public BigDecimal computeBalance(String supplierId) {
        Supplier s = supplierRepository.findById(supplierId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Supplier not found: " + supplierId));

        BigDecimal opening      = s.getOpeningBalance() == null ? BigDecimal.ZERO : s.getOpeningBalance();
        BigDecimal purchases    = nz(purchaseRepository.sumTotalBySupplier(supplierId));
        BigDecimal purchasePaid = nz(purchaseRepository.sumAmountPaidBySupplier(supplierId));
        BigDecimal payments     = nz(paymentRepository.sumAmountBySupplier(supplierId));
        BigDecimal creditNotes  = nz(creditNoteRepository.sumAmountBySupplier(supplierId));

        // balance = opening + purchases - (paid at purchase) - payments - credit notes
        return opening.add(purchases)
                .subtract(purchasePaid)
                .subtract(payments)
                .subtract(creditNotes);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    // =========================================================
    //  Supplier payments (Phase 2)
    // =========================================================
    /** Generate the next payment ID: PAY0001, PAY0002, ... */
    private synchronized String generateNextPaymentId() {
        List<SupplierPayment> all = paymentRepository.findAll();
        int maxNum = 0;
        for (SupplierPayment p : all) {
            String id = p.getPaymentId();
            if (id != null && id.startsWith("PAY")) {
                try {
                    int n = Integer.parseInt(id.substring(3));
                    if (n > maxNum) maxNum = n;
                } catch (NumberFormatException ignored) { /* skip */ }
            }
        }
        return String.format("PAY%04d", maxNum + 1);
    }

    @Transactional
    public SupplierPayment recordPayment(String supplierId, SupplierPaymentDTO dto) {
        Supplier supplier = supplierRepository.findById(supplierId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Supplier not found: " + supplierId));

        if (dto.getAmount() == null || dto.getAmount().signum() <= 0) {
            throw new IllegalArgumentException("Payment amount must be greater than 0");
        }

        LocalDate date;
        if (dto.getPaymentDate() == null || dto.getPaymentDate().isBlank()) {
            date = LocalDate.now();
        } else {
            try {
                date = LocalDate.parse(dto.getPaymentDate().trim());
            } catch (Exception e) {
                throw new IllegalArgumentException("Invalid payment date: " + dto.getPaymentDate());
            }
        }

        SupplierPayment payment = new SupplierPayment();
        payment.setPaymentId(generateNextPaymentId());
        payment.setSupplierId(supplier.getSupplierId());
        payment.setAmount(dto.getAmount());
        payment.setPaymentDate(date);
        payment.setCreatedTime(LocalTime.now());
        payment.setMode(blankToNull(dto.getMode()));
        payment.setReference(blankToNull(dto.getReference()));
        payment.setNotes(blankToNull(dto.getNotes()));

        return paymentRepository.save(payment);
    }

    public List<SupplierPayment> listPayments(String supplierId) {
        return paymentRepository.findBySupplierIdOrderByPaymentDateDescCreatedTimeDesc(supplierId);
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}