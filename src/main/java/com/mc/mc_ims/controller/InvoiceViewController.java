package com.mc.mc_ims.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.ui.Model;

import com.mc.mc_ims.repository.InvoiceRepository;
import com.mc.mc_ims.entity.Invoice;

@Controller
public class InvoiceViewController {

    @Autowired
    private InvoiceRepository invoiceRepository;

    @GetMapping("/invoice/{billNo}")
    public String viewInvoice(@PathVariable String billNo, Model model) {

        Invoice invoice = invoiceRepository.findById(billNo)
                .orElseThrow(() -> new RuntimeException("Invoice Not Found"));
      
        model.addAttribute("invoice", invoice);
        return "invoice";
    }
}
