package com.mc.mc_ims.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.mc.mc_ims.entity.Supplier;
import com.mc.mc_ims.entity.SupplierPayment;
import com.mc.mc_ims.dto.SupplierPaymentDTO;
import com.mc.mc_ims.service.SupplierService;
import com.mc.mc_ims.service.LedgerService;

import jakarta.validation.Valid;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/suppliers")
public class SupplierRestController {

    @Autowired
    private SupplierService supplierService;

    @Autowired
    private LedgerService ledgerService;

    // -----------------------------------------------------
    //  GET /api/suppliers              → all suppliers (incl. inactive)
    //  GET /api/suppliers?active=true  → only active suppliers (for dropdowns)
    //  GET /api/suppliers?search=ka    → name search
    // -----------------------------------------------------
    @GetMapping
    public List<Supplier> list(
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String search) {

        if (search != null && !search.isBlank()) {
            return supplierService.search(search);
        }
        if (Boolean.TRUE.equals(active)) {
            return supplierService.listActive();
        }
        return supplierService.listAll();
    }

    @GetMapping("/{supplierId}")
    public ResponseEntity<?> single(@PathVariable String supplierId) {
        return supplierService.findById(supplierId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(404)
                        .body(Map.of("error", "Supplier not found: " + supplierId)));
    }

    /** Map of supplierId → current balance, for the suppliers table. */
    @GetMapping("/balances")
    public Map<String, BigDecimal> balances() {
        Map<String, BigDecimal> result = new HashMap<>();
        for (Supplier s : supplierService.listAll()) {
            result.put(s.getSupplierId(), supplierService.computeBalance(s.getSupplierId()));
        }
        return result;
    }

    @GetMapping("/{supplierId}/balance")
    public ResponseEntity<?> balance(@PathVariable String supplierId) {
        try {
            BigDecimal balance = supplierService.computeBalance(supplierId);
            Map<String, Object> resp = new HashMap<>();
            resp.put("supplierId", supplierId);
            resp.put("balance",    balance);
            return ResponseEntity.ok(resp);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Supplier supplier) {
        try {
            Supplier saved = supplierService.create(supplier);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500)
                    .body(Map.of("error", "Failed to create supplier: " + e.getMessage()));
        }
    }

    @PutMapping("/{supplierId}")
    public ResponseEntity<?> update(@PathVariable String supplierId,
                                    @RequestBody Supplier updates) {
        try {
            Supplier saved = supplierService.update(supplierId, updates);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500)
                    .body(Map.of("error", "Failed to update supplier: " + e.getMessage()));
        }
    }

    /** Soft-disable (sets active=false). Suppliers are never hard-deleted. */
    @DeleteMapping("/{supplierId}")
    public ResponseEntity<?> deactivate(@PathVariable String supplierId) {
        try {
            supplierService.setActive(supplierId, false);
            return ResponseEntity.ok(Map.of("message", "Supplier deactivated."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    /** Re-activate a previously deactivated supplier. */
    @PostMapping("/{supplierId}/activate")
    public ResponseEntity<?> activate(@PathVariable String supplierId) {
        try {
            supplierService.setActive(supplierId, true);
            return ResponseEntity.ok(Map.of("message", "Supplier reactivated."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    // -----------------------------------------------------
    //  Payments (Phase 2)
    // -----------------------------------------------------
    /** Record a payment made to this supplier. Reduces the balance owed. */
    @PostMapping("/{supplierId}/payments")
    public ResponseEntity<?> recordPayment(@PathVariable String supplierId,
                                           @Valid @RequestBody SupplierPaymentDTO dto) {
        try {
            SupplierPayment saved = supplierService.recordPayment(supplierId, dto);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500)
                    .body(Map.of("error", "Failed to record payment: " + e.getMessage()));
        }
    }

    /** All payments made to this supplier, newest first. */
    @GetMapping("/{supplierId}/payments")
    public List<SupplierPayment> listPayments(@PathVariable String supplierId) {
        return supplierService.listPayments(supplierId);
    }

    // -----------------------------------------------------
    //  Ledger (Phase 3)
    // -----------------------------------------------------
    /** Full running statement for this supplier. */
    @GetMapping("/{supplierId}/ledger")
    public ResponseEntity<?> ledger(@PathVariable String supplierId) {
        try {
            return ResponseEntity.ok(ledgerService.buildLedger(supplierId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }
}