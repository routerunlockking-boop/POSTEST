const API_BASE = '/api';

let authToken = localStorage.getItem('pos_token') || null;
let currentBusiness = localStorage.getItem('pos_business') || '';
let currentRole = localStorage.getItem('pos_role') || 'user';

// ==== AUTH LOGIC ====
const authOverlay = document.getElementById('auth-overlay');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const forgotPasswordForm = document.getElementById('forgot-password-form');

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.style.padding = '14px 20px';
    toast.style.borderRadius = '8px';
    toast.style.color = '#fff';
    toast.style.fontWeight = '500';
    toast.style.fontSize = '14px';
    toast.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    toast.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '10px';

    if (type === 'success') {
        toast.style.backgroundColor = '#10b981';
        toast.innerHTML = `<i class='bx bx-check-circle' style='font-size: 20px;'></i> <span>${message}</span>`;
    } else {
        toast.style.backgroundColor = '#ef4444';
        toast.innerHTML = `<i class='bx bx-error-circle' style='font-size: 20px;'></i> <span>${message}</span>`;
    }

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 400);
    }, 4500);
}

document.getElementById('switch-to-register').addEventListener('click', () => {
    loginForm.classList.remove('active');
    registerForm.classList.add('active');
    document.getElementById('auth-subtitle').textContent = "Register a new business";
});

document.getElementById('switch-to-login').addEventListener('click', () => {
    registerForm.classList.remove('active');
    if (forgotPasswordForm) forgotPasswordForm.classList.remove('active');
    loginForm.classList.add('active');
    document.getElementById('auth-subtitle').textContent = "Login to your account";
});

document.getElementById('switch-to-forgot').addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.remove('active');
    registerForm.classList.remove('active');
    forgotPasswordForm.classList.add('active');
    document.getElementById('auth-subtitle').textContent = "Reset your password";
});

document.getElementById('switch-to-login-from-reset').addEventListener('click', () => {
    forgotPasswordForm.classList.remove('active');
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
    } catch(err) { showToast(err.message, 'error'); }
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
        
        showToast(data.message, 'success');
        document.getElementById('switch-to-login').click();
    } catch(err) { showToast(err.message, 'error'); }
});

if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reset-email').value;
        const business_name = document.getElementById('reset-business').value;
        const new_password = document.getElementById('reset-password').value;
        
        try {
            const res = await fetch(`${API_BASE}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, business_name, new_password })
            });
            const data = await res.json();
            if(!res.ok) throw new Error(data.error || 'Password reset failed');
            
            showToast(data.message, 'success');
            document.getElementById('switch-to-login-from-reset').click();
            forgotPasswordForm.reset();
        } catch(err) { showToast(err.message, 'error'); }
    });
}

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
            if (document.getElementById('tab-btn-account')) document.getElementById('tab-btn-account').style.display = 'none';
        } else {
            document.getElementById('nav-item-admin').style.display = 'none';
            if (document.getElementById('tab-btn-account')) document.getElementById('tab-btn-account').style.display = 'inline-block';
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
let currentScanMode = 'billing'; // 'billing' or 'addProduct'
let vouchers = [];
let appliedVoucher = null;

// ==== DOM ELEMENTS ====
const clockEl = document.getElementById('clock');
const navLinks = document.querySelectorAll('.nav-link');
const views = document.querySelectorAll('.view');
const pageTitle = document.getElementById('page-title');
const modalOverlay = document.getElementById('modal-overlay');
const productModal = document.getElementById('product-modal');
const invoiceModal = document.getElementById('invoice-modal');
const adminUserModal = document.getElementById('admin-user-modal');
const customerModal = document.getElementById('customer-modal');
const voucherModal = document.getElementById('voucher-modal');

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
            if (e.key === 'Enter') e.preventDefault();
        });
    }

    // Global listener for physical barcode scanner
    let barcodeBuffer = '';
    let barcodeTimer = null;
    let lastKeyTime = Date.now();

    document.addEventListener('keydown', (e) => {
        const isProductModalActive = productModal && productModal.classList.contains('active');
        const isPosView = currentTab === 'pos-view';
        const isInventoryView = currentTab === 'inventory-view';
        
        const now = Date.now();
        const interval = now - lastKeyTime;
        lastKeyTime = now;

        const activeEl = document.activeElement;
        const isBarcodeField = activeEl.id === 'pos-barcode-input' || activeEl.id === 'product-barcode' || activeEl.id === 'inventory-barcode-input';
        const isOtherInput = (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && !isBarcodeField;

        // Collect characters
        if (e.key.length === 1) {
            // If it's a fast sequence, it's a scanner. 
            barcodeBuffer += e.key;
            
            // If it's fast and we are in an input that isn't the barcode field, prevent it
            if (interval < 50 && isOtherInput) {
                e.preventDefault();
            }

            clearTimeout(barcodeTimer);
            barcodeTimer = setTimeout(() => {
                barcodeBuffer = '';
            }, 500); // Increased slightly for slower hardware
        } 
        
        if (e.key === 'Enter' || e.key === 'Tab') {
            // Priority: buffer (from scanner) > input value (if manually typed)
            let finalBarcode = barcodeBuffer.trim();
            if (!finalBarcode && isBarcodeField) {
                finalBarcode = activeEl.value.trim();
            }

            if (finalBarcode) {
                e.preventDefault();
                
                // We clear buffer immediately to prevent double-processing 
                // but keep the value in finalBarcode
                barcodeBuffer = '';
                clearTimeout(barcodeTimer);

                if (isProductModalActive) {
                    const pBarcodeInput = document.getElementById('product-barcode');
                    if (pBarcodeInput) {
                        pBarcodeInput.value = finalBarcode;
                        pBarcodeInput.dispatchEvent(new Event('input'));
                        pBarcodeInput.dispatchEvent(new Event('change'));
                        
                        pBarcodeInput.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                        setTimeout(() => pBarcodeInput.style.backgroundColor = '', 500);
                    }
                } else if (isPosView || isInventoryView) {
                    const product = products.find(p => p.barcode === finalBarcode);
                    if (product) {
                        if (isPosView) {
                            addToBill(product);
                            if (activeEl.id === 'pos-barcode-input') activeEl.value = '';
                        } else {
                            editProduct(product.id);
                            if (activeEl.id === 'inventory-barcode-input') activeEl.value = '';
                        }
                    } else {
                        openAddProductModal(finalBarcode);
                        if (activeEl.id === 'pos-barcode-input' || activeEl.id === 'inventory-barcode-input') activeEl.value = '';
                    }
                } else {
                    // Switch to inventory for other views
                    if (!isInventoryView) {
                        navLinks.forEach(l => l.classList.remove('active'));
                        const invLink = document.querySelector('[data-target="inventory-view"]');
                        if (invLink) invLink.classList.add('active');
                        
                        views.forEach(v => v.classList.remove('active'));
                        const invView = document.getElementById('inventory-view');
                        if (invView) invView.classList.add('active');
                        
                        pageTitle.textContent = "Inventory";
                        currentTab = 'inventory-view';
                        loadInventory();
                    }

                    // Small delay to ensure inventory is loaded if we just switched
                    setTimeout(() => {
                        const product = products.find(p => p.barcode === finalBarcode);
                        if (product) {
                            editProduct(product.id);
                        } else {
                            openAddProductModal(finalBarcode);
                        }
                    }, isInventoryView ? 0 : 100);
                }
            }
            // Always clear buffer
            barcodeBuffer = '';
        }
    });

    const btnCamera = document.getElementById('btn-camera-scan');
    const btnCameraProduct = document.getElementById('btn-camera-scan-product');
    const btnCameraInventory = document.getElementById('btn-camera-scan-inventory');
    const scannerModal = document.getElementById('scanner-modal');
    
    if (btnCamera && scannerModal) {
        btnCamera.addEventListener('click', () => {
            currentScanMode = 'billing';
            showModal(scannerModal);
            startScanner();
        });
    }

    if (btnCameraProduct && scannerModal) {
        btnCameraProduct.addEventListener('click', () => {
            currentScanMode = 'addProduct';
            showModal(scannerModal);
            startScanner();
        });
    }

    if (btnCameraInventory && scannerModal) {
        btnCameraInventory.addEventListener('click', () => {
            currentScanMode = 'inventory';
            showModal(scannerModal);
            startScanner();
        });
    }

    const productBarcodeInput = document.getElementById('product-barcode');
    if (productBarcodeInput) {
        productBarcodeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent form submission
            }
        });
    }

    if ((btnCamera || btnCameraProduct) && scannerModal) {
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
            if (currentScanMode === 'addProduct') {
                document.getElementById('reader').style.boxShadow = "inset 0 0 0 10px #10b981";
                setTimeout(() => { document.getElementById('reader').style.boxShadow = "none"; }, 500);
                document.getElementById('product-barcode').value = decodedText;
                hideModal();
                return;
            }

            if (currentScanMode === 'inventory') {
                document.getElementById('reader').style.boxShadow = "inset 0 0 0 10px #10b981";
                setTimeout(() => { document.getElementById('reader').style.boxShadow = "none"; }, 500);
                
                const product = products.find(p => p.barcode === decodedText);
                hideModal();
                if (product) {
                    editProduct(product.id);
                } else {
                    openAddProductModal(decodedText);
                }
                return;
            }

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
                setTimeout(() => { 
                    document.getElementById('reader').style.boxShadow = "none";
                    hideModal();
                    openAddProductModal(decodedText);
                }, 500);
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
    const tabCashier = document.getElementById('tab-btn-cashier');
    const tabCustomer = document.getElementById('tab-btn-customer');
    
    const panelItems = document.getElementById('pos-bill-items');
    const panelCashier = document.getElementById('pos-cashier-details');
    const panelCustomer = document.getElementById('pos-customer-details');
    
    const tabs = [tabItems, tabCashier, tabCustomer];
    const panels = [panelItems, panelCashier, panelCustomer];
    
    tabs.forEach((tab, index) => {
        if (tab) {
            tab.addEventListener('click', () => {
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.style.color = 'var(--text-muted)';
                    t.style.fontWeight = '500';
                });
                panels.forEach(p => p.style.display = 'none');
                
                tab.classList.add('active');
                tab.style.color = 'var(--primary)';
                tab.style.fontWeight = '600';
                panels[index].style.display = 'block';
            });
        }
    });
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
            if(target === 'vouchers-view') loadVouchers();
            if(target === 'customers-view') loadCustomers();
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

    // ==== DISCONNECT ACCOUNT ====
    const btnDisconnectTab = document.getElementById('btn-request-disconnect-tab');
    if (btnDisconnectTab) {
        btnDisconnectTab.addEventListener('click', async () => {
            if (confirm('Are you sure you want to request your account to be disconnected/deleted?')) {
                try {
                    const res = await fetchAuth(`${API_BASE}/user/request-disconnect`, { method: 'POST' });
                    const data = await res.json();
                    if (res.ok) {
                        alert(data.message);
                        btnDisconnectTab.disabled = true;
                        btnDisconnectTab.textContent = 'Disconnect Requested';
                    } else {
                        alert(data.error || 'Failed to request disconnection');
                    }
                } catch (err) {
                    console.error(err);
                    alert('Error requesting disconnection.');
                }
            }
        });
    }
}

function openAddProductModal(barcode = '') {
    const form = document.getElementById('product-form');
    form.reset();
    document.getElementById('product-id').value = '';
    currentProductImageBase64 = null;
    document.getElementById('product-image-preview').innerHTML = '<span style="color:var(--text-muted);font-size:12px;">+ Add Image</span>';
    document.getElementById('product-modal-title').textContent = 'Add Product';
    
    // Set barcode after reset
    if (barcode) {
        document.getElementById('product-barcode').value = barcode;
    }
    
    showModal(productModal);
    
    // Focus and highlight
    setTimeout(() => {
        const input = document.getElementById('product-barcode');
        input.focus();
        if (barcode) {
            input.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
            setTimeout(() => input.style.backgroundColor = '', 500);
        }
    }, 150);
}

function setupModals() {
    document.getElementById('btn-close-modal').addEventListener('click', hideModal);
    document.getElementById('btn-close-invoice-modal').addEventListener('click', hideModal);
    document.getElementById('btn-close-admin-modal').addEventListener('click', hideModal);
    document.getElementById('btn-close-customer-modal').addEventListener('click', hideModal);
    document.getElementById('btn-close-voucher-modal').addEventListener('click', hideModal);
    
    // Add product
    document.getElementById('btn-add-product').addEventListener('click', () => openAddProductModal());
    
    // Add customer
    document.getElementById('btn-add-customer').addEventListener('click', () => {
        document.getElementById('customer-form').reset();
        document.getElementById('customer-id').value = '';
        document.getElementById('customer-modal-title').textContent = 'Add Customer';
        showModal(customerModal);
    });

    // Create voucher
    document.getElementById('btn-create-voucher').addEventListener('click', () => {
        document.getElementById('voucher-form').reset();
        document.getElementById('voucher-id').value = '';
        
        // Update modal title for creating
        const modalTitle = voucherModal.querySelector('.modal-header h3');
        modalTitle.textContent = 'Create Voucher';
        
        generateVoucherCode();
        showModal(voucherModal);
    });

    // Generate voucher code
    document.getElementById('btn-generate-voucher-code').addEventListener('click', generateVoucherCode);

    // Handle voucher form submission
    document.getElementById('voucher-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Voucher form submitted');
        
        const id = document.getElementById('voucher-id').value;
        const code = document.getElementById('voucher-code').value.trim();
        const discount_type = document.getElementById('voucher-discount-type').value;
        const discount_value = parseFloat(document.getElementById('voucher-discount-value').value);
        const usage_limit = parseInt(document.getElementById('voucher-usage-limit').value);
        const min_bill_amount = parseFloat(document.getElementById('voucher-min-bill').value) || 0;
        const expiry_date = document.getElementById('voucher-expiry-date').value;
        const description = document.getElementById('voucher-description').value.trim();
        const is_active = document.getElementById('voucher-is-active').checked;
        
        console.log('Voucher data:', { code, discount_type, discount_value, usage_limit });
        
        // Validation
        if (!code) {
            showToast('Please enter a voucher code', 'error');
            return;
        }
        if (!discount_value || discount_value <= 0) {
            showToast('Please enter a valid discount value', 'error');
            return;
        }
        if (!usage_limit || usage_limit <= 0) {
            showToast('Please enter a valid usage limit', 'error');
            return;
        }
        
        const payload = {
            id: id || Date.now().toString(),
            code,
            discount_type,
            discount_value,
            usage_limit,
            min_bill_amount,
            expiry_date,
            description,
            is_active,
            used_count: 0,
            created_at: new Date().toISOString()
        };
        
        console.log('Saving voucher:', payload);
        
        // Always use local storage for now to ensure it works
        try {
            let savedVouchers = JSON.parse(localStorage.getItem('pos_vouchers') || '[]');
            console.log('Current vouchers:', savedVouchers);
            
            if (id) {
                // Update existing voucher
                const index = savedVouchers.findIndex(v => v.id == id);
                if (index !== -1) {
                    savedVouchers[index] = { ...savedVouchers[index], ...payload };
                    console.log('Updated voucher at index:', index);
                }
            } else {
                // Add new voucher
                savedVouchers.push(payload);
                console.log('Added new voucher');
            }
            
            localStorage.setItem('pos_vouchers', JSON.stringify(savedVouchers));
            console.log('Vouchers saved to localStorage');
            
            hideModal();
            loadVouchers();
            showToast('Voucher saved successfully!', 'success');
        } catch (err) {
            console.error('Error saving voucher:', err);
            alert('Error saving voucher: ' + err.message);
        }
    });

    // Voucher functionality in POS
    document.getElementById('btn-apply-voucher').addEventListener('click', applyVoucher);
    document.getElementById('btn-remove-voucher').addEventListener('click', removeVoucher);
    document.getElementById('pos-voucher-code').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            applyVoucher();
        }
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

    // Handle Customer Form
    document.getElementById('customer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('customer-id').value;
        const name = document.getElementById('customer-name').value;
        const phone = document.getElementById('customer-phone').value;
        const address = document.getElementById('customer-address').value;
        const type = document.getElementById('customer-type').value;
        
        const payload = { name, phone, address, type };
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/customers/${id}` : `${API_BASE}/customers`;
        
        try {
            const res = await fetchAuth(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Failed to save customer');
            hideModal();
            loadCustomers();
        } catch (err) {
            console.error(err);
            alert('Error saving customer');
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
        const is_active = document.getElementById('admin-is-active').checked;
        
        try {
            await fetchAuth(`${API_BASE}/admin/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ business_name, email, whatsapp_number, marketplace_enabled, is_active })
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
        // Fetch 'lite' products for inventory table too
        const res = await fetchAuth(`${API_BASE}/products?lite=true`);
        products = await res.json();
        renderInventory(products);
    } catch (err) {
        console.error(err);
    }
}

function renderInventory(productsToRender) {
    const tbody = document.querySelector('#inventory-table tbody');
    tbody.innerHTML = '';
    
    // Handle admin inventory filtering
    const filterBadge = document.getElementById('inventory-filter-badge');
    if (currentRole === 'admin' && adminInventoryFilter) {
        productsToRender = productsToRender.filter(p => p.owner_name === adminInventoryFilter);
        document.getElementById('inventory-filter-name').textContent = adminInventoryFilter;
        filterBadge.style.display = 'flex';
    } else {
        filterBadge.style.display = 'none';
    }
    
    productsToRender.forEach(p => {
        const tr = document.createElement('tr');
        tr.dataset.id = p.id;
        
        // Placeholder for image
        const imgId = `inv-img-${p.id}`;
        const imgHtml = `<div id="${imgId}" class="inventory-img-placeholder" style="width:40px;height:40px;border-radius:8px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;">
            <div class="shimmer-placeholder"></div>
        </div>`;
        
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

        // Lazy load the inventory image
        const imgPlaceholder = tr.querySelector('.inventory-img-placeholder');
        const invObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const productId = p.id;
                    if (imageCache.has(productId)) {
                        const img = document.createElement('img');
                        img.src = imageCache.get(productId);
                        img.style = "width:100%;height:100%;object-fit:cover;";
                        imgPlaceholder.innerHTML = '';
                        imgPlaceholder.appendChild(img);
                    } else {
                        fetchAuth(`${API_BASE}/products/${productId}/image`)
                            .then(r => r.json())
                            .then(data => {
                                if (data.image) {
                                    imageCache.set(productId, data.image);
                                    const img = document.createElement('img');
                                    img.src = data.image;
                                    img.style = "width:100%;height:100%;object-fit:cover;";
                                    imgPlaceholder.innerHTML = '';
                                    imgPlaceholder.appendChild(img);
                                } else {
                                    imgPlaceholder.innerHTML = '<div style="font-size:10px;color:#64748b;">No Img</div>';
                                }
                            })
                            .catch(() => {
                                imgPlaceholder.innerHTML = '<div style="font-size:10px;color:#64748b;">No Img</div>';
                            });
                    }
                    observer.unobserve(imgPlaceholder);
                }
            });
        }, { root: document.querySelector('.table-responsive'), rootMargin: '50px' });
        invObserver.observe(imgPlaceholder);
    });
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
        setTimeout(() => document.getElementById('product-barcode').focus(), 100);
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
        // Fetch 'lite' products (without images) for faster loading
        const res = await fetchAuth(`${API_BASE}/products?lite=true`);
        products = await res.json();
        renderPOSProducts(products);
        
        // Also load customers list for POS search
        const custRes = await fetchAuth(`${API_BASE}/customers`);
        customersList = await custRes.json();
        setupCustomerPOSSearch();
    } catch (err) {
        console.error(err);
    }
}

function setupCustomerPOSSearch() {
    const searchInput = document.getElementById('pos-customer-search');
    const suggestionsBox = document.getElementById('pos-customer-suggestions');
    
    if (!searchInput || !suggestionsBox) return;

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (!term) {
            suggestionsBox.style.display = 'none';
            return;
        }

        const filtered = customersList.filter(c => 
            c.name.toLowerCase().includes(term) || 
            c.phone.includes(term)
        );

        if (filtered.length > 0) {
            suggestionsBox.innerHTML = '';
            filtered.forEach(c => {
                const div = document.createElement('div');
                div.style = "padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--border); transition: background 0.2s;";
                div.innerHTML = `
                    <div style="font-weight: 600; font-size: 13px;">${c.name}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${c.phone} | ${c.type}</div>
                `;
                div.onmouseover = () => div.style.background = 'var(--secondary)';
                div.onmouseout = () => div.style.background = 'transparent';
                div.onclick = () => {
                    document.getElementById('pos-customer-name').value = c.name;
                    document.getElementById('pos-customer-phone').value = c.phone;
                    document.getElementById('pos-customer-type').value = c.type || 'Retail';
                    document.getElementById('pos-customer-search').value = '';
                    suggestionsBox.style.display = 'none';
                    
                    // Visual feedback
                    const nameField = document.getElementById('pos-customer-name');
                    nameField.style.backgroundColor = 'var(--success-light)';
                    setTimeout(() => nameField.style.backgroundColor = '', 500);
                };
                suggestionsBox.appendChild(div);
            });
            suggestionsBox.style.display = 'block';
        } else {
            suggestionsBox.style.display = 'none';
        }
    });

    // Close suggestions on outside click
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
            suggestionsBox.style.display = 'none';
        }
    });
}

// Image cache to avoid re-fetching the same image
const imageCache = new Map();

function renderPOSProducts(productArray) {
    const grid = document.getElementById('pos-products-grid');
    grid.innerHTML = '';
    
    // Intersection Observer for lazy loading images
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const card = entry.target;
                const imgDiv = card.querySelector('.product-img');
                const productId = card.dataset.id;
                
                // If we have it in cache, use it
                if (imageCache.has(productId)) {
                    imgDiv.style.backgroundImage = `url('${imageCache.get(productId)}')`;
                    imgDiv.classList.add('loaded');
                } else {
                    // Fetch image from API
                    fetchAuth(`${API_BASE}/products/${productId}/image`)
                        .then(r => r.json())
                        .then(data => {
                            if (data.image) {
                                imageCache.set(productId, data.image);
                                imgDiv.style.backgroundImage = `url('${data.image}')`;
                                imgDiv.classList.add('loaded');
                            }
                        })
                        .catch(err => console.error('Error loading image', err));
                }
                observer.unobserve(card);
            }
        });
    }, { root: null, rootMargin: '100px' });
    
    productArray.forEach(p => {
        const div = document.createElement('div');
        div.className = 'pos-product-card';
        div.dataset.id = p.id;
        
        div.innerHTML = `
            <div class="product-img" style="background-color:#e2e8f0; position:relative;">
                <div class="shimmer-placeholder"></div>
            </div>
            <h4>${p.name}</h4>
            <div class="price">${formatCurrency(p.price)}</div>
            <div class="stock">Stock: ${p.quantity}</div>
        `;
        div.addEventListener('click', () => addToBill(p));
        grid.appendChild(div);
        
        // Start observing this card for image lazy loading
        imageObserver.observe(div);
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
    
    if (currentBill.length > 0) {
        const header = document.createElement('div');
        header.style = "display: flex; justify-content: space-between; padding: 0 12px 8px 12px; border-bottom: 1px solid var(--border); margin-bottom: 8px; font-size: 12px; font-weight: 700; color: var(--text-muted);";
        header.innerHTML = `
            <span style="flex: 1; margin-right: 40px;">ITEM</span>
            <span style="width: 80px; text-align: center;">QTY</span>
            <span style="width: 80px; text-align: right;">TOTAL</span>
        `;
        itemsContainer.appendChild(header);
    }

    currentBill.forEach(item => {
        const amount = item.price * item.quantity;
        total += amount;
        
        const div = document.createElement('div');
        div.className = 'bill-item';
        div.style.marginBottom = '8px';
        div.style.padding = '10px';
        div.style.border = '1px solid var(--border)';
        div.style.borderRadius = '8px';
        div.style.background = 'var(--background)';
        div.innerHTML = `
            <div class="bill-item-details">
                <h4 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600; color: var(--text-main);">${item.name}</h4>
                <div style="display:flex; align-items:center; gap:12px; margin-top:8px;">
                    <input type="number" step="0.01" value="${item.price}" 
                           onchange="updateBillPrice('${item.id}', this.value)" 
                           style="width:80px; padding:6px 8px; font-size:13px; border:1px solid var(--border); border-radius:4px; font-weight: 500;"> 
                    <span style="font-size:13px; color:var(--text-muted); font-weight: 500;">@ ${formatCurrency(item.price)}</span>
                </div>
            </div>
            <div class="bill-item-actions" style="display: flex; align-items: center; gap: 20px; margin-top: 12px;">
                <div class="qty-control" style="display: flex; align-items: center; gap: 8px; background: var(--secondary); padding: 4px; border-radius: 6px; border: 1px solid var(--border);">
                    <button class="qty-btn" onclick="updateBillQuantity('${item.id}', -1)" style="width: 24px; height: 24px; font-size: 14px; padding: 0; border: none; background: var(--primary); color: white; border-radius: 4px; cursor: pointer;">-</button>
                    <span style="font-weight: 600; font-size: 14px; min-width: 20px; text-align: center;">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateBillQuantity('${item.id}', 1)" style="width: 24px; height: 24px; font-size: 14px; padding: 0; border: none; background: var(--primary); color: white; border-radius: 4px; cursor: pointer;">+</button>
                </div>
                <div class="item-total" style="font-size: 16px; font-weight: 700; color: var(--primary); min-width: 80px; text-align: right;">${formatCurrency(amount)}</div>
            </div>
        `;
        itemsContainer.appendChild(div);
    });
    
    // Calculate voucher discount
    const voucherDiscount = calculateVoucherDiscount(total);
    const finalTotal = total - voucherDiscount;
    
    // Update UI elements
    const subtotalEl = document.getElementById('pos-subtotal-amount');
    if (subtotalEl) {
        subtotalEl.textContent = formatCurrency(total);
    }
    
    // Show voucher discount row if voucher is applied
    const voucherDiscountRow = document.getElementById('pos-voucher-discount-row');
    const voucherDiscountAmount = document.getElementById('pos-voucher-discount-amount');
    if (appliedVoucher && voucherDiscount > 0) {
        voucherDiscountRow.style.display = 'flex';
        voucherDiscountAmount.textContent = `-${formatCurrency(voucherDiscount)}`;
    } else {
        voucherDiscountRow.style.display = 'none';
    }
    
    // Always update the total amount (with or without voucher)
    document.getElementById('pos-total-amount').textContent = formatCurrency(finalTotal);
    
    // Update voucher applied info
    if (appliedVoucher && voucherDiscount > 0) {
        document.getElementById('applied-voucher-discount').textContent = `-${formatCurrency(voucherDiscount)}`;
    }
    
    // Auto-update balance whenever the bill items change (e.g. quantity updates)
    calculateChange();
}

function calculateChange() {
    const totalText = document.getElementById('pos-total-amount').textContent;
    const amountToPay = parseFloat(totalText.replace(/[^0-9.-]/g, '')) || 0;
    const amountPaidInput = document.getElementById('pos-amount-paid').value;
    const balanceEl = document.getElementById('pos-balance-amount');
    
    // If no amount has been typed yet, reset balance state to 0.00
    if (!amountPaidInput || amountPaidInput.trim() === '') {
        balanceEl.textContent = formatCurrency(0);
        balanceEl.style.color = 'var(--text-main)';
        return;
    }
    
    const amountPaid = parseFloat(amountPaidInput) || 0;
    const balance = amountPaid - amountToPay;
    
    balanceEl.textContent = formatCurrency(balance);
    
    if (balance < 0) {
        balanceEl.style.color = '#ef4444'; // Red for insufficient payment
    } else if (balance > 0) {
        balanceEl.style.color = '#10b981'; // Green for positive balance (change to give)
    } else {
        balanceEl.style.color = 'var(--text-main)'; // Default if exactly 0
    }
}

// Add event listeners for payment calculation
document.addEventListener('DOMContentLoaded', () => {
    const amountPaidInput = document.getElementById('pos-amount-paid');
    
    if (amountPaidInput) {
        amountPaidInput.addEventListener('input', calculateChange);
    }
});

document.getElementById('btn-submit-bill').addEventListener('click', async () => {
if (currentBill.length === 0) {
    alert('Bill is empty!');
    return;
}

const totalText = document.getElementById('pos-total-amount').textContent;
let total = parseFloat(totalText.replace(/[^0-9.-]/g, '')) || 0;
let amountPaid = parseFloat(document.getElementById('pos-amount-paid').value);

// If amount paid is empty or 0, default to the total amount
if (isNaN(amountPaid) || amountPaid <= 0) {
    amountPaid = total;
}

const cashier_name = document.getElementById('pos-cashier-name').value || 'System';
const customer_name = document.getElementById('pos-customer-name').value;
const customer_phone = document.getElementById('pos-customer-phone').value;
const customer_type = document.getElementById('pos-customer-type').value;
const payment_method = document.getElementById('pos-payment-method').value;

// Calculate original subtotal for voucher tracking
const originalSubtotal = currentBill.reduce((sum, item) => sum + (item.price * item.quantity), 0);
const voucherDiscount = appliedVoucher ? calculateVoucherDiscount(originalSubtotal) : 0;

const payload = {
    items: currentBill,
    total_amount: total,
    amount_paid: amountPaid,
    cashier_name,
    customer_name,
    customer_phone,
    customer_type,
    payment_method,
    voucher: appliedVoucher ? {
        id: appliedVoucher.id,
        code: appliedVoucher.code,
        discount_type: appliedVoucher.discount_type,
        discount_value: appliedVoucher.discount_value,
        discount_amount: voucherDiscount
    } : null
};

try {
    const res = await fetchAuth(`${API_BASE}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create invoice');
    }

    const data = await res.json();
    const invoiceData = data.invoice;
    console.log('Invoice created:', invoiceData);

    // Update voucher usage count if voucher was applied BEFORE resetting appliedVoucher
    if (appliedVoucher) {
        invoiceData.voucher = appliedVoucher; // Pass to printout
        try {
            // Try API first
            const voucherRes = await fetchAuth(`${API_BASE}/vouchers/${appliedVoucher.id}/use`, { method: 'POST' });
            if (!voucherRes.ok) {
                throw new Error('API not available');
            }
        } catch (err) {
            // Fallback to local storage
            let savedVouchers = JSON.parse(localStorage.getItem('pos_vouchers') || '[]');
            const voucherIndex = savedVouchers.findIndex(v => v.id === appliedVoucher.id);
            if (voucherIndex !== -1) {
                savedVouchers[voucherIndex].used_count = (savedVouchers[voucherIndex].used_count || 0) + 1;
                localStorage.setItem('pos_vouchers', JSON.stringify(savedVouchers));
            }
        }
    }

    // Show invoice printout
    showInvoicePrintout(invoiceData);

    // Clear bill
    currentBill = [];
    appliedVoucher = null;
    updateBillUI();

    showToast('Bill submitted successfully!', 'success');

    // Reset form fields
    document.getElementById('pos-cashier-name').value = 'Pamidu';
    document.getElementById('pos-customer-name').value = 'Walk-in Customer';
    document.getElementById('pos-customer-phone').value = '';
    document.getElementById('pos-customer-type').value = 'Retail';
    document.getElementById('pos-customer-search').value = '';
    document.getElementById('pos-payment-method').value = 'Cash';
    document.getElementById('pos-amount-paid').value = '';
    document.getElementById('pos-balance-amount').textContent = '0.00';
    
    // Reset voucher UI
    document.getElementById('voucher-applied-info').style.display = 'none';
    document.getElementById('btn-apply-voucher').style.display = 'block';
    document.getElementById('btn-remove-voucher').style.display = 'none';
    document.getElementById('pos-voucher-code').value = '';
    document.getElementById('pos-voucher-code').disabled = false;
    
    // Reset tabs and reload products
    if (document.getElementById('tab-btn-items')) document.getElementById('tab-btn-items').click();
    fetchAuth(`${API_BASE}/products?lite=true`).then(r => r.json()).then(p => products = p).catch(() => {});

} catch (err) {
    console.error('Error submitting bill:', err);
    alert('Error submitting bill: ' + err.message);
}
});

function showInvoicePrintout(invoice) {
    document.getElementById('receipt-business-name').textContent = invoice.owner_name || currentBusiness || 'Smart Zone';
    document.getElementById('receipt-no').textContent = invoice.invoice_number;
    document.getElementById('receipt-date').textContent = invoice.date;
    document.getElementById('receipt-time').textContent = invoice.time;
    document.getElementById('receipt-payment-method').textContent = invoice.payment_method || 'Cash';
    document.getElementById('receipt-cashier-name').textContent = invoice.cashier_name || 'System';
    
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
    
    let subtotal = 0;
    invoice.items.forEach(item => {
        const amt = item.price * item.quantity;
        subtotal += amt;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.product_name || item.name}</td>
            <td>${item.quantity}</td>
            <td>${item.price}</td>
            <td>${amt}</td>
        `;
        tbody.appendChild(tr);
    });
    
        // Handle voucher information
        let voucherDiscount = 0;
        let total = typeof invoice.total_amount === 'number' ? invoice.total_amount : subtotal;

        if (invoice.voucher) {
            if (invoice.voucher.discount_type === 'percentage') {
                voucherDiscount = subtotal * (invoice.voucher.discount_value / 100);
            } else {
                voucherDiscount = invoice.voucher.discount_amount || invoice.voucher.discount_value || 0;
            }
            
            document.getElementById('receipt-subtotal-row').style.display = 'flex';
            document.getElementById('receipt-discount-row').style.display = 'flex';
            document.getElementById('receipt-discount-row').children[0].textContent = `Voucher (${invoice.voucher.code || 'Discount'}):`;
            document.getElementById('receipt-subtotal-amount').textContent = subtotal.toFixed(2);
            document.getElementById('receipt-simple-discount').textContent = '-' + voucherDiscount.toFixed(2);
            
            total = invoice.total_amount !== undefined ? invoice.total_amount : (subtotal - voucherDiscount);
        } else if (invoice.total_amount !== undefined && (subtotal - invoice.total_amount) > 0.01) {
            voucherDiscount = subtotal - invoice.total_amount;
            document.getElementById('receipt-subtotal-row').style.display = 'flex';
            document.getElementById('receipt-discount-row').style.display = 'flex';
            document.getElementById('receipt-discount-row').children[0].textContent = `Voucher Discount:`;
            document.getElementById('receipt-subtotal-amount').textContent = subtotal.toFixed(2);
            document.getElementById('receipt-simple-discount').textContent = '-' + voucherDiscount.toFixed(2);
        } else {
            document.getElementById('receipt-subtotal-row').style.display = 'none';
            document.getElementById('receipt-discount-row').style.display = 'none';
            total = subtotal;
        }
    
    document.getElementById('receipt-total-amount').textContent = total.toFixed(2);
    
    // Payment details for receipt
    const amountPaid = invoice.amount_paid || 0;
    const change = amountPaid > 0 ? (amountPaid - total) : 0;
    
    document.getElementById('receipt-amount-paid').textContent = amountPaid.toFixed(2);
    document.getElementById('receipt-balance-amount').textContent = Math.max(0, change).toFixed(2);
    
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
                <td style="text-align: center;">
                    ${inv.voucher ? 
                        `<div style="font-size: 11px; font-weight: 600; color: #0284c7; line-height: 1.2;"><i class='bx bx-ticket' title="Voucher: ${inv.voucher.code}"></i> ${inv.voucher.code}<br><span style="color: #059669;">-${formatCurrency(inv.voucher.discount_amount || inv.voucher.discount_value || 0)}</span></div>` : 
                        '<span style="color: var(--text-muted); font-size: 12px;">-</span>'
                    }
                </td>
                <td>
                    <button class="btn btn-outline btn-icon-only view-invoice-btn" data-id="${inv.id}" title="View Invoice"><i class='bx bx-receipt'></i></button>
                    <button class="btn btn-primary btn-icon-only print-invoice-btn" data-id="${inv.id}" title="Print Invoice"><i class='bx bx-printer'></i></button>
                    ${adminActions}
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        // Add event listeners for invoice actions
        document.querySelectorAll('.view-invoice-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.closest('.view-invoice-btn').dataset.id;
                try {
                    const res = await fetchAuth(`${API_BASE}/invoices/${id}`);
                    const inv = await res.json();
                    showInvoicePrintout(inv);
                } catch(err) { 
                    console.error(err); 
                }
            });
        });
        
        document.querySelectorAll('.print-invoice-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.closest('.print-invoice-btn').dataset.id;
                try {
                    const res = await fetchAuth(`${API_BASE}/invoices/${id}`);
                    const inv = await res.json();
                    showInvoicePrintout(inv);
                } catch(err) { 
                    console.error(err); 
                }
            });
        });
        
        document.querySelectorAll('.delete-invoice-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(confirm('Are you sure you want to delete this invoice? (This will restock the inventory automatically)')) {
                    const id = e.target.closest('.delete-invoice-btn').dataset.id;
                    try {
                        await fetchAuth(`${API_BASE}/invoices/${id}`, { method: 'DELETE' });
                        loadInvoices();
                    } catch(err) { 
                        console.error(err); 
                    }
                }
            });
        });
        
    } catch (err) {
        console.error(err);
    }
}

// ==== CUSTOMERS ====
let customersList = [];

async function loadCustomers() {
    try {
        const res = await fetchAuth(`${API_BASE}/customers`);
        customersList = await res.json();
        renderCustomers(customersList);
    } catch (err) {
        console.error(err);
    }
}

function renderCustomers(list) {
    const tbody = document.querySelector('#customers-table tbody');
    tbody.innerHTML = '';
    
    list.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${c.name}</td>
            <td>${c.phone}</td>
            <td><span class="badge ${c.type === 'Wholesale' ? 'badge-primary' : 'badge-secondary'}" style="padding:4px 8px; border-radius:4px; font-size:11px; background:${c.type === 'Wholesale' ? 'var(--primary)' : 'var(--secondary)'}; color:${c.type === 'Wholesale' ? 'white' : 'var(--text-main)'}">${c.type}</span></td>
            <td>${c.address || '-'}</td>
            <td>
                <button class="btn btn-outline btn-icon-only edit-customer-btn" data-id="${c.id}"><i class='bx bx-edit'></i></button>
                <button class="btn btn-danger btn-icon-only delete-customer-btn" data-id="${c.id}"><i class='bx bx-trash'></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Event Delegation for Customer Actions
document.querySelector('#customers-table tbody').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-customer-btn');
    if (editBtn) {
        const id = editBtn.dataset.id;
        const c = customersList.find(cust => cust.id === id);
        if (c) {
            document.getElementById('customer-id').value = c.id;
            document.getElementById('customer-name').value = c.name;
            document.getElementById('customer-phone').value = c.phone;
            document.getElementById('customer-address').value = c.address || '';
            document.getElementById('customer-type').value = c.type || 'Retail';
            document.getElementById('customer-modal-title').textContent = 'Edit Customer';
            showModal(customerModal);
        }
        return;
    }
    
    const delBtn = e.target.closest('.delete-customer-btn');
    if (delBtn) {
        if(confirm('Are you sure you want to delete this customer?')) {
            const id = delBtn.dataset.id;
            fetchAuth(`${API_BASE}/customers/${id}`, { method: 'DELETE' })
                .then(() => loadCustomers())
                .catch(err => console.error(err));
        }
    }
});

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
        
        const tableContainer = document.getElementById('reports-table-container');
        const accContainer = document.getElementById('reports-account-container');
        
        if (currentReportMode === 'account') {
            if (tableContainer) tableContainer.style.display = 'none';
            if (accContainer) accContainer.style.display = 'block';
        } else {
            if (tableContainer) tableContainer.style.display = 'block';
            if (accContainer) accContainer.style.display = 'none';
            loadReports();
        }
    });
});

async function loadReports() {
    if (currentReportMode === 'account') return; // Don't fetch data for account tab
    
    const thead = document.querySelector('#reports-table thead');
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
            const disconnectBadge = user.delete_request ? '<br><span class="text-danger" style="font-size:11px;font-weight:bold;color:#ef4444;">[Disconnect Requested]</span>' : '';
            tr.innerHTML = `
                <td>${user.business_name} ${disconnectBadge}</td>
                <td>${user.email}</td>
                <td>
                    <div style="font-size:12px; margin-bottom:4px;">Marketplace: ${user.marketplace_enabled ? '<span class="text-success" style="color:var(--success);font-weight:600;">Enabled</span>' : '<span class="text-muted">Disabled</span>'}</div>
                    <div style="font-size:12px;">Account: ${user.is_active ? '<span class="text-success" style="color:var(--success);font-weight:600;">Active</span>' : '<span class="text-danger" style="color:var(--danger);font-weight:600;">Pending approval</span>'}</div>
                </td>
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
            document.getElementById('admin-is-active').checked = user.is_active;
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

// ==== VOUCHER FUNCTIONS ====
function generateVoucherCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('voucher-code').value = code;
}

async function loadVouchers() {
    console.log('Loading vouchers...');
    
    // Always use local storage for now
    vouchers = JSON.parse(localStorage.getItem('pos_vouchers') || '[]');
    console.log('Loaded vouchers:', vouchers);
    
    const tbody = document.querySelector('#vouchers-table tbody');
    tbody.innerHTML = '';
    
    if (vouchers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">No vouchers created yet. Click "Create Voucher" to get started.</td></tr>';
        return;
    }
    
    vouchers.forEach(voucher => {
        const tr = document.createElement('tr');
        
        // Status badge with color coding
        const statusBadge = voucher.is_active ? 
            '<span class="text-success" style="color:var(--success);font-weight:600;">Active</span>' : 
            '<span class="text-danger" style="color:var(--danger);font-weight:600;">Inactive</span>';
        
        // Expiry date with formatting and warning
        const expiryDate = voucher.expiry_date ? 
            new Date(voucher.expiry_date).toLocaleDateString() : 
            '<span style="color:var(--text-muted);">No expiry</span>';
        
        const isExpired = voucher.expiry_date && new Date(voucher.expiry_date) < new Date();
        const expiryDisplay = voucher.expiry_date ? 
            `<span style="color: ${isExpired ? 'var(--danger)' : 'var(--text-main)'}">${expiryDate}</span>` : 
            '<span style="color:var(--text-muted);">No expiry</span>';
        
        // Usage progress bar
        const usagePercentage = voucher.usage_limit > 0 ? (voucher.used_count || 0) / voucher.usage_limit * 100 : 0;
        const usageColor = usagePercentage >= 90 ? 'var(--danger)' : usagePercentage >= 70 ? 'var(--warning)' : 'var(--success)';
        const usageBar = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="flex: 1; background: #e5e7eb; border-radius: 4px; height: 6px; overflow: hidden;">
                    <div style="width: ${usagePercentage}%; height: 100%; background: ${usageColor}; transition: width 0.3s;"></div>
                </div>
                <span style="font-size: 12px; font-weight: 600; color: var(--text-main); min-width: 60px;">${voucher.used_count || 0}/${voucher.usage_limit}</span>
            </div>
        `;
        
        // Discount display with icon
        const discountDisplay = voucher.discount_type === 'percentage' ? 
            `${voucher.discount_value}%` : 
            formatCurrency(voucher.discount_value);
        
        // Description with truncation for long text
        const description = voucher.description ? 
            (voucher.description.length > 30 ? voucher.description.substring(0, 30) + '...' : voucher.description) : 
            '<span style="color: var(--text-muted); font-style: italic;">No description</span>';
        
        // Add action buttons based on user role
        let voucherActions = '';
        if (currentRole === 'admin') {
            voucherActions = `
                <button class="btn btn-outline btn-icon-only edit-voucher-btn" data-id="${voucher.id}" title="Edit Voucher">
                    <i class='bx bx-edit'></i>
                </button>
                <button class="btn btn-danger btn-icon-only delete-voucher-btn" data-id="${voucher.id}" title="Delete Voucher">
                    <i class='bx bx-trash'></i>
                </button>
            `;
        } else {
            voucherActions = `
                <button class="btn btn-outline btn-icon-only view-voucher-btn" data-id="${voucher.id}" title="View Voucher Details">
                    <i class='bx bx-show'></i>
                </button>
            `;
        }
        
        tr.innerHTML = `
            <td>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <strong style="color: var(--primary); font-size: 14px;">${voucher.code}</strong>
                    <small style="color: var(--text-muted);">ID: ${voucher.id}</small>
                </div>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <i class='bx ${voucher.discount_type === 'percentage' ? 'bx-percentage' : 'bx-dollar-circle'}' style="color: var(--primary); font-size: 16px;"></i>
                    <span style="font-weight: 600;">${discountDisplay}</span>
                </div>
            </td>
            <td>
                ${usageBar}
            </td>
            <td>
                ${voucher.min_bill_amount ? 
                    `<span style="font-weight: 600;">${formatCurrency(voucher.min_bill_amount)}</span>` : 
                    '<span style="color: var(--text-muted);">No minimum</span>'}
            </td>
            <td>
                ${expiryDisplay}
            </td>
            <td>
                ${statusBadge}
            </td>
            <td>
                <div style="max-width: 200px;" title="${voucher.description || 'No description'}">
                    ${description}
                </div>
            </td>
            <td>
                <div style="display: flex; gap: 4px;">
                    ${voucherActions}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    console.log('Vouchers displayed in table');
    
    // Add event listeners for voucher actions
    document.querySelectorAll('.edit-voucher-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const voucherId = e.target.closest('.edit-voucher-btn').dataset.id;
            console.log('Edit voucher clicked:', voucherId);
            editVoucher(voucherId);
        });
    });
    
    document.querySelectorAll('.view-voucher-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const voucherId = e.target.closest('.view-voucher-btn').dataset.id;
            console.log('View voucher clicked:', voucherId);
            viewVoucher(voucherId);
        });
    });
    
    document.querySelectorAll('.delete-voucher-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const voucherId = e.target.closest('.delete-voucher-btn').dataset.id;
            console.log('Delete voucher clicked:', voucherId);
            deleteVoucher(voucherId);
        });
    });
}

function viewVoucher(voucherId) {
    const voucher = vouchers.find(v => v.id == voucherId);
    if (!voucher) return;
    
    // Create a simple alert to show voucher details
    const details = `
Voucher Details:
================
Code: ${voucher.code}
Discount: ${voucher.discount_type === 'percentage' ? voucher.discount_value + '%' : formatCurrency(voucher.discount_value)}
Usage: ${voucher.used_count || 0}/${voucher.usage_limit}
Min Bill: ${voucher.min_bill_amount ? formatCurrency(voucher.min_bill_amount) : 'No minimum'}
Expiry: ${voucher.expiry_date ? new Date(voucher.expiry_date).toLocaleDateString() : 'No expiry'}
Status: ${voucher.is_active ? 'Active' : 'Inactive'}
Description: ${voucher.description || 'No description'}
================
    `;
    
    alert(details);
}

async function editVoucher(voucherId) {
    const voucher = vouchers.find(v => v.id == voucherId);
    if (!voucher) return;
    
    // Update modal title for editing
    const modalTitle = voucherModal.querySelector('.modal-header h3');
    modalTitle.textContent = 'Edit Voucher';
    
    document.getElementById('voucher-id').value = voucher.id;
    document.getElementById('voucher-code').value = voucher.code;
    document.getElementById('voucher-discount-type').value = voucher.discount_type;
    document.getElementById('voucher-discount-value').value = voucher.discount_value;
    document.getElementById('voucher-usage-limit').value = voucher.usage_limit;
    document.getElementById('voucher-min-bill').value = voucher.min_bill_amount || '';
    document.getElementById('voucher-expiry-date').value = voucher.expiry_date || '';
    document.getElementById('voucher-description').value = voucher.description || '';
    document.getElementById('voucher-is-active').checked = voucher.is_active;
    
    showModal(voucherModal);
}

async function deleteVoucher(voucherId) {
    if (!confirm('Are you sure you want to delete this voucher?')) return;
    
    console.log('Deleting voucher:', voucherId);
    
    try {
        // Always use local storage for now
        let savedVouchers = JSON.parse(localStorage.getItem('pos_vouchers') || '[]');
        console.log('Vouchers before deletion:', savedVouchers);
        
        savedVouchers = savedVouchers.filter(v => v.id != voucherId);
        console.log('Vouchers after deletion:', savedVouchers);
        
        localStorage.setItem('pos_vouchers', JSON.stringify(savedVouchers));
        console.log('Voucher deleted from localStorage');
        
        loadVouchers();
        showToast('Voucher deleted successfully!', 'success');
    } catch (err) {
        console.error('Error deleting voucher:', err);
        alert('Error deleting voucher: ' + err.message);
    }
}

async function applyVoucher() {
    const codeInput = document.getElementById('pos-voucher-code');
    const code = codeInput.value.trim().toUpperCase();
    
    if (!code) {
        showToast('Please enter a voucher code', 'error');
        return;
    }
    
    let voucher = null;
    
    try {
        // Try API first
        const res = await fetchAuth(`${API_BASE}/vouchers/validate/${code}`);
        if (res.ok) {
            voucher = await res.json();
        } else {
            throw new Error('API not available');
        }
    } catch (err) {
        console.log('Using local storage for voucher validation');
        // Fallback to local storage
        const savedVouchers = JSON.parse(localStorage.getItem('pos_vouchers') || '[]');
        voucher = savedVouchers.find(v => v.code.toUpperCase() === code);
        
        if (!voucher) {
            showToast('Invalid voucher code', 'error');
            return;
        }
    }
    
    // Validate voucher conditions
    const subtotal = currentBill.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (!voucher.is_active) {
        showToast('This voucher is not active', 'error');
        return;
    }
    
    if (voucher.min_bill_amount && subtotal < voucher.min_bill_amount) {
        showToast(`Minimum bill amount of ${formatCurrency(voucher.min_bill_amount)} required for this voucher`, 'error');
        return;
    }
    
    if (voucher.expiry_date && new Date(voucher.expiry_date) < new Date()) {
        showToast('This voucher has expired', 'error');
        return;
    }
    
    if ((voucher.used_count || 0) >= voucher.usage_limit) {
        showToast('This voucher has reached its usage limit', 'error');
        return;
    }
    
    // Apply voucher
    appliedVoucher = voucher;
    
    // Update UI
    document.getElementById('voucher-applied-info').style.display = 'block';
    document.getElementById('btn-apply-voucher').style.display = 'none';
    document.getElementById('btn-remove-voucher').style.display = 'block';
    codeInput.disabled = true;
    
    updateBillUI();
    showToast('Voucher applied successfully!', 'success');
}

function removeVoucher() {
    appliedVoucher = null;
    
    // Update UI
    document.getElementById('voucher-applied-info').style.display = 'none';
    document.getElementById('btn-apply-voucher').style.display = 'block';
    document.getElementById('btn-remove-voucher').style.display = 'none';
    document.getElementById('pos-voucher-code').value = '';
    document.getElementById('pos-voucher-code').disabled = false;
    
    updateBillUI();
}

function calculateVoucherDiscount(subtotal) {
    if (!appliedVoucher) return 0;
    
    let discount = 0;
    if (appliedVoucher.discount_type === 'percentage') {
        discount = subtotal * (appliedVoucher.discount_value / 100);
    } else {
        discount = Math.min(appliedVoucher.discount_value, subtotal);
    }
    
    return discount;
}
