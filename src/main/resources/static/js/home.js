// Sample Data
       // let products = [
        //    { productId: 'MKS001', name: 'Silk Saree', category: 'sarees', description: 'Pure Banarasi Silk', size: 'M', color: 'Red', actualPrice: 2999, sellingPrice: 2500, quantity: 10 },
        //    { productId: 'MKS002', name: 'Cotton Kurti', category: 'kurtis', description: 'Cotton Kurti with Dupatta', size: 'L', color: 'Blue', actualPrice: 1200, sellingPrice: 800, quantity: 15 },
       // ];

        let currentBill = [];
		let products = [];
		let invoices = [];
		const PAGE_SIZE = 10;

		// ===== Generic Pager =====
		// Works on any <tbody>: caps visible rows to `visibleCount`, respects a
		// search filter that marks non-matching rows with data-filter-hidden="1".
		function createPager(config) {

		    const state = {
		        visibleCount: PAGE_SIZE,
		        lastFilteredCount: 0
		    };

		    function refresh() {

		        const tbody = document.getElementById(config.tbodyId);
		        if (!tbody) return;

		        // Find data rows (skip "No records" colspan placeholders)
		        const allRows = Array.from(tbody.querySelectorAll('tr'));
		        const dataRows = allRows.filter(r => {
		            const cells = r.querySelectorAll('td');
		            return !(cells.length === 1 && cells[0].hasAttribute('colspan'));
		        });

		        // Split by filter state
		        const filterHidden = dataRows.filter(r => r.dataset.filterHidden === '1');
		        const filtered = dataRows.filter(r => r.dataset.filterHidden !== '1');
		        state.lastFilteredCount = filtered.length;

		        // First N filtered rows visible, rest hidden
		        filtered.forEach((row, idx) => {
		            row.style.display = (idx < state.visibleCount) ? '' : 'none';
		        });
		        filterHidden.forEach(row => { row.style.display = 'none'; });

		        updateControls();

		        // Let callers react to visibility changes (e.g. lazily render
		        // barcodes only for rows that just became visible).
		        if (typeof config.onRefresh === 'function') config.onRefresh();
		    }

		    function updateControls() {

		        const info     = document.getElementById(config.infoId);
		        const moreBtn  = document.getElementById(config.moreBtnId);
		        const lessBtn  = document.getElementById(config.lessBtnId);
		        const wrapper  = document.getElementById(config.wrapperId);
		        const total    = state.lastFilteredCount;
		        const shown    = Math.min(state.visibleCount, total);

		        if (wrapper) {
		            wrapper.style.display = (total === 0) ? 'none' : 'flex';
		        }
		        if (info) {
		            info.innerHTML = total === 0
		                ? ''
		                : `Showing <strong>${shown}</strong> of <strong>${total}</strong>`;
		        }
		        if (moreBtn) moreBtn.classList.toggle('hidden', shown >= total);
		        if (lessBtn) lessBtn.classList.toggle('hidden', state.visibleCount <= PAGE_SIZE);
		    }

		    return {
		        refresh,
		        more() {
		            state.visibleCount += PAGE_SIZE;
		            refresh();
		        },
		        less() {
		            state.visibleCount = PAGE_SIZE;
		            refresh();
		            const tbody = document.getElementById(config.tbodyId);
		            const container = tbody && tbody.closest('.table-container');
		            if (container) container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		        },
		        reset() {
		            state.visibleCount = PAGE_SIZE;
		            refresh();
		        }
		    };
		}

		const inventoryPager = createPager({
		    tbodyId: 'inventoryTableBody',
		    wrapperId: 'inventoryPagination',
		    infoId: 'inventoryInfo',
		    moreBtnId: 'invViewMoreBtn',
		    lessBtnId: 'invShowLessBtn',
		    onRefresh: () => renderVisibleInventoryBarcodes()
		});

		const pastBusinessPager = createPager({
		    tbodyId: 'pastBusinessBody',
		    wrapperId: 'pastBusinessPagination',
		    infoId: 'pastBusinessInfo',
		    moreBtnId: 'pastViewMoreBtn',
		    lessBtnId: 'pastShowLessBtn'
		});

        // Initialize the page
        document.addEventListener('DOMContentLoaded', function() {
			fetchProducts();
            updateDateTime();
            setInterval(updateDateTime, 1000);
			
			const activeBtn = document.querySelector('.filter-btn.active');

		    if (activeBtn) {
		        activeBtn.click();
		    } else {
		        // No default filter → still load the past-business table, and don't
		        // make the splash wait on an invoice fetch that won't happen.
		        if (typeof fetchInvoices === 'function') fetchInvoices();
		        else loaderStageReady('invoices');
		    }
        });
		
		// ===== BRANDED LOADING SPLASH CONTROL =====
		// The splash stays up until BOTH the inventory table (products) AND the
		// past-business table (invoices) have finished rendering.
		const LOADER_START = (window.performance && performance.now) ? performance.now() : Date.now();
		const LOADER_MIN_MS = 900;   // keep the splash up at least this long so it's seen
		let loaderHidden = false;
		let _loaderProductsReady = false;
		let _loaderInvoicesReady = false;

		function hideAppLoader() {
		    if (loaderHidden) return;
		    loaderHidden = true;
		    const el = document.getElementById('appLoader');
		    if (!el) return;
		    const now = (window.performance && performance.now) ? performance.now() : Date.now();
		    const wait = Math.max(0, LOADER_MIN_MS - (now - LOADER_START));
		    setTimeout(() => {
		        el.classList.add('hidden');
		        setTimeout(() => { if (el && el.parentNode) el.parentNode.removeChild(el); }, 700);
		    }, wait);
		}

		// Mark a data stage complete; hide only once both stages are done.
		function loaderStageReady(which) {
		    if (which === 'products') _loaderProductsReady = true;
		    if (which === 'invoices') _loaderInvoicesReady = true;
		    if (_loaderProductsReady && _loaderInvoicesReady) hideAppLoader();
		}

		// Safety net: never let the splash get stuck if a fetch hangs/fails.
		setTimeout(hideAppLoader, 8000);

		function fetchProducts() {
		    fetch('/api/products')
		        .then(response => response.json())
		        .then(data => {
		            products = data;
		            loadInventoryTable();
		            loadProductSelect();
		        })
		        .catch(err => console.error('Load products failed:', err))
		        .finally(() => loaderStageReady('products'));
		}

        // Date and Time Update
        function updateDateTime() {
            const now = new Date();
            document.getElementById('date').textContent = now.toLocaleDateString('en-IN', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            document.getElementById('time').textContent = now.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            document.getElementById('businessDate').textContent = now.toLocaleDateString('en-IN');
            document.getElementById('businessTime').textContent = now.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }

		// Switch between tabs
        function switchTab(tab) {
            const addForm    = document.getElementById('addProductForm');
            const editForm   = document.getElementById('editProductForm');
            const removeForm = document.getElementById('removeProductForm');
            const returnForm = document.getElementById('returnExchangeForm');
            const tabs       = document.querySelectorAll('.tab-btn');
 
            // Reset all forms and tabs
            addForm.style.display    = 'none';
            editForm.style.display   = 'none';
            removeForm.style.display = 'none';
            if (returnForm) returnForm.style.display = 'none';
            tabs.forEach(t => t.classList.remove('active'));
 
            // Activate the chosen one
            if (tab === 'add') {
                addForm.style.display = 'grid';
                if (tabs[0]) tabs[0].classList.add('active');
            } else if (tab === 'edit') {
                editForm.style.display = 'grid';
                if (tabs[1]) tabs[1].classList.add('active');
            } else if (tab === 'remove') {
                removeForm.style.display = 'grid';
                if (tabs[2]) tabs[2].classList.add('active');
            } else if (tab === 'return') {
                if (returnForm) returnForm.style.display = 'flex';
                if (tabs[3]) tabs[3].classList.add('active');
                // Focus the bill input so the cashier can scan immediately
                setTimeout(() => {
                    const el = document.getElementById('returnBillNo');
                    if (el) el.focus();
                }, 60);
            }
        }

		// ===== BARCODE / PRODUCT-ID GENERATION =====
		const CATEGORY_PREFIX = {
		    "Sarees": "MC",
		    "Dress Pieces": "MS"
		};

		const CATEGORY_COMPANY = {
		    "Sarees": "Mokshitha Collections",
		    "Dress Pieces": "Moksha's Studio"
		};

		function companyNameFor(category) {
		    return CATEGORY_COMPANY[category] || "Mokshitha";
		}

		function generateProductId() {

		    const category = document.getElementById('productCategory').value;

		    if (!category || !CATEGORY_PREFIX[category]) {
		        showNotification("Please select a Category first", 'error');
		        return;
		    }

		    const prefix = CATEGORY_PREFIX[category];
		    const now = new Date();
		    const pad = n => String(n).padStart(2, '0');
		    const stamp =
		        pad(now.getDate()) +
		        pad(now.getMonth() + 1) +
		        String(now.getFullYear()).slice(-2) +
		        pad(now.getHours()) +
		        pad(now.getMinutes()) +
		        pad(now.getSeconds());

		    const id = prefix + stamp;
		    document.getElementById('productId').value = id;

		    updateBarcodePreview();
		}

		function updateBarcodePreview() {

		    const id = document.getElementById('productId').value.trim();
		    const name = document.getElementById('productName').value.trim();
		    const color = document.getElementById('productColor').value.trim();
		    const category = document.getElementById('productCategory').value;
		    const actual = document.getElementById('actualPrice').value || '0';
		    const selling = document.getElementById('sellingPrice').value || '0';
		    const wrap = document.getElementById('barcodePreviewWrap');

		    if (!id) {
		        wrap.style.display = 'none';
		        return;
		    }

		    wrap.style.display = 'block';

		    try {
		        JsBarcode("#barcodeSvg", id, {
		            format: "CODE128",
		            width: 1.6,
		            height: 40,
		            fontSize: 11,
		            displayValue: true,
		            margin: 2
		        });
		    } catch (e) {
		        console.error("Barcode render failed:", e);
		    }

		    document.getElementById('companyName').textContent = companyNameFor(category);
		    document.getElementById('barcodeLabelName').textContent =
		        (name || '') + (color ? ' - ' + color : '');
		    document.getElementById('barcodeActualPrice').textContent = actual;
		    document.getElementById('barcodeSellingPrice').textContent = selling;
		}

		// Wrapper for the preview's Print button
		function printBarcodeFromForm() {
		    const id = document.getElementById('productId').value.trim();
		    const name = document.getElementById('productName').value.trim();
		    const color = document.getElementById('productColor').value.trim();
		    const category = document.getElementById('productCategory').value;
		    const actual = parseFloat(document.getElementById('actualPrice').value) || 0;
		    const selling = parseFloat(document.getElementById('sellingPrice').value) || 0;
		    printBarcodeLabel(id, name, { color, category, actualPrice: actual, sellingPrice: selling });
		}

		// Print barcode stickers on A4-24 sheet (3 cols x 8 rows = 24 max).
		// User picks: starting row (1-8), starting column (1-3), and count (1-24).
		// Sticker spec: 63.5mm x 33.9mm on a 210x297mm A4 sheet (Avery L7159 / A4-24).
		// Top margin 13.55mm, side margin 7.21mm, horizontal gap 2.54mm, vertical gap 0.
		function printBarcodeLabel(id, name, extras) {

		    if (!id) {
		        showNotification("No Product ID to print", 'error');
		        return;
		    }

		    extras = extras || {};

		    if (!extras.category || extras.actualPrice == null) {
		        const p = products.find(x => x.productId === id);
		        if (p) {
		            if (!extras.color) extras.color = p.color;
		            if (!extras.category) extras.category = p.category;
		            if (extras.actualPrice == null) extras.actualPrice = p.actualPrice;
		            if (extras.sellingPrice == null) extras.sellingPrice = p.sellingPrice;
		            if (!name) name = p.name;
		        }
		    }

		    const company  = companyNameFor(extras.category);
		    const color    = (extras.color || '').trim();
		    const actual   = Number(extras.actualPrice || 0);
		    const selling  = Number(extras.sellingPrice || 0);
		    const safeName = (name || '').trim();

		    const esc = s => String(s == null ? '' : s)
		        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

		    const stickerHtml = `
		        <div class="sticker">
		            <div class="barcode-wrap"><svg class="bc"></svg></div>
		            <div class="pname">${esc(safeName)}${color ? ' \u2014 ' + esc(color) : ''}</div>
		            <div class="prices">
		                <div class="mrp"> ACTUAL PRICE: \u20B9${actual}</div>
		                <div class="sp"><span class="tag">Selling Price: </span> \u20B9${selling}</div>
		            </div>
		        </div>
		    `;
		    const cellsHtml = Array.from({ length: 24 }, (_, i) => {
		        const row = Math.floor(i / 3) + 1;
		        const col = (i % 3) + 1;
		        return `<div class="cell" data-idx="${i}" data-pos="R${row}C${col}">${stickerHtml}</div>`;
		    }).join('');

		    const win = window.open('', '_blank', 'width=900,height=1050');
		    const html = `<!doctype html><html><head>
		<meta charset="utf-8">
		<title>Barcode Sheet - ${esc(id)}</title>
		<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
		<style>
		    @page { size: A4; margin: 0; }
		    * { box-sizing: border-box; }
		    html, body { margin: 0; padding: 0; }
		    body {
		        font-family: 'Georgia', 'Times New Roman', serif;
		        -webkit-print-color-adjust: exact;
		        print-color-adjust: exact;
		    }

		    .sheet {
		        width: 210mm; height: 297mm;
		        padding: 13.55mm 7.21mm 0;
		        display: grid;
		        grid-template-columns: repeat(3, 63.5mm);
		        grid-template-rows: repeat(8, 33.9mm);
		        column-gap: 2.54mm; row-gap: 0;
		        page-break-after: always;
		        position: relative;
		    }

		    .cell {
		        width: 63.5mm; height: 33.9mm;
		        position: relative;
		    }

		    /* Empty (skipped) cells: hide content, keep slot */
		    .cell.empty .sticker { visibility: hidden; }

		    .sticker {
		        width: 100%; height: 100%;
		        padding: 3mm 2mm;
		        display: flex; flex-direction: column;
		        justify-content: space-between; text-align: center;
		        overflow: hidden;
		    }

		    .barcode-wrap { margin: 0; line-height: 0; }
		    .barcode-wrap svg { display: block; margin: 0 auto; max-width: 100%; height: auto; }
		    .pname {
		        font-family: 'Helvetica', 'Arial', sans-serif;
		        font-size: 8pt; font-weight: 600; color: #222;
		        line-height: 1.1; letter-spacing: 0.1pt;
		        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
		    }
		    .prices {
		        display: flex; flex-direction: column; align-items: center;
		        gap: 1mm;
		        font-family: 'Helvetica', 'Arial', sans-serif;
		        line-height: 1.05;
		    }
		    .prices .mrp {
		        font-size: 8pt;
		        color: #555;
		        font-weight: 500;
		    }
		    .prices .sp {
		        font-size: 10pt;
		        color: #000;
		        font-weight: 500;
		        letter-spacing: 0.2pt;
		    }
		    .prices .sp .tag {
		        font-size: 8pt; font-weight: 600; color: #444;
		        letter-spacing: 0.3pt; margin-right: 0.6mm;
		        text-transform: uppercase;
		    }

		    /* ===== ON-SCREEN PICKER (print-hidden) ===== */
		    @media screen {
		        body { background: #e8eaed; padding: 20px; }
		        .sheet { background: white; margin: 150px auto 20px; box-shadow: 0 4px 14px rgba(0,0,0,0.15); }
		        .cell { outline: 0.5px dashed #cfd6dd; outline-offset: -0.5px; }
		        .cell.empty { background: repeating-linear-gradient(45deg, #fafafa, #fafafa 4px, #f0f0f0 4px, #f0f0f0 8px); }

		        /* Show position label inside each empty cell on screen */
		        .cell.empty::before {
		            content: attr(data-pos);
		            position: absolute;
		            top: 50%; left: 50%; transform: translate(-50%, -50%);
		            font-family: 'Inter', sans-serif;
		            font-size: 9pt; font-weight: 700;
		            color: #b0b6bb; letter-spacing: 0.5px;
		        }

		        /* Floating picker bar (fixed at top of window) */
		        .picker {
		            position: fixed; top: 0; left: 0; right: 0;
		            background: linear-gradient(to right, #20B2AA, #2ac2ba);
		            color: white; padding: 12px 20px;
		            box-shadow: 0 4px 14px rgba(0,0,0,0.18);
		            font-family: 'Inter', 'Helvetica', sans-serif;
		            z-index: 100;
		        }
		        .picker-row {
		            display: flex; align-items: center; justify-content: center;
		            gap: 14px; flex-wrap: wrap;
		        }
		        .picker-row + .picker-row { margin-top: 8px; }
		        .picker .group {
		            display: flex; align-items: center; gap: 8px;
		        }
		        .picker .group label {
		            font-size: 12px; font-weight: 500;
		            text-transform: uppercase; letter-spacing: 1px;
		            opacity: 0.9;
		        }
		        .picker input[type="number"] {
		            width: 60px; padding: 6px 8px;
		            border: none; border-radius: 6px;
		            font-family: 'Courier New', monospace; font-size: 15px;
		            font-weight: 700; text-align: center; color: #0a3d32;
		        }
		        .picker .quick {
		            display: flex; gap: 4px;
		        }
		        .picker .quick button {
		            background: rgba(255,255,255,0.2);
		            color: white; border: 1px solid rgba(255,255,255,0.4);
		            border-radius: 6px; padding: 5px 10px;
		            font-size: 12px; font-weight: 600; cursor: pointer;
		            transition: background 0.15s ease;
		        }
		        .picker .quick button:hover { background: rgba(255,255,255,0.35); }
		        .picker .print-btn {
		            background: white; color: #0a3d32;
		            border: none; border-radius: 6px;
		            padding: 8px 22px; font-size: 14px; font-weight: 700;
		            cursor: pointer; transition: transform 0.15s ease;
		        }
		        .picker .print-btn:hover { transform: translateY(-1px); }
		        .picker .summary {
		            font-size: 13px; font-weight: 500;
		            background: rgba(0,0,0,0.15);
		            padding: 6px 12px; border-radius: 6px;
		        }
		        .picker .summary.warn {
		            background: rgba(255, 200, 50, 0.35);
		        }
		    }
		    @media print {
		        .picker { display: none !important; }
		        .cell { outline: none; }
		        .cell.empty { background: none; }
		        .cell.empty::before { display: none; }
		    }
		</style></head>
		<body>
		    <div class="picker">
		        <div class="picker-row">
		            <div class="group">
		                <label>Start Row</label>
		                <input type="number" id="startRow" min="1" max="8" value="1">
		            </div>
		            <div class="group">
		                <label>Start Col</label>
		                <input type="number" id="startCol" min="1" max="3" value="1">
		            </div>
		            <div class="group">
		                <label>Count</label>
		                <input type="number" id="count" min="1" max="24" value="24">
		            </div>
		            <div class="quick">
		                <button data-preset="topleft-full">Top-left, full sheet</button>
		                <button data-preset="topleft-1">Top-left, 1 sticker</button>
		            </div>
		        </div>
		        <div class="picker-row">
		            <span class="summary" id="summary"></span>
		            <button class="print-btn" id="printBtn">\uD83D\uDDA8 Print</button>
		        </div>
		    </div>

		    <div class="sheet">${cellsHtml}</div>

		    <script>
		        const PRODUCT_ID = ${JSON.stringify(id)};

		        // Render all 24 SVG barcodes once
		        document.querySelectorAll('.bc').forEach(function (svg) {
		            JsBarcode(svg, PRODUCT_ID, {
		                format: "CODE128", width: 1, height: 25, fontSize: 7,
		                displayValue: true, margin: 0, textMargin: 1
		            });
		        });

		        const rowInput = document.getElementById('startRow');
		        const colInput = document.getElementById('startCol');
		        const cntInput = document.getElementById('count');
		        const summary  = document.getElementById('summary');
		        const cells    = document.querySelectorAll('.cell');
		        const printBtn = document.getElementById('printBtn');

		        function clamp(v, lo, hi) {
		            v = parseInt(v, 10);
		            if (isNaN(v) || v < lo) return lo;
		            if (v > hi) return hi;
		            return v;
		        }

		        function applyLayout() {
		            const row = clamp(rowInput.value, 1, 8);
		            const col = clamp(colInput.value, 1, 3);
		            const requested = clamp(cntInput.value, 1, 24);

		            // Persist clamped values back into inputs (so the user sees what we used)
		            rowInput.value = row;
		            colInput.value = col;

		            // Compute starting cell index (0-based) and the maximum count that fits
		            const startIdx = (row - 1) * 3 + (col - 1);
		            const maxFit   = 24 - startIdx;
		            const count    = Math.min(requested, maxFit);

		            cntInput.value = count;

		            // Mark cells empty/filled
		            cells.forEach(function (cell, i) {
		                const filled = (i >= startIdx && i < startIdx + count);
		                cell.classList.toggle('empty', !filled);
		            });

		            // Build summary text
		            const startLabel = 'R' + row + 'C' + col + ' (#' + (startIdx + 1) + ')';
		            const endIdx = startIdx + count - 1;
		            const endRow = Math.floor(endIdx / 3) + 1;
		            const endCol = (endIdx % 3) + 1;
		            const endLabel = 'R' + endRow + 'C' + endCol + ' (#' + (endIdx + 1) + ')';

		            let msg;
		            if (count === 1) {
		                msg = 'Printing 1 sticker at ' + startLabel;
		            } else {
		                msg = 'Printing ' + count + ' stickers, ' + startLabel + ' \u2192 ' + endLabel;
		            }

		            // Warn if requested count was reduced
		            if (requested > maxFit) {
		                msg += '  \u2014  reduced from ' + requested + ' (only ' + maxFit + ' fit from this position)';
		                summary.classList.add('warn');
		            } else {
		                summary.classList.remove('warn');
		            }
		            summary.textContent = msg;
		        }

		        // Wire inputs
		        [rowInput, colInput, cntInput].forEach(function (el) {
		            el.addEventListener('input', applyLayout);
		        });

		        // Quick presets
		        document.querySelectorAll('.quick button').forEach(function (b) {
		            b.addEventListener('click', function () {
		                if (b.dataset.preset === 'topleft-full') {
		                    rowInput.value = 1; colInput.value = 1; cntInput.value = 24;
		                } else if (b.dataset.preset === 'topleft-1') {
		                    rowInput.value = 1; colInput.value = 1; cntInput.value = 1;
		                }
		                applyLayout();
		            });
		        });

		        printBtn.addEventListener('click', function () {
		            applyLayout();
		            setTimeout(function () { window.print(); }, 100);
		        });

		        applyLayout(); // initial state
		        cntInput.focus(); cntInput.select();
		    <\/script>
		</body></html>`;

		    win.document.write(html);
		    win.document.close();
		}

		function addProduct() {

		    const productId = document.getElementById('productId').value.trim().toUpperCase();
		    const name = document.getElementById('productName').value.trim();
		    const category = document.getElementById('productCategory').value;
		    const description = document.getElementById('productDescription').value.trim();
		    const size = document.getElementById('productSize').value;
		    const color = document.getElementById('productColor').value.trim();
		    const actualPrice = parseFloat(document.getElementById('actualPrice').value);
		    const sellingPrice = parseFloat(document.getElementById('sellingPrice').value);
		    const quantity = parseInt(document.getElementById('quantity').value);

		    //  Frontend validation
		    if (!category || category === 'Select Category') return showNotification("Select Category", 'error');
		    if (!productId) return showNotification("Click Generate to create Product ID", 'error');
		    if (!name) return showNotification("Enter Product Name", 'error');
		    if (!size) return showNotification("Select Size", 'error');
		    if (!color) return showNotification("Enter Color", 'error');
		    if (!actualPrice || actualPrice <= 0) return showNotification("Enter valid Actual Price", 'error');
		    if (!sellingPrice || sellingPrice <= 0) return showNotification("Enter valid Selling Price", 'error');
		    if (sellingPrice > actualPrice) return showNotification("Selling price cannot exceed actual price", 'error');
		    if (!quantity || quantity < 0) return showNotification("Enter valid Quantity", 'error');

		    const newProduct = {
		        productId,
		        name,
		        category,
		        description,
		        size,
		        color,
		        actualPrice,
		        sellingPrice,
		        quantity
		    };

		    fetch('/api/products', {
		        method: 'POST',
		        headers: {
		            'Content-Type': 'application/json'
		        },
		        body: JSON.stringify(newProduct)
		    })
		    .then(async response => {
		        if (!response.ok) {
		            const errorMessage = await response.text();
		            throw new Error(errorMessage);
		        }
		        return response.json();
		    })
		    .then(data => {
		        fetchProducts();   
		        clearAddForm();
		        showNotification('Product added successfully!', 'success');
		    })
		    .catch(error => {
		        showNotification(error.message, 'error');
		    });
		}

		// 🔥 Load Inventory Table
		function loadInventoryTable() {

		    const tableBody = document.getElementById("inventoryTableBody");

		    // Build the whole table markup in ONE string, then assign once.
		    // (Appending with `innerHTML +=` per row re-parses the table each time
		    //  → O(n²); with 700+ products that is very slow.)
		    const rows = products.map(product => {
		        const safeName = (product.name || '').replace(/'/g, "\\'");
		        return `
		            <tr>
		                <td>${product.productId}</td>
		                <td>${product.name}</td>
		                <td>${product.category}</td>
		                <td>${product.size}</td>
		                <td>${product.color}</td>
		                <td>${product.actualPrice}</td>
		                <td>${product.sellingPrice}</td>
		                <td>${product.quantity}</td>
		                <td class="barcode-cell">
		                    <svg class="inv-barcode" data-code="${product.productId}"></svg>
		                    <i class="fa-solid fa-print action-icon print-icon"
		                       title="Print Barcode"
		                       onclick="printBarcodeLabel('${product.productId}', '${safeName}')"></i>
		                </td>
		            </tr>
		        `;
		    });
		    tableBody.innerHTML = rows.join('');

		    // Re-apply current search filter (also refreshes the pager, which in turn
		    // lazily renders barcodes for the visible rows via onRefresh).
		    filterInventoryTable();
		}

		// Render barcodes ONLY for rows that are currently visible and not yet drawn.
		// Called by the inventory pager's onRefresh, so we never render all 700+
		// barcodes up front — only the ~page-worth actually on screen.
		function renderVisibleInventoryBarcodes() {
		    document.querySelectorAll('#inventoryTableBody tr').forEach(row => {
		        if (row.style.display === 'none') return;
		        const svg = row.querySelector('.inv-barcode');
		        if (!svg || svg.dataset.rendered === '1') return;
		        const code = svg.getAttribute('data-code');
		        try {
		            JsBarcode(svg, code, {
		                format: "CODE128",
		                width: 1.3,
		                height: 30,
		                fontSize: 10,
		                displayValue: true,
		                margin: 2
		            });
		            svg.dataset.rendered = '1';
		        } catch (e) {
		            console.error("Inventory barcode render failed for", code, e);
		        }
		    });
		}

		// Search / filter the inventory table client-side.
		// Marks non-matching rows with data-filter-hidden="1"; pager decides which
		// of the matching rows to actually show (first N).
		function filterInventoryTable() {

		    const input = document.getElementById('inventorySearch');
		    if (!input) return;
		    const q = input.value.trim().toLowerCase();

		    document.querySelectorAll('#inventoryTableBody tr').forEach(row => {
		        const text = row.innerText.toLowerCase();
		        const match = !q || text.includes(q);
		        row.dataset.filterHidden = match ? '0' : '1';
		    });

		    // Changing the filter resets pagination to the first page
		    inventoryPager.reset();
		}

		
		function loadProductSelect() {
			const select = document.getElementById('selectProduct');
            select.innerHTML = '<option value="">Select Product</option>';
            
            products.forEach(product => {
                if (product.quantity > 0) {
                    const option = document.createElement('option');
                    option.value = product.productId;
                    option.textContent = `${product.productId} - ${product.name} - - ${product.color} - ₹${product.sellingPrice} (${product.quantity} available)`;
                    select.appendChild(option);
                }
            });
		}
		
		
        // Search Product for Edit (also triggered by barcode scanners on Enter)
        function searchProduct(event) {
            const searchTerm = document.getElementById('searchProduct').value.trim().toLowerCase();
            if (!searchTerm) return;

            // Prefer exact Product ID match (scanner case)
            let product = products.find(p => p.productId.toLowerCase() === searchTerm);

            // Otherwise fall back to partial match (manual typing case)
            if (!product) {
                product = products.find(p =>
                    p.productId.toLowerCase().includes(searchTerm) ||
                    (p.name || '').toLowerCase().includes(searchTerm)
                );
            }

            if (product) {
                document.getElementById('editCategory').value = product.category || '';
                document.getElementById('editName').value = product.name;
                document.getElementById('editDescription').value = product.description || '';
                document.getElementById('editSize').value = product.size || '';
                document.getElementById('editColor').value = product.color || '';
                document.getElementById('editActualPrice').value = product.actualPrice;
                document.getElementById('editSellingPrice').value = product.sellingPrice;
                document.getElementById('editQuantity').value = product.quantity;
            } else if (event && event.key === 'Enter') {
                showNotification('Product not found', 'error');
            }
        }

		function updateProduct() {

		    const searchTerm = document.getElementById('searchProduct').value.trim().toLowerCase();

		    if (!searchTerm) {
		        return showNotification("Select Product to Update", "error");
		    }

		    // Prefer exact ID match (scanner case), then partial match (manual typing)
		    let product = products.find(p => p.productId.toLowerCase() === searchTerm);
		    if (!product) {
		        product = products.find(p =>
		            p.productId.toLowerCase().includes(searchTerm) ||
		            (p.name || '').toLowerCase().includes(searchTerm)
		        );
		    }

		    if (!product) {
		        return showNotification("Product not found", "error");
		    }

		    const productId = product.productId;

		    const updatedProduct = {
		        productId: productId,
		        category: document.getElementById('editCategory').value,
		        name: document.getElementById('editName').value,
		        description: document.getElementById('editDescription').value,
		        size: document.getElementById('editSize').value,
		        color: document.getElementById('editColor').value,
		        actualPrice: parseFloat(document.getElementById('editActualPrice').value),
		        sellingPrice: parseFloat(document.getElementById('editSellingPrice').value), // ✅ fixed
		        quantity: parseInt(document.getElementById('editQuantity').value)
		    };

		    fetch(`/api/products/${productId}`, {
		        method: 'PUT',
		        headers: {
		            'Content-Type': 'application/json'
		        },
		        body: JSON.stringify(updatedProduct)
		    })
		    .then(async response => {
		        if (!response.ok) {
		            const errorMessage = await response.text();
		            throw new Error(errorMessage);
		        }
		        return response.json();
		    })
		    .then(data => {
		        fetchProducts();   // reload from DB
				clearEditForm();
		        showNotification('Product updated successfully!', 'success');
		    })
		    .catch(error => {
		        showNotification(error.message, 'error');
		    });
		}



		function removeProduct() {

		    const input = document.getElementById('removeProductId').value.trim();

		    if (!input) {
		        return showNotification("Enter Product ID or Name", "error");
		    }

		    // Resolve to a real productId: exact ID match first, then exact name, then partial
		    const q = input.toLowerCase();
		    let product = products.find(p => p.productId.toLowerCase() === q);
		    if (!product) product = products.find(p => (p.name || '').toLowerCase() === q);
		    if (!product) {
		        const matches = products.filter(p =>
		            p.productId.toLowerCase().includes(q) ||
		            (p.name || '').toLowerCase().includes(q)
		        );
		        if (matches.length === 1) product = matches[0];
		        else if (matches.length > 1) {
		            return showNotification("Multiple matches \u2014 pick one from the list", "error");
		        }
		    }

		    if (!product) return showNotification("Product not found", "error");

		    if (!confirm(`Remove "${product.name}" (${product.productId}) ?`)) return;

		    fetch(`/api/products/${product.productId}`, {
		        method: 'DELETE'
		    })
		    .then(async response => {
		        if (!response.ok) {
		            const errorMessage = await response.text();
		            throw new Error(errorMessage);
		        }
		        return response.text();
		    })
		    .then(message => {
		        fetchProducts();
		        document.getElementById('removeProductId').value = '';
		        const list = document.getElementById('removeMatchList');
		        if (list) list.innerHTML = '';
		        showNotification(message, 'success');
		    })
		    .catch(error => {
		        showNotification(error.message, 'error');
		    });
		}

		// Live list of matches under the Remove input (fallback when scanner is unavailable)
		function filterRemoveMatches(event) {
		    const input = document.getElementById('removeProductId');
		    const list = document.getElementById('removeMatchList');
		    if (!input || !list) return;

		    const q = input.value.trim().toLowerCase();

		    // Pressing Enter with an exact match triggers delete directly (scanner flow)
		    if (event && event.key === 'Enter') {
		        const exact = products.find(p => p.productId.toLowerCase() === q);
		        if (exact) { removeProduct(); return; }
		    }

		    if (!q) { list.innerHTML = ''; return; }

		    const matches = products.filter(p =>
		        p.productId.toLowerCase().includes(q) ||
		        (p.name || '').toLowerCase().includes(q)
		    ).slice(0, 8);

		    if (matches.length === 0) {
		        list.innerHTML = '<div class="match-empty">No products match</div>';
		        return;
		    }

		    list.innerHTML = matches.map(p =>
		        `<div class="match-item" onclick="document.getElementById('removeProductId').value='${p.productId}'; document.getElementById('removeMatchList').innerHTML='';">
		            <strong>${p.productId}</strong> \u2014 ${p.name} <span class="muted">(${p.color}, qty ${p.quantity})</span>
		        </div>`
		    ).join('');
		}
		
		const billingOn = document.getElementById("billingOn");
	    const discount = document.getElementById("discount");
	    const appliedOn = document.getElementById("appliedOn");

	    billingOn.addEventListener("change", function () {
	        if (this.value === "Offer") {
	            discount.disabled = false;
	            appliedOn.disabled = false;
	        } else {
	            discount.disabled = true;
	            appliedOn.disabled = true;

	            // Optional: Reset values when disabled
	            discount.value = "";
	            appliedOn.value = "";
	        }
	    });

        // Add to Bill
        function addToBill() {
            const productId = document.getElementById('selectProduct').value;
            const quantity = parseInt(document.getElementById('productQuantity').value);
			
			const billingOn = document.getElementById("billingOn").value;
		    const discountPercent = parseFloat(document.getElementById("discount").value);
		    const appliedOn = document.getElementById("appliedOn").value;
            
            if (!productId) {
                showNotification('Please Select a Product..!', 'error');
                return;
            }
			
			if(!billingOn){
				showNotification('Please Select Billing On..!', 'error');
				return;
			}
            
            const product = products.find(p => p.productId === productId);
            
            if (product.quantity < quantity) {
                showNotification('Insufficient quantity!', 'error');
                return;
            }
            
			let finalPrice = product.sellingPrice; // default
			
			if (billingOn === "Offer") {

		        if (!discountPercent || !appliedOn) {
		            showNotification("Please select discount and applied price type", 'error');
		            return;
		        }

		        let basePrice = 0;

		        if (appliedOn === "Actual Price") {
		            basePrice = product.actualPrice;   // Make sure this exists
		        } else {
		            basePrice = product.sellingPrice;
		        }

		        // Apply discount
		        finalPrice = basePrice - (basePrice * discountPercent / 100);
		    }
			
            const existingItem = currentBill.find(item => item.id === productId);
            
            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                currentBill.push({
					billingType: billingOn,
                    id: product.productId,
                    name: product.name,
                    color: product.color,
					applied: billingOn === "Offer" ? appliedOn : "Selling Price",
					discount: billingOn === "Offer" ? discountPercent : '0',
                    price: finalPrice,
                    quantity: quantity
                });
            }
            
            // Reduce from inventory
            product.quantity -= quantity;
            
            updateBillDisplay();
            loadInventoryTable();
            loadProductSelect();
        }

        // Update Bill Display
        function updateBillDisplay() {
            const tbody = document.getElementById('billBody');
            tbody.innerHTML = '';
            let total = 0;
            
            currentBill.forEach(item => {
                const row = tbody.insertRow();
                const itemTotal = item.price * item.quantity;
                total += itemTotal;
                
                row.innerHTML = `
					<td>${item.billingType}</td>
                    <td>${item.name}</td>
                    <td>${item.color}</td>
					<td>${item.discount}%</td>
					<td>${item.applied}</td>
                    <td>₹${item.price}</td>
					<td>${item.quantity}</td>
					<td>₹${itemTotal}</td>
					<td>
						<i class="fa-solid fa-trash action-icon delete-icon"
						       onclick="removeFromBill('${item.id}')"
						       title="Delete Invoice"></i>
					</td>
                `;
            });
            
            document.getElementById('billTotal').textContent = `₹${total}`;
        }
		
		function removeFromBill(productId) {

		    const itemIndex = currentBill.findIndex(item => item.id === productId);

		    if (itemIndex === -1) return;

		    const item = currentBill[itemIndex];

		    // Restore quantity back to inventory
		    const product = products.find(p => p.productId === productId);
		    if (product) {
		        product.quantity += item.quantity;
		    }

		    // Remove item from bill
		    currentBill.splice(itemIndex, 1);

		    updateBillDisplay();
		    loadInventoryTable();
		    loadProductSelect();
		}


		function generateBill() {

		    if (currentBill.length === 0) {
		        showNotification('No items in bill', 'error');
		        return;
		    }

		    const sellerName = document.getElementById("sellerName").value;
		    const buyerName = document.getElementById("buyerName").value;
		    const buyerMobile = document.getElementById("buyerMobile").value;
		    const paymentMode = document.getElementById("paymentMode").value;

		    if (!sellerName) return showNotification('Please Select a Seller..!', 'error');
		    if (!buyerName) return showNotification('Please Enter Buyer Name..!', 'error');
		    if (buyerMobile.length !== 10) return showNotification('Enter Valid Mobile..!', 'error');
		    if (!paymentMode) return showNotification('Select Payment Mode..!', 'error');

		    // 🔥 Send only RAW data to backend
		    fetch("/api/invoice/save", {
		        method: "POST",
		        headers: {
		            "Content-Type": "application/json"
		        },
		        body: JSON.stringify({
		            sellerName: sellerName,
		            buyerName: buyerName,
		            buyerMobile: buyerMobile,
		            paymentMode: paymentMode,
		            items: currentBill.map(item => ({
		                productId: item.id,
		                description: item.name,
		                billOn: item.billingType,
		                color: item.color,
		                discount: item.discount + "%",
		                appliedOn: item.applied,
		                price: item.price,
		                quantity: item.quantity
		            }))
		        })
		    })
		    .then(async response => {
		        const data = await response.json().catch(() => ({}));
		        if (!response.ok) {
		            throw new Error(data.error || "Server error");
		        }
		        return data;
		    })
		    .then(data => {

		        // 🔥 Backend returns generated bill number
		        const billNo = data.billNo;

		        // Open invoice using bill number
		        window.open("/invoice/" + billNo, "_blank");
				
				fetchInvoices();
		        // Clear bill
		        currentBill = [];
				updateBillDisplay();
		    })
		    .catch(error => {
		        console.error("Error:", error);
		        showNotification(error.message || "Failed to save invoice", "error");
		    });
		}
		
		function fetchInvoices() {

		    fetch("/api/invoice/all")
		        .then(response => {
		            console.log("Status:", response.status);
		            return response.json();
		        })
		        .then(invoices => {

		            const tbody = document.getElementById('pastBusinessBody');
		            tbody.innerHTML = '';

		            if (!Array.isArray(invoices) || invoices.length === 0) {

		                tbody.innerHTML = `
		                    <tr>
		                        <td colspan="9" style="text-align:center;color:#999;">
		                            <i class="fas fa-inbox"></i> No past business records
		                        </td>
		                    </tr>
		                `;
		                pastBusinessPager.refresh();
		                return;
		            }

		            invoices.forEach(invoice => {

		                const row = tbody.insertRow();

		                row.innerHTML = `
		                    <td>${invoice.billNo}</td>
		                    <td>${invoice.invoiceDate}</td>
		                    <td>${invoice.invoiceTime}</td>
		                    <td>${invoice.sellerName}</td>
							<td>${invoice.buyerName}</td>
		                    <td>₹${invoice.totalAmount}</td>
		                    <td>${invoice.paymentMode}</td>
							<td>
							    <i class="fa-solid fa-eye action-icon view-icon"
							       onclick="viewBill('${invoice.billNo}')"
							       title="View Invoice"></i>
							</td>

							<td>
							    <i class="fa-solid fa-trash action-icon delete-icon"
							       onclick="deleteBill('${invoice.billNo}')"
							       title="Delete Invoice"></i>
							</td>
		                `;
		            });

		            // Re-apply current search filter (also refreshes the pager)
		            filterPastBusinessTable();
		        })
		        .catch(error => {
		            console.error("Error fetching invoices:", error);
		        })
		        .finally(() => loaderStageReady('invoices'));
		}
		
		function populatePastBusinessTable(data) {

		    const tbody = document.getElementById("pastBusinessBody");
		    tbody.innerHTML = "";

		    if (data.length === 0) {
		        tbody.innerHTML = `
		            <tr>
		                <td colspan="9" style="text-align:center; color:#999;">
		                    No records found
		                </td>
		            </tr>
		        `;
		        pastBusinessPager.refresh();
		        return;
		    }

		    let _pbHtml = '';
		    data.forEach(invoice => {

		        let row = `
		            <tr>
					<td>${invoice.billNo}</td>
                    <td>${invoice.invoiceDate}</td>
                    <td>${invoice.invoiceTime}</td>
                    <td>${invoice.sellerName}</td>
					<td>${invoice.buyerName}</td>
                    <td>₹${invoice.totalAmount}</td>
                    <td>${invoice.paymentMode}</td>
					<td>
					    <i class="fa-solid fa-eye action-icon view-icon"
					       onclick="viewBill('${invoice.billNo}')"
					       title="View Invoice"></i>
					</td>

					<td>
					    <i class="fa-solid fa-trash action-icon delete-icon"
					       onclick="deleteBill('${invoice.billNo}')"
					       title="Delete Invoice"></i>
					</td>
		            </tr>
		        `;

		        _pbHtml += row;
		    });
		    tbody.innerHTML = _pbHtml;

		    // Re-apply current search filter (also refreshes the pager)
		    filterPastBusinessTable();
		}

		function viewBill(billNo) {
			
		    window.open("/invoice/" + billNo, "_blank");
		}
		
		function deleteBill(billNo) {

		    if (!confirm("Are you sure you want to delete this invoice?")) return;

		    fetch("/api/invoice/" + billNo, {
		        method: "DELETE"
		    })
		    .then(response => {
		        if (!response.ok) {
		            throw new Error("Delete failed");
		        }

		        showNotification("Bill " + billNo + " deleted successfully..!" , "success");
		        fetchInvoices();
		    })
		    .catch(err => {
		        console.error(err);
		        showNotification("Error deleting bill..!", "error");
		    });
		}

		function filterBusiness(type, ev) {

		    const buttons = document.querySelectorAll('.filter-btn');
		    buttons.forEach(btn => btn.classList.remove('active'));
		    // Highlight the clicked button. Use closest() so clicking the icon/text
		    // inside the button still lights up the button itself (not the <i>).
		    const evt = ev || window.event;
		    let clickedBtn = evt && evt.target ? evt.target.closest('.filter-btn') : null;
		    if (!clickedBtn) {
		        // Fallback (e.g. programmatic call): match by the type in the onclick.
		        clickedBtn = Array.from(buttons).find(b =>
		            (b.getAttribute('onclick') || '').includes("'" + type + "'"));
		    }
		    if (clickedBtn) clickedBtn.classList.add('active');

		    let today = new Date();
		    let startDate;
		    let endDate = today.toISOString().split("T")[0];

		    if (type === "week") {
		        let lastWeek = new Date();
		        lastWeek.setDate(today.getDate() - 7);
		        startDate = lastWeek.toISOString().split("T")[0];

		    } else if (type === "month") {
		        let firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
		        startDate = firstDay.toISOString().split("T")[0];

		    } else if (type === "all") {
		        fetchInvoices(); // existing function
		        return;
		    }

		    fetchFilteredInvoices(startDate, endDate);
		}

		function applyDateRange() {

		    const start = document.getElementById('startDate').value;
		    const end = document.getElementById('endDate').value;

		    if (!start || !end) {
		        alert('Please select both start and end dates');
		        return;
		    }

		    fetchFilteredInvoices(start, end);
		}
		
		function fetchFilteredInvoices(start, end) {

		    fetch(`/api/invoice/filter?start=${start}&end=${end}`)
		        .then(response => response.json())
		        .then(data => {
		            populatePastBusinessTable(data);
		        })
		        .catch(error => console.error(error))
		        .finally(() => loaderStageReady('invoices'));
		}

		function exportData(type) {

		    showNotification(`Preparing ${type.toUpperCase()} file...`, 'success');

		    if (type === "excel") {
		        window.location.href = "/api/invoice/export/excel";
		    }
		    else if (type === "pdf") {
		        window.location.href = "/api/invoice/export/pdf";
		    }
		    else if (type === "print") {
		        window.print();
		    }
		}

		// Scanner / typed-ID handler for the Generate-Bill section.
		// Triggered on Enter: looks up the product by exact ID, sets the
		// existing Select Product dropdown, then invokes the existing addToBill().
		function scanAddToBill(event) {
		    if (event.key !== 'Enter') return;
		    event.preventDefault();

		    const input = document.getElementById('scanToBill');
		    const code = input.value.trim();
		    if (!code) return;

		    const q = code.toLowerCase();
		    let product = products.find(p => p.productId.toLowerCase() === q);
		    if (!product) {
		        product = products.find(p =>
		            p.productId.toLowerCase().includes(q) ||
		            (p.name || '').toLowerCase().includes(q)
		        );
		    }

		    if (!product) {
		        showNotification('Product not found for "' + code + '"', 'error');
		        input.select();
		        return;
		    }

		    if (product.quantity <= 0) {
		        showNotification('Out of stock: ' + product.name, 'error');
		        input.select();
		        return;
		    }

		    // Select the product in the dropdown then reuse existing addToBill()
		    const select = document.getElementById('selectProduct');
		    select.value = product.productId;

		    // Default quantity to 1 if blank or < 1
		    const qtyEl = document.getElementById('productQuantity');
		    if (!qtyEl.value || parseInt(qtyEl.value) < 1) qtyEl.value = 1;

		    addToBill();

		    // Reset scan input so the next scan is clean
		    input.value = '';
		    input.focus();
		}

		// Client-side filter for the Past Business table. Marks non-matching rows
		// with data-filter-hidden="1"; pager decides which matches to show (first N).
		function filterPastBusinessTable() {
		    const input = document.getElementById('pastBusinessSearch');
		    if (!input) return;
		    const q = input.value.trim().toLowerCase();

		    document.querySelectorAll('#pastBusinessBody tr').forEach(row => {
		        // Skip placeholder rows ("No records", etc.)
		        const cells = row.querySelectorAll('td');
		        if (cells.length === 1 && cells[0].hasAttribute('colspan')) return;

		        const text = row.innerText.toLowerCase();
		        const match = !q || text.includes(q);
		        row.dataset.filterHidden = match ? '0' : '1';
		    });

		    pastBusinessPager.reset();
		}

        // Clear Add Form
        function clearAddForm() {
		    document.getElementById("productId").value = "";
		    document.getElementById("productName").value = "";
		    document.getElementById("productCategory").value = "";
		    document.getElementById("productDescription").value = "";
		    document.getElementById("productSize").value = "";
		    document.getElementById("productColor").value = "";
		    document.getElementById("actualPrice").value = "";
		    document.getElementById("sellingPrice").value = "";
		    document.getElementById("quantity").value = "";
		    const wrap = document.getElementById('barcodePreviewWrap');
		    if (wrap) wrap.style.display = 'none';
		}
		
		function clearEditForm() {
		    document.getElementById("searchProduct").value = "";
		    document.getElementById("editCategory").value = "";
		    document.getElementById("editName").value = "";
		    document.getElementById("editDescription").value = "";
		    document.getElementById("editSize").value = "";
		    document.getElementById("editColor").value = "";
		    document.getElementById("editActualPrice").value = "";
		    document.getElementById("editSellingPrice").value = "";
		    document.getElementById("editQuantity").value = "";
		}
		
        // Show Notification
        function showNotification(message, type) {
            // Create notification element
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = `
                <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
                ${message}
            `;
            
            // Style notification
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 25px;
                background: ${type === 'success' ? '#28a745' : '#e64e36'};
                color: white;
                border-radius: 10px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                z-index: 1000;
                animation: slideInRight 0.3s ease-out;
            `;
            
            document.body.appendChild(notification);
            
            // Remove after 3 seconds
            setTimeout(() => {
                notification.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => {
                    document.body.removeChild(notification);
                }, 300);
            }, 3000);
        }
		
		// ===== ANALYSIS PASSWORD GATE =====
		// NOTE: Hardcoded password for simplicity. This is client-side only and
		// can be inspected via DevTools — adequate for in-shop staff control,
		// not for true security. Change ANALYSIS_PASSWORD here when needed.
		const ANALYSIS_PASSWORD = "mokshitha123";

		function openAnalysisGate() {
		    const gate = document.getElementById('analysisGate');
		    const input = document.getElementById('analysisPassword');
		    const error = document.getElementById('analysisGateError');
		    if (!gate || !input || !error) return;

		    input.value = '';
		    error.textContent = '';
		    gate.style.display = 'flex';
		    setTimeout(() => input.focus(), 50);
		}

		function closeAnalysisGate() {
		    const gate = document.getElementById('analysisGate');
		    if (gate) gate.style.display = 'none';
		}

		function submitAnalysisPassword() {
		    const input = document.getElementById('analysisPassword');
		    const error = document.getElementById('analysisGateError');
		    if (!input) return;

		    if (input.value === ANALYSIS_PASSWORD) {
		        // Pass a session token via sessionStorage so the analysis page can verify
		        // the user came through this gate (still client-side, but slightly cleaner)
		        try {
		            sessionStorage.setItem('analysisAuthorized', 'yes');
		            sessionStorage.setItem('analysisAuthorizedAt', String(Date.now()));
		        } catch (e) { /* ignore — sessionStorage may be disabled */ }
		        window.location.href = '/analysis';
		    } else {
		        error.textContent = 'Incorrect password. Try again.';
		        input.value = '';
		        input.focus();
		    }
		}

		// ---- Purchases gate (mirrors the Analysis gate; same admin password) ----
		function openPurchasesGate() {
		    const gate = document.getElementById('purchasesGate');
		    const input = document.getElementById('purchasesPassword');
		    const error = document.getElementById('purchasesGateError');
		    if (!gate || !input || !error) return;

		    input.value = '';
		    error.textContent = '';
		    gate.style.display = 'flex';
		    setTimeout(() => input.focus(), 50);
		}

		function closePurchasesGate() {
		    const gate = document.getElementById('purchasesGate');
		    if (gate) gate.style.display = 'none';
		}

		function submitPurchasesPassword() {
		    const input = document.getElementById('purchasesPassword');
		    const error = document.getElementById('purchasesGateError');
		    if (!input) return;

		    if (input.value === ANALYSIS_PASSWORD) {
		        try {
		            sessionStorage.setItem('purchasesAuthorized', 'yes');
		            sessionStorage.setItem('purchasesAuthorizedAt', String(Date.now()));
		        } catch (e) { /* ignore — sessionStorage may be disabled */ }
		        window.location.href = '/purchases';
		    } else {
		        error.textContent = 'Incorrect password. Try again.';
		        input.value = '';
		        input.focus();
		    }
		}

		// Close the modal on Escape
		document.addEventListener('keydown', function (e) {
		    if (e.key === 'Escape') {
		        const gate = document.getElementById('analysisGate');
		        if (gate && gate.style.display !== 'none') closeAnalysisGate();
		        const pgate = document.getElementById('purchasesGate');
		        if (pgate && pgate.style.display !== 'none') closePurchasesGate();
		    }
		});

        // Add animation keyframes
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
		
		// ============================================================
		// RETURN / EXCHANGE LOGIC
		// ============================================================
		 
		// Module-scope state
		let currentBillLookup       = null;   // last successful /api/return/lookup response
		let currentExchangeItems    = [];     // items the customer wants in the exchange
		let adminOverrideOK         = false;  // set after a successful admin password override
		let adminOverridePassword   = "";     // captured password to send to server with the request
		 
		// ----------- Step 1: Look up the original bill -----------
		function lookupReturnBill() {
		 
		    const input    = document.getElementById('returnBillNo');
		    const errorEl  = document.getElementById('returnLookupError');
		    const billNo   = (input.value || '').trim();
		 
		    errorEl.textContent = '';
		 
		    if (!billNo) {
		        errorEl.textContent = 'Please enter or scan a bill number.';
		        return;
		    }
		 
		    // Reset prior state so a fresh lookup is clean
		    adminOverrideOK       = false;
		    adminOverridePassword = "";
		    currentExchangeItems  = [];
		 
		    fetch('/api/return/lookup/' + encodeURIComponent(billNo))
		        .then(async (res) => {
		            const body = await res.json();
		            if (!res.ok) throw new Error(body.error || 'Bill not found');
		            return body;
		        })
		        .then((data) => {
		            currentBillLookup = data;
		            populateBillDetails(data);
		 
		            // Handle the 7-day window
		            const badge = document.getElementById('returnWindowBadge');
		            if (data.withinReturnWindow) {
		                badge.className = 'window-badge ok';
		                badge.textContent = data.daysSincePurchase + ' day(s) since purchase — within window';
		                revealReturnSections();
		            } else {
		                // Bill is too old — require admin override before continuing
		                badge.className = 'window-badge expired';
		                badge.textContent = data.daysSincePurchase + ' day(s) since purchase — EXPIRED';
		 
		                openOverrideModal(
		                    'Bill #' + data.billNo + ' is ' + data.daysSincePurchase +
		                    ' days old (limit ' + data.returnWindowDays +
		                    ' days). Enter the admin password to proceed.',
		                    () => {
		                        adminOverrideOK = true;
		                        badge.className = 'window-badge override';
		                        badge.textContent = data.daysSincePurchase + ' day(s) — ADMIN OVERRIDE';
		                        revealReturnSections();
		                    }
		                );
		            }
		        })
		        .catch((err) => {
		            errorEl.textContent = err.message || 'Bill not found';
		            hideReturnSections();
		            currentBillLookup = null;
		        });
		}
		 
		function populateBillDetails(data) {
		    document.getElementById('rbBillNo').textContent  = data.billNo;
		    document.getElementById('rbDate').textContent    =
		        data.invoiceDate + ' ' + (data.invoiceTime || '').slice(0, 5);
		    document.getElementById('rbSeller').textContent  = data.sellerName || '—';
		    document.getElementById('rbBuyer').textContent   = data.buyerName || '—';
		    document.getElementById('rbMobile').textContent  = data.buyerMobile || '—';
		    document.getElementById('rbPayment').textContent = data.paymentMode || '—';
		    document.getElementById('rbTotal').textContent   = '\u20B9' + (data.totalAmount || 0);
		 
		    // Build the items table
		    const tbody = document.getElementById('returnItemsBody');
		    tbody.innerHTML = '';
		    (data.items || []).forEach(item => {
		        tbody.insertAdjacentHTML('beforeend', buildReturnItemRow(item));
		    });
		}
		 
		function buildReturnItemRow(item) {
		    const fullyReturned = item.remainingReturnable <= 0;
		    // Row starts with `inputs-locked` so qty/reason/notes look inactive until the
		    // checkbox is checked. The checkbox itself is always clickable (CSS exempts
		    // the first <td>). Fully-returned rows get an extra class for dimming.
		    const trClass = fullyReturned ? 'fully-returned' : 'inputs-locked';
		 
		    return `
		        <tr data-item-id="${item.id}" class="${trClass}">
		            <td>
		                <input type="checkbox" class="rt-check"
		                       data-item-id="${item.id}"
		                       ${fullyReturned ? 'disabled' : ''}
		                       onchange="toggleReturnRow(this)">
		            </td>
		            <td>${escapeHTML(item.description)}</td>
		            <td>${escapeHTML(item.color || '')}</td>
		            <td>\u20B9${item.price}</td>
		            <td>${item.quantity}</td>
		            <td>${item.returnedQuantity}</td>
		            <td><strong>${item.remainingReturnable}</strong></td>
		            <td>
		                <input type="number" class="rt-qty"
		                       min="1" max="${item.remainingReturnable}"
		                       value="${item.remainingReturnable > 0 ? 1 : 0}"
		                       ${fullyReturned ? 'disabled' : ''}
		                       onchange="recomputeReturnSummary()"
		                       oninput="recomputeReturnSummary()">
		            </td>
		            <td>
		                <select class="rt-reason" ${fullyReturned ? 'disabled' : ''} onchange="recomputeReturnSummary()">
		                    <option value="Damaged">Damaged</option>
		                    <option value="Quality">Quality</option>
		                    <option value="Size">Size</option>
		                    <option value="Color">Color</option>
		                    <option value="Other" selected>Other</option>
		                </select>
		            </td>
		            <td>
		                <input type="text" class="rt-notes" placeholder="Optional notes" ${fullyReturned ? 'disabled' : ''}>
		            </td>
		        </tr>
		    `;
		}
		 
		function toggleReturnRow(checkbox) {
		    const row = checkbox.closest('tr');
		    if (!row) return;
		    if (checkbox.checked) {
		        row.classList.remove('inputs-locked');
		    } else {
		        row.classList.add('inputs-locked');
		    }
		    recomputeReturnSummary();
		}
		 
		function revealReturnSections() {
		    document.getElementById('returnBillDetails').style.display     = 'block';
		    document.getElementById('returnExchangeSection').style.display = 'block';
		    document.getElementById('returnSummarySection').style.display  = 'block';
		    recomputeReturnSummary();
		}
		 
		function hideReturnSections() {
		    document.getElementById('returnBillDetails').style.display     = 'none';
		    document.getElementById('returnExchangeSection').style.display = 'none';
		    document.getElementById('returnSummarySection').style.display  = 'none';
		}
		 
		// ----------- Step 3: Exchange items -----------
		function exchangeScanAdd(event) {
		    if (event.key !== 'Enter') return;
		    if (event.preventDefault) event.preventDefault();
		 
		    const scanInput = document.getElementById('exchangeScan');
		    const qtyInput  = document.getElementById('exchangeQty');
		    const code      = (scanInput.value || '').trim();
		    const qty       = parseInt(qtyInput.value, 10) || 1;
		 
		    if (!code) return;
		 
		    // Find product by exact ID first (scanner case), then by partial match
		    const q = code.toLowerCase();
		    let product = products.find(p => p.productId.toLowerCase() === q);
		    if (!product) {
		        product = products.find(p =>
		            p.productId.toLowerCase().includes(q) ||
		            (p.name || '').toLowerCase().includes(q)
		        );
		    }
		    if (!product) {
		        showNotification('Product not found for "' + code + '"', 'error');
		        scanInput.select();
		        return;
		    }
		    if (product.quantity < qty) {
		        showNotification('Only ' + product.quantity + ' available for ' + product.name, 'error');
		        scanInput.select();
		        return;
		    }
		 
		    // Add or stack
		    const existing = currentExchangeItems.find(it => it.productId === product.productId);
		    if (existing) {
		        if (existing.quantity + qty > product.quantity) {
		            showNotification('Cannot add more — only ' + product.quantity + ' in stock', 'error');
		            return;
		        }
		        existing.quantity += qty;
		    } else {
		        currentExchangeItems.push({
		            productId:   product.productId,
		            description: product.name,
		            color:       product.color,
		            price:       product.sellingPrice,
		            quantity:    qty,
		            billOn:      'General',
		            discount:    '0%',
		            appliedOn:   'Selling Price'
		        });
		    }
		 
		    renderExchangeItemsTable();
		    scanInput.value = '';
		    qtyInput.value  = '1';
		    scanInput.focus();
		    recomputeReturnSummary();
		}
		 
		function renderExchangeItemsTable() {
		    const tbody = document.getElementById('exchangeItemsBody');
		    if (currentExchangeItems.length === 0) {
		        tbody.innerHTML = '<tr class="empty-row"><td colspan="6" class="muted-cell">No exchange items added yet</td></tr>';
		        return;
		    }
		    tbody.innerHTML = currentExchangeItems.map((it, idx) => `
		        <tr>
		            <td>${escapeHTML(it.description)}</td>
		            <td>${escapeHTML(it.color || '')}</td>
		            <td>\u20B9${it.price}</td>
		            <td>${it.quantity}</td>
		            <td>\u20B9${it.price * it.quantity}</td>
		            <td>
		                <i class="fa-solid fa-trash action-icon delete-icon"
		                   onclick="removeExchangeItem(${idx})" title="Remove"></i>
		            </td>
		        </tr>
		    `).join('');
		}
		 
		function removeExchangeItem(idx) {
		    currentExchangeItems.splice(idx, 1);
		    renderExchangeItemsTable();
		    recomputeReturnSummary();
		}
		 
		// ----------- Step 4: Refund calculation -----------
		function recomputeReturnSummary() {
		    if (!currentBillLookup) return;
		 
		    // Sum returned value (only checked items)
		    let returnValue = 0;
		    document.querySelectorAll('#returnItemsBody tr').forEach(row => {
		        const cb = row.querySelector('.rt-check');
		        if (!cb || !cb.checked) return;
		        const itemId = parseInt(cb.dataset.itemId, 10);
		        const item   = currentBillLookup.items.find(i => i.id === itemId);
		        if (!item) return;
		        const qtyInput = row.querySelector('.rt-qty');
		        let qty = parseInt(qtyInput.value, 10) || 0;
		        if (qty < 1) qty = 1;
		        if (qty > item.remainingReturnable) qty = item.remainingReturnable;
		        qtyInput.value = qty;
		        returnValue += Number(item.price) * qty;
		    });
		 
		    // Sum exchange value
		    const exchangeValue = currentExchangeItems.reduce(
		        (sum, it) => sum + (Number(it.price) * Number(it.quantity)), 0);
		 
		    // Refund = returned - exchanged
		    const refund = returnValue - exchangeValue;
		 
		    document.getElementById('sumReturnValue').textContent   = '\u20B9' + returnValue.toFixed(0);
		    document.getElementById('sumExchangeValue').textContent = '\u20B9' + exchangeValue.toFixed(0);
		 
		    const totalRow   = document.getElementById('sumRefundRow');
		    const totalLabel = document.getElementById('sumRefundLabel');
		    const totalValue = document.getElementById('sumRefundValue');
		 
		    totalRow.classList.remove('refund', 'charge', 'even');
		    if (refund > 0) {
		        totalRow.classList.add('refund');
		        totalLabel.textContent = 'Refund to customer';
		        totalValue.textContent = '\u20B9' + refund.toFixed(0);
		    } else if (refund < 0) {
		        totalRow.classList.add('charge');
		        totalLabel.textContent = 'Customer pays extra';
		        totalValue.textContent = '\u20B9' + Math.abs(refund).toFixed(0);
		    } else {
		        totalRow.classList.add('even');
		        totalLabel.textContent = 'Even swap';
		        totalValue.textContent = '\u20B90';
		    }
		 
		    // Show/hide the exchange-bill payment mode dropdown
		    const wrap = document.getElementById('exchangePaymentWrap');
		    wrap.style.display = currentExchangeItems.length > 0 ? 'flex' : 'none';
		}
		 
		// ----------- Submit the return -----------
		function submitReturn() {
		 
		    if (!currentBillLookup) {
		        showNotification('Look up a bill first', 'error');
		        return;
		    }
		 
		    // Build the list of items being returned
		    const returnItems = [];
		    document.querySelectorAll('#returnItemsBody tr').forEach(row => {
		        const cb = row.querySelector('.rt-check');
		        if (!cb || !cb.checked) return;
		        const itemId = parseInt(cb.dataset.itemId, 10);
		        const qty    = parseInt(row.querySelector('.rt-qty').value, 10) || 0;
		        const reason = row.querySelector('.rt-reason').value;
		        const notes  = row.querySelector('.rt-notes').value.trim();
		        if (qty > 0) {
		            returnItems.push({
		                originalInvoiceItemId: itemId,
		                quantityReturned:      qty,
		                reason:                reason,
		                reasonNotes:           notes
		            });
		        }
		    });
		 
		    if (returnItems.length === 0) {
		        showNotification('Select at least one item to return', 'error');
		        return;
		    }
		 
		    const processedBy = currentBillLookup.sellerName;
		    const refundMode  = document.getElementById('returnRefundMode').value;
		    const notes       = document.getElementById('returnNotes').value.trim();
		 
		    // Build exchange payload (if any)
		    const exchangeItems = currentExchangeItems.map(it => ({
		        description: it.description,
		        billOn:      it.billOn,
		        color:       it.color,
		        discount:    it.discount,
		        appliedOn:   it.appliedOn,
		        price:       it.price,
		        quantity:    it.quantity
		    }));
		 
		    let paymentMode = '';
		    if (exchangeItems.length > 0) {
		        paymentMode = document.getElementById('exchangePaymentMode').value;
		        if (!paymentMode) {
		            showNotification('Select a payment mode for the exchange bill', 'error');
		            return;
		        }
		    }
		 
		    const payload = {
		        originalBillNo: currentBillLookup.billNo,
		        processedBy:    processedBy,
		        refundMode:     refundMode,
		        notes:          notes,
		        adminOverride:  adminOverrideOK,
		        adminPassword:  adminOverrideOK ? adminOverridePassword : null,
		        returnItems:    returnItems,
		        exchangeItems:  exchangeItems,
		        buyerName:      currentBillLookup.buyerName,
		        buyerMobile:    currentBillLookup.buyerMobile,
		        paymentMode:    paymentMode
		    };
		 
		    fetch('/api/return/process', {
		        method:  'POST',
		        headers: { 'Content-Type': 'application/json' },
		        body:    JSON.stringify(payload)
		    })
		    .then(async (res) => {
		        const body = await res.json();
		        if (!res.ok) throw new Error(body.error || 'Failed to process return');
		        return body;
		    })
		    .then((result) => {
		        showNotification('Return processed: ' + result.returnId, 'success');
		 
		        // Open the return receipt in a new tab
		        window.open('/return-receipt/' + result.returnId, '_blank');
		 
		        // If an exchange invoice was created, open it too
		        if (result.newBillNo) {
		            window.open('/invoice/' + result.newBillNo, '_blank');
		        }
		 
		        // Refresh product list (stock changed) + invoices list
		        fetchProducts();
		        if (typeof fetchInvoices === 'function') fetchInvoices();
		 
		        resetReturnForm();
		    })
		    .catch((err) => {
		        showNotification(err.message, 'error');
		    });
		}
		 
		function resetReturnForm() {
		    document.getElementById('returnBillNo').value = '';
		    document.getElementById('returnNotes').value  = '';
		    document.getElementById('returnLookupError').textContent = '';
		    document.getElementById('returnItemsBody').innerHTML = '';
		    document.getElementById('exchangeItemsBody').innerHTML =
		        '<tr class="empty-row"><td colspan="6" class="muted-cell">No exchange items added yet</td></tr>';
		    hideReturnSections();
		 
		    currentBillLookup     = null;
		    currentExchangeItems  = [];
		    adminOverrideOK       = false;
		    adminOverridePassword = "";
		 
		    setTimeout(() => {
		        const el = document.getElementById('returnBillNo');
		        if (el) el.focus();
		    }, 60);
		}
		 
		// ----------- Admin override modal -----------
		let _overrideOnConfirm = null;
		 
		function openOverrideModal(message, onConfirm) {
		    _overrideOnConfirm = onConfirm;
		    document.getElementById('overrideGateMessage').textContent = message;
		    document.getElementById('overridePassword').value = '';
		    document.getElementById('overrideGateError').textContent = '';
		    document.getElementById('overrideGate').style.display = 'flex';
		    setTimeout(() => {
		        const el = document.getElementById('overridePassword');
		        if (el) el.focus();
		    }, 50);
		}
		 
		function closeOverrideModal() {
		    document.getElementById('overrideGate').style.display = 'none';
		    _overrideOnConfirm = null;
		}
		 
		function submitOverride() {
		    const input = document.getElementById('overridePassword');
		    const error = document.getElementById('overrideGateError');
		    const value = (input.value || '').trim();
		 
		    if (!value) {
		        error.textContent = 'Enter the admin password';
		        return;
		    }
		 
		    // The server is the real validator (when we send the actual return request).
		    // Here we just capture the password and let the caller proceed; if it's wrong,
		    // the server will reject /api/return/process with a 400.
		    adminOverridePassword = value;
		    error.textContent = '';
		    document.getElementById('overrideGate').style.display = 'none';
		 
		    if (typeof _overrideOnConfirm === 'function') {
		        const cb = _overrideOnConfirm;
		        _overrideOnConfirm = null;
		        cb();
		    }
		}
		 
		// ----------- Past Business: show "Returned" badge on bills with returns -----------
		let _returnedBillsCache = null;
		async function refreshReturnedBillsBadges() {
		    try {
		        const res = await fetch('/api/return/all');
		        if (!res.ok) return;
		        const list = await res.json();
		        _returnedBillsCache = new Set();
		        (list || []).forEach(rt => {
		            if (rt.originalBillNo) _returnedBillsCache.add(rt.originalBillNo);
		        });
		        applyReturnedBadges();
		    } catch (e) { /* silent */ }
		}
		 
		function applyReturnedBadges() {
		    if (!_returnedBillsCache) return;
		    document.querySelectorAll('#pastBusinessBody tr').forEach(row => {
		        const firstCell = row.querySelector('td');
		        if (!firstCell) return;
		        // Already badged?
		        if (firstCell.querySelector('.returned-badge')) return;
		        const billNo = firstCell.textContent.trim();
		        if (_returnedBillsCache.has(billNo)) {
		            const badge = document.createElement('span');
		            badge.className = 'returned-badge';
		            badge.textContent = 'Returned';
		            firstCell.appendChild(badge);
		        }
		    });
		}
		 
		// Helpers
		function escapeHTML(s) {
		    return String(s == null ? '' : s)
		        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
		        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
		}
		 
		// Hook into the existing fetchInvoices flow: after each fetch, apply badges
		document.addEventListener('DOMContentLoaded', () => {
		    refreshReturnedBillsBadges();
		});
		 
		// Also expose a small wrapper so populatePastBusinessTable / fetchInvoices
		// can call applyReturnedBadges after they rebuild rows.
		const _origPopulate = (typeof populatePastBusinessTable !== 'undefined') ? populatePastBusinessTable : null;
		
		
		
		
		// ============================================================
		// PURCHASES — Phase 1: Suppliers CRUD
		// ============================================================
		 
		// Module-scope state
		let allSuppliers          = [];   // full list (incl. inactive) — populated by loadSuppliers
		let editingSupplierId     = null; // null = creating new, otherwise = editing existing
		 
		// --------- Tab switching for the Purchases section ---------
		function switchPurchaseTab(name) {
		    const tabs = {
		        'suppliers':   'suppliersTab',
		        'invoices':    'invoicesTab',
		        'credit-notes':'creditNotesTab',
		        'ledger':      'ledgerTab'
		    };
		    Object.values(tabs).forEach(id => {
		        const el = document.getElementById(id);
		        if (el) el.style.display = 'none';
		    });
		    document.querySelectorAll('.purchase-tab-btn').forEach(b => b.classList.remove('active'));
		 
		    const target = tabs[name];
		    if (target) {
		        const el = document.getElementById(target);
		        if (el) el.style.display = 'block';
		    }
		    // Highlight the matching button
		    document.querySelectorAll('.purchase-tab-btn').forEach(btn => {
		        if (btn.getAttribute('onclick') &&
		            btn.getAttribute('onclick').includes("'" + name + "'")) {
		            btn.classList.add('active');
		        }
		    });
		 
		    if (name === 'suppliers') {
		        loadSuppliers();
		    }
		}
		 
		// --------- Load suppliers from the API ---------
		async function loadSuppliers() {
		    const tbody = document.getElementById('suppliersTableBody');
		    if (!tbody) return;
		 
		    tbody.innerHTML = '<tr class="empty-row"><td colspan="9" class="muted-cell">Loading suppliers…</td></tr>';
		 
		    try {
		        // Always fetch all; we filter visibility client-side based on "Show inactive" checkbox
		        const res = await fetch('/api/suppliers');
		        if (!res.ok) throw new Error('Failed to load suppliers');
		        allSuppliers = await res.json();
		        renderSuppliers();
		    } catch (e) {
		        tbody.innerHTML = `<tr class="empty-row"><td colspan="9" class="muted-cell" style="color:#dc2626;">${escapeHTML(e.message)}</td></tr>`;
		    }
		}
		 
		// --------- Render the suppliers table ---------
		function renderSuppliers() {
		    const tbody = document.getElementById('suppliersTableBody');
		    if (!tbody) return;
		 
		    const showInactive = document.getElementById('showInactiveSuppliers').checked;
		    const searchEl = document.getElementById('supplierSearch');
		    const q = (searchEl ? searchEl.value : '').trim().toLowerCase();
		 
		    let list = allSuppliers.slice();
		    if (!showInactive) list = list.filter(s => s.active);
		    if (q) list = list.filter(s =>
		        (s.name || '').toLowerCase().includes(q) ||
		        (s.contactPerson || '').toLowerCase().includes(q) ||
		        (s.phone || '').includes(q) ||
		        (s.supplierId || '').toLowerCase().includes(q)
		    );
		 
		    if (list.length === 0) {
		        tbody.innerHTML = `<tr class="empty-row"><td colspan="9" class="muted-cell">${
		            allSuppliers.length === 0
		                ? 'No suppliers yet — click "Add Supplier" to get started'
		                : 'No suppliers match your search'
		        }</td></tr>`;
		        return;
		    }
		 
		    tbody.innerHTML = list.map(s => {
		        // Phase 1: balance equals opening balance (Phases 2-3 will make this dynamic)
		        const balance = Number(s.openingBalance || 0);
		        const balancePillClass = balance > 0 ? 'owed' : (balance < 0 ? 'credit' : 'zero');
		        const balanceText = balance === 0
		            ? '\u20B90'
		            : (balance > 0
		                ? '\u20B9' + Math.abs(balance).toLocaleString('en-IN')
		                : '\u20B9' + Math.abs(balance).toLocaleString('en-IN') + ' (cr)');
		 
		        const rowClass = s.active ? '' : 'inactive';
		 
		        const actions = s.active
		            ? `
		                <i class="fa-solid fa-edit action-icon edit"
		                   onclick='openSupplierForm(${JSON.stringify(s.supplierId)})'
		                   title="Edit"></i>
		                <i class="fa-solid fa-ban action-icon deact"
		                   onclick='confirmDeactivateSupplier(${JSON.stringify(s.supplierId)}, ${JSON.stringify(s.name)})'
		                   title="Deactivate"></i>
		              `
		            : `
		                <i class="fa-solid fa-edit action-icon edit"
		                   onclick='openSupplierForm(${JSON.stringify(s.supplierId)})'
		                   title="Edit"></i>
		                <i class="fa-solid fa-check-circle action-icon act"
		                   onclick='reactivateSupplier(${JSON.stringify(s.supplierId)})'
		                   title="Reactivate"></i>
		              `;
		 
		        return `
		            <tr class="${rowClass}">
		                <td><span class="supplier-id">${escapeHTML(s.supplierId)}</span></td>
		                <td><span class="supplier-name">${escapeHTML(s.name)}</span></td>
		                <td>${escapeHTML(s.contactPerson || '\u2014')}</td>
		                <td>${escapeHTML(s.phone || '\u2014')}</td>
		                <td>${escapeHTML(s.gstNumber || '\u2014')}</td>
		                <td>${escapeHTML(s.paymentTerms || '\u2014')}</td>
		                <td class="right"><span class="balance-pill ${balancePillClass}">${balanceText}</span></td>
		                <td><span class="status-badge ${s.active ? 'active' : 'inactive'}">${s.active ? 'Active' : 'Inactive'}</span></td>
		                <td>
		                    <div class="supplier-actions">
		                        ${actions}
		                    </div>
		                </td>
		            </tr>
		        `;
		    }).join('');
		}
		 
		function filterSuppliers() {
		    renderSuppliers();
		}
		 
		// --------- Open form modal (create or edit) ---------
		function openSupplierForm(supplierId) {
		    editingSupplierId = supplierId || null;
		 
		    const modal = document.getElementById('supplierModal');
		    const title = document.getElementById('supplierModalTitle');
		    const subtitle = document.getElementById('supplierModalSubtitle');
		    const error = document.getElementById('supplierModalError');
		    const openingInput = document.getElementById('sfOpeningBalance');
		 
		    error.textContent = '';
		 
		    // Clear all fields first
		    ['sfName','sfContactPerson','sfPhone','sfEmail','sfAddress',
		     'sfGstNumber','sfNotes'].forEach(id => {
		        document.getElementById(id).value = '';
		    });
		    document.getElementById('sfPaymentTerms').value = '';
		    openingInput.value = '';
		    openingInput.disabled = false;
		 
		    if (editingSupplierId) {
		        // Edit mode: populate fields
		        const s = allSuppliers.find(x => x.supplierId === editingSupplierId);
		        if (!s) {
		            showNotification('Supplier not found locally — please refresh', 'error');
		            return;
		        }
		        title.textContent = 'Edit Supplier · ' + s.supplierId;
		        subtitle.textContent = 'Update the fields below. Opening balance is locked after creation.';
		 
		        document.getElementById('sfName').value           = s.name || '';
		        document.getElementById('sfContactPerson').value  = s.contactPerson || '';
		        document.getElementById('sfPhone').value          = s.phone || '';
		        document.getElementById('sfEmail').value          = s.email || '';
		        document.getElementById('sfAddress').value        = s.address || '';
		        document.getElementById('sfGstNumber').value      = s.gstNumber || '';
		        document.getElementById('sfPaymentTerms').value   = s.paymentTerms || '';
		        document.getElementById('sfNotes').value          = s.notes || '';
		        openingInput.value = s.openingBalance || 0;
		        openingInput.disabled = true; // locked after creation
		    } else {
		        // Create mode
		        title.textContent = 'Add Supplier';
		        subtitle.textContent = 'Enter supplier details. ID will be auto-generated.';
		    }
		 
		    modal.style.display = 'flex';
		    setTimeout(() => document.getElementById('sfName').focus(), 50);
		}
		 
		function closeSupplierForm() {
		    document.getElementById('supplierModal').style.display = 'none';
		    editingSupplierId = null;
		}
		 
		// --------- Save (create or update) ---------
		async function saveSupplier() {
		    const error = document.getElementById('supplierModalError');
		    error.textContent = '';
		 
		    const name = document.getElementById('sfName').value.trim();
		    if (!name) {
		        error.textContent = 'Supplier name is required';
		        return;
		    }
		 
		    const phone = document.getElementById('sfPhone').value.trim();
		    // Phone is optional but if provided, do a soft length check (allows 10-15 chars)
		    if (phone && (phone.length < 7 || phone.length > 15)) {
		        error.textContent = 'Phone number should be 7-15 digits';
		        return;
		    }
		 
		    const openingBalanceStr = document.getElementById('sfOpeningBalance').value.trim();
		    const openingBalance = openingBalanceStr === '' ? 0 : parseFloat(openingBalanceStr);
		    if (isNaN(openingBalance) || openingBalance < 0) {
		        error.textContent = 'Opening balance must be 0 or positive';
		        return;
		    }
		 
		    const payload = {
		        name:           name,
		        contactPerson:  document.getElementById('sfContactPerson').value.trim() || null,
		        phone:          phone || null,
		        email:          document.getElementById('sfEmail').value.trim() || null,
		        address:        document.getElementById('sfAddress').value.trim() || null,
		        gstNumber:      document.getElementById('sfGstNumber').value.trim() || null,
		        paymentTerms:   document.getElementById('sfPaymentTerms').value || null,
		        notes:          document.getElementById('sfNotes').value.trim() || null,
		        openingBalance: openingBalance,
		        active:         true
		    };
		 
		    const btn = document.getElementById('sfSaveBtn');
		    btn.disabled = true;
		    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
		 
		    try {
		        let res;
		        if (editingSupplierId) {
		            res = await fetch('/api/suppliers/' + encodeURIComponent(editingSupplierId), {
		                method: 'PUT',
		                headers: { 'Content-Type': 'application/json' },
		                body: JSON.stringify(payload)
		            });
		        } else {
		            res = await fetch('/api/suppliers', {
		                method: 'POST',
		                headers: { 'Content-Type': 'application/json' },
		                body: JSON.stringify(payload)
		            });
		        }
		        const body = await res.json();
		        if (!res.ok) throw new Error(body.error || 'Save failed');
		 
		        showNotification(
		            editingSupplierId
		                ? 'Supplier updated: ' + body.name
		                : 'Supplier created: ' + body.supplierId + ' · ' + body.name,
		            'success'
		        );
		        closeSupplierForm();
		        loadSuppliers();
		    } catch (e) {
		        error.textContent = e.message;
		    } finally {
		        btn.disabled = false;
		        btn.innerHTML = '<i class="fas fa-save"></i> Save';
		    }
		}
		 
		// --------- Deactivate / reactivate ---------
		function confirmDeactivateSupplier(supplierId, name) {
		    if (!confirm('Deactivate supplier "' + name + '"?\n\n' +
		                 'Inactive suppliers are hidden from new purchase forms but ' +
		                 'remain in historical reports.')) {
		        return;
		    }
		    fetch('/api/suppliers/' + encodeURIComponent(supplierId), { method: 'DELETE' })
		        .then(async (res) => {
		            const body = await res.json().catch(() => ({}));
		            if (!res.ok) throw new Error(body.error || 'Deactivation failed');
		            showNotification('Supplier deactivated', 'success');
		            loadSuppliers();
		        })
		        .catch((e) => showNotification(e.message, 'error'));
		}
		 
		function reactivateSupplier(supplierId) {
		    fetch('/api/suppliers/' + encodeURIComponent(supplierId) + '/activate', { method: 'POST' })
		        .then(async (res) => {
		            const body = await res.json().catch(() => ({}));
		            if (!res.ok) throw new Error(body.error || 'Reactivation failed');
		            showNotification('Supplier reactivated', 'success');
		            loadSuppliers();
		        })
		        .catch((e) => showNotification(e.message, 'error'));
		}
		 
		// --------- Boot ---------
		document.addEventListener('DOMContentLoaded', () => {
		    // Load suppliers on page load so they're ready when the tab is opened
		    loadSuppliers();
		});