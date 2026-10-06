package com.mc.mc_ims.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
public class HomeController {
	
	
	@GetMapping("/")
    public String homePage(Model model) {
        return "home";  // resolves to /WEB-INF/jsp/index.jsp
    }
	

	@GetMapping("/invoice")
	public String showInvoice() {
	    return "invoice";  // no .html
	}
	
	@GetMapping("/analysis")
	public String showAnalysis() {
	    return "analysis";  // resolves to templates/analysis.html
	}
	
	/**
     * Print-friendly return receipt page (similar look to invoice.html).
     * The receipt template itself is built in Phase 3; this route is
     * wired in advance so Phase 2's UI can open it via a `_blank` link.
     */
    @GetMapping("/return-receipt/{returnId}")
    public String showReturnReceipt(@PathVariable String returnId, Model model) {
        model.addAttribute("returnId", returnId);
        return "return-receipt";
    }
    
    @GetMapping("/purchases")
	public String showPurchases() {
	    return "purchases";  // resolves to templates/purchases.html
	}
	
}
