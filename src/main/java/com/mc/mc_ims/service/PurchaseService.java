package com.mc.mc_ims.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.mc.mc_ims.dto.*;
import com.mc.mc_ims.entity.*;
import com.mc.mc_ims.repository.ProductRepository;
import com.mc.mc_ims.repository.PurchaseBillPhotoRepository;
import com.mc.mc_ims.repository.PurchaseInvoiceRepository;
import com.mc.mc_ims.repository.PurchaseItemRepository;
import com.mc.mc_ims.repository.SupplierRepository;

import java.util.stream.Collectors;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Purchase (stock-in) business logic. Saving a purchase is the mirror of a
 * sale: it INCREASES product stock, and its total feeds the supplier balance.
 */
@Service
public class PurchaseService {

    @Autowired
    private PurchaseInvoiceRepository purchaseRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private PurchaseBillPhotoRepository billPhotoRepository;

    @Autowired
    private PurchaseItemRepository purchaseItemRepository;

    /** Only these image types may be uploaded as a bill photo. */
    private static final List<String> ALLOWED_IMAGE_TYPES =
            List.of("image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic");

    // =========================================================
    //  ID generation — PUR0001, PUR0002, ...
    // =========================================================
    private synchronized String generateNextPurchaseId() {
        List<PurchaseInvoice> all = purchaseRepository.findAll();
        int maxNum = 0;
        for (PurchaseInvoice p : all) {
            String id = p.getPurchaseId();
            if (id != null && id.startsWith("PUR")) {
                try {
                    int n = Integer.parseInt(id.substring(3));
                    if (n > maxNum) maxNum = n;
                } catch (NumberFormatException ignored) { /* skip */ }
            }
        }
        return String.format("PUR%04d", maxNum + 1);
    }

    // =========================================================
    //  Save purchase (atomic: stock-in + record)
    // =========================================================
    @Transactional
    public PurchaseInvoice savePurchase(PurchaseInvoiceDTO dto) {

        Supplier supplier = supplierRepository.findById(dto.getSupplierId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Supplier not found: " + dto.getSupplierId()));

        LocalDateTime now = LocalDateTime.now();

        PurchaseInvoice purchase = new PurchaseInvoice();
        purchase.setPurchaseId(generateNextPurchaseId());
        purchase.setSupplierId(supplier.getSupplierId());
        purchase.setSupplierName(supplier.getName());
        purchase.setSupplierInvoiceNo(blankToNull(dto.getSupplierInvoiceNo()));
        purchase.setPurchaseDate(parseDateOrToday(dto.getPurchaseDate()));
        purchase.setCreatedTime(now.toLocalTime());
        purchase.setPaymentMode(blankToNull(dto.getPaymentMode()));
        purchase.setNotes(blankToNull(dto.getNotes()));

        List<PurchaseItem> itemList = new ArrayList<>();
        BigDecimal grandTotal = BigDecimal.ZERO;

        for (PurchaseItemDTO itemDTO : dto.getItems()) {

            // Add the purchased quantity to product stock.
            Product product = productRepository.findById(itemDTO.getProductId())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Product not found: " + itemDTO.getProductId()));

            int qty = itemDTO.getQuantity();
            product.setQuantity(product.getQuantity() + qty);
            productRepository.save(product);

            BigDecimal lineTotal = itemDTO.getCostPrice()
                    .multiply(BigDecimal.valueOf(qty));

            PurchaseItem item = new PurchaseItem();
            item.setProductId(itemDTO.getProductId());
            item.setDescription(itemDTO.getDescription());
            item.setColor(itemDTO.getColor());
            item.setQuantity(qty);
            item.setCostPrice(itemDTO.getCostPrice());
            item.setTotalPrice(lineTotal);
            item.setPurchaseInvoice(purchase);
            itemList.add(item);

            grandTotal = grandTotal.add(lineTotal);
        }

        BigDecimal amountPaid = dto.getAmountPaid() == null ? BigDecimal.ZERO : dto.getAmountPaid();
        if (amountPaid.compareTo(grandTotal) > 0) {
            throw new IllegalArgumentException(
                    "Amount paid (" + amountPaid + ") cannot exceed the purchase total (" + grandTotal + ")");
        }

        purchase.setTotalAmount(grandTotal);
        purchase.setAmountPaid(amountPaid);
        purchase.setItems(itemList);

        return purchaseRepository.save(purchase);
    }

    // =========================================================
    //  Reads
    // =========================================================
    public List<PurchaseInvoice> listAll() {
        return purchaseRepository.findAllWithItems();
    }

    public PurchaseInvoice getById(String purchaseId) {
        return purchaseRepository.findById(purchaseId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Purchase not found: " + purchaseId));
    }

    public List<PurchaseInvoice> listBySupplier(String supplierId) {
        return purchaseRepository.findBySupplierWithItems(supplierId);
    }

    /**
     * Prior purchases of a product (newest first, capped) — so the New Purchase
     * screen can show what was previously paid for a scanned/entered product.
     */
    public List<PurchasePriceHistoryDTO> priceHistory(String productId, int limit) {
        return purchaseItemRepository.findRecentByProductId(productId).stream()
                .limit(limit <= 0 ? 5 : limit)
                .map(pi -> {
                    PurchaseInvoice p = pi.getPurchaseInvoice();
                    return new PurchasePriceHistoryDTO(
                            p.getPurchaseId(),
                            p.getPurchaseDate() != null ? p.getPurchaseDate().toString() : null,
                            p.getSupplierName(),
                            pi.getCostPrice(),
                            pi.getQuantity());
                })
                .collect(Collectors.toList());
    }

    // =========================================================
    //  Bill photo (stored IN the database as bytea)
    // =========================================================
    /**
     * Store (or replace) the bill photo for a purchase. The image bytes go into
     * the purchase_bill_photos table (shared across machines via the common DB),
     * and a lightweight filename is kept on the purchase record as a presence
     * flag so the purchases list can show the "view" icon without loading blobs.
     */
    @Transactional
    public PurchaseInvoice attachBillPhoto(String purchaseId, MultipartFile file) {
        PurchaseInvoice purchase = getById(purchaseId);

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("No file was uploaded");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_IMAGE_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException(
                    "Only image files (JPG, PNG, WEBP, HEIC) are allowed. Got: " + contentType);
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new IllegalStateException("Could not read uploaded file: " + e.getMessage(), e);
        }

        String fileName = file.getOriginalFilename();
        if (fileName == null || fileName.isBlank()) fileName = purchaseId;

        // Upsert — one photo row per purchase (PK == purchaseId).
        PurchaseBillPhoto photo = billPhotoRepository.findById(purchaseId)
                .orElseGet(PurchaseBillPhoto::new);
        photo.setPurchaseId(purchaseId);
        photo.setData(bytes);
        photo.setContentType(contentType);
        photo.setFileName(fileName);
        photo.setUploadedAt(LocalDateTime.now());
        billPhotoRepository.save(photo);

        // Keep the filename on the purchase as a presence flag.
        purchase.setBillPhoto(fileName);
        return purchaseRepository.save(purchase);
    }

    /** Fetch the stored bill photo (bytes + content type), or throw if none exists. */
    public PurchaseBillPhoto getBillPhoto(String purchaseId) {
        return billPhotoRepository.findById(purchaseId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No bill photo for purchase " + purchaseId));
    }

    // =========================================================
    //  Helpers
    // =========================================================
    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private static LocalDate parseDateOrToday(String iso) {
        if (iso == null || iso.isBlank()) return LocalDate.now();
        try {
            return LocalDate.parse(iso.trim());
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid purchase date: " + iso);
        }
    }
}
