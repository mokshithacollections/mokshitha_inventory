package com.mc.mc_ims.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mc.mc_ims.dto.*;
import com.mc.mc_ims.entity.*;
import com.mc.mc_ims.repository.CreditNoteRepository;
import com.mc.mc_ims.repository.ProductRepository;
import com.mc.mc_ims.repository.SupplierRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Credit note logic. A credit note reduces the balance owed to a supplier.
 * When it carries line items and reduceStock is true, those quantities are
 * removed from inventory (goods physically returned to the supplier).
 */
@Service
public class CreditNoteService {

    @Autowired
    private CreditNoteRepository creditNoteRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private ProductRepository productRepository;

    private synchronized String generateNextCreditNoteId() {
        List<CreditNote> all = creditNoteRepository.findAll();
        int maxNum = 0;
        for (CreditNote c : all) {
            String id = c.getCreditNoteId();
            if (id != null && id.startsWith("CN")) {
                try {
                    int n = Integer.parseInt(id.substring(2));
                    if (n > maxNum) maxNum = n;
                } catch (NumberFormatException ignored) { /* skip */ }
            }
        }
        return String.format("CN%04d", maxNum + 1);
    }

    @Transactional
    public CreditNote saveCreditNote(CreditNoteDTO dto) {

        Supplier supplier = supplierRepository.findById(dto.getSupplierId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Supplier not found: " + dto.getSupplierId()));

        boolean hasItems = dto.getItems() != null && !dto.getItems().isEmpty();
        boolean reduceStock = Boolean.TRUE.equals(dto.getReduceStock()) && hasItems;

        LocalDate date = parseDateOrToday(dto.getCreditDate());
        LocalTime now = LocalTime.now();

        CreditNote note = new CreditNote();
        note.setCreditNoteId(generateNextCreditNoteId());
        note.setSupplierId(supplier.getSupplierId());
        note.setSupplierName(supplier.getName());
        note.setCreditDate(date);
        note.setCreatedTime(now);
        note.setReason(blankToNull(dto.getReason()));
        note.setReference(blankToNull(dto.getReference()));
        note.setReduceStock(reduceStock);
        note.setNotes(blankToNull(dto.getNotes()));

        BigDecimal total = BigDecimal.ZERO;
        List<CreditNoteItem> itemList = new ArrayList<>();

        if (hasItems) {
            for (CreditNoteItemDTO itemDTO : dto.getItems()) {
                Product product = productRepository.findById(itemDTO.getProductId())
                        .orElseThrow(() -> new IllegalArgumentException(
                                "Product not found: " + itemDTO.getProductId()));

                int qty = itemDTO.getQuantity();

                if (reduceStock) {
                    if (product.getQuantity() < qty) {
                        throw new IllegalStateException(
                                "Insufficient stock to return for " + product.getName() +
                                " (" + product.getProductId() + "): available " +
                                product.getQuantity() + ", returning " + qty);
                    }
                    product.setQuantity(product.getQuantity() - qty);
                    productRepository.save(product);
                }

                BigDecimal lineValue = itemDTO.getUnitValue().multiply(BigDecimal.valueOf(qty));

                CreditNoteItem item = new CreditNoteItem();
                item.setProductId(itemDTO.getProductId());
                item.setDescription(itemDTO.getDescription());
                item.setColor(itemDTO.getColor());
                item.setQuantity(qty);
                item.setUnitValue(itemDTO.getUnitValue());
                item.setTotalValue(lineValue);
                item.setCreditNote(note);
                itemList.add(item);

                total = total.add(lineValue);
            }
            note.setItems(itemList);
        } else {
            // No items: amount must be supplied directly.
            if (dto.getAmount() == null || dto.getAmount().signum() <= 0) {
                throw new IllegalArgumentException(
                        "Enter a credit amount, or add line items to compute it.");
            }
            total = dto.getAmount();
        }

        note.setAmount(total);
        return creditNoteRepository.save(note);
    }

    public List<CreditNote> listAll() {
        return creditNoteRepository.findAllWithItems();
    }

    public CreditNote getById(String creditNoteId) {
        return creditNoteRepository.findById(creditNoteId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Credit note not found: " + creditNoteId));
    }

    public List<CreditNote> listBySupplier(String supplierId) {
        return creditNoteRepository.findBySupplierIdOrderByCreditDateDescCreatedTimeDesc(supplierId);
    }

    // Helpers
    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private static LocalDate parseDateOrToday(String iso) {
        if (iso == null || iso.isBlank()) return LocalDate.now();
        try {
            return LocalDate.parse(iso.trim());
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid credit note date: " + iso);
        }
    }
}
