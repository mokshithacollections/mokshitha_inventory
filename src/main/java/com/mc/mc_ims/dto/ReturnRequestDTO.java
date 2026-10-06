package com.mc.mc_ims.dto;
import lombok.Data;
import java.util.List;

/**
 * Incoming payload for POST /api/return/process.
 *
 * - Pure return:        returnItems[] populated, exchangeItems[] empty
 * - Return + exchange:  both populated
 */
@Data
public class ReturnRequestDTO {
	private String originalBillNo;
    private String processedBy;
    private String refundMode;     // Cash | UPI | Store Credit | Adjusted in New Bill
    private String notes;
 
    private Boolean adminOverride = false;
    private String  adminPassword; // checked server-side when adminOverride=true
 
    private List<ReturnedItemDTO> returnItems;
    private List<InvoiceItemDTO>  exchangeItems;
 
    // Only used when exchangeItems is non-empty (for the new invoice)
    private String buyerName;
    private String buyerMobile;
    private String paymentMode;
}
