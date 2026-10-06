package com.mc.mc_ims.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import com.mc.mc_ims.entity.SupplierPayment;

import java.math.BigDecimal;
import java.util.List;

public interface SupplierPaymentRepository extends JpaRepository<SupplierPayment, String> {

    /** Payments to one supplier, newest first. */
    List<SupplierPayment> findBySupplierIdOrderByPaymentDateDescCreatedTimeDesc(String supplierId);

    /** All payments, newest first. */
    List<SupplierPayment> findAllByOrderByPaymentDateDescCreatedTimeDesc();

    /** Total amount paid to a supplier (feeds the balance calc). */
    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM SupplierPayment p WHERE p.supplierId = :supplierId")
    BigDecimal sumAmountBySupplier(String supplierId);
}
