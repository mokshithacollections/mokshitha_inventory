<%@ page session="true" %>
<%@ taglib uri="http://java.sun.com/jsp/jstl/core" prefix="c" %>
<%@ page contentType="text/html;charset=UTF-8" language="java" pageEncoding="UTF-8" %>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mokshitha Collections - Inventory Management System</title>
    <!-- Font Awesome for icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
	<link rel="stylesheet" type="text/css" href="<c:url value='/css/home.css'/>">
</head>
<body>
    <div class="dashboard">
        <!-- Header -->
        <div class="header">
            <div class="business-title">
                <i class="fas fa-store-alt"></i>
                <h1></h1> <!--Mokshitha Collections-->
            </div>
            <div class="date-time" id="currentDateTime">
                <i class="far fa-calendar-alt"></i>
                <span id="date"></span>
                <span>&nbsp;&nbsp;</span>
                <i class="far fa-clock ml-2"></i>
                <span id="time"></span>
            </div>
        </div>

        <!-- Main Content -->
        <div class="main-content">
            <!-- Left Panel - Product Management -->
            <div class="left-panel">
                <div class="section-header">
                    <i class="fas fa-boxes"></i>
                    <h2>Product Management <span>Add / Edit / Remove</span></h2>
                </div>

                <!-- Product Tabs -->
                <div class="product-tabs">
                    <button class="tab-btn active" onclick="switchTab('add')">
                        <i class="fas fa-plus-circle"></i> Add Product
                    </button>
                    <button class="tab-btn" onclick="switchTab('edit')">
                        <i class="fas fa-edit"></i> Edit Product
                    </button>
					<button class="tab-btn" onclick="switchTab('remove')">
                       <i class="fas fa-minus-circle"></i> Remove Product
                   </button>
                </div>

                <!-- Add Product Form -->
                <div id="addProductForm" class="product-form">
                    <div class="form-group">
                        <label><i class="fas fa-tag"></i> Product Category</label>
                        <select id="productCategory">
                            <option value="">Select Category</option>
                            <option value="Sarees">Sarees</option>
                            <option value="Dress Pieces">Dress Pieces</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-barcode"></i> Product ID</label>
                        <input type="text" id="productId" placeholder="e.g., MKS00001-R">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-box"></i> Product Name</label>
                        <input type="text" id="productName" placeholder="Product name">
                    </div>
					<div class="form-group full-width">
	                     <label><i class="fas fa-align-left"></i> Product Description</label>
	                     <textarea id="productDescription" rows="1" placeholder="Brief description..."></textarea>
	                 </div>
                    <div class="form-group">
                        <label><i class="fas fa-ruler"></i> Product Size</label>
                        <select id="productSize">
                            <option value="">Select Size</option>
                            <option value="Free Size">Free Size</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-palette"></i> Product Color</label>
                        <input type="text" id="productColor" placeholder="e.g., Red, Blue">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-rupee-sign"></i> Actual Price</label>
                        <div class="price-input">
                            <input type="number" id="actualPrice" placeholder="0">
                        </div>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-tags"></i> Selling Price</label>
                        <div class="price-input">
                            <input type="number" id="sellingPrice" placeholder="0">
                        </div>
                    </div>
					<div class="form-group">
                       <label><i class="fas fa-cubes"></i> Quantity</label>
                       <input type="number" id="quantity" placeholder="0" min="0">
                   </div>
                    <div class="form-group full-width">
                        <button class="btn-primary pulse" onclick="addProduct()">
                            <i class="fas fa-plus-circle"></i> Add Product
                        </button>
                    </div>
                </div>

                <!-- Edit Product Form (Hidden by default) -->
                <div id="editProductForm" class="product-form" style="display: none;">
                    <div class="form-group full-width">
                        <label><i class="fas fa-search"></i> Search Product</label>
                        <input type="text" id="searchProduct" placeholder="Enter Product ID or Name" onkeyup="searchProduct()">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-tag"></i> Product Category</label>
                        <select id="editCategory">
                            <option value="">Select Category</option>
                            <option value="Sarees">Sarees</option>
                            <option value="Dress Pieces">Dress Pieces</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-box"></i> Product Name</label>
                        <input type="text" id="editName" placeholder="Product name">
                    </div>
					<div class="form-group full-width">
                        <label><i class="fas fa-align-left"></i> Product Description</label>
                        <textarea id="editDescription" rows="1" placeholder="Brief description..."></textarea>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-ruler"></i> Product Size</label>
                        <select id="editSize">
                            <option value="">Select Size</option>
                            <option value="Free Size">Free Size</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-palette"></i> Product Color</label>
                        <input type="text" id="editColor" placeholder="e.g., Red, Blue">
                    </div>
                   
                    <div class="form-group">
                        <label><i class="fas fa-rupee-sign"></i> Actual Price</label>
                        <div class="price-input">
                            <input type="number" id="editActualPrice" placeholder="0">
                        </div>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-tags"></i> Selling Price</label>
                        <div class="price-input">
                            <input type="number" id="editSellingPrice" placeholder="0">
                        </div>
                    </div>

                    <div class="form-group">
                        <label><i class="fas fa-cubes"></i> Quantity</label>
                        <input type="number" id="editQuantity" placeholder="0" min="0">
                    </div>
					
                    <div class="form-group full-width">
                        <button class="btn-primary pulse" onclick="updateProduct()">
                            <i class="fas fa-save"></i> Update Product
                        </button>
                    </div>
                </div>
				
				<div id="removeProductForm"  style="display: none;">
	               <div class="remove-section">
	                   <div class="search-box">
	                       <input type="text" id="removeProductId" placeholder="Enter Product ID or Name">
	                       <button class="btn-danger pulse" onclick="removeProduct()">
	                           <i class="fas fa-trash"></i> Remove
	                       </button>
	                   </div>
	               </div>
				</div>

               
            </div>

            <!-- Right Panel - Business Operations -->
            <div class="right-panel">
                <!-- Current Business Section -->
                <div class="section-header">
                    <i class="fas fa-chart-line"></i>
                    <h2>Current Business</h2>
                </div>

                <div class="business-info">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h3><i class="fas fa-store"></i> Active Session</h3>
                        <span class="bill-number" id="currentBillNo">BILL-001</span>
                    </div>
                    
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="label">Seller</span>
							<input type="text" id="sellerName" value="Mokshitha Collections">
                        </div>
                        <div class="info-item">
                            <span class="label">Buyer</span>
							<input type="text" id="buyerName">
                        </div>
                        <div class="info-item">
                            <span class="label">Date</span>
                            <span class="value" id="businessDate">2024-01-15</span>
                        </div>
						
						<div class="info-item">
                            <span class="label">Time</span>
							<span class="value" id="businessTime">10:30 AM</span>
                        </div>
						<div class="info-item">
                            <span class="label">Payment</span>
							<select id="paymentMode">
	                            <option value="">Select Mode</option>
	                            <option value="Cash">Cash</option>
								<option value="UPI">UPI</option>
								<option value="Card">Card</option>
								<option value="Check">Check</option>
	                        </select>
                        </div>
                    </div>

                    <!-- Bill Generation -->
                    <div class="bill-section">
                        <div class="bill-header">
                            <h4><i class="fas fa-file-invoice"></i> Generate Bill</h4>
                            <!-- <span class="bill-number" id="dynamicBillNo">#001</span> -->
                        </div>
                        
                        <div class="selling-item">
                            <select id="selectProduct">
                                <option value="">Select Product</option>
                                <!-- Products will be populated here -->
                            </select>
                            <input type="number" id="productQuantity" placeholder="Qty" min="1" value="1">
                        </div>

                        <!-- Current Bill Items -->
                        <div class="table-container" style="margin-top: 15px;">
                            <table id="billTable">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Color</th>
                                        <th>Qty</th>
                                        <th>Price</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody id="billBody">
                                    <!-- Bill items will be added here -->
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="4" style="text-align: right;"><strong>Total:</strong></td>
                                        <td><strong id="billTotal">₹0</strong></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                         <div style="display: flex; justify-content: flex-end; gap: 10px; margin: 15px 0 0 0;">
                            <button class="btn-secondary" onclick="addToBill()">
                                <i class="fas fa-cart-plus"></i> Add to Bill
                            </button>
                            <button class="btn-primary" onclick="generateBill()">
                                <i class="fas fa-file-invoice"></i> Generate Bill
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Past Business Section -->
                <div class="past-business">
                    <div class="section-header">
                        <i class="fas fa-history"></i>
                        <h2>Past Business</h2>
                    </div>

                    <div class="date-filters">
                        <button class="filter-btn active" onclick="filterBusiness('week')">
                            <i class="fas fa-calendar-week"></i> Last 7 Days
                        </button>
                        <button class="filter-btn" onclick="filterBusiness('month')">
                            <i class="fas fa-calendar-alt"></i> This Month
                        </button>
                        <button class="filter-btn" onclick="filterBusiness('all')">
                            <i class="fas fa-globe"></i> All
                        </button>
                    </div>

                    <div class="range-finder">
                        <input type="date" id="startDate" placeholder="Start Date">
                        <input type="date" id="endDate" placeholder="End Date">
                        <button class="btn-secondary" onclick="applyDateRange()">
                            <i class="fas fa-search"></i> Apply
                        </button>
                    </div>

                    <!-- Past Business Table -->
                    <div class="table-container" style="margin-top: 15px;">
                        <table id="pastBusinessTable">
                            <thead>
                                <tr>
                                    <th>Bill No.</th>
                                    <th>Date</th>
                                    <th>Items</th>
                                    <th>Total</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody id="pastBusinessBody">
                                <!-- Past business data will be populated here -->
                                <tr>
                                    <td colspan="5" style="text-align: center; color: #999;">
                                        <i class="fas fa-inbox"></i> No past business records
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Export Section -->
                    <div class="export-section">
                        <button class="export-btn" onclick="exportData('excel')">
                            <i class="fas fa-file-excel"></i> Excel
                        </button>
                        <button class="export-btn" onclick="exportData('pdf')">
                            <i class="fas fa-file-pdf"></i> PDF
                        </button>
                        <button class="export-btn" onclick="exportData('print')">
                            <i class="fas fa-print"></i> Print
                        </button>
                    </div>
                </div>
            </div>
        </div>
		<div class= "main-below">
			<div class="below-panel">
				<!-- Products Table -->
	            <div style="margin-top: 25px;">
	                <h3><i class="fas fa-list"></i> Current Inventory</h3><br>
	                <div class="table-container">
	                    <table id="inventoryTable">
							<thead>
						        <tr>
						            <th>ID</th>
						            <th>Name</th>
						            <th>Category</th>
						            <th>Size</th>
						            <th>Color</th>
						            <th>Actual Price</th>
						            <th>Selling Price</th>
						            <th>Quantity</th>
						        </tr>
						    </thead>
							<tbody id="inventoryTableBody">
							</tbody>
	                    </table>
	                </div>
	            </div>
			</div>
		</div>
    </div>
	<script type="text/javascript" src="<c:url value='/js/home.js'/>"></script>
</body>
</html>