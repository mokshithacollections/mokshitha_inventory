// =====================================================================
// Mokshitha Sales Analytics — analysis.js
// Loads products + invoices, aggregates client-side, renders KPIs,
// 6 Chart.js charts, and 3 operational tables.
// =====================================================================

// ============== STATE ==============
let allProducts = [];
let allInvoices = [];
let allReturns  = [];   // all return transactions
const productById = new Map();   // for fast lookup when computing profit
const charts = {};               // active Chart.js instances (so we can destroy/replace)

// Active filters
const filterState = {
    business: 'both',          // 'both' | 'Sarees' | 'Dress Pieces'
    period:   'month',         // 'today' | 'week' | 'month' | 'year' | 'all' | 'custom'
    customStart: null,
    customEnd:   null
};

// ============== UTILS ==============
const fmtINR = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const pct    = (a, b) => (b === 0 ? 0 : (a / b) * 100);
const PALETTE = {
    primary:  '#6c5ce7',
    primarySoft: '#8e7cf3',
    teal:     '#20B2AA',
    tealSoft: '#2ac2ba',
    green:    '#10b981',
    amber:    '#f59e0b',
    red:      '#ef4444',
    blue:     '#3b82f6',
    pink:     '#ec4899',
    indigo:   '#6366f1'
};
const CATEGORY_COLOR = {
    'Sarees':       PALETTE.teal,
    'DressPieces': PALETTE.primary
};

function parseInvoiceDate(invoice) {
    // backend returns invoiceDate as 'YYYY-MM-DD'
    const d = new Date(invoice.invoiceDate + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
}

function getDateRange(period) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start, end = new Date(today); end.setHours(23, 59, 59, 999);

    if (period === 'today') {
        start = new Date(today);
    } else if (period === 'week') {
        start = new Date(today); start.setDate(today.getDate() - 6);
    } else if (period === 'month') {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (period === 'year') {
        start = new Date(today.getFullYear(), 0, 1);
    } else if (period === 'all') {
        start = new Date(2000, 0, 1);
    } else if (period === 'custom') {
        start = filterState.customStart ? new Date(filterState.customStart + 'T00:00:00') : new Date(2000, 0, 1);
        end   = filterState.customEnd   ? new Date(filterState.customEnd   + 'T23:59:59') : new Date(today); end.setHours(23, 59, 59, 999);
        if (filterState.customEnd) end = new Date(filterState.customEnd + 'T23:59:59');
    }
    return { start, end };
}

// ============== AUTH GATE ==============
function checkAuth() {
    try {
        const ok = sessionStorage.getItem('analysisAuthorized');
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

// ============== LOADING SPLASH CONTROL ==============
const LOADER_START = (window.performance && performance.now) ? performance.now() : Date.now();
const LOADER_MIN_MS = 700;   // show the splash at least this long so it doesn't flash
let loaderHidden = false;
function hideAnalysisLoader() {
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
// Safety net: never leave the splash stuck if a request hangs.
setTimeout(hideAnalysisLoader, 20000);

// ============== DATA LOAD ==============
async function loadAllData() {
    try {
        const [prodRes, invRes, retRes] = await Promise.all([
            fetch('/api/products'),
            fetch('/api/invoice/all'),
            fetch('/api/return/all')
        ]);
        allProducts = await prodRes.json();
        allInvoices = await invRes.json();
        allReturns  = retRes.ok ? await retRes.json() : [];

        productById.clear();
        allProducts.forEach(p => productById.set(p.productId, p));

        renderEverything();
    } catch (e) {
        console.error(e);
        alert('Failed to load analytics data. Please try again.');
    } finally {
        // Hide the splash only once the charts/KPIs have been rendered.
        hideAnalysisLoader();
    }
}

// ============== FILTER LOGIC ==============
function getFilteredInvoices() {
    const { start, end } = getDateRange(filterState.period);

    return allInvoices.filter(inv => {
        const d = parseInvoiceDate(inv);
        if (!d) return false;
        if (d < start || d > end) return false;

        // Business filter applies via the seller name on the invoice
        if (filterState.business !== 'both') {
            const expected = filterState.business === 'Sarees'
                ? 'Mokshitha Collections'
                : "Moksha's Studios";
            if (inv.sellerName !== expected) return false;
        }
        return true;
    });
}

// Filter returns by return-date being in the period, AND by business (via processedBy seller name)
function getFilteredReturns() {
    const { start, end } = getDateRange(filterState.period);

    return (allReturns || []).filter(rt => {
        // Parse returnDate (YYYY-MM-DD)
        if (!rt.returnDate) return false;
        const d = new Date(rt.returnDate + 'T00:00:00');
        if (isNaN(d.getTime())) return false;
        if (d < start || d > end) return false;

        if (filterState.business !== 'both') {
            const expected = filterState.business === 'Sarees'
                ? 'Mokshitha Collections'
                : "Moksha's Studios";
            if (rt.processedBy !== expected) return false;
        }
        return true;
    });
}

// ============== AGGREGATION ==============
// Each invoice has items[]: { description, billOn, color, discount, appliedOn, price, quantity, totalPrice }
// We need to look up the product by description-match to get costPrice; description == product.name in our system.
// Fallback: 0 cost if product no longer in inventory (deleted). Profit = revenue - cost*qty.

function lineItemProfit(item) {
    // Try to find matching product by name (description) to get costPrice
    const product = allProducts.find(p => p.name === item.description);
    const cost    = product && product.costPrice != null ? product.costPrice : 0;
    const revenue = Number(item.totalPrice) || (Number(item.price) * Number(item.quantity));
    const profit  = revenue - (cost * Number(item.quantity));
    return { revenue, profit, cost };
}

function lineItemCategory(item) {
    const product = allProducts.find(p => p.name === item.description);
    return product ? product.category : 'Unknown';
}

function aggregate(invoices, returns) {
    let revenue = 0, profit = 0, items = 0;
    const byProduct = new Map();   // productName -> { revenue, profit, qty, category }
    const byCategory = { 'Sarees': 0, 'Dress Pieces': 0, 'Unknown': 0 };
    const bySeller = new Map();
    const byPayment = new Map();
    const byDay = new Map();        // dateString (YYYY-MM-DD) -> { revenue, profit, bills:Set, items }
    const byWeekday = [0,0,0,0,0,0,0]; // Sun..Sat (revenue sum)
    const weekdayCount = [0,0,0,0,0,0,0]; // count of days with sales per weekday (for averaging)
    const seenWeekdayDates = new Set();

    invoices.forEach(inv => {
        const dStr = inv.invoiceDate;
        const d = parseInvoiceDate(inv);

        let invRevenue = 0, invProfit = 0, invItems = 0;
        (inv.items || []).forEach(it => {
            const { revenue: r, profit: p } = lineItemProfit(it);
            const qty = Number(it.quantity) || 0;
            invRevenue += r; invProfit += p; invItems += qty;

            // by product
            const cat = lineItemCategory(it);
            const key = it.description;
            if (!byProduct.has(key)) {
                byProduct.set(key, { name: key, revenue: 0, profit: 0, qty: 0, category: cat });
            }
            const e = byProduct.get(key);
            e.revenue += r; e.profit += p; e.qty += qty;

            // by category
            byCategory[cat] = (byCategory[cat] || 0) + r;
        });

        revenue += invRevenue; profit += invProfit; items += invItems;

        // by seller
        bySeller.set(inv.sellerName, (bySeller.get(inv.sellerName) || 0) + invRevenue);

        // by payment mode
        byPayment.set(inv.paymentMode, (byPayment.get(inv.paymentMode) || 0) + invRevenue);

        // by day
        if (!byDay.has(dStr)) byDay.set(dStr, { revenue: 0, profit: 0, billSet: new Set(), items: 0 });
        const day = byDay.get(dStr);
        day.revenue += invRevenue; day.profit += invProfit;
        day.billSet.add(inv.billNo); day.items += invItems;

        // by weekday — accumulate revenue, count distinct dates per weekday for proper averaging
        if (d) {
            const wd = d.getDay();
            byWeekday[wd] += invRevenue;
            const wdKey = wd + ':' + dStr;
            if (!seenWeekdayDates.has(wdKey)) {
                seenWeekdayDates.add(wdKey);
                weekdayCount[wd] += 1;
            }
        }
    });

    // ===== Returns processing =====
    // For each returned unit on each return transaction:
    //   - non-damaged: subtract per-unit profit (price - cost)  AND subtract per-unit revenue (price)
    //   - damaged:     subtract per-unit revenue (price) AND subtract full per-unit price from profit (cost write-off)
    // We also build byReason for the donut chart, returnedUnits count for the rate.
    const byReason = new Map();   // reason -> total units returned
    let returnedUnits = 0;
    let returnedValue = 0;
    let returnProfitDelta = 0;    // amount to subtract from gross profit

    (returns || []).forEach(rt => {
        (rt.items || []).forEach(ri => {
            const qty = Number(ri.quantityReturned) || 0;
            if (qty <= 0) return;

            const unitPrice = Number(ri.unitPrice) || 0;
            // Find product to get cost price (may be missing if product was deleted)
            const product = allProducts.find(p => p.name === ri.description);
            const unitCost = product && product.costPrice != null ? Number(product.costPrice) : 0;

            const lineRevenue = unitPrice * qty;
            const lineProfit  = (unitPrice - unitCost) * qty;
            const isDamaged   = String(ri.reason || '').toLowerCase() === 'damaged';

            returnedUnits  += qty;
            returnedValue  += lineRevenue;
            // Non-damaged: cancel out the original profit (item is back in stock, ready to resell).
            // Damaged: lose the cost too — total profit delta is the whole sale price.
            returnProfitDelta += isDamaged ? lineRevenue : lineProfit;

            // By reason (units)
            const reason = ri.reason || 'Other';
            byReason.set(reason, (byReason.get(reason) || 0) + qty);

            // Subtract from byProduct stats (if found)
            if (byProduct.has(ri.description)) {
                const e = byProduct.get(ri.description);
                e.revenue -= lineRevenue;
                e.profit  -= isDamaged ? lineRevenue : lineProfit;
                e.qty     -= qty;
            }

            // Subtract from byCategory by product's category (if known)
            const cat = product ? product.category : 'Unknown';
            if (byCategory[cat] != null) byCategory[cat] -= lineRevenue;
        });
    });

    // Net (post-return) figures
    const netRevenue = revenue - returnedValue;
    const netProfit  = profit  - returnProfitDelta;

    return {
        // Net (return-adjusted) numbers shown as the primary KPIs
        revenue: netRevenue,
        profit:  netProfit,
        items:   items,            // items SOLD (gross — denominator of return rate)
        bills:   invoices.length,
        // Gross numbers retained for reference / debugging
        grossRevenue: revenue,
        grossProfit:  profit,
        returnedUnits,
        returnedValue,
        // The rest
        byProduct, byCategory, bySeller, byPayment, byDay,
        byWeekday, weekdayCount,
        byReason
    };
}

// ============== RENDER: KPI CARDS ==============
function renderKpis(curr, prev) {
    document.getElementById('kpiRevenue').textContent = fmtINR(curr.revenue);
    document.getElementById('kpiProfit').textContent  = fmtINR(curr.profit);
    document.getElementById('kpiBills').textContent   = curr.bills.toLocaleString('en-IN');
    document.getElementById('kpiItems').textContent   = curr.items.toLocaleString('en-IN');

    // Sub-line: profit margin %
    const margin = pct(curr.profit, curr.revenue);
    document.getElementById('kpiProfitSub').textContent = curr.revenue > 0
        ? margin.toFixed(1) + '% margin'
        : 'No revenue yet';

    // Sub-line for revenue: vs previous period
    const rDelta = pct(curr.revenue - prev.revenue, prev.revenue || 1);
    if (prev.revenue > 0) {
        const sub = document.getElementById('kpiRevenueSub');
        sub.textContent = (rDelta >= 0 ? '↑ ' : '↓ ') + Math.abs(rDelta).toFixed(1) + '% vs prev';
        sub.className = 'kpi-sub ' + (rDelta >= 0 ? 'up' : 'down');
    } else {
        document.getElementById('kpiRevenueSub').textContent = 'No prior data';
    }

    // Bills sub: avg bill value
    document.getElementById('kpiBillsSub').textContent = curr.bills > 0
        ? 'Avg ' + fmtINR(curr.revenue / curr.bills) + ' / bill'
        : 'No bills yet';

    // Items sub: avg per bill
    document.getElementById('kpiItemsSub').textContent = curr.bills > 0
        ? (curr.items / curr.bills).toFixed(1) + ' items/bill'
        : '—';

    // Return Rate KPI
    const rate     = pct(curr.returnedUnits || 0, curr.items || 1);
    const prevRate = pct(prev.returnedUnits || 0, prev.items || 1);
    const rateEl   = document.getElementById('kpiReturnRate');
    const subEl    = document.getElementById('kpiReturnRateSub');
    if (rateEl) rateEl.textContent = (curr.items > 0 ? rate.toFixed(1) : '0.0') + '%';
    if (subEl) {
        if (curr.returnedUnits > 0) {
            subEl.textContent = curr.returnedUnits + ' item(s) returned · ' + fmtINR(curr.returnedValue) + ' value';
        } else if (curr.items > 0) {
            subEl.textContent = 'No returns this period';
        } else {
            subEl.textContent = '—';
        }
    }
}

// ============== RENDER: CHARTS ==============
function destroyChart(name) {
    if (charts[name]) {
        charts[name].destroy();
        delete charts[name];
    }
}

function renderTrendChart(byDay) {
    destroyChart('trend');
    const dates = Array.from(byDay.keys()).sort();
    const data  = dates.map(d => byDay.get(d).revenue);

    const ctx = document.getElementById('chartTrend').getContext('2d');
    charts.trend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates.map(d => {
                const dt = new Date(d + 'T00:00:00');
                return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            }),
            datasets: [{
                label: 'Revenue',
                data,
                borderColor: PALETTE.primary,
                backgroundColor: hexToRgba(PALETTE.primary, 0.12),
                borderWidth: 2.5,
                tension: 0.35,
                fill: true,
                pointRadius: 3,
                pointBackgroundColor: PALETTE.primary,
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: ctx => 'Revenue: ' + fmtINR(ctx.parsed.y) }
                }
            },
            scales: {
                y: {
                    ticks: { callback: v => fmtINR(v), font: { size: 11 } },
                    grid: { color: '#f3f4f6' }
                },
                x: {
                    ticks: { font: { size: 11 }, maxRotation: 0, autoSkipPadding: 20 },
                    grid: { display: false }
                }
            }
        }
    });
}

function renderTopProductsChart(byProduct) {
    destroyChart('topProducts');
    const top = Array.from(byProduct.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

    const ctx = document.getElementById('chartTopProducts').getContext('2d');
    charts.topProducts = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top.map(p => truncate(p.name, 22)),
            datasets: [{
                label: 'Revenue',
                data: top.map(p => p.revenue),
                backgroundColor: top.map(p => CATEGORY_COLOR[p.category] || PALETTE.indigo),
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => 'Revenue: ' + fmtINR(ctx.parsed.x) + '  (' + top[ctx.dataIndex].qty + ' sold)'
                    }
                }
            },
            scales: {
                x: { ticks: { callback: v => fmtINR(v), font: { size: 11 } }, grid: { color: '#f3f4f6' } },
                y: { ticks: { font: { size: 11 } }, grid: { display: false } }
            }
        }
    });
}

function renderCategoryChart(byCategory) {
    destroyChart('category');
    const labels = ['Sarees', 'Dress Pieces'];
    const data   = labels.map(l => byCategory[l] || 0);

    const ctx = document.getElementById('chartCategory').getContext('2d');
    charts.category = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: [PALETTE.teal, PALETTE.primary],
                borderColor: '#fff',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { size: 12 }, padding: 12, usePointStyle: true, pointStyle: 'circle' }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ctx.label + ': ' + fmtINR(ctx.parsed) + '  (' + pct(ctx.parsed, data.reduce((a,b)=>a+b,0)).toFixed(1) + '%)'
                    }
                }
            }
        }
    });
}

function renderSellerChart(bySeller) {
    destroyChart('seller');
    const entries = Array.from(bySeller.entries()).sort((a,b) => b[1] - a[1]);
    const labels = entries.map(e => e[0] || 'Unknown');
    const data   = entries.map(e => e[1]);

    const ctx = document.getElementById('chartSeller').getContext('2d');
    charts.seller = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Revenue',
                data,
                backgroundColor: labels.map(l => l === 'Mokshitha Collections' ? PALETTE.teal : PALETTE.primary),
                borderRadius: 8,
                borderSkipped: false,
                maxBarThickness: 60
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => 'Revenue: ' + fmtINR(ctx.parsed.y) } }
            },
            scales: {
                y: { ticks: { callback: v => fmtINR(v), font: { size: 11 } }, grid: { color: '#f3f4f6' } },
                x: { ticks: { font: { size: 11 } }, grid: { display: false } }
            }
        }
    });
}

function renderPaymentChart(byPayment) {
    destroyChart('payment');
    const entries = Array.from(byPayment.entries()).sort((a,b) => b[1] - a[1]);
    const labels = entries.map(e => e[0] || 'Unknown');
    const data   = entries.map(e => e[1]);
    const colors = [PALETTE.primary, PALETTE.teal, PALETTE.amber, PALETTE.green, PALETTE.pink, PALETTE.blue];

    const ctx = document.getElementById('chartPayment').getContext('2d');
    charts.payment = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: labels.map((_, i) => colors[i % colors.length]),
                borderColor: '#fff',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 12, usePointStyle: true, pointStyle: 'circle' } },
                tooltip: {
                    callbacks: {
                        label: ctx => ctx.label + ': ' + fmtINR(ctx.parsed)
                    }
                }
            }
        }
    });
}

function renderReturnReasonsChart(byReason) {
    destroyChart('returnReasons');

    // Canonical order so colors stay consistent
    const REASONS = ['Damaged', 'Quality', 'Size', 'Color', 'Other'];
    const reasonColors = {
        'Damaged': PALETTE.red,
        'Quality': PALETTE.amber,
        'Size':    PALETTE.teal,
        'Color':   PALETTE.indigo,
        'Other':   '#9ca3af'
    };

    // Filter to reasons that have any data; preserve canonical order
    const present = REASONS.filter(r => (byReason.get(r) || 0) > 0);
    const data    = present.map(r => byReason.get(r));
    const colors  = present.map(r => reasonColors[r]);

    // Find the wrapper; we may have replaced contents with an empty-state message last time
    let canvas = document.getElementById('chartReturnReasons');
    let wrap   = canvas ? canvas.parentElement : document.querySelector('.chart-canvas-wrap [id="chartReturnReasons"], .chart-canvas-wrap');
    // Locate the right wrap reliably via the chart-card containing the heading
    if (!canvas) {
        const headings = document.querySelectorAll('.chart-card h3');
        headings.forEach(h => {
            if (h.textContent.includes('Return Reasons')) {
                wrap = h.parentElement.querySelector('.chart-canvas-wrap');
            }
        });
        if (wrap) {
            wrap.innerHTML = '<canvas id="chartReturnReasons"></canvas>';
            canvas = document.getElementById('chartReturnReasons');
        }
    }
    if (!canvas) return; // really shouldn't happen, defensive

    if (data.length === 0) {
        // Replace canvas with an empty-state message
        if (wrap) {
            wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--ink-muted);font-size:13px;font-style:italic;">No returns recorded in this period</div>';
        }
        return;
    }

    const ctx = canvas.getContext('2d');
    charts.returnReasons = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: present,
            datasets: [{
                data,
                backgroundColor: colors,
                borderColor: '#fff',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { size: 12 }, padding: 12, usePointStyle: true, pointStyle: 'circle' }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const total = data.reduce((a,b) => a+b, 0);
                            return ctx.label + ': ' + ctx.parsed + ' unit(s)  (' + pct(ctx.parsed, total).toFixed(1) + '%)';
                        }
                    }
                }
            }
        }
    });
}

function renderWeekdayChart(byWeekday, weekdayCount) {
    destroyChart('weekday');
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const avgs = byWeekday.map((sum, i) => weekdayCount[i] > 0 ? sum / weekdayCount[i] : 0);

    const ctx = document.getElementById('chartWeekday').getContext('2d');
    charts.weekday = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Avg Revenue',
                data: avgs,
                backgroundColor: avgs.map((v, i) => {
                    const max = Math.max(...avgs, 1);
                    return v === max && v > 0 ? PALETTE.green : PALETTE.primary;
                }),
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => 'Avg: ' + fmtINR(ctx.parsed.y) } }
            },
            scales: {
                y: { ticks: { callback: v => fmtINR(v), font: { size: 11 } }, grid: { color: '#f3f4f6' } },
                x: { ticks: { font: { size: 12, weight: 600 } }, grid: { display: false } }
            }
        }
    });
}

// ============== RENDER: TABLES ==============
function renderTopSellers(byProduct) {
    const tbody = document.getElementById('topSellersBody');
    const top = Array.from(byProduct.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

    if (top.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No sales data for this period</td></tr>';
        return;
    }

    tbody.innerHTML = top.map((p, i) => `
        <tr>
            <td><span class="rank-pill ${i < 3 ? 'top' + (i + 1) : ''}">${i + 1}</span></td>
            <td>${escapeHtml(p.name)}</td>
            <td><span class="badge ${p.category === 'Sarees' ? 'sarees' : 'dress'}">${p.category === 'Sarees' ? 'Saree' : 'Dress'}</span></td>
            <td class="right">${p.qty}</td>
            <td class="right"><strong>${fmtINR(p.revenue)}</strong></td>
            <td class="right" style="color: var(--green); font-weight: 600;">${fmtINR(p.profit)}</td>
        </tr>
    `).join('');
}

function renderSlowMovers() {
    // Slow movers = highest stock, lowest qty sold across ALL invoices (regardless of period filter)
    // — gives a real "this stock isn't moving" view
    const tbody = document.getElementById('slowMoversBody');

    // Compute total qty sold for each product across all time
    const soldMap = new Map();
    allInvoices.forEach(inv => {
        (inv.items || []).forEach(it => {
            soldMap.set(it.description, (soldMap.get(it.description) || 0) + Number(it.quantity || 0));
        });
    });

    // Filter products by current business filter
    const filtered = allProducts.filter(p => {
        if (filterState.business === 'both') return true;
        return p.category === filterState.business;
    });

    // Rank: products with stock > 0 sorted by sold ascending, then stock descending
    const slow = filtered
        .filter(p => p.quantity > 0)
        .map(p => ({ ...p, sold: soldMap.get(p.name) || 0 }))
        .sort((a, b) => a.sold - b.sold || b.quantity - a.quantity)
        .slice(0, 10);

    if (slow.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No inventory data</td></tr>';
        return;
    }

    tbody.innerHTML = slow.map(p => `
        <tr>
            <td>${escapeHtml(p.name)}</td>
            <td><span class="badge ${p.category === 'Sarees' ? 'sarees' : 'dress'}">${p.category === 'Sarees' ? 'Saree' : 'Dress'}</span></td>
            <td class="right"><strong>${p.quantity}</strong></td>
            <td class="right ${p.sold === 0 ? 'muted' : ''}">${p.sold === 0 ? 'never' : p.sold}</td>
        </tr>
    `).join('');
}

function renderDailyLog(byDay) {
    const tbody = document.getElementById('dailyLogBody');
    const rows = Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0]));

    if (rows.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No sales for this period</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map(([dateStr, day]) => {
        const dt = new Date(dateStr + 'T00:00:00');
        const fmtDate = dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        const bills   = day.billSet.size;
        const avg     = bills > 0 ? day.revenue / bills : 0;
        return `
            <tr>
                <td>${fmtDate}</td>
                <td class="right">${bills}</td>
                <td class="right">${day.items}</td>
                <td class="right"><strong>${fmtINR(day.revenue)}</strong></td>
                <td class="right" style="color: var(--green); font-weight: 600;">${fmtINR(day.profit)}</td>
                <td class="right muted">${fmtINR(avg)}</td>
            </tr>
        `;
    }).join('');
}

// ============== ORCHESTRATOR ==============
function renderEverything() {
    const filtered      = getFilteredInvoices();
    const filteredRet   = getFilteredReturns();
    const curr          = aggregate(filtered, filteredRet);

    // Compute previous-period for delta
    const { start, end } = getDateRange(filterState.period);
    const periodMs       = end - start;
    const prevEnd        = new Date(start.getTime() - 1);
    const prevStart      = new Date(prevEnd.getTime() - periodMs);
    const prevInvoices = allInvoices.filter(inv => {
        const d = parseInvoiceDate(inv);
        if (!d) return false;
        if (d < prevStart || d > prevEnd) return false;
        if (filterState.business !== 'both') {
            const expected = filterState.business === 'Sarees' ? 'Mokshitha Collections' : "Moksha's Studios";
            if (inv.sellerName !== expected) return false;
        }
        return true;
    });
    const prevReturns = (allReturns || []).filter(rt => {
        if (!rt.returnDate) return false;
        const d = new Date(rt.returnDate + 'T00:00:00');
        if (isNaN(d.getTime())) return false;
        if (d < prevStart || d > prevEnd) return false;
        if (filterState.business !== 'both') {
            const expected = filterState.business === 'Sarees' ? 'Mokshitha Collections' : "Moksha's Studios";
            if (rt.processedBy !== expected) return false;
        }
        return true;
    });
    const prev = aggregate(prevInvoices, prevReturns);

    renderKpis(curr, prev);
    renderTrendChart(curr.byDay);
    renderTopProductsChart(curr.byProduct);
    renderCategoryChart(curr.byCategory);
    renderSellerChart(curr.bySeller);
    renderPaymentChart(curr.byPayment);
    renderReturnReasonsChart(curr.byReason);
    renderWeekdayChart(curr.byWeekday, curr.weekdayCount);
    renderTopSellers(curr.byProduct);
    renderSlowMovers();
    renderDailyLog(curr.byDay);
}

// ============== HELPERS ==============
function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function hexToRgba(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// ============== FILTER UI WIRING ==============
function applyCustomRange() {
    const start = document.getElementById('customStart').value;
    const end   = document.getElementById('customEnd').value;
    if (!start || !end) {
        alert('Please pick both start and end dates.');
        return;
    }
    filterState.period      = 'custom';
    filterState.customStart = start;
    filterState.customEnd   = end;

    // Visually deselect all period chips when custom is active
    document.querySelectorAll('.chip.period').forEach(c => c.classList.remove('active'));

    renderEverything();
}

function wireFilters() {
    document.querySelectorAll('.chip.business').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip.business').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            filterState.business = chip.dataset.biz;
            renderEverything();
        });
    });

    document.querySelectorAll('.chip.period').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip.period').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            filterState.period = chip.dataset.period;
            // Clear custom dates so they don't override
            filterState.customStart = null;
            filterState.customEnd   = null;
            renderEverything();
        });
    });
}

// ============== BOOT ==============
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    wireFilters();
    loadAllData();
});