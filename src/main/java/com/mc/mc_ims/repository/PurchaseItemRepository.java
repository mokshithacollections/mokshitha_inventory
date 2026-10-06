package com.mc.mc_ims.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.mc.mc_ims.entity.PurchaseItem;

import java.util.List;

public interface PurchaseItemRepository extends JpaRepository<PurchaseItem, Long> {

    /**
     * Every purchase line for a given product, newest purchase first — used to
     * show the buyer what they previously paid for this product.
     */
    @Query("SELECT pi FROM PurchaseItem pi JOIN FETCH pi.purchaseInvoice p "
         + "WHERE pi.productId = :productId "
         + "ORDER BY p.purchaseDate DESC, p.createdTime DESC")
    List<PurchaseItem> findRecentByProductId(@Param("productId") String productId);
}
