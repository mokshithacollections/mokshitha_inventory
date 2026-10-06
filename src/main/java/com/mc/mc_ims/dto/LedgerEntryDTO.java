package com.mc.mc_ims.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A single row of a supplier ledger / running statement.
 *   debit  = increases what we owe (a purchase)
 *   credit = decreases what we owe (a payment or credit note)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LedgerEntryDTO {

    private LocalDate date;

    /** OPENING | PURCHASE | PAYMENT | CREDIT_NOTE */
    private String type;

    /** Reference id (purchaseId / paymentId / creditNoteId), null for OPENING. */
    private String refId;

    private String description;

    private BigDecimal debit;

    private BigDecimal credit;

    /** Balance owed after applying this row. */
    private BigDecimal runningBalance;
}
