package com.mc.mc_ims.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import com.mc.mc_ims.entity.CreditNote;

import java.math.BigDecimal;
import java.util.List;

public interface CreditNoteRepository extends JpaRepository<CreditNote, String> {

    /** All credit notes, newest first. */
    List<CreditNote> findAllByOrderByCreditDateDescCreatedTimeDesc();

    /** All credit notes with items in one query — avoids N+1 during serialization. */
    @Query("SELECT DISTINCT c FROM CreditNote c LEFT JOIN FETCH c.items "
         + "ORDER BY c.creditDate DESC, c.createdTime DESC")
    List<CreditNote> findAllWithItems();

    /** Credit notes for one supplier, newest first. */
    List<CreditNote> findBySupplierIdOrderByCreditDateDescCreatedTimeDesc(String supplierId);

    /** Total credit received from a supplier (feeds the balance calc). */
    @Query("SELECT COALESCE(SUM(c.amount), 0) FROM CreditNote c WHERE c.supplierId = :supplierId")
    BigDecimal sumAmountBySupplier(String supplierId);
}
