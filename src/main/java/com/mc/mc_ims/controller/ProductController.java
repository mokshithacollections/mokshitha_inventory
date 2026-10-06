package com.mc.mc_ims.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.mc.mc_ims.entity.Product;
import com.mc.mc_ims.repository.ProductRepository;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
@CrossOrigin
public class ProductController {

    private final ProductRepository productRepository;

    // ✅ Get all products
    @GetMapping
    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }

    // ✅ Save product
    @PostMapping
    public ResponseEntity<?> saveProduct(@RequestBody Product product) {

        if (productRepository.existsByProductId(product.getProductId())) {
            return ResponseEntity
                    .badRequest()
                    .body("Product ID already used");
        }

        Product saved = productRepository.save(product);
        return ResponseEntity.ok(saved);
    }
    
    @PutMapping("/{productId}")
    public ResponseEntity<?> updateProduct(@PathVariable String productId,
                                           @RequestBody Product updatedProduct) {

        Optional<Product> optionalProduct = productRepository.findById(productId);

        if (optionalProduct.isEmpty()) {
            return ResponseEntity.status(404)
                    .body("Product not found");
        }

        Product existingProduct = optionalProduct.get();

        existingProduct.setCategory(updatedProduct.getCategory());
        existingProduct.setName(updatedProduct.getName());
        existingProduct.setDescription(updatedProduct.getDescription());
        existingProduct.setSize(updatedProduct.getSize());
        existingProduct.setColor(updatedProduct.getColor());
        existingProduct.setActualPrice(updatedProduct.getActualPrice());
        existingProduct.setSellingPrice(updatedProduct.getSellingPrice());
        existingProduct.setQuantity(updatedProduct.getQuantity());

        productRepository.save(existingProduct);

        return ResponseEntity.ok(existingProduct);
    }
    
    @DeleteMapping("/{productId}")
    public ResponseEntity<?> deleteProduct(@PathVariable String productId) {

        if (!productRepository.existsById(productId)) {
            return ResponseEntity.status(404)
                    .body("Product not found");
        }

        productRepository.deleteById(productId);

        return ResponseEntity.ok("Product Removed Successfully..!");
    }




}
