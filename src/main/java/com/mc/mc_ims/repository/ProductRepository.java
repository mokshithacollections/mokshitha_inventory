package com.mc.mc_ims.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.mc.mc_ims.entity.Product;

public interface ProductRepository extends JpaRepository<Product, String> {
	 boolean existsByProductId(String productId);
}
