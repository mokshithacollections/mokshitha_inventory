package com.mc.mc_ims.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * The actual image bytes of a purchase's bill photo, stored IN the database
 * (PostgreSQL bytea) so it is shared across all machines that point at the same
 * DB. Kept in its own table so the heavy blob is never loaded when listing
 * purchases — it's read only by the bill-photo view endpoint.
 *
 * One row per purchase (PK == purchaseId).
 */
@Entity
@Table(name = "purchase_bill_photos")
public class PurchaseBillPhoto {

    @Id
    @Column(name = "purchase_id", nullable = false, length = 20)
    private String purchaseId;

    /** Raw image bytes. Mapped explicitly to bytea (not a Postgres large object). */
    @Column(name = "data", nullable = false, columnDefinition = "bytea")
    private byte[] data;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType;

    @Column(name = "file_name", length = 255)
    private String fileName;

    @Column(name = "uploaded_at", nullable = false)
    private LocalDateTime uploadedAt;

    public String getPurchaseId() { return purchaseId; }
    public void setPurchaseId(String purchaseId) { this.purchaseId = purchaseId; }

    public byte[] getData() { return data; }
    public void setData(byte[] data) { this.data = data; }

    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public LocalDateTime getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(LocalDateTime uploadedAt) { this.uploadedAt = uploadedAt; }
}
