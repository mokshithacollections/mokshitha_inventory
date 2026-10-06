package com.mc.mc_ims.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;

import com.mc.mc_ims.dto.*;
import com.mc.mc_ims.entity.*;
import com.mc.mc_ims.repository.InvoiceRepository;
import com.mc.mc_ims.repository.ProductRepository;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.math.BigDecimal;
import java.util.*;

@Service
public class InvoiceService {

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private ProductRepository productRepository;

    private String generateBillNo(String sellerName) {
        DateTimeFormatter formatter =
                DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
        
        String prifix = sellerName.equals("Mokshitha Collections")? "MCI" : "MSI";
        return prifix + LocalDateTime.now().format(formatter);
    }

    @Transactional
    public String saveInvoice(InvoiceDTO dto) {
    	
    	LocalDateTime now = LocalDateTime.now();
    	
        String billNo = generateBillNo(dto.getSellerName());

        Invoice invoice = new Invoice();
        invoice.setBillNo(billNo);
        invoice.setInvoiceDate(now.toLocalDate());
        invoice.setInvoiceTime(now.toLocalTime());
        invoice.setSellerName(dto.getSellerName());
        invoice.setBuyerName(dto.getBuyerName());
        invoice.setBuyerMobile(dto.getBuyerMobile());
        invoice.setPaymentMode(dto.getPaymentMode());

        List<InvoiceItem> itemList = new ArrayList<>();
        BigDecimal grandTotal = BigDecimal.ZERO;

        for (InvoiceItemDTO itemDTO : dto.getItems()) {

            // Deduct the sold quantity from product stock (atomic with the invoice save).
            Product product = productRepository.findById(itemDTO.getProductId())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Product not found: " + itemDTO.getProductId()));

            int soldQty = itemDTO.getQuantity();
            if (product.getQuantity() < soldQty) {
                throw new IllegalStateException(
                        "Insufficient stock for " + product.getName() +
                        " (" + product.getProductId() + "): available " +
                        product.getQuantity() + ", requested " + soldQty);
            }
            product.setQuantity(product.getQuantity() - soldQty);
            productRepository.save(product);

            InvoiceItem item = new InvoiceItem();
            item.setProductId(itemDTO.getProductId());
            item.setDescription(itemDTO.getDescription());
            item.setBillOn(itemDTO.getBillOn());
            item.setColor(itemDTO.getColor());
            item.setDiscount(itemDTO.getDiscount());
            item.setAppliedOn(itemDTO.getAppliedOn());
            item.setPrice(itemDTO.getPrice());
            item.setQuantity(itemDTO.getQuantity());

            BigDecimal total =
                    itemDTO.getPrice().multiply(
                            BigDecimal.valueOf(itemDTO.getQuantity()));

            item.setTotalPrice(total);
            grandTotal = grandTotal.add(total);

            item.setInvoice(invoice);
            itemList.add(item);
        }

        invoice.setTotalAmount(grandTotal);
        invoice.setItems(itemList);

        invoiceRepository.save(invoice);

        return billNo;
    }
}
