-- ============================================================================
--  Removing a duplicate bill (and putting its stock back)
-- ============================================================================
--
--  WHY THIS IS SQL AND NOT THE "Remove" BUTTON
--  -------------------------------------------
--  DELETE /api/invoice/{billNo} deletes the invoice and its line items, but it
--  never returns the quantities to products.quantity. Deleting a duplicate that
--  way corrects the revenue and leaves the stock permanently short. This script
--  does both, in one transaction.
--
--  BEFORE YOU START
--  ----------------
--      pg_dump -U postgres -d <your_db> -f backup_before_cleanup.sql
--
--  The script ends with ROLLBACK. Read the output, satisfy yourself it is
--  correct, then change the last line to COMMIT and run it again.
--
--  Run with:  psql -U postgres -d <your_db> -f cleanup-duplicate-bills.sql
-- ============================================================================


-- ----------------------------------------------------------------------------
--  STEP 1 — Find every duplicate, not just the one you noticed
-- ----------------------------------------------------------------------------
--  Signature of an accidental double-submit: same buyer, same day, same total,
--  more than one bill. Genuine repeat purchases almost never match to the paisa.
--  `gap_seconds` is the giveaway — a real second sale is minutes apart, a
--  double-submit is seconds.

SELECT
    buyer_name,
    buyer_mobile,
    invoice_date,
    total_amount,
    count(*)                                        AS copies,
    string_agg(bill_no, ' , ' ORDER BY invoice_time) AS bill_numbers,
    EXTRACT(EPOCH FROM (max(invoice_time) - min(invoice_time)))::int AS gap_seconds
FROM invoice
GROUP BY buyer_name, buyer_mobile, invoice_date, total_amount
HAVING count(*) > 1
ORDER BY invoice_date DESC;


-- ----------------------------------------------------------------------------
--  STEP 2 — Set the bill you are deleting
-- ----------------------------------------------------------------------------
--  Keep the EARLIER bill, delete the LATER one. Change this one value only.

\set doomed_bill 'MSI20261004143537'


-- ----------------------------------------------------------------------------
--  STEP 3 — Pre-flight checks. Do not skip these.
-- ----------------------------------------------------------------------------

-- 3a. Is there a return against this bill? If this returns ANY row, STOP.
--     Deleting it would orphan a return record and break the audit trail.
SELECT return_id, original_bill_no, new_bill_no, return_date
FROM return_transactions
WHERE original_bill_no = :'doomed_bill'
   OR new_bill_no      = :'doomed_bill';

-- 3b. Has anything on this bill already been returned? If returned_quantity is
--     anything but 0, STOP — the stock maths below would be wrong.
SELECT id, description, quantity, returned_quantity
FROM invoice_items
WHERE bill_no = :'doomed_bill'
  AND COALESCE(returned_quantity, 0) <> 0;

-- 3c. What will be given back, and does each product still exist?
--
--     Grouped BY PRODUCT, not by line, because the UPDATE below is grouped too.
--     This matters: your bill has MUSLIN JAMDANI on two separate lines at
--     different prices. A per-line preview would show each one returning 1 unit
--     and look like the stock only goes up by 1, when it actually goes up by 2.
--
--     product_id NULL  -> stock was never deducted for that line, nothing to return
--     current_stock NULL -> the product has since been deleted, nothing to credit
SELECT
    ii.product_id,
    string_agg(DISTINCT ii.description, ' / ')  AS description,
    count(*)                                    AS on_lines,
    SUM(ii.quantity)                            AS units_to_return,
    p.quantity                                  AS current_stock,
    p.quantity + SUM(ii.quantity)               AS stock_after
FROM invoice_items ii
LEFT JOIN products p ON p.product_id = ii.product_id
WHERE ii.bill_no = :'doomed_bill'
GROUP BY ii.product_id, p.quantity
ORDER BY ii.product_id;


-- ----------------------------------------------------------------------------
--  STEP 4 — The cleanup
-- ----------------------------------------------------------------------------

BEGIN;

-- 4a. Put the stock back FIRST, while the line items still exist to read.
--     Grouped by product_id because the same product can appear on two lines.
UPDATE products p
SET quantity = p.quantity + x.units
FROM (
    SELECT product_id, SUM(quantity) AS units
    FROM invoice_items
    WHERE bill_no = :'doomed_bill'
      AND product_id IS NOT NULL
    GROUP BY product_id
) x
WHERE p.product_id = x.product_id;

-- 4b. Then the line items.
DELETE FROM invoice_items WHERE bill_no = :'doomed_bill';

-- 4c. Then the invoice itself.
DELETE FROM invoice WHERE bill_no = :'doomed_bill';


-- ----------------------------------------------------------------------------
--  STEP 5 — Confirm before committing
-- ----------------------------------------------------------------------------

-- Both should return 0 rows.
SELECT bill_no FROM invoice       WHERE bill_no = :'doomed_bill';
SELECT id      FROM invoice_items WHERE bill_no = :'doomed_bill';

-- The duplicate group should be gone. Re-running the STEP 1 detection is a
-- better check than naming a buyer and date, which would silently return
-- nothing if either were typed wrong and look like success.
SELECT
    buyer_name,
    buyer_mobile,
    invoice_date,
    total_amount,
    count(*)                                        AS copies,
    string_agg(bill_no, ' , ' ORDER BY invoice_time) AS bill_numbers
FROM invoice
GROUP BY buyer_name, buyer_mobile, invoice_date, total_amount
HAVING count(*) > 1
ORDER BY invoice_date DESC;


-- ============================================================================
--  Leaves the database untouched. Once the output above looks right, change
--  this to COMMIT and run the file again.
-- ============================================================================
ROLLBACK;
-- COMMIT;
