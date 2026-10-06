package com.mc.mc_ims.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.mc.mc_ims.dto.*;
import com.mc.mc_ims.entity.ReturnTransaction;
import com.mc.mc_ims.repository.ReturnTransactionRepository;
import com.mc.mc_ims.service.ReturnService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/return")
public class ReturnRestController {

    @Autowired private ReturnService returnService;
    @Autowired private ReturnTransactionRepository returnRepository;

    // -----------------------------------------------------
    //  GET /api/return/lookup/{billNo}
    //  Returns the original bill + per-item remaining-returnable counts
    //  plus the days-since-purchase / withinReturnWindow flag for the UI.
    // -----------------------------------------------------
    @GetMapping("/lookup/{billNo}")
    public ResponseEntity<?> lookup(@PathVariable String billNo) {
        try {
            BillLookupResponseDTO dto = returnService.lookupBill(billNo);
            return ResponseEntity.ok(dto);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    // -----------------------------------------------------
    //  POST /api/return/process
    //  Process a return (+ optional exchange) atomically.
    // -----------------------------------------------------
    @PostMapping("/process")
    public ResponseEntity<?> process(@RequestBody ReturnRequestDTO request) {
        try {
            ReturnService.ReturnResult result = returnService.processReturn(request);
            return ResponseEntity.ok(Map.of(
                    "returnId",         result.getReturnId(),
                    "newBillNo",        result.getNewBillNo() == null ? "" : result.getNewBillNo(),
                    "totalReturnValue", result.getTotalReturnValue(),
                    "exchangeTotal",    result.getExchangeTotal(),
                    "refundAmount",     result.getRefundAmount(),
                    "refundMode",       result.getRefundMode()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(
                    Map.of("error", "Internal error while processing return: " + e.getMessage()));
        }
    }

    // -----------------------------------------------------
    //  GET /api/return/all — list returns (most-recent first)
    // -----------------------------------------------------
    @GetMapping("/all")
    public List<ReturnTransaction> all() {
        // JOIN FETCH items in one query — avoids N+1 as returns history grows.
        return returnRepository.findAllWithItems();
    }

    // -----------------------------------------------------
    //  GET /api/return/{returnId} — single return for receipt page
    // -----------------------------------------------------
    @GetMapping("/{returnId}")
    public ResponseEntity<?> single(@PathVariable String returnId) {
        return returnRepository.findById(returnId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(404).body(
                        Map.of("error", "Return not found: " + returnId)));
    }

    // -----------------------------------------------------
    //  GET /api/return/by-bill/{billNo} — has-this-bill-been-returned-against?
    //  Used by the front-end to show "Returned" badges on Past Business rows.
    // -----------------------------------------------------
    @GetMapping("/by-bill/{billNo}")
    public List<ReturnTransaction> byBill(@PathVariable String billNo) {
        return returnRepository.findByOriginalBillNo(billNo);
    }
}