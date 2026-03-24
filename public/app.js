const API_BASE = '/api';

let authToken = localStorage.getItem('pos_token') || null;
let currentBusiness = localStorage.getItem('pos_business') || '';
let currentRole = localStorage.getItem('pos_role') || 'user';

// ==== AUTH LOGIC ====
const authOverlay = document.getElementById('auth-overlay');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

document.getElementById('switch-to-register').addEventListener('click', () => {
    loginForm.classList.remove('active');
    registerForm.classList.add('active');
    document.getElementById('auth-subtitle').textContent = "Register a new business";
});

document.getElementById('switch-to-login').addEventListener('click', () => {
    registerForm.classList.remove('active');
    loginForm.classList.add('active');
    document.getElementById('auth-subtitle').textContent = "Login to your account";
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || 'Login failed');
        
        loginSuccess(data.token, data.business_name, data.role);
    } catch(err) { alert(err.message); }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const business_name = document.getElementById('reg-businessName').value;
    const whatsapp_number = document.getElementById('reg-whatsapp').value;
    
    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, business_name, whatsapp_number })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || 'Registration failed');
        
        loginSuccess(data.token, data.business_name, data.role);
    } catch(err) { alert(err.message); }
});

function loginSuccess(token, businessName, role = 'user') {
    authToken = token;
    currentBusiness = businessName;
    currentRole = role;
    localStorage.setItem('pos_token', token);
    localStorage.setItem('pos_business', businessName);
    localStorage.setItem('pos_role', role);
    checkAuth();
}

document.getElementById('btn-logout').addEventListener('click', () => {
    authToken = null;
    currentBusiness = '';
    currentRole = 'user';
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_business');
    localStorage.removeItem('pos_role');
    checkAuth();
});

function checkAuth() {
    if (authToken) {
        authOverlay.classList.remove('active');
        document.getElementById('business-name-display').textContent = currentBusiness;
        
        if (currentRole === 'admin') {
            document.getElementById('nav-item-admin').style.display = 'block';
        } else {
            document.getElementById('nav-item-admin').style.display = 'none';
        }
        
        // Re-initialize data
        loadDashboard();
    } else {
        authOverlay.classList.add('active');
    }
}

// Wrapper for fetch requests to include Auth Header
async function fetchAuth(url, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    options.headers = headers;
    
    const res = await fetch(url, options);
    if (res.status === 401) {
        // Unauthorized, logout
        document.getElementById('btn-logout').click();
    }
    return res;
}

// ==== STATE ====
let products = [];
let currentBill = [];
let currentTab = 'dashboard-view';
let chartInstance = null;
let currentProductImageBase64 = null;
let html5QrCode = null;
let isScanTorchOn = false;

// ==== DOM ELEMENTS ====
const clockEl = document.getElementById('clock');
const navLinks = document.querySelectorAll('.nav-link');
const views = document.querySelectorAll('.view');
const pageTitle = document.getElementById('page-title');
const modalOverlay = document.getElementById('modal-overlay');
const productModal = document.getElementById('product-modal');
const invoiceModal = document.getElementById('invoice-modal');
const adminUserModal = document.getElementById('admin-user-modal');

// ==== INITIALIZATION ====
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    checkAuth();
    updateClock();
    setInterval(updateClock, 1000);
    
    setupNavigation();
    setupModals();
    setupPOSTabs();
    setupBarcodeScanner();
});

function initTheme() {
    const savedTheme = localStorage.getItem('pos_theme') || 'light';
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const toggleIcon = btnThemeToggle.querySelector('i');

    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        toggleIcon.classList.replace('bx-moon', 'bx-sun');
    }

    btnThemeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        if (isDark) {
            localStorage.setItem('pos_theme', 'dark');
            toggleIcon.classList.replace('bx-moon', 'bx-sun');
        } else {
            localStorage.setItem('pos_theme', 'light');
            toggleIcon.classList.replace('bx-sun', 'bx-moon');
        }
    });
}

function setupBarcodeScanner() {
    const barcodeInput = document.getElementById('pos-barcode-input');
    if (barcodeInput) {
        barcodeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const barcode = e.target.value.trim();
                if (barcode) {
                    const product = products.find(p => p.barcode === barcode);
                    if (product) {
                        addToBill(product);
                        e.target.value = '';
                    } else {
                        alert('Product not found with this barcode.');
                    }
                }
            }
        });
    }

    // Global listener for physical barcode scanner
    let barcodeBuffer = '';
    let barcodeTimer = null;
    document.addEventListener('keypress', (e) => {
        if (currentTab !== 'pos-view') return;
        
        // Ignore if the user is typing in another input/textarea (except our barcode input)
        const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
        if (isInput && e.target.id !== 'pos-barcode-input') return;

        if (e.key === 'Enter') {
            if (barcodeBuffer) {
                // If they typed in the barcode input, it's handled by its own event, but we can clear buffer
                if (e.target.id !== 'pos-barcode-input') {
                    const product = products.find(p => p.barcode === barcodeBuffer);
                    if (product) {
                        addToBill(product);
                    } else {
                        // Optional: alert('Product not found with this barcode.');
                    }
                }
                barcodeBuffer = '';
            }
        } else {
            barcodeBuffer += e.key;
            clearTimeout(barcodeTimer);
            // Barcode scanners type very quickly, within a few milliseconds.
            barcodeTimer = setTimeout(() => {
                barcodeBuffer = '';
            }, 100); 
        }
    });

    const btnCamera = document.getElementById('btn-camera-scan');
    const scannerModal = document.getElementById('scanner-modal');
    
    if (btnCamera && scannerModal) {
        btnCamera.addEventListener('click', () => {
            showModal(scannerModal);
            startScanner();
        });

        document.getElementById('btn-toggle-torch').addEventListener('click', async () => {
            if (html5QrCode && html5QrCode.getState() === 2) { // 2 = SCANNING
                try {
                    isScanTorchOn = !isScanTorchOn;
                    await html5QrCode.applyVideoConstraints({ advanced: [{ torch: isScanTorchOn }] });
                    const icon = document.querySelector('#btn-toggle-torch i');
                    if(isScanTorchOn) {
                        icon.classList.remove('bx-bolt-circle');
                        icon.classList.add('bxs-bolt-circle');
                        icon.style.color = '#fbbf24'; // Yellow lighting
                    } else {
                        icon.classList.remove('bxs-bolt-circle');
                        icon.classList.add('bx-bolt-circle');
                        icon.style.color = '';
                    }
                } catch (err) {
                    alert('Torch/Flashlight is not supported on this device or camera.');
                    isScanTorchOn = !isScanTorchOn; // revert state
                }
            }
        });

        document.getElementById('btn-restart-scan').addEventListener('click', () => {
            if (html5QrCode) {
                try {
                    if (html5QrCode.getState() === 2) {
                        html5QrCode.stop().then(() => {
                            isScanTorchOn = false;
                            document.querySelector('#btn-toggle-torch i').classList.replace('bxs-bolt-circle', 'bx-bolt-circle');
                            document.querySelector('#btn-toggle-torch i').style.color = '';
                            startScanner();
                        });
                    } else {
                        startScanner();
                    }
                } catch(e) { console.error(e); }
            }
        });
    }
}

function startScanner() {
    if (!html5QrCode) {
        // Need to clear reader div just in case it retains weird states
        document.getElementById('reader').innerHTML = '';
        html5QrCode = new Html5Qrcode("reader");
    }
    
    if (html5QrCode.getState() === 2) return; // already scanning

    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText, decodedResult) => {
            // Success handler
            const product = products.find(p => p.barcode === decodedText);
            if (product) {
                // Flash success color briefly
                document.getElementById('reader').style.boxShadow = "inset 0 0 0 10px #10b981";
                setTimeout(() => { document.getElementById('reader').style.boxShadow = "none"; }, 500);
                
                addToBill(product);
                
                // Close the modal after successful scan
                hideModal();
            } else {
                document.getElementById('reader').style.boxShadow = "inset 0 0 0 10px #ef4444";
                setTimeout(() => { document.getElementById('reader').style.boxShadow = "none"; }, 500);
                // alert(`Scanned barcode ${decodedText} not found in inventory.`);
            }
        },
        (errorMessage) => {
            // Ignore parse errors as it scans frames without barcodes
        }
    ).catch(err => {
        console.error("Camera access failed", err);
        alert("Unable to access camera. Please ensure permissions are granted.");
    });
}

function setupPOSTabs() {
    const tabItems = document.getElementById('tab-btn-items');
    const tabCustomer = document.getElementById('tab-btn-customer');
    const panelItems = document.getElementById('pos-bill-items');
    const panelCustomer = document.getElementById('pos-customer-details');
    
    if (tabItems && tabCustomer) {
        tabItems.addEventListener('click', () => {
            tabItems.classList.add('active');
            tabCustomer.classList.remove('active');
            panelItems.style.display = 'block';
            panelCustomer.style.display = 'none';
        });

        tabCustomer.addEventListener('click', () => {
            tabCustomer.classList.add('active');
            tabItems.classList.remove('active');
            panelItems.style.display = 'none';
            panelCustomer.style.display = 'block';
        });
    }
}

function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + now.toLocaleDateString();
}

function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            const target = link.getAttribute('data-target');
            views.forEach(view => view.classList.remove('active'));
            document.getElementById(target).classList.add('active');
            
            pageTitle.textContent = link.querySelector('.link-name').textContent;
            currentTab = target;
            
            // Load specific view data
            if(target === 'dashboard-view') loadDashboard();
            if(target === 'inventory-view') loadInventory();
            if(target === 'pos-view') loadPOS();
            if(target === 'invoices-view') loadInvoices();
            if(target === 'reports-view') loadReports();
            if(target === 'admin-view') loadAdminUsers();
        });
    });
    
    // ==== MARKETPLACE ====
    const btnMarketplace = document.getElementById('btn-create-marketplace');
    if (btnMarketplace) {
        btnMarketplace.addEventListener('click', async () => {
            try {
                const res = await fetchAuth(`${API_BASE}/marketplace/enable`, { method: 'POST' });
                if (res.ok) {
                    const domain = window.location.origin;
                    const url = `${domain}/${encodeURIComponent(currentBusiness)}`;
                    // Open the marketplace URL in a new window immediately
                    window.open(url, '_blank');
                } else {
                    alert('Failed to enable marketplace. Make sure you have restarted your server.');
                }
            } catch (err) {
                console.error(err);
                alert('Error enabling marketplace. Did you restart the server?');
            }
        });
    }
}

function setupModals() {
    document.getElementById('btn-close-modal').addEventListener('click', hideModal);
    document.getElementById('btn-close-invoice-modal').addEventListener('click', hideModal);
    document.getElementById('btn-close-admin-modal').addEventListener('click', hideModal);
    
    // Add product
    document.getElementById('btn-add-product').addEventListener('click', () => {
        document.getElementById('product-form').reset();
        document.getElementById('product-id').value = '';
        document.getElementById('product-barcode').value = '';
        currentProductImageBase64 = null;
        document.getElementById('product-image-preview').innerHTML = '<span style="color:var(--text-muted);font-size:12px;">+ Add Image</span>';
        document.getElementById('product-modal-title').textContent = 'Add Product';
        showModal(productModal);
    });

    // Handle Image Selection
    document.getElementById('product-image').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 400;
                const MAX_HEIGHT = 400;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                currentProductImageBase64 = dataUrl;
                document.getElementById('product-image-preview').innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`;
            }
            img.src = event.target.result;
        }
        reader.readAsDataURL(file);
    });

    // Handle Product Form
    document.getElementById('product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('product-id').value;
        const name = document.getElementById('product-name').value;
        const barcode = document.getElementById('product-barcode').value;
        const qty = document.getElementById('product-qty').value;
        const cost_price = document.getElementById('product-cost-price').value;
        const price = document.getElementById('product-price').value;
        
        const payload = { 
            name,
            barcode,
            quantity: parseInt(qty), 
            cost_price: parseFloat(cost_price) || 0,
            price: parseFloat(price),
            image: currentProductImageBase64
        };
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/products/${id}` : `${API_BASE}/products`;
        
        try {
            await fetchAuth(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            hideModal();
            loadInventory();
        } catch (err) {
            console.error(err);
            alert('Error saving product');
        }
    });

    // Print Receipt logic
    document.getElementById('btn-print-receipt').addEventListener('click', () => {
        window.print();
    });
    
    // Admin User Edit Form
    document.getElementById('admin-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('admin-user-id').value;
        const business_name = document.getElementById('admin-business-name').value;
        const email = document.getElementById('admin-email').value;
        const whatsapp_number = document.getElementById('admin-whatsapp').value;
        const marketplace_enabled = document.getElementById('admin-marketplace-enabled').checked;
        
        try {
            await fetchAuth(`${API_BASE}/admin/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ business_name, email, whatsapp_number, marketplace_enabled })
            });
            hideModal();
            loadAdminUsers();
        } catch (err) {
            console.error(err);
            alert('Error updating user');
        }
    });
}

function showModal(modal) {
    modalOverlay.classList.add('active');
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    modal.classList.add('active');
}

function hideModal() {
    modalOverlay.classList.remove('active');
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    
    // Stop the custom barcode camera stream
    if (html5QrCode && html5QrCode.getState() === 2) {
        html5QrCode.stop().then(() => {
            isScanTorchOn = false;
            try {
                document.querySelector('#btn-toggle-torch i').classList.replace('bxs-bolt-circle', 'bx-bolt-circle');
                document.querySelector('#btn-toggle-torch i').style.color = '';
            } catch(e){}
        }).catch(err => console.error(err));
    }
}

// ==== UTILS ====
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'LKR' }).format(amount).replace('LKR', 'Rs.');
}

function exportToCSV(filename, rows) {
    let processRow = function(row) {
        let finalVal = '';
        for (let j = 0; j < row.length; j++) {
            let innerValue = row[j] === null ? '' : row[j].toString();
            if (row[j] instanceof Date) { innerValue = row[j].toLocaleString(); }
            let result = innerValue.replace(/"/g, '""');
            if (result.search(/("|,|\n)/g) >= 0) result = '"' + result + '"';
            if (j > 0) finalVal += ',';
            finalVal += result;
        }
        return finalVal + '\n';
    };

    let csvFile = '';
    for (let i = 0; i < rows.length; i++) {
        csvFile += processRow(rows[i]);
    }

    let blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
    let link = document.createElement("a");
    if (link.download !== undefined) {
        let url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// ==== DASHBOARD ====
async function loadDashboard() {
    if (!authToken) return;
    try {
        const res = await fetchAuth(`${API_BASE}/dashboard`);
        const stats = await res.json();
        
        document.getElementById('dash-bills-today').textContent = stats.totalBillsToday;
        document.getElementById('dash-bills-month').textContent = stats.totalBillsMonth;
        document.getElementById('dash-income-today').textContent = formatCurrency(stats.dailyIncome);
        document.getElementById('dash-profit-today').textContent = formatCurrency(stats.dailyProfit || 0);
        document.getElementById('dash-income-month').textContent = formatCurrency(stats.monthlyIncome);
        document.getElementById('dash-profit-month').textContent = formatCurrency(stats.monthlyProfit || 0);
        document.getElementById('dash-total-products').textContent = stats.totalProducts;
        document.getElementById('dash-low-stock').textContent = stats.lowStockProducts;

        // Load low stock table
        const resAlerts = await fetchAuth(`${API_BASE}/dashboard/low-stock`);
        const alerts = await resAlerts.json();
        const tbody = document.querySelector('#low-stock-table tbody');
        tbody.innerHTML = '';
        
        alerts.forEach(item => {
            const tr = document.createElement('tr');
            let nameHTML = `<td>${item.name}</td>`;
            if (currentRole === 'admin') {
                nameHTML = `<td>${item.name} <div style="font-size:11px;color:var(--primary);margin-top:2px;">[${item.owner_name}]</div></td>`;
            }
            
            tr.innerHTML = `
                ${nameHTML}
                <td class="text-danger">${item.quantity}</td>
                <td>${formatCurrency(item.price)}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

// ==== INVENTORY ====
let adminInventoryFilter = null;

async function loadInventory() {
    try {
        const res = await fetchAuth(`${API_BASE}/products`);
        products = await res.json();
        const tbody = document.querySelector('#inventory-table tbody');
        tbody.innerHTML = '';
        
        // Handle admin inventory filtering
        let productsToRender = products;
        const filterBadge = document.getElementById('inventory-filter-badge');
        if (currentRole === 'admin' && adminInventoryFilter) {
            productsToRender = products.filter(p => p.owner_name === adminInventoryFilter);
            document.getElementById('inventory-filter-name').textContent = adminInventoryFilter;
            filterBadge.style.display = 'flex';
        } else {
            filterBadge.style.display = 'none';
        }
        
        productsToRender.forEach(p => {
            const imgHtml = p.image ? `<img src="${p.image}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;">` : `<div style="width:40px;height:40px;border-radius:8px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#64748b;">No Img</div>`;
            const tr = document.createElement('tr');
            
            let nameDisplay = `<span>${p.name}</span>`;
            if (currentRole === 'admin') {
                nameDisplay = `<div><span>${p.name}</span><div style="font-size:11px;color:var(--primary);margin-top:2px;">[${p.owner_name}]</div></div>`;
            }
            
            tr.innerHTML = `
                <td style="display:flex;align-items:center;gap:12px;">${imgHtml} ${nameDisplay}</td>
                <td class="${p.quantity <= 10 ? 'text-danger' : ''}">${p.quantity}</td>
                <td>${formatCurrency(p.cost_price || 0)}</td>
                <td>${formatCurrency(p.price)}</td>
                <td>
                    <button class="btn btn-outline btn-icon-only edit-btn" data-id="${p.id}"><i class='bx bx-edit'></i></button>
                    <button class="btn btn-danger btn-icon-only del-btn" data-id="${p.id}"><i class='bx bx-trash'></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (err) {
        console.error(err);
    }
}

document.getElementById('btn-clear-inventory-filter').addEventListener('click', () => {
    adminInventoryFilter = null;
    loadInventory();
});

// Event Delegation for Edit and Delete buttons
document.querySelector('#inventory-table tbody').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) {
        editProduct(editBtn.dataset.id);
        return;
    }
    
    const delBtn = e.target.closest('.del-btn');
    if (delBtn) {
        deleteProduct(delBtn.dataset.id);
    }
});

function editProduct(id) {
    const p = products.find(prod => prod.id == id);
    if(p) {
        document.getElementById('product-id').value = p.id;
        document.getElementById('product-name').value = p.name;
        document.getElementById('product-barcode').value = p.barcode || '';
        document.getElementById('product-qty').value = p.quantity;
        document.getElementById('product-cost-price').value = p.cost_price || 0;
        document.getElementById('product-price').value = p.price;
        
        currentProductImageBase64 = p.image || null;
        if (p.image) {
            document.getElementById('product-image-preview').innerHTML = `<img src="${p.image}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`;
        } else {
            document.getElementById('product-image-preview').innerHTML = '<span style="color:var(--text-muted);font-size:12px;">+ Add Image</span>';
        }
        
        document.getElementById('product-modal-title').textContent = 'Edit Product';
        showModal(productModal);
    }
}

async function deleteProduct(id) {
    if(confirm('Are you sure you want to delete this product?')) {
        try {
            await fetchAuth(`${API_BASE}/products/${id}`, { method: 'DELETE' });
            loadInventory();
        } catch (err) { console.error(err); }
    }
}

document.getElementById('btn-export-inventory').addEventListener('click', () => {
    const csvData = [['Item Name', 'Quantity', 'Price']];
    products.forEach(p => csvData.push([p.name, p.quantity, p.price]));
    exportToCSV('products.csv', csvData);
});

// ==== POS (NEW BILL) ====
async function loadPOS() {
    currentBill = [];
    updateBillUI();
    document.getElementById('pos-search-input').value = '';
    
    try {
        const res = await fetchAuth(`${API_BASE}/products`);
        products = await res.json();
        renderPOSProducts(products);
    } catch (err) {
        console.error(err);
    }
}

function renderPOSProducts(productArray) {
    const grid = document.getElementById('pos-products-grid');
    grid.innerHTML = '';
    
    productArray.forEach(p => {
        const div = document.createElement('div');
        div.className = 'pos-product-card';
        const imgStyle = p.image ? `background-image:url('${p.image}');background-size:cover;background-position:center;` : `background:#e2e8f0;`;
        div.innerHTML = `
            <div style="width:100%;height:100px;border-radius:8px;margin-bottom:12px;${imgStyle}"></div>
            <h4>${p.name}</h4>
            <div class="price">${formatCurrency(p.price)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Stock: ${p.quantity}</div>
        `;
        div.addEventListener('click', () => addToBill(p));
        grid.appendChild(div);
    });
}

document.getElementById('pos-search-input').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = products.filter(p => p.name.toLowerCase().includes(term));
    renderPOSProducts(filtered);
});

function addToBill(product) {
    if (product.quantity <= 0) {
        alert('Product out of stock!');
        return;
    }
    
    const existing = currentBill.find(item => item.id === product.id);
    if (existing) {
        if (existing.quantity >= product.quantity) {
             alert('Cannot add more than available stock!');
             return;
        }
        existing.quantity++;
    } else {
        currentBill.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            maxQty: product.quantity
        });
    }
    updateBillUI();
}

function updateBillQuantity(id, change) {
    const item = currentBill.find(i => i.id === id);
    if (item) {
        const newQty = item.quantity + change;
        if (newQty > 0 && newQty <= item.maxQty) {
            item.quantity = newQty;
        } else if (newQty === 0) {
            currentBill = currentBill.filter(i => i.id !== id);
        } else {
             alert('Cannot exceed available stock!');
        }
        updateBillUI();
    }
}

function updateBillPrice(id, newPrice) {
    const item = currentBill.find(i => i.id === id);
    if (item) {
        item.price = parseFloat(newPrice) || 0;
        updateBillUI();
    }
}

function updateBillUI() {
    const itemsContainer = document.getElementById('pos-bill-items');
    itemsContainer.innerHTML = '';
    let total = 0;
    
    currentBill.forEach(item => {
        const amount = item.price * item.quantity;
        total += amount;
        
        const div = document.createElement('div');
        div.className = 'bill-item';
        div.innerHTML = `
            <div class="bill-item-details">
                <h4>${item.name}</h4>
                <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                    <input type="number" step="0.01" value="${item.price}" 
                           onchange="updateBillPrice('${item.id}', this.value)" 
                           style="width:80px; padding:4px; font-size:13px; border:1px solid var(--border); border-radius:4px;"> 
                    <span style="font-size:13px; color:var(--text-muted)">x ${item.quantity}</span>
                </div>
            </div>
            <div class="bill-item-actions">
                <div class="qty-control">
                    <button class="qty-btn" onclick="updateBillQuantity('${item.id}', -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="qty-btn" onclick="updateBillQuantity('${item.id}', 1)">+</button>
                </div>
                <div class="item-total">${formatCurrency(amount)}</div>
            </div>
        `;
        itemsContainer.appendChild(div);
    });
    
    document.getElementById('pos-total-amount').textContent = formatCurrency(total);
}

document.getElementById('btn-submit-bill').addEventListener('click', async () => {
    if (currentBill.length === 0) {
        alert('Bill is empty!');
        return;
    }
    
    let total = currentBill.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const customer_name = document.getElementById('pos-customer-name').value;
    const customer_phone = document.getElementById('pos-customer-phone').value;
    const payment_method = document.getElementById('pos-payment-method').value;
    
    const payload = {
        items: currentBill,
        total_amount: total,
        customer_name,
        customer_phone,
        payment_method
    };
    
    try {
        const res = await fetchAuth(`${API_BASE}/invoices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) throw new Error('Failed to create invoice');
        
        const data = await res.json();
        
        // Print
        showInvoicePrintout(data.invoice);
        
        // Clear bill
        currentBill = [];
        document.getElementById('pos-customer-name').value = '';
        document.getElementById('pos-customer-phone').value = '';
        document.getElementById('pos-payment-method').value = 'Cash';
        updateBillUI();
        
        // Reload products cache
        fetchAuth(`${API_BASE}/products`).then(r => r.json()).then(p => products = p);
        
    } catch (err) {
        console.error(err);
        alert('Error saving bill');
    }
});

function showInvoicePrintout(invoice) {
    document.getElementById('receipt-no').textContent = invoice.invoice_number;
    document.getElementById('receipt-date').textContent = invoice.date;
    document.getElementById('receipt-time').textContent = invoice.time;
    document.getElementById('receipt-payment-method').textContent = invoice.payment_method || 'Cash';
    
    if (invoice.customer_name || invoice.customer_phone) {
        if (invoice.customer_name) {
            document.getElementById('receipt-customer-row').style.display = 'block';
            document.getElementById('receipt-customer-name').textContent = invoice.customer_name;
        } else {
            document.getElementById('receipt-customer-row').style.display = 'none';
        }
        if (invoice.customer_phone) {
            document.getElementById('receipt-phone-row').style.display = 'block';
            document.getElementById('receipt-customer-phone').textContent = invoice.customer_phone;
        } else {
            document.getElementById('receipt-phone-row').style.display = 'none';
        }
    } else {
        document.getElementById('receipt-customer-row').style.display = 'none';
        document.getElementById('receipt-phone-row').style.display = 'none';
    }
    
    const tbody = document.querySelector('#receipt-items tbody');
    tbody.innerHTML = '';
    
    let total = 0;
    invoice.items.forEach(item => {
        const amt = item.price * item.quantity;
        total += amt;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.product_name || item.name}</td>
            <td>${item.quantity}</td>
            <td>${item.price}</td>
            <td>${amt}</td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('receipt-total-amount').textContent = total.toFixed(2);
    
    // Automatically open modal and print dialog as per rules
    showModal(invoiceModal);
    setTimeout(() => {
        window.print();
    }, 500);
}

// ==== INVOICES ====
let invoicesList = [];

async function loadInvoices() {
    const dateFilter = document.getElementById('filter-date').value;
    const monthFilter = document.getElementById('filter-month').value;
    
    let url = `${API_BASE}/invoices`;
    if (dateFilter) url += `?date=${dateFilter}`;
    else if (monthFilter) url += `?month=${monthFilter}`;
    
    try {
        const res = await fetchAuth(url);
        invoicesList = await res.json();
        const tbody = document.querySelector('#invoices-table tbody');
        tbody.innerHTML = '';
        
        invoicesList.forEach(inv => {
            const tr = document.createElement('tr');
            let adminActions = '';
            let invDisplay = inv.invoice_number;
            if (currentRole === 'admin') {
                invDisplay += `<div style="font-size:11px;color:var(--primary);margin-top:2px;">[${inv.owner_name}]</div>`;
                adminActions = `<button class="btn btn-danger btn-icon-only delete-invoice-btn" style="margin-left: 4px;" data-id="${inv.id}"><i class='bx bx-trash'></i></button>`;
            }
            
            tr.innerHTML = `
                <td>${invDisplay}</td>
                <td>${inv.date}</td>
                <td>${inv.time}</td>
                <td style="font-weight:bold">${formatCurrency(inv.total_amount)}</td>
                <td style="color: #15803d; font-weight:bold">${formatCurrency(inv.total_profit || 0)}</td>
                <td>
                    <button class="btn btn-outline btn-icon-only view-invoice-btn" data-id="${inv.id}"><i class='bx bx-show'></i></button>
                    <button class="btn btn-primary btn-icon-only print-invoice-btn" data-id="${inv.id}"><i class='bx bx-printer'></i></button>
                    ${adminActions}
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.view-invoice-btn, .print-invoice-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                try {
                    const res = await fetchAuth(`${API_BASE}/invoices/${id}`);
                    const inv = await res.json();
                    showInvoicePrintout(inv);
                } catch(err) { console.error(err); }
            });
        });
        
        document.querySelectorAll('.delete-invoice-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(confirm('Are you sure you want to delete this invoice? (This will restock the inventory automatically)')) {
                    const id = e.currentTarget.dataset.id;
                    try {
                        await fetchAuth(`${API_BASE}/invoices/${id}`, { method: 'DELETE' });
                        loadInvoices();
                    } catch(err) { console.error(err); }
                }
            });
        });
        
    } catch (err) {
        console.error(err);
    }
}

document.getElementById('filter-date').addEventListener('change', () => {
    document.getElementById('filter-month').value = '';
    loadInvoices();
});
document.getElementById('filter-month').addEventListener('change', () => {
    document.getElementById('filter-date').value = '';
    loadInvoices();
});
document.getElementById('btn-clear-filters').addEventListener('click', () => {
    document.getElementById('filter-date').value = '';
    document.getElementById('filter-month').value = '';
    loadInvoices();
});

document.getElementById('btn-export-invoices').addEventListener('click', () => {
    const csvData = [['Invoice Number', 'Date', 'Time', 'Total Amount']];
    invoicesList.forEach(i => csvData.push([i.invoice_number, i.date, i.time, i.total_amount]));
    exportToCSV('invoices.csv', csvData);
});

// ==== REPORTS ====
let currentReportMode = 'sales';

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(td => td.classList.remove('active'));
        e.target.classList.add('active');
        currentReportMode = e.target.getAttribute('data-report');
        loadReports();
    });
});

async function loadReports() {
    const thead = document.querySelector('#reports-table document, #reports-table thead');
    const tbody = document.querySelector('#reports-table tbody');
    tbody.innerHTML = '';
    
    try {
        if (currentReportMode === 'sales') {
            thead.innerHTML = `<tr><th>Date</th><th>Total Sales</th><th>Profit</th></tr>`;
            const res = await fetchAuth(`${API_BASE}/reports/sales`);
            const data = await res.json();
            data.forEach(row => {
               const tr = document.createElement('tr');
               tr.innerHTML = `<td>${row.date}</td><td>${formatCurrency(row.total_sales)}</td><td style="color: #15803d; font-weight:bold">${formatCurrency(row.total_profit || 0)}</td>`;
               tbody.appendChild(tr);
            });
        } else {
            thead.innerHTML = `<tr><th>Product Name</th><th>Quantity Sold</th><th>Revenue</th><th>Profit</th></tr>`;
            const res = await fetchAuth(`${API_BASE}/reports/product-sales`);
            const data = await res.json();
            data.forEach(row => {
               const tr = document.createElement('tr');
               tr.innerHTML = `<td>${row.product_name}</td><td>${row.quantity_sold}</td><td>${formatCurrency(row.revenue)}</td><td style="color: #15803d; font-weight:bold">${formatCurrency(row.profit || 0)}</td>`;
               tbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error(err);
    }
}

// ==== ADMIN VIEW ====
let adminUsersList = [];

async function loadAdminUsers() {
    try {
        const res = await fetchAuth(`${API_BASE}/admin/users`);
        adminUsersList = await res.json();
        
        const tbody = document.querySelector('#admin-users-table tbody');
        tbody.innerHTML = '';
        
        adminUsersList.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.business_name}</td>
                <td>${user.email}</td>
                <td>${user.marketplace_enabled ? '<span class="text-success" style="color:var(--success);font-weight:600;">Enabled</span>' : '<span class="text-muted">Disabled</span>'}</td>
                <td>
                    <button class="btn btn-outline btn-icon-only view-user-inventory-btn" data-id="${user.id}" title="View Inventory"><i class='bx bx-box'></i></button>
                    <button class="btn btn-outline btn-icon-only admin-edit-btn" data-id="${user.id}" title="Edit User"><i class='bx bx-edit'></i></button>
                    <button class="btn btn-danger btn-icon-only admin-del-btn" data-id="${user.id}" title="Delete User"><i class='bx bx-trash'></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

// Event Delegation for Admin Users Edit/Delete
document.querySelector('#admin-users-table tbody').addEventListener('click', async (e) => {
    const viewInvBtn = e.target.closest('.view-user-inventory-btn');
    if (viewInvBtn) {
        const id = viewInvBtn.dataset.id;
        const user = adminUsersList.find(u => u.id === id);
        if (user) {
            // Set filter and switch tabs
            adminInventoryFilter = user.business_name;
            
            navLinks.forEach(l => l.classList.remove('active'));
            document.querySelector('[data-target="inventory-view"]').classList.add('active');
            
            views.forEach(v => v.classList.remove('active'));
            document.getElementById('inventory-view').classList.add('active');
            
            pageTitle.textContent = "Inventory";
            currentTab = 'inventory-view';
            loadInventory();
        }
        return;
    }

    const editBtn = e.target.closest('.admin-edit-btn');
    if (editBtn) {
        const id = editBtn.dataset.id;
        const user = adminUsersList.find(u => u.id === id);
        if (user) {
            document.getElementById('admin-user-id').value = user.id;
            document.getElementById('admin-business-name').value = user.business_name;
            document.getElementById('admin-email').value = user.email;
            document.getElementById('admin-whatsapp').value = user.whatsapp_number || '';
            document.getElementById('admin-marketplace-enabled').checked = user.marketplace_enabled;
            showModal(adminUserModal);
        }
        return;
    }
    
    const delBtn = e.target.closest('.admin-del-btn');
    if (delBtn) {
        if(confirm('Are you sure you want to permanently delete this user and ALL their data (products, invoices)?')) {
            try {
                await fetchAuth(`${API_BASE}/admin/users/${delBtn.dataset.id}`, { method: 'DELETE' });
                loadAdminUsers();
            } catch (err) { console.error(err); }
        }
    }
});
