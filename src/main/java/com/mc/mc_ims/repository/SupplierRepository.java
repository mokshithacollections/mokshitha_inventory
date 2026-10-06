package com.mc.mc_ims.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import com.mc.mc_ims.entity.Supplier;

import java.util.List;

public interface SupplierRepository extends JpaRepository<Supplier, String> {

    /** Active suppliers only (for dropdowns when recording new purchases). */
    List<Supplier> findByActiveTrueOrderByNameAsc();

    /** All suppliers, ordered alphabetically — used in the management UI. */
    List<Supplier> findAllByOrderByNameAsc();

    /** Case-insensitive name match — used by the search box on the suppliers tab. */
    @Query("SELECT s FROM Supplier s WHERE LOWER(s.name) LIKE LOWER(CONCAT('%', :q, '%')) ORDER BY s.name ASC")
    List<Supplier> searchByName(String q);

    /** Check for duplicate names before creating (case-insensitive). */
    boolean existsByNameIgnoreCase(String name);
}