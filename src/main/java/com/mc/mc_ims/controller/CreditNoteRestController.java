package com.mc.mc_ims.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;

import com.mc.mc_ims.dto.CreditNoteDTO;
import com.mc.mc_ims.entity.CreditNote;
import com.mc.mc_ims.service.CreditNoteService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/credit-notes")
public class CreditNoteRestController {

    @Autowired
    private CreditNoteService creditNoteService;

    /** Record a credit note — reduces the supplier balance (and stock if flagged). */
    @PostMapping
    public ResponseEntity<?> save(@Valid @RequestBody CreditNoteDTO dto) {
        try {
            CreditNote saved = creditNoteService.saveCreditNote(dto);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500)
                    .body(Map.of("error", "Failed to save credit note: " + e.getMessage()));
        }
    }

    @GetMapping
    public List<CreditNote> all() {
        return creditNoteService.listAll();
    }

    @GetMapping("/{creditNoteId}")
    public ResponseEntity<?> single(@PathVariable String creditNoteId) {
        try {
            return ResponseEntity.ok(creditNoteService.getById(creditNoteId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/by-supplier/{supplierId}")
    public List<CreditNote> bySupplier(@PathVariable String supplierId) {
        return creditNoteService.listBySupplier(supplierId);
    }
}
