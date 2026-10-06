package com.mc.mc_ims.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mc.mc_ims.dto.*;
import com.mc.mc_ims.entity.*;
import com.mc.mc_ims.repository.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * All return / exchange business logic lives here. The entry point
 * {@link #processReturn(ReturnRequestDTO)} is @Transactional so the whole
 * operation either fully succeeds or fully rolls back — there's no
 * "stock added but return record missing" failure mode.
 */
@Service
public class ReturnService {

    /** How many days after purchase a return is allowed by default. */
    public static final int RETURN_WINDOW_DAYS = 7;

    /**
     * Admin override password for the 7-day rule. Kept here on the server
     * (not in front-end JS) so the rule is genuinely enforced.
     *
     * Pulled from application.properties so it can be changed without recompiling.
     * Falls back to "mokshitha123" to match the front-end Analysis gate default.
     */
    @Value("${mokshitha.admin.password:mokshitha123}")
    private String adminPassword;

    @Autowired private InvoiceRepository invoiceRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private ReturnTransactionRepository returnRepository;
    @Autowired private InvoiceService invoiceService;

    // =========================================================
    //  Bill lookup — used by the UI to populate the return form
    // =========================================================
    public BillLookupResponseDTO lookupBill(String billNo) {

        Invoice invoice = invoiceRepository.findById(billNo)
                .orElseThrow(() -> new IllegalArgumentException("Bill not found: " + billNo));

        long daysSince = ChronoUnit.DAYS.between(invoice.getInvoiceDate(), LocalDate.now());

        List<BillLookupResponseDTO.ItemView> itemViews = new ArrayList<>();
        if (invoice.getItems() != null) {
            for (InvoiceItem ii : invoice.getItems()) {
                int returned = ii.getReturnedQuantity() == null ? 0 : ii.getReturnedQuantity();
                itemViews.add(new BillLookupResponseDTO.ItemView(
                        ii.getId(),
                        ii.getDescription(),
                        ii.getColor(),
                        ii.getBillOn(),
                        ii.getDiscount(),
                        ii.getAppliedOn(),
                        ii.getPrice(),
                        ii.getQuantity(),
                        returned,
                        ii.getQuantity() - returned,
                        ii.getTotalPrice()
                ));
            }
        }

        BillLookupResponseDTO dto = new BillLookupResponseDTO();
        dto.setBillNo(invoice.getBillNo());
        dto.setInvoiceDate(invoice.getInvoiceDate());
        dto.setInvoiceTime(invoice.getInvoiceTime());
        dto.setSellerName(invoice.getSellerName());
        dto.setBuyerName(invoice.getBuyerName());
        dto.setBuyerMobile(invoice.getBuyerMobile());
        dto.setPaymentMode(invoice.getPaymentMode());
        dto.setTotalAmount(invoice.getTotalAmount());
        dto.setDaysSincePurchase(daysSince);
        dto.setWithinReturnWindow(daysSince <= RETURN_WINDOW_DAYS);
        dto.setReturnWindowDays(RETURN_WINDOW_DAYS);
        dto.setItems(itemViews);

        return dto;
    }

    // =========================================================
    //  The main entry point — process a return (+ optional exchange)
    // =========================================================
    @Transactional
    public ReturnResult processReturn(ReturnRequestDTO req) {

        // ---------- 1. Basic input validation ----------
        if (req == null || req.getOriginalBillNo() == null || req.getOriginalBillNo().isBlank()) {
            throw new IllegalArgumentException("Original bill number is required");
        }
        if (req.getReturnItems() == null || req.getReturnItems().isEmpty()) {
            throw new IllegalArgumentException("At least one item must be returned");
        }
        if (req.getProcessedBy() == null || req.getProcessedBy().isBlank()) {
            throw new IllegalArgumentException("Please select who is processing the return");
        }
        if (req.getRefundMode() == null || req.getRefundMode().isBlank()) {
            throw new IllegalArgumentException("Refund mode is required");
        }

        // ---------- 2. Load original invoice ----------
        Invoice invoice = invoiceRepository.findById(req.getOriginalBillNo())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Original bill not found: " + req.getOriginalBillNo()));

        // ---------- 3. Enforce 7-day rule ----------
        long daysSince = ChronoUnit.DAYS.between(invoice.getInvoiceDate(), LocalDate.now());
        if (daysSince > RETURN_WINDOW_DAYS) {
            if (!Boolean.TRUE.equals(req.getAdminOverride())) {
                throw new IllegalArgumentException(
                        "Return window expired (" + daysSince + " days since purchase, "
                        + "limit is " + RETURN_WINDOW_DAYS + " days). "
                        + "An admin override is required to proceed.");
            }
            if (req.getAdminPassword() == null || !req.getAdminPassword().equals(adminPassword)) {
                throw new IllegalArgumentException("Invalid admin password — override denied.");
            }
        }

        // ---------- 4. Validate each returned line ----------
        // Index InvoiceItems by id for O(1) lookup
        Map<Long, InvoiceItem> itemsById = new HashMap<>();
        if (invoice.getItems() != null) {
            for (InvoiceItem ii : invoice.getItems()) {
                itemsById.put(ii.getId(), ii);
            }
        }

        BigDecimal totalReturnValue = BigDecimal.ZERO;
        List<ReturnItem> returnItemEntities = new ArrayList<>();

        for (ReturnedItemDTO rDto : req.getReturnItems()) {
            InvoiceItem ii = itemsById.get(rDto.getOriginalInvoiceItemId());
            if (ii == null) {
                throw new IllegalArgumentException(
                        "Invoice item " + rDto.getOriginalInvoiceItemId()
                        + " does not belong to bill " + req.getOriginalBillNo());
            }

            int alreadyReturned = ii.getReturnedQuantity() == null ? 0 : ii.getReturnedQuantity();
            int remaining       = ii.getQuantity() - alreadyReturned;
            int qty             = rDto.getQuantityReturned();

            if (qty <= 0) {
                throw new IllegalArgumentException(
                        "Return quantity must be positive (got " + qty + ")");
            }
            if (qty > remaining) {
                throw new IllegalArgumentException(
                        "Cannot return " + qty + " units of \"" + ii.getDescription()
                        + "\" — only " + remaining + " remaining ("
                        + alreadyReturned + " already returned of " + ii.getQuantity() + ")");
            }

            String reason = rDto.getReason() == null ? "Other" : rDto.getReason().trim();
            if (reason.isEmpty()) reason = "Other";

            // ---------- 5. Update InvoiceItem.returnedQuantity ----------
            ii.setReturnedQuantity(alreadyReturned + qty);

            // ---------- 6. Restore stock (unless damaged) ----------
            boolean stockReturned = !"Damaged".equalsIgnoreCase(reason);
            if (stockReturned) {
                // Find the product by name. (We store description == product.name today.)
                // If product no longer exists in inventory, skip stock restoration silently.
                List<Product> matches = productRepository.findAll().stream()
                        .filter(p -> p.getName() != null && p.getName().equals(ii.getDescription()))
                        .toList();
                if (!matches.isEmpty()) {
                    Product p = matches.get(0);
                    p.setQuantity(p.getQuantity() == null ? qty : p.getQuantity() + qty);
                    productRepository.save(p);
                }
            }

            // ---------- 7. Build ReturnItem record ----------
            BigDecimal lineValue = ii.getPrice().multiply(BigDecimal.valueOf(qty));
            totalReturnValue = totalReturnValue.add(lineValue);

            ReturnItem ri = new ReturnItem();
            ri.setOriginalInvoiceItemId(ii.getId());
            ri.setDescription(ii.getDescription());
            ri.setQuantityReturned(qty);
            ri.setReason(reason);
            ri.setReasonNotes(rDto.getReasonNotes());
            ri.setStockReturned(stockReturned);
            ri.setUnitPrice(ii.getPrice());
            // productId stays null unless we can resolve it — keeps things simple
            returnItemEntities.add(ri);
        }

        // ---------- 8. Process exchange items (if any) ----------
        String newBillNo = null;
        BigDecimal exchangeTotal = BigDecimal.ZERO;

        boolean hasExchange = req.getExchangeItems() != null && !req.getExchangeItems().isEmpty();
        if (hasExchange) {
            if (req.getBuyerName() == null || req.getBuyerName().isBlank()) {
                throw new IllegalArgumentException(
                        "Buyer name is required when processing an exchange");
            }
            if (req.getBuyerMobile() == null || req.getBuyerMobile().length() != 10) {
                throw new IllegalArgumentException(
                        "Valid 10-digit buyer mobile is required when processing an exchange");
            }
            if (req.getPaymentMode() == null || req.getPaymentMode().isBlank()) {
                throw new IllegalArgumentException(
                        "Payment mode is required when processing an exchange");
            }

            // Reuse the existing InvoiceService for the new invoice — keeps logic single-source-of-truth
            InvoiceDTO newInvoiceDto = new InvoiceDTO();
            newInvoiceDto.setSellerName(req.getProcessedBy());
            newInvoiceDto.setBuyerName(req.getBuyerName());
            newInvoiceDto.setBuyerMobile(req.getBuyerMobile());
            newInvoiceDto.setPaymentMode(req.getPaymentMode());
            newInvoiceDto.setItems(req.getExchangeItems());

            newBillNo = invoiceService.saveInvoice(newInvoiceDto);
            final String createdBillNo = newBillNo;   // effectively-final copy for the lambda

            // Now link the new bill back to the original
            Invoice newInvoice = invoiceRepository.findById(createdBillNo)
                    .orElseThrow(() -> new IllegalStateException(
                            "Could not load newly-created exchange bill " + createdBillNo));
            newInvoice.setRelatedBillNo(req.getOriginalBillNo());
            invoiceRepository.save(newInvoice);
            exchangeTotal = newInvoice.getTotalAmount();
        }

        // ---------- 9. Compute refund amount ----------
        //   refundAmount = (value returned)  -  (value of exchange items)
        //   positive => we owe customer, negative => customer pays extra, zero => even swap
        BigDecimal refundAmount = totalReturnValue.subtract(exchangeTotal);

        // ---------- 10. Create the ReturnTransaction ----------
        LocalDateTime now = LocalDateTime.now();
        ReturnTransaction rt = new ReturnTransaction();
        rt.setReturnId(generateReturnId());
        rt.setOriginalBillNo(req.getOriginalBillNo());
        rt.setNewBillNo(newBillNo);
        rt.setReturnDate(now.toLocalDate());
        rt.setReturnTime(now.toLocalTime());
        rt.setRefundAmount(refundAmount);
        rt.setRefundMode(req.getRefundMode());
        rt.setProcessedBy(req.getProcessedBy());
        rt.setAdminOverride(Boolean.TRUE.equals(req.getAdminOverride()));
        rt.setNotes(req.getNotes());

        for (ReturnItem ri : returnItemEntities) {
            ri.setReturnTransaction(rt);
        }
        rt.setItems(returnItemEntities);

        returnRepository.save(rt);

        // Save the original invoice (cascades updated returnedQuantity on items)
        invoiceRepository.save(invoice);

        // ---------- 11. Return summary ----------
        return new ReturnResult(
                rt.getReturnId(),
                newBillNo,
                totalReturnValue,
                exchangeTotal,
                refundAmount,
                req.getRefundMode()
        );
    }

    // =========================================================
    //  Helpers
    // =========================================================
    private String generateReturnId() {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
        return "RTN" + LocalDateTime.now().format(fmt);
    }

    /** Lightweight DTO for the service's return value. */
    public static class ReturnResult {
        public final String returnId;
        public final String newBillNo;
        public final BigDecimal totalReturnValue;
        public final BigDecimal exchangeTotal;
        public final BigDecimal refundAmount;
        public final String refundMode;

        public ReturnResult(String returnId, String newBillNo,
                            BigDecimal totalReturnValue, BigDecimal exchangeTotal,
                            BigDecimal refundAmount, String refundMode) {
            this.returnId = returnId;
            this.newBillNo = newBillNo;
            this.totalReturnValue = totalReturnValue;
            this.exchangeTotal = exchangeTotal;
            this.refundAmount = refundAmount;
            this.refundMode = refundMode;
        }

        public String getReturnId() { return returnId; }
        public String getNewBillNo() { return newBillNo; }
        public BigDecimal getTotalReturnValue() { return totalReturnValue; }
        public BigDecimal getExchangeTotal() { return exchangeTotal; }
        public BigDecimal getRefundAmount() { return refundAmount; }
        public String getRefundMode() { return refundMode; }
    }
}