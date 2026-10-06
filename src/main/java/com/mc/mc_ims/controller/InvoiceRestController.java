package com.mc.mc_ims.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;

import jakarta.validation.Valid;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import com.mc.mc_ims.dto.InvoiceDTO;
import com.mc.mc_ims.entity.Invoice;
import com.mc.mc_ims.repository.InvoiceRepository;
import com.mc.mc_ims.repository.ReturnTransactionRepository;
import com.mc.mc_ims.service.InvoiceService;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.*;
import java.io.ByteArrayOutputStream;

import com.itextpdf.kernel.pdf.*;
import com.itextpdf.layout.*;
import com.itextpdf.layout.element.Paragraph;

@RestController
@RequestMapping("/api/invoice")
public class InvoiceRestController {

    @Autowired
    private InvoiceService invoiceService;
    
    @Autowired
    private InvoiceRepository invoiceRepository;
    
    /** Used to block deletion of bills that have returns recorded against them. */
    @Autowired
    private ReturnTransactionRepository returnRepository;

    @PostMapping("/save")
    public ResponseEntity<?> saveInvoice(@Valid @RequestBody InvoiceDTO dto) {
        try {
            String billNo = invoiceService.saveInvoice(dto);
            return ResponseEntity.ok(Map.of("billNo", billNo));
        } catch (IllegalArgumentException | IllegalStateException e) {
            // e.g. product not found or insufficient stock — nothing is saved (transaction rolls back)
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    @GetMapping("/all")
    public List<Invoice> getAllInvoices() {
        // Single JOIN FETCH query — avoids N+1 loading of each invoice's items.
        return invoiceRepository.findAllWithItems();
    }

    @GetMapping("/filter")
    public List<Invoice> filterInvoices(
            @RequestParam String start,
            @RequestParam String end) {

        LocalDate startDate = LocalDate.parse(start);
        LocalDate endDate = LocalDate.parse(end);

        return invoiceRepository.findByDateRangeWithItems(startDate, endDate);
    }
    
//    @DeleteMapping("/{billNo}")
//    @ResponseBody
//    public ResponseEntity<?> deleteInvoice(@PathVariable String billNo) {
//        invoiceRepository.deleteById(billNo);
//        return ResponseEntity.ok().build();
//    }
    
    /**
     * Deletes an invoice — BUT refuses if any returns have been recorded against it.
     * Preserves the audit trail: if you've returned against a bill, the bill must stay.
     */
    @DeleteMapping("/{billNo}")
    @ResponseBody
    public ResponseEntity<?> deleteInvoice(@PathVariable String billNo) {
        if (returnRepository.existsByOriginalBillNo(billNo)) {
            return ResponseEntity.badRequest().body(Map.of(
                "error",
                "Cannot delete bill " + billNo +
                " — one or more returns have been processed against it. " +
                "Deleting it would break the audit trail."
            ));
        }
        invoiceRepository.deleteById(billNo);
        return ResponseEntity.ok().build();
    }
    
    @GetMapping("/export/excel")
    public ResponseEntity<byte[]> exportExcel() throws Exception {

        List<Invoice> invoices = invoiceRepository.findAll();

        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("Invoices");

        Row header = sheet.createRow(0);
        header.createCell(0).setCellValue("Bill No");
        header.createCell(1).setCellValue("Date");
        header.createCell(2).setCellValue("Time");
        header.createCell(3).setCellValue("Seller");
        header.createCell(4).setCellValue("Total");
        header.createCell(5).setCellValue("Payment Mode");

        int rowNum = 1;
        for (Invoice inv : invoices) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(inv.getBillNo());
            row.createCell(1).setCellValue(inv.getInvoiceDate().toString());
            row.createCell(2).setCellValue(inv.getInvoiceTime().toString());
            row.createCell(3).setCellValue(inv.getSellerName());
            row.createCell(4).setCellValue(inv.getTotalAmount().doubleValue());
            row.createCell(5).setCellValue(inv.getPaymentMode());
        }

        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        workbook.write(bos);
        workbook.close();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=invoices.xlsx")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(bos.toByteArray());
    }
    
    @GetMapping("/export/pdf")
    public ResponseEntity<byte[]> exportPdf() throws Exception {

        List<Invoice> invoices = invoiceRepository.findAll();

        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(bos);
        PdfDocument pdf = new PdfDocument(writer);
        Document document = new Document(pdf);

        document.add(new Paragraph("Invoice Report\n\n"));

        for (Invoice inv : invoices) {
            document.add(new Paragraph(
                    inv.getBillNo() + " | " +
                    inv.getInvoiceDate() + " | " +
                    inv.getTotalAmount()
            ));
        }

        document.close();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=invoices.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(bos.toByteArray());
    }
}
