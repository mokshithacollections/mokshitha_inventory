package com.mc.mc_ims.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import com.mc.mc_ims.entity.PurchaseInvoice;

import java.math.BigDecimal;
import java.util.List;

public interface PurchaseInvoiceRepository extends JpaRepository<PurchaseInvoice, String> {

    /** All purchases, newest first — for the Purchase Invoices list. */
    List<PurchaseInvoice> findAllByOrderByPurchaseDateDescCreatedTimeDesc();

    /** Purchases for one supplier, newest first — for the ledger / supplier view. */
    List<PurchaseInvoice> findBySupplierIdOrderByPurchaseDateDescCreatedTimeDesc(String supplierId);

    /** All purchases with items in one query — avoids N+1 during serialization. */
    @Query("SELECT DISTINCT p FROM PurchaseInvoice p LEFT JOIN FETCH p.items "
         + "ORDER BY p.purchaseDate DESC, p.createdTime DESC")
    List<PurchaseInvoice> findAllWithItems();

    /** One supplier's purchases with items in one query. */
    @Query("SELECT DISTINCT p FROM PurchaseInvoice p LEFT JOIN FETCH p.items "
         + "WHERE p.supplierId = :supplierId "
         + "ORDER BY p.purchaseDate DESC, p.createdTime DESC")
    List<PurchaseInvoice> findBySupplierWithItems(String supplierId);

    /** Total value of all purchases from a supplier (feeds the balance calc). */
    @Query("SELECT COALESCE(SUM(p.totalAmount), 0) FROM PurchaseInvoice p WHERE p.supplierId = :supplierId")
    BigDecimal sumTotalBySupplier(String supplierId);

    /** Total already paid at purchase time (reduces the balance owed). */
    @Query("SELECT COALESCE(SUM(p.amountPaid), 0) FROM PurchaseInvoice p WHERE p.supplierId = :supplierId")
    BigDecimal sumAmountPaidBySupplier(String supplierId);
}
