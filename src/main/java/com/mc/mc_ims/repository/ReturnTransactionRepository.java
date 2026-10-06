package com.mc.mc_ims.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import com.mc.mc_ims.entity.ReturnTransaction;

import java.util.List;

public interface ReturnTransactionRepository extends JpaRepository<ReturnTransaction, String> {

    /** All returns processed against a particular original bill. */
    List<ReturnTransaction> findByOriginalBillNo(String originalBillNo);

    /** Used by InvoiceRestController to block deletion of bills that have returns. */
    boolean existsByOriginalBillNo(String originalBillNo);

    /** Used to find returns that produced a particular new (exchange) bill. */
    List<ReturnTransaction> findByNewBillNo(String newBillNo);

    /** All returns ordered most-recent first (for the future Returns History UI). */
    java.util.List<ReturnTransaction> findAllByOrderByReturnDateDescReturnTimeDesc();

    /** Same list, but loads items in one query (avoids N+1 during serialization). */
    @Query("SELECT DISTINCT r FROM ReturnTransaction r LEFT JOIN FETCH r.items "
         + "ORDER BY r.returnDate DESC, r.returnTime DESC")
    List<ReturnTransaction> findAllWithItems();
}