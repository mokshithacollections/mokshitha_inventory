// ============================================================
// PURCHASES PAGE — Phase 1: Suppliers CRUD
// ============================================================

// ============== AUTH GATE ==============
// Mirror analysis.js: the home page sets sessionStorage.purchasesAuthorized
// after the admin password is entered. If that's missing, send the user back.
function checkAuth() {
    try {
        const ok = sessionStorage.getItem('purchasesAuthorized');
        if (ok !== 'yes') {
            alert('Access denied. Please open this page from the dashboard.');
            window.location.href = '/';
            return false;
        }
    } catch (e) {
        alert('Browser storage unavailable. Please open from the dashboard.');
        window.location.href = '/';
        return false;
    }
    return true;
}

// ============== HELPERS ==============
function escapeHTML(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Lightweight notification (purchases page is standalone — no shared showNotification)
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = 'notification ' + type;
    notification.innerHTML =
        '<i class="fas ' + (type === 'success' ? 'fa-check-circle' : 'fa-info-circle') + '"></i> ' +
        escapeHTML(message);
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        padding: 15px 25px;
        background: ${type === 'success' ? '#28a745' : '#e64e36'};
        color: white;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 3000;
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        display: flex; align-items: center; gap: 8px;
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.transition = 'opacity 0.3s';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============== STATE ==============
let allSuppliers      = [];   // full list (incl. inactive) — populated by loadSuppliers
let editingSupplierId = null; // null = creating new, otherwise = editing existing
let supplierBalances  = {};   // supplierId -> current balance (opening + purchases - payments)

// Purchases tab state
let allPurchases      = [];   // all purchase invoices
let allProducts       = [];   // inventory, for the purchase line dropdowns
let productById       = {};   // productId -> product
let purchaseLineSeq   = 0;    // unique id for dynamic line rows
let paymentSupplierId = null; // supplier currently being paid

// Credit notes + ledger state
let allCreditNotes    = [];   // all credit notes
let creditLineSeq     = 0;    // unique id for dynamic credit-note line rows
let ledgerLoaded      = false;// whether the ledger supplier dropdown is populated

// ============== TAB SWITCHING ==============
function switchPurchaseTab(name) {
    const tabs = {
        'suppliers':    'suppliersTab',
        'invoices':     'invoicesTab',
        'credit-notes': 'creditNotesTab',
        'ledger':       'ledgerTab',
        'price-check':  'priceCheckTab'
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
    document.querySelectorAll('.purchase-tab-btn').forEach(btn => {
        if (btn.getAttribute('onclick') &&
            btn.getAttribute('onclick').includes("'" + name + "'")) {
            btn.classList.add('active');
        }
    });

    if (name === 'suppliers') {
        loadSuppliers();
    } else if (name === 'invoices') {
        loadPurchases();
    } else if (name === 'credit-notes') {
        loadCreditNotes();
    } else if (name === 'ledger') {
        initLedger();
    } else if (name === 'price-check') {
        initPriceCheck();
    }
}

// =====================================================================
//  PRICE CHECK — look up any product's purchase price history
// =====================================================================
async function initPriceCheck() {
    // Make sure we have the product list to resolve scanned IDs / names.
    if (!allProducts || allProducts.length === 0) {
        try {
            const res = await fetch('/api/products');
            allProducts = res.ok ? await res.json() : [];
            productById = {};
            allProducts.forEach(p => { productById[p.productId] = p; });
        } catch (e) { /* ignore — lookup will just fail gracefully */ }
    }
    setTimeout(() => { const s = document.getElementById('pcScan'); if (s) s.focus(); }, 60);
}

function scanPriceCheck(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();

    const input = document.getElementById('pcScan');
    const code = (input.value || '').trim();
    if (!code) return;

    const q = code.toLowerCase();
    let product = allProducts.find(p => p.productId.toLowerCase() === q);
    if (!product) {
        product = allProducts.find(p =>
            p.productId.toLowerCase().includes(q) ||
            (p.name || '').toLowerCase().includes(q)
        );
    }

    if (!product) {
        showNotification('Product not found for "' + code + '"', 'error');
        input.select();
        return;
    }

    loadPriceCheck(product);
}

async function loadPriceCheck(product) {
    const tbody   = document.getElementById('priceCheckTableBody');
    const summary = document.getElementById('pcSummary');
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6" class="muted-cell">Loading price history…</td></tr>';

    let list = [];
    try {
        const res = await fetch('/api/purchases/price-history/' +
            encodeURIComponent(product.productId) + '?limit=100');
        list = res.ok ? await res.json() : [];
    } catch (e) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="6" class="muted-cell" style="color:#dc2626;">Failed to load history</td></tr>';
        return;
    }

    // ----- Summary card -----
    const times = list.length;
    const totalQty = list.reduce((s, h) => s + (Number(h.quantity) || 0), 0);
    const last = times > 0 ? list[0] : null;
    let minP = null, maxP = null, wsum = 0, wqty = 0;
    list.forEach(h => {
        const c = Number(h.costPrice) || 0, qn = Number(h.quantity) || 0;
        minP = (minP == null) ? c : Math.min(minP, c);
        maxP = (maxP == null) ? c : Math.max(maxP, c);
        wsum += c * qn; wqty += qn;
    });
    const avg = wqty > 0 ? (wsum / wqty) : 0;

    summary.style.display = 'block';
    summary.innerHTML = `
        <div class="pc-card" style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:2px;">
                ${escapeHTML(product.productId)} — ${escapeHTML(product.name)}
                <span class="muted" style="font-weight:400;">(${escapeHTML(product.color || '')}${product.size ? ', ' + escapeHTML(product.size) : ''})</span>
            </div>
            <div class="muted" style="font-size:12px;margin-bottom:10px;">
                In stock: <strong>${product.quantity != null ? product.quantity : '—'}</strong>
                &nbsp;•&nbsp; Recorded cost: <strong>${fmtINR(product.actualPrice)}</strong>
                &nbsp;•&nbsp; Selling: <strong>${fmtINR(product.sellingPrice)}</strong>
            </div>
            ${times === 0 ? `<div class="muted">No prior purchases recorded for this product.</div>` : `
            <div style="display:flex;gap:22px;flex-wrap:wrap;">
                <div><div class="muted" style="font-size:11px;">LAST PAID</div>
                     <div style="font-weight:700;">${fmtINR(last.costPrice)}</div>
                     <div class="muted" style="font-size:11px;">${escapeHTML(last.purchaseDate || '')}${last.supplierName ? ' · ' + escapeHTML(last.supplierName) : ''}</div></div>
                <div><div class="muted" style="font-size:11px;">AVG (by qty)</div>
                     <div style="font-weight:700;">${fmtINR(avg)}</div></div>
                <div><div class="muted" style="font-size:11px;">LOWEST</div>
                     <div style="font-weight:700;">${fmtINR(minP)}</div></div>
                <div><div class="muted" style="font-size:11px;">HIGHEST</div>
                     <div style="font-weight:700;">${fmtINR(maxP)}</div></div>
                <div><div class="muted" style="font-size:11px;">TIMES BOUGHT</div>
                     <div style="font-weight:700;">${times} <span class="muted" style="font-weight:400;font-size:11px;">(${totalQty} units)</span></div></div>
            </div>`}
        </div>`;

    // ----- History table -----
    if (times === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="6" class="muted-cell">No purchase history for this product</td></tr>';
        return;
    }
    tbody.innerHTML = list.map(h => {
        const qn = Number(h.quantity) || 0;
        const c  = Number(h.costPrice) || 0;
        return `
            <tr>
                <td>${escapeHTML(h.purchaseDate || '—')}</td>
                <td>${escapeHTML(h.supplierName || '—')}</td>
                <td><span class="supplier-id">${escapeHTML(h.purchaseId || '—')}</span></td>
                <td class="right">${qn}</td>
                <td class="right">${fmtINR(c)}</td>
                <td class="right">${fmtINR(c * qn)}</td>
            </tr>`;
    }).join('');
}

// ============== LOAD ==============
async function loadSuppliers() {
    const tbody = document.getElementById('suppliersTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr class="empty-row"><td colspan="9" class="muted-cell">Loading suppliers…</td></tr>';

    try {
        const [supRes, balRes] = await Promise.all([
            fetch('/api/suppliers'),
            fetch('/api/suppliers/balances')
        ]);
        if (!supRes.ok) throw new Error('Failed to load suppliers');
        allSuppliers = await supRes.json();
        supplierBalances = balRes.ok ? await balRes.json() : {};
        renderSuppliers();
    } catch (e) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="9" class="muted-cell" style="color:#dc2626;">' +
                          escapeHTML(e.message) + '</td></tr>';
    }
}

// ============== RENDER ==============
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
        tbody.innerHTML = '<tr class="empty-row"><td colspan="9" class="muted-cell">' +
            (allSuppliers.length === 0
                ? 'No suppliers yet — click "Add Supplier" to get started'
                : 'No suppliers match your search') +
            '</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(s => {
        // Balance = opening + purchases - payments (computed by the backend)
        const balance = supplierBalances[s.supplierId] != null
            ? Number(supplierBalances[s.supplierId])
            : Number(s.openingBalance || 0);
        const balancePillClass = balance > 0 ? 'owed' : (balance < 0 ? 'credit' : 'zero');
        const balanceText = balance === 0
            ? '\u20B90'
            : (balance > 0
                ? '\u20B9' + Math.abs(balance).toLocaleString('en-IN')
                : '\u20B9' + Math.abs(balance).toLocaleString('en-IN') + ' (cr)');

        const rowClass = s.active ? '' : 'inactive';

        const payIcon = `
                <i class="fa-solid fa-money-bill-wave action-icon edit"
                   onclick='openPaymentModal(${JSON.stringify(s.supplierId)}, ${JSON.stringify(s.name)})'
                   title="Record Payment"></i>`;

        const actions = s.active
            ? `
                <i class="fa-solid fa-edit action-icon edit"
                   onclick='openSupplierForm(${JSON.stringify(s.supplierId)})'
                   title="Edit"></i>
                ${payIcon}
                <i class="fa-solid fa-ban action-icon deact"
                   onclick='confirmDeactivateSupplier(${JSON.stringify(s.supplierId)}, ${JSON.stringify(s.name)})'
                   title="Deactivate"></i>
              `
            : `
                <i class="fa-solid fa-edit action-icon edit"
                   onclick='openSupplierForm(${JSON.stringify(s.supplierId)})'
                   title="Edit"></i>
                ${payIcon}
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

// ============== FORM MODAL ==============
function openSupplierForm(supplierId) {
    editingSupplierId = supplierId || null;

    const modal        = document.getElementById('supplierModal');
    const title        = document.getElementById('supplierModalTitle');
    const subtitle     = document.getElementById('supplierModalSubtitle');
    const error        = document.getElementById('supplierModalError');
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
        // Edit mode
        const s = allSuppliers.find(x => x.supplierId === editingSupplierId);
        if (!s) {
            showNotification('Supplier not found locally — please refresh', 'error');
            return;
        }
        title.textContent = 'Edit Supplier · ' + s.supplierId;
        subtitle.textContent = 'Update the fields below. Opening balance is locked after creation.';

        document.getElementById('sfName').value          = s.name || '';
        document.getElementById('sfContactPerson').value = s.contactPerson || '';
        document.getElementById('sfPhone').value         = s.phone || '';
        document.getElementById('sfEmail').value         = s.email || '';
        document.getElementById('sfAddress').value       = s.address || '';
        document.getElementById('sfGstNumber').value     = s.gstNumber || '';
        document.getElementById('sfPaymentTerms').value  = s.paymentTerms || '';
        document.getElementById('sfNotes').value         = s.notes || '';
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

// ============== SAVE ==============
async function saveSupplier() {
    const error = document.getElementById('supplierModalError');
    error.textContent = '';

    const name = document.getElementById('sfName').value.trim();
    if (!name) {
        error.textContent = 'Supplier name is required';
        return;
    }

    const phone = document.getElementById('sfPhone').value.trim();
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

// ============== DEACTIVATE / REACTIVATE ==============
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

// =====================================================================
//  PURCHASE INVOICES
// =====================================================================
const fmtINR = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

async function loadPurchases() {
    const tbody = document.getElementById('purchasesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr class="empty-row"><td colspan="9" class="muted-cell">Loading purchases…</td></tr>';
    try {
        const res = await fetch('/api/purchases');
        if (!res.ok) throw new Error('Failed to load purchases');
        allPurchases = await res.json();
        renderPurchases();
    } catch (e) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="9" class="muted-cell" style="color:#dc2626;">' +
                          escapeHTML(e.message) + '</td></tr>';
    }
}

function renderPurchases() {
    const tbody = document.getElementById('purchasesTableBody');
    if (!tbody) return;

    const searchEl = document.getElementById('purchaseSearch');
    const q = (searchEl ? searchEl.value : '').trim().toLowerCase();

    let list = allPurchases.slice();
    if (q) list = list.filter(p =>
        (p.supplierName || '').toLowerCase().includes(q) ||
        (p.purchaseId || '').toLowerCase().includes(q) ||
        (p.supplierInvoiceNo || '').toLowerCase().includes(q)
    );

    if (list.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="9" class="muted-cell">' +
            (allPurchases.length === 0
                ? 'No purchases yet — click "New Purchase" to record one'
                : 'No purchases match your search') +
            '</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(p => {
        const total   = Number(p.totalAmount || 0);
        const paid    = Number(p.amountPaid || 0);
        const balance = total - paid;
        const itemCount = Array.isArray(p.items) ? p.items.length : 0;
        const balClass = balance > 0 ? 'owed' : 'zero';
        const billCell = p.billPhoto
            ? `<i class="fa-solid fa-image action-icon edit" title="View bill photo"
                   onclick='viewBillPhoto(${JSON.stringify(p.purchaseId)})'></i>`
            : '<span class="muted-cell">—</span>';
        return `
            <tr>
                <td><span class="supplier-id">${escapeHTML(p.purchaseId)}</span></td>
                <td>${escapeHTML(p.purchaseDate || '—')}</td>
                <td><span class="supplier-name">${escapeHTML(p.supplierName || '—')}</span></td>
                <td>${escapeHTML(p.supplierInvoiceNo || '—')}</td>
                <td>${itemCount}</td>
                <td class="right">${fmtINR(total)}</td>
                <td class="right">${fmtINR(paid)}</td>
                <td class="right"><span class="balance-pill ${balClass}">${fmtINR(balance)}</span></td>
                <td>${billCell}</td>
            </tr>
        `;
    }).join('');
}

// ============== BILL PHOTO VIEWER ==============
function viewBillPhoto(purchaseId) {
    const modal = document.getElementById('billPhotoModal');
    const img   = document.getElementById('billPhotoImg');
    const title = document.getElementById('billPhotoTitle');
    const open  = document.getElementById('billPhotoOpen');
    if (!modal || !img) return;

    const url = '/api/purchases/' + encodeURIComponent(purchaseId) + '/bill-photo';
    // cache-bust so a replaced photo shows the new image
    img.src = url + '?t=' + Date.now();
    if (title) title.textContent = 'Bill Photo · ' + purchaseId;
    if (open)  open.href = url;
    modal.style.display = 'flex';
}

function closeBillPhoto(event) {
    // when called from the backdrop, only close if the backdrop itself was clicked
    if (event && event.target && event.target.id !== 'billPhotoModal') return;
    const modal = document.getElementById('billPhotoModal');
    if (modal) modal.style.display = 'none';
    const img = document.getElementById('billPhotoImg');
    if (img) img.src = '';
}

// ============== PURCHASE FORM ==============
async function openPurchaseForm() {
    const modal = document.getElementById('purchaseModal');
    const error = document.getElementById('purchaseModalError');
    error.textContent = '';

    // Reset fields
    document.getElementById('pfSupplierInvoiceNo').value = '';
    document.getElementById('pfPaymentMode').value = '';
    document.getElementById('pfAmountPaid').value = '';
    document.getElementById('pfNotes').value = '';
    document.getElementById('pfPurchaseDate').value = new Date().toISOString().slice(0, 10);
    const photoInput = document.getElementById('pfBillPhoto');
    if (photoInput) photoInput.value = '';
    const scanInput = document.getElementById('pfScan');
    if (scanInput) scanInput.value = '';
    document.getElementById('purchaseLinesBody').innerHTML = '';

    // Load active suppliers + products in parallel
    try {
        const [supRes, prodRes] = await Promise.all([
            fetch('/api/suppliers?active=true'),
            fetch('/api/products')
        ]);
        const suppliers = supRes.ok ? await supRes.json() : [];
        allProducts = prodRes.ok ? await prodRes.json() : [];
        productById = {};
        allProducts.forEach(p => { productById[p.productId] = p; });

        const supSel = document.getElementById('pfSupplier');
        supSel.innerHTML = '<option value="">— select supplier —</option>' +
            suppliers.map(s => `<option value="${escapeHTML(s.supplierId)}">${escapeHTML(s.name)} (${escapeHTML(s.supplierId)})</option>`).join('');
    } catch (e) {
        error.textContent = 'Could not load suppliers/products: ' + e.message;
        return;
    }

    recalcPurchaseTotal();
    modal.style.display = 'flex';
    // Focus the scan box so the user can scan/type a Product ID immediately
    setTimeout(() => { const s = document.getElementById('pfScan'); if (s) s.focus(); }, 60);
}

function closePurchaseForm() {
    document.getElementById('purchaseModal').style.display = 'none';
}

// Scanner / typed-ID handler: on Enter, look up the product and add a line.
function scanAddPurchaseLine(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();

    const input = document.getElementById('pfScan');
    const code = input.value.trim();
    if (!code) return;

    const q = code.toLowerCase();
    let product = allProducts.find(p => p.productId.toLowerCase() === q);
    if (!product) {
        product = allProducts.find(p =>
            p.productId.toLowerCase().includes(q) ||
            (p.name || '').toLowerCase().includes(q)
        );
    }

    if (!product) {
        showNotification('Product not found for "' + code + '"', 'error');
        input.select();
        return;
    }

    addPurchaseLineForProduct(product);

    // Reset scan box for the next scan
    input.value = '';
    input.focus();
}

// Add (or increment) a line for a scanned/looked-up product. Cost is editable
// and prefilled from the product's recorded cost price (actualPrice).
function addPurchaseLineForProduct(product) {
    const body = document.getElementById('purchaseLinesBody');

    // If the product is already on the list, just bump its quantity.
    const existing = body.querySelector('tr[data-product-id="' + cssEscape(product.productId) + '"]');
    if (existing) {
        const qtyInput = existing.querySelector('.pl-qty');
        qtyInput.value = (parseInt(qtyInput.value) || 0) + 1;
        recalcPurchaseTotal();
        return;
    }

    const rowId = 'pl_' + (++purchaseLineSeq);
    const cost = product.actualPrice != null ? product.actualPrice : 0;
    const tr = document.createElement('tr');
    tr.id = rowId;
    tr.setAttribute('data-product-id', product.productId);
    tr.innerHTML = `
        <td>
            <strong>${escapeHTML(product.productId)}</strong> — ${escapeHTML(product.name)}
            <span class="muted">(${escapeHTML(product.color || '')})</span>
            <div class="pl-history muted" style="font-size:11px;margin-top:3px;">
                <i class="fas fa-clock-rotate-left"></i> checking last purchase…
            </div>
        </td>
        <td><input type="number" class="pl-qty" min="1" value="1" oninput="recalcPurchaseTotal()" style="width:100%;"></td>
        <td><input type="number" class="pl-cost" min="0" step="0.01" value="${cost}"
                   data-autofill="1" oninput="this.dataset.autofill='';recalcPurchaseTotal()" style="width:100%;"></td>
        <td class="right line-total">₹0</td>
        <td>
            <i class="fa-solid fa-trash action-icon deact" title="Remove"
               onclick="removePurchaseLine('${rowId}')"></i>
        </td>
    `;
    body.appendChild(tr);
    recalcPurchaseTotal();

    // Fetch this product's prior purchase prices and show them on the row.
    loadPurchaseHistoryForRow(rowId, product.productId);
}

// Load a product's prior purchase prices, show them on the row, and (if the
// user hasn't typed a cost yet) prefill the cost with the LAST price paid.
function loadPurchaseHistoryForRow(rowId, productId) {
    fetch('/api/purchases/price-history/' + encodeURIComponent(productId))
        .then(r => r.ok ? r.json() : [])
        .then(list => {
            const tr = document.getElementById(rowId);
            if (!tr) return;
            const box = tr.querySelector('.pl-history');
            if (!list || list.length === 0) {
                if (box) box.innerHTML = '<i class="fas fa-circle-info"></i> no prior purchase for this product';
                return;
            }
            const last = list[0];
            if (box) {
                const older = list.slice(1).map(h =>
                    `${escapeHTML(h.purchaseDate || '')}: ${fmtINR(h.costPrice)}`
                ).join('  •  ');
                box.innerHTML =
                    '<i class="fas fa-clock-rotate-left"></i> Last paid <strong>' + fmtINR(last.costPrice) + '</strong>' +
                    ' on ' + escapeHTML(last.purchaseDate || '—') +
                    (last.supplierName ? ' · ' + escapeHTML(last.supplierName) : '') +
                    (older ? '<br><span style="opacity:.75;">Earlier: ' + older + '</span>' : '');
            }
            // Prefill cost with the last price paid, unless the user already edited it.
            const costInput = tr.querySelector('.pl-cost');
            if (costInput && costInput.dataset.autofill === '1') {
                costInput.value = last.costPrice;
                recalcPurchaseTotal();
            }
        })
        .catch(() => {
            const tr = document.getElementById(rowId);
            const box = tr && tr.querySelector('.pl-history');
            if (box) box.innerHTML = '';
        });
}

function removePurchaseLine(rowId) {
    const tr = document.getElementById(rowId);
    if (tr) tr.remove();
    recalcPurchaseTotal();
}

// Minimal CSS.escape fallback for attribute selectors (product IDs are simple).
function cssEscape(s) {
    return String(s).replace(/["\\\]]/g, '\\$&');
}

function recalcPurchaseTotal() {
    let grand = 0;
    document.querySelectorAll('#purchaseLinesBody tr').forEach(tr => {
        const qty  = Number(tr.querySelector('.pl-qty').value)  || 0;
        const cost = Number(tr.querySelector('.pl-cost').value) || 0;
        const lineTotal = qty * cost;
        grand += lineTotal;
        tr.querySelector('.line-total').textContent = fmtINR(lineTotal);
    });
    document.getElementById('pfGrandTotal').value = fmtINR(grand);
    return grand;
}

async function savePurchase() {
    const error = document.getElementById('purchaseModalError');
    error.textContent = '';

    const supplierId = document.getElementById('pfSupplier').value;
    if (!supplierId) { error.textContent = 'Please select a supplier'; return; }

    // Collect line items
    const items = [];
    let bad = false;
    document.querySelectorAll('#purchaseLinesBody tr').forEach(tr => {
        const productId = tr.getAttribute('data-product-id');
        if (!productId) return;                 // skip any stray rows
        const qty  = parseInt(tr.querySelector('.pl-qty').value);
        const cost = parseFloat(tr.querySelector('.pl-cost').value);
        if (!qty || qty < 1) { bad = true; return; }
        if (isNaN(cost) || cost < 0) { bad = true; return; }
        const p = productById[productId];
        items.push({
            productId:   productId,
            description: p ? p.name : productId,
            color:       p ? p.color : null,
            quantity:    qty,
            costPrice:   cost
        });
    });

    if (bad) { error.textContent = 'Check quantities and cost prices on each line'; return; }
    if (items.length === 0) { error.textContent = 'Scan or type a Product ID to add at least one item'; return; }

    const grand = recalcPurchaseTotal();
    const amountPaidStr = document.getElementById('pfAmountPaid').value.trim();
    const amountPaid = amountPaidStr === '' ? 0 : parseFloat(amountPaidStr);
    if (isNaN(amountPaid) || amountPaid < 0) { error.textContent = 'Amount paid must be 0 or positive'; return; }
    if (amountPaid > grand) { error.textContent = 'Amount paid cannot exceed the grand total'; return; }

    const payload = {
        supplierId:        supplierId,
        supplierInvoiceNo: document.getElementById('pfSupplierInvoiceNo').value.trim() || null,
        purchaseDate:      document.getElementById('pfPurchaseDate').value || null,
        paymentMode:       document.getElementById('pfPaymentMode').value || null,
        amountPaid:        amountPaid,
        notes:             document.getElementById('pfNotes').value.trim() || null,
        items:             items
    };

    const btn = document.getElementById('pfSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
    try {
        const res = await fetch('/api/purchases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Save failed');

        // If a bill photo was chosen, upload it now (purchase already saved).
        const photoInput = document.getElementById('pfBillPhoto');
        const file = photoInput && photoInput.files ? photoInput.files[0] : null;
        if (file) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading bill…';
            try {
                const fd = new FormData();
                fd.append('file', file);
                const upRes = await fetch('/api/purchases/' + encodeURIComponent(body.purchaseId) + '/bill-photo', {
                    method: 'POST',
                    body: fd
                });
                if (!upRes.ok) {
                    const upBody = await upRes.json().catch(() => ({}));
                    showNotification('Purchase saved, but bill photo failed: ' +
                        (upBody.error || 'upload error'), 'error');
                }
            } catch (upErr) {
                showNotification('Purchase saved, but bill photo upload failed', 'error');
            }
        }

        showNotification('Purchase saved: ' + body.purchaseId + ' · stock updated', 'success');
        closePurchaseForm();
        loadPurchases();
    } catch (e) {
        error.textContent = e.message;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Save Purchase';
    }
}

// =====================================================================
//  SUPPLIER PAYMENTS
// =====================================================================
function openPaymentModal(supplierId, name) {
    paymentSupplierId = supplierId;
    document.getElementById('paymentModalTitle').textContent = 'Record Payment · ' + supplierId;
    document.getElementById('paymentModalSubtitle').textContent = 'Log a payment made to ' + name + '.';
    document.getElementById('paymentModalError').textContent = '';
    document.getElementById('payAmount').value = '';
    document.getElementById('payDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('payMode').value = '';
    document.getElementById('payReference').value = '';
    document.getElementById('payNotes').value = '';
    document.getElementById('paymentModal').style.display = 'flex';
    setTimeout(() => document.getElementById('payAmount').focus(), 50);
}

function closePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
    paymentSupplierId = null;
}

async function savePayment() {
    const error = document.getElementById('paymentModalError');
    error.textContent = '';

    const amount = parseFloat(document.getElementById('payAmount').value);
    if (isNaN(amount) || amount <= 0) { error.textContent = 'Enter a valid amount greater than 0'; return; }

    const payload = {
        amount:      amount,
        paymentDate: document.getElementById('payDate').value || null,
        mode:        document.getElementById('payMode').value || null,
        reference:   document.getElementById('payReference').value.trim() || null,
        notes:       document.getElementById('payNotes').value.trim() || null
    };

    const btn = document.getElementById('paySaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
    try {
        const res = await fetch('/api/suppliers/' + encodeURIComponent(paymentSupplierId) + '/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Save failed');
        showNotification('Payment recorded: ' + body.paymentId, 'success');
        closePaymentModal();
        loadSuppliers();   // refresh balances
    } catch (e) {
        error.textContent = e.message;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Save Payment';
    }
}

// =====================================================================
//  CREDIT NOTES
// =====================================================================
async function loadCreditNotes() {
    const tbody = document.getElementById('creditNotesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7" class="muted-cell">Loading credit notes…</td></tr>';
    try {
        const res = await fetch('/api/credit-notes');
        if (!res.ok) throw new Error('Failed to load credit notes');
        allCreditNotes = await res.json();
        renderCreditNotes();
    } catch (e) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="7" class="muted-cell" style="color:#dc2626;">' +
                          escapeHTML(e.message) + '</td></tr>';
    }
}

function renderCreditNotes() {
    const tbody = document.getElementById('creditNotesTableBody');
    if (!tbody) return;

    const searchEl = document.getElementById('creditNoteSearch');
    const q = (searchEl ? searchEl.value : '').trim().toLowerCase();

    let list = allCreditNotes.slice();
    if (q) list = list.filter(c =>
        (c.supplierName || '').toLowerCase().includes(q) ||
        (c.creditNoteId || '').toLowerCase().includes(q) ||
        (c.reason || '').toLowerCase().includes(q)
    );

    if (list.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="7" class="muted-cell">' +
            (allCreditNotes.length === 0
                ? 'No credit notes yet — click "New Credit Note" to record one'
                : 'No credit notes match your search') +
            '</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(c => `
        <tr>
            <td><span class="supplier-id">${escapeHTML(c.creditNoteId)}</span></td>
            <td>${escapeHTML(c.creditDate || '—')}</td>
            <td><span class="supplier-name">${escapeHTML(c.supplierName || '—')}</span></td>
            <td>${escapeHTML(c.reason || '—')}</td>
            <td>${escapeHTML(c.reference || '—')}</td>
            <td>${c.reduceStock ? '<span class="status-badge active">Yes</span>' : '<span class="status-badge inactive">No</span>'}</td>
            <td class="right">${fmtINR(c.amount)}</td>
        </tr>
    `).join('');
}

// ============== CREDIT NOTE FORM ==============
async function openCreditNoteForm() {
    const modal = document.getElementById('creditNoteModal');
    const error = document.getElementById('creditNoteModalError');
    error.textContent = '';

    document.getElementById('cnReference').value = '';
    document.getElementById('cnReason').value = '';
    document.getElementById('cnNotes').value = '';
    document.getElementById('cnAmount').value = '';
    document.getElementById('cnAmount').disabled = false;
    document.getElementById('cnReduceStock').checked = false;
    document.getElementById('cnDate').value = new Date().toISOString().slice(0, 10);
    const cnScan = document.getElementById('cnScan');
    if (cnScan) cnScan.value = '';
    document.getElementById('creditLinesBody').innerHTML = '';

    try {
        const [supRes, prodRes] = await Promise.all([
            fetch('/api/suppliers?active=true'),
            fetch('/api/products')
        ]);
        const suppliers = supRes.ok ? await supRes.json() : [];
        allProducts = prodRes.ok ? await prodRes.json() : [];
        productById = {};
        allProducts.forEach(p => { productById[p.productId] = p; });

        const supSel = document.getElementById('cnSupplier');
        supSel.innerHTML = '<option value="">— select supplier —</option>' +
            suppliers.map(s => `<option value="${escapeHTML(s.supplierId)}">${escapeHTML(s.name)} (${escapeHTML(s.supplierId)})</option>`).join('');
    } catch (e) {
        error.textContent = 'Could not load suppliers/products: ' + e.message;
        return;
    }

    modal.style.display = 'flex';
}

function closeCreditNoteForm() {
    document.getElementById('creditNoteModal').style.display = 'none';
}

// Scanner / typed-ID handler for credit note lines: Enter → look up + add line.
function scanAddCreditLine(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();

    const input = document.getElementById('cnScan');
    const code = input.value.trim();
    if (!code) return;

    const q = code.toLowerCase();
    let product = allProducts.find(p => p.productId.toLowerCase() === q);
    if (!product) {
        product = allProducts.find(p =>
            p.productId.toLowerCase().includes(q) ||
            (p.name || '').toLowerCase().includes(q)
        );
    }

    if (!product) {
        showNotification('Product not found for "' + code + '"', 'error');
        input.select();
        return;
    }

    addCreditLineForProduct(product);
    input.value = '';
    input.focus();
}

// Add (or increment) a credit line for a scanned product. Value/unit is editable
// and prefilled from the product's recorded cost price (actualPrice).
function addCreditLineForProduct(product) {
    const body = document.getElementById('creditLinesBody');

    const existing = body.querySelector('tr[data-product-id="' + cssEscape(product.productId) + '"]');
    if (existing) {
        const qtyInput = existing.querySelector('.cl-qty');
        qtyInput.value = (parseInt(qtyInput.value) || 0) + 1;
        recalcCreditTotal();
        return;
    }

    const rowId = 'cl_' + (++creditLineSeq);
    const val = product.actualPrice != null ? product.actualPrice : 0;
    const tr = document.createElement('tr');
    tr.id = rowId;
    tr.setAttribute('data-product-id', product.productId);
    tr.innerHTML = `
        <td>
            <strong>${escapeHTML(product.productId)}</strong> — ${escapeHTML(product.name)}
            <span class="muted">(${escapeHTML(product.color || '')})</span>
        </td>
        <td><input type="number" class="cl-qty" min="1" value="1" oninput="recalcCreditTotal()" style="width:100%;"></td>
        <td><input type="number" class="cl-val" min="0" step="0.01" value="${val}" oninput="recalcCreditTotal()" style="width:100%;"></td>
        <td class="right line-total">₹0</td>
        <td>
            <i class="fa-solid fa-trash action-icon deact" title="Remove"
               onclick="removeCreditLine('${rowId}')"></i>
        </td>
    `;
    body.appendChild(tr);
    recalcCreditTotal();
}

function removeCreditLine(rowId) {
    const tr = document.getElementById(rowId);
    if (tr) tr.remove();
    recalcCreditTotal();
}

function recalcCreditTotal() {
    const rows = document.querySelectorAll('#creditLinesBody tr');
    const amountInput = document.getElementById('cnAmount');
    const hint = document.getElementById('cnAmountHint');

    if (rows.length === 0) {
        amountInput.disabled = false;
        hint.textContent = 'Enter directly, or add line items to auto-calculate.';
        return 0;
    }

    let grand = 0;
    rows.forEach(tr => {
        const qty = Number(tr.querySelector('.cl-qty').value) || 0;
        const val = Number(tr.querySelector('.cl-val').value) || 0;
        const lineTotal = qty * val;
        grand += lineTotal;
        tr.querySelector('.line-total').textContent = fmtINR(lineTotal);
    });
    // With line items, amount is derived and locked.
    amountInput.value = grand;
    amountInput.disabled = true;
    hint.textContent = 'Calculated from line items above.';
    return grand;
}

async function saveCreditNote() {
    const error = document.getElementById('creditNoteModalError');
    error.textContent = '';

    const supplierId = document.getElementById('cnSupplier').value;
    if (!supplierId) { error.textContent = 'Please select a supplier'; return; }

    // Collect optional line items
    const items = [];
    let bad = false;
    document.querySelectorAll('#creditLinesBody tr').forEach(tr => {
        const productId = tr.getAttribute('data-product-id');
        if (!productId) return;
        const qty = parseInt(tr.querySelector('.cl-qty').value);
        const val = parseFloat(tr.querySelector('.cl-val').value);
        if (!qty || qty < 1) { bad = true; return; }
        if (isNaN(val) || val < 0) { bad = true; return; }
        const p = productById[productId];
        items.push({
            productId:   productId,
            description: p ? p.name : productId,
            color:       p ? p.color : null,
            quantity:    qty,
            unitValue:   val
        });
    });
    if (bad) { error.textContent = 'Check quantities and values on each line'; return; }

    const hasItems = items.length > 0;
    const amountStr = document.getElementById('cnAmount').value.trim();
    const amount = amountStr === '' ? null : parseFloat(amountStr);

    if (!hasItems) {
        if (amount == null || isNaN(amount) || amount <= 0) {
            error.textContent = 'Enter a credit amount, or add line items';
            return;
        }
    }

    const payload = {
        supplierId:  supplierId,
        creditDate:  document.getElementById('cnDate').value || null,
        reason:      document.getElementById('cnReason').value || null,
        reference:   document.getElementById('cnReference').value.trim() || null,
        reduceStock: document.getElementById('cnReduceStock').checked,
        notes:       document.getElementById('cnNotes').value.trim() || null,
        amount:      hasItems ? null : amount,
        items:       hasItems ? items : null
    };

    const btn = document.getElementById('cnSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
    try {
        const res = await fetch('/api/credit-notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Save failed');
        showNotification('Credit note saved: ' + body.creditNoteId, 'success');
        closeCreditNoteForm();
        loadCreditNotes();
    } catch (e) {
        error.textContent = e.message;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Save Credit Note';
    }
}

// =====================================================================
//  SUPPLIER LEDGER
// =====================================================================
async function initLedger() {
    const sel = document.getElementById('ledgerSupplier');
    if (!sel) return;
    if (!ledgerLoaded) {
        try {
            const res = await fetch('/api/suppliers');
            const suppliers = res.ok ? await res.json() : [];
            sel.innerHTML = '<option value="">— select a supplier —</option>' +
                suppliers.map(s => `<option value="${escapeHTML(s.supplierId)}">${escapeHTML(s.name)} (${escapeHTML(s.supplierId)})</option>`).join('');
            ledgerLoaded = true;
        } catch (e) {
            sel.innerHTML = '<option value="">Failed to load suppliers</option>';
        }
    }
}

async function loadLedger() {
    const supplierId = document.getElementById('ledgerSupplier').value;
    const tbody = document.getElementById('ledgerTableBody');
    const closing = document.getElementById('ledgerClosing');
    closing.textContent = '';

    if (!supplierId) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="7" class="muted-cell">Select a supplier to view their statement</td></tr>';
        return;
    }

    tbody.innerHTML = '<tr class="empty-row"><td colspan="7" class="muted-cell">Loading statement…</td></tr>';
    try {
        const res = await fetch('/api/suppliers/' + encodeURIComponent(supplierId) + '/ledger');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load ledger');
        renderLedger(data);
    } catch (e) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="7" class="muted-cell" style="color:#dc2626;">' +
                          escapeHTML(e.message) + '</td></tr>';
    }
}

function renderLedger(data) {
    const tbody = document.getElementById('ledgerTableBody');
    const closing = document.getElementById('ledgerClosing');
    const entries = data.entries || [];

    const typeLabel = {
        'OPENING':     'Opening',
        'PURCHASE':    'Purchase',
        'PAYMENT':     'Payment',
        'CREDIT_NOTE': 'Credit Note'
    };

    tbody.innerHTML = entries.map(e => `
        <tr>
            <td>${escapeHTML(e.date || '—')}</td>
            <td>${escapeHTML(typeLabel[e.type] || e.type)}</td>
            <td>${escapeHTML(e.refId || '—')}</td>
            <td>${escapeHTML(e.description || '')}</td>
            <td class="right">${Number(e.debit) ? fmtINR(e.debit) : '—'}</td>
            <td class="right">${Number(e.credit) ? fmtINR(e.credit) : '—'}</td>
            <td class="right"><strong>${fmtINR(e.runningBalance)}</strong></td>
        </tr>
    `).join('');

    const bal = Number(data.closingBalance || 0);
    const label = bal > 0 ? 'Owed to supplier' : (bal < 0 ? 'Supplier owes us' : 'Settled');
    closing.textContent = 'Closing balance: ' + fmtINR(Math.abs(bal)) + ' · ' + label;
}

// ============== ESCAPE TO CLOSE MODAL ==============
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const closers = {
        supplierModal:   closeSupplierForm,
        purchaseModal:   closePurchaseForm,
        paymentModal:    closePaymentModal,
        creditNoteModal: closeCreditNoteForm,
        billPhotoModal:  closeBillPhoto
    };
    for (const id in closers) {
        const modal = document.getElementById(id);
        if (modal && modal.style.display !== 'none') closers[id]();
    }
});

// ============== BOOT ==============
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    loadSuppliers();
});