package com.mc.mc_ims.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.Valid;

import com.mc.mc_ims.dto.PurchaseInvoiceDTO;
import com.mc.mc_ims.dto.PurchasePriceHistoryDTO;
import com.mc.mc_ims.entity.PurchaseInvoice;
import com.mc.mc_ims.entity.PurchaseBillPhoto;
import com.mc.mc_ims.service.PurchaseService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/purchases")
public class PurchaseRestController {

    @Autowired
    private PurchaseService purchaseService;

    /** Record a purchase — increases product stock atomically. */
    @PostMapping
    public ResponseEntity<?> save(@Valid @RequestBody PurchaseInvoiceDTO dto) {
        try {
            PurchaseInvoice saved = purchaseService.savePurchase(dto);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException | IllegalStateException e) {
            // product/supplier not found, bad amount, etc. — nothing saved (rolls back)
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500)
                    .body(Map.of("error", "Failed to save purchase: " + e.getMessage()));
        }
    }

    @GetMapping
    public List<PurchaseInvoice> all() {
        return purchaseService.listAll();
    }

    @GetMapping("/{purchaseId}")
    public ResponseEntity<?> single(@PathVariable String purchaseId) {
        try {
            return ResponseEntity.ok(purchaseService.getById(purchaseId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/by-supplier/{supplierId}")
    public List<PurchaseInvoice> bySupplier(@PathVariable String supplierId) {
        return purchaseService.listBySupplier(supplierId);
    }

    /** Prior purchase prices for a product (newest first). Default 5; the Price
     *  Check tab requests more via ?limit=. */
    @GetMapping("/price-history/{productId}")
    public List<PurchasePriceHistoryDTO> priceHistory(
            @PathVariable String productId,
            @RequestParam(name = "limit", defaultValue = "5") int limit) {
        return purchaseService.priceHistory(productId, limit);
    }

    /** Upload (or replace) the bill photo for a purchase. */
    @PostMapping("/{purchaseId}/bill-photo")
    public ResponseEntity<?> uploadBillPhoto(@PathVariable String purchaseId,
                                             @RequestParam("file") MultipartFile file) {
        try {
            PurchaseInvoice saved = purchaseService.attachBillPhoto(purchaseId, file);
            return ResponseEntity.ok(Map.of(
                    "purchaseId", saved.getPurchaseId(),
                    "billPhoto",  saved.getBillPhoto()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500)
                    .body(Map.of("error", "Failed to upload bill photo: " + e.getMessage()));
        }
    }

    /** Stream the bill photo image from the DB (inline, so the browser can display it). */
    @GetMapping("/{purchaseId}/bill-photo")
    public ResponseEntity<?> getBillPhoto(@PathVariable String purchaseId) {
        try {
            PurchaseBillPhoto photo = purchaseService.getBillPhoto(purchaseId);
            MediaType mediaType;
            try {
                mediaType = MediaType.parseMediaType(photo.getContentType());
            } catch (Exception ex) {
                mediaType = MediaType.APPLICATION_OCTET_STREAM;
            }
            String name = photo.getFileName() != null ? photo.getFileName() : purchaseId;
            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header("Content-Disposition", "inline; filename=\"" + name + "\"")
                    .body(photo.getData());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }
}
