package com.mc.mc_ims.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.mc.mc_ims.entity.Invoice;

import java.time.LocalDate;
import java.util.List;

public interface InvoiceRepository extends JpaRepository<Invoice, String> {

	List<Invoice> findByInvoiceDateBetweenOrderByInvoiceDateDescInvoiceTimeDesc(
	        LocalDate startDate,
	        LocalDate endDate
	);

	/**
	 * Fetch all invoices WITH their items in a single query (LEFT JOIN FETCH),
	 * avoiding the N+1 explosion that made /api/invoice/all take minutes.
	 * DISTINCT collapses the duplicate parent rows the join produces.
	 */
	@Query("SELECT DISTINCT i FROM Invoice i LEFT JOIN FETCH i.items "
	     + "ORDER BY i.invoiceDate DESC, i.invoiceTime DESC")
	List<Invoice> findAllWithItems();

	/** Same single-query fetch, restricted to a date range. */
	@Query("SELECT DISTINCT i FROM Invoice i LEFT JOIN FETCH i.items "
	     + "WHERE i.invoiceDate BETWEEN :start AND :end "
	     + "ORDER BY i.invoiceDate DESC, i.invoiceTime DESC")
	List<Invoice> findByDateRangeWithItems(@Param("start") LocalDate start,
	                                       @Param("end") LocalDate end);
}
