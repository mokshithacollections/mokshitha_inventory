package com.mc.mc_ims.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;

@Entity
@Table(name = "products")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product {

    @Id
    @NotBlank
    @Column(name = "product_id", nullable = false, unique = true)
    private String productId;

    @NotBlank
    @Column(nullable = false)
    private String name;

    @NotBlank
    @Column(nullable = false)
    private String category;

    // Optional field
    @Column(nullable = true)
    private String description;

    @NotBlank
    @Column(nullable = false)
    private String size;

    @NotBlank
    @Column(nullable = false)
    private String color;

    @NotNull
    @Positive
    @Column(nullable = false)
    private Double actualPrice;

    @NotNull
    @Positive
    @Column(nullable = false)
    private Double sellingPrice;

    @NotNull
    @Min(0)
    @Column(nullable = false)
    private Integer quantity;
}

