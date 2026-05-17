/* DigitalStore - Minimal Supabase Edition */
[23.38, 17/5/2026] Dek Rin: // ===================================================
// ===== JEMBATAN COMPATIBILITY (AUTH & APP GLOBAL) =====
// ===================================================

// 1. Jembatan untuk sistem Auth Supabase (Memperbaiki Login Google)
if (typeof Auth === 'undefined') {
    window.Auth = {
        signInWithGoogle: typeof signInWithGoogle === 'function' ? signInWithGoogle : async () => {},
        signOut: typeof signOut === 'function' ? signOut : async () => {},
        getUser: async () => typeof currentUser !== 'undefined' ? currentUser : null,
        currentUser: typeof currentUser !== 'undefined' ? currentUser : null
    };
} else {
    if (typeof signInWithGoogle === 'function') Auth.signInWithGoogle = signInWithGoogle;
    if (typeof signOut === 'function') Auth.signOut = signOut;
    Auth.getUser = async () => typeof currentUser !== 'undefined' ? currentUser : null;
    Auth.currentUser = typeof currentUser !== 'undefined' ? currentUser : null;
}

// 2. Jembatan untuk objek App (Memperbaiki Semua Tombol Ikon Menu & "+ Baru")
if (typeof App === 'undefined') {
    window.App = {
        showPage: function(pageId) {
            if (typeof showPage === 'function') {
                showPage(pageId); 
            } else {
                const pages = document.querySelectorAll('.page, section, [data-page]');
                pages.forEach(p => p.classList.remove('active'));
                const targetPage = document.getElementById(pageId);
                if (targetPage) targetPage.classList.add('active');
            }
        },
        openModal: function(modalId) {
            if (typeof openModal === 'function') {
                openModal(modalId);
            } else {
                const modal = document.getElementById(modalId || 'productModal');
                if (modal) modal.style.display = 'block';
            }
        },
        closeModal: function(modalId) {
            if (typeof closeModal === 'function') {
                closeModal(modalId);
            } else {
                const modal = document.getElementById(modalId || 'productModal');
                if (modal) modal.style.display = 'none';
            }
        },
        init: typeof init === 'function' ? init : function() {}
    };
}
[23.45, 17/5/2026] Dek Rin: // =============================================================
// PILAR UTAMA: JEMBATAN COMPATIBILITY (AUTH & APP GLOBAL)
// Wajib ditaruh di Baris 1 agar tombol HTML tidak memicu eror
// =============================================================
window.App = {
    showPage: function(pageId) {
        if (typeof showPage === 'function') {
            showPage(pageId); 
        } else {
            // Jalur alternatif jika fungsi showPage global belum termuat
            const pages = document.querySelectorAll('.page, section, [data-page]');
            pages.forEach(p => p.classList.remove('active'));
            const targetPage = document.getElementById(pageId);
            if (targetPage) targetPage.classList.add('active');
        }
    },
    openModal: function(modalId) {
        if (typeof openModal === 'function') {
            openModal(modalId);
        } else {
            const modal = document.getElementById(modalId || 'productModal');
            if (modal) modal.style.display = 'block';
        }
    },
    closeModal: function(modalId) {
        if (typeof closeModal === 'function') {
            closeModal(modalId);
        } else {
            const modal = document.getElementById(modalId || 'productModal');
            if (modal) modal.style.display = 'none';
        }
    },
    init: function() {
        if (typeof init === 'function') init();
    }
};

if (typeof Auth === 'undefined') {
    window.Auth = {
        signInWithGoogle: function() { if (typeof signInWithGoogle === 'function') signInWithGoogle(); },
        signOut: function() { if (typeof signOut === 'function') signOut(); },
        getUser: async () => typeof currentUser !== 'undefined' ? currentUser : null,
        currentUser: null
    };
}
// =============================================================
// Konfigurasi
const SUPABASE_URL = 'https://xjjilzbqdsqopbxfggiv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nrgI-f90SYolBJ8fzwv_EQ_MMx6f1wq';

// Variabel global
let supabaseClient = null;
let products = [];
let cart = [];
let currentUser = null;

// Init
function init() {
    console.log('Initializing...');

    // Load Supabase library
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase library not loaded');
        showApp(); // mode offline
        return;
    }

    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase connected');
        checkAuth();
    } catch (e) {
        console.error('Supabase init failed:', e);
        showApp(); // mode offline
    }
}

// Check auth status
async function checkAuth() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session?.user) {
            currentUser = session.user;
            showApp();
            loadProducts();
        } else {
            showAuth();
        }

        // Listen auth changes
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                currentUser = session.user;
                showApp();
                loadProducts();
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                showAuth();
            }
        });
    } catch (e) {
        console.error('Auth check failed:', e);
        showAuth();
    }
}

// Show auth screen
function showAuth() {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('tabBar').style.display = 'none';
}

// Show app screen
function showApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('tabBar').style.display = 'flex';

    if (currentUser) {
        const name = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Pengguna';
        document.getElementById('userGreeting').textContent = 'Halo, ' + name + ' ðŸ‘‹';
    }

    cart = JSON.parse(localStorage.getItem('digitalStore_cart')) || [];
    updateCartUI();
}

// Login with Google
async function signInWithGoogle() {
    if (!supabaseClient) {
        alert('Supabase belum siap. Refresh halaman.');
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '') + '/index.html'
            }
        });

        if (error) {
            alert('Gagal login: ' + error.message);
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

// Logout
async function signOut() {
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
    }
    currentUser = null;
    showAuth();
}

// Load products
async function loadProducts() {
    if (!supabaseClient) {
        products = JSON.parse(localStorage.getItem('digitalStore_products')) || [];
        renderProducts();
        updateStats();
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        products = data || [];
        localStorage.setItem('digitalStore_products', JSON.stringify(products));
        renderProducts();
        updateStats();
    } catch (e) {
        console.error('Load products failed:', e);
        products = JSON.parse(localStorage.getItem('digitalStore_products')) || [];
        renderProducts();
        updateStats();
    }
}

// Render products
function renderProducts(searchTerm) {
    const container = document.getElementById('productsContainer');
    let filtered = products;

    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = products.filter(p => 
            (p.name && p.name.toLowerCase().includes(term)) ||
            (p.category && p.category.toLowerCase().includes(term))
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-ios"><i class="fas fa-cube"></i><h3>Belum ada produk</h3><p>Tap "+ Baru" untuk menambahkan</p></div>';
        return;
    }

    container.innerHTML = filtered.map((p, i) => `
        <div class="product-ios" style="animation-delay:${i*0.05}s">
            <img src="${p.image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=300&fit=crop'}" 
                 alt="${p.name}" class="product-ios-image" loading="lazy">
            <div class="product-ios-body">
                <div class="product-ios-meta">
                    <span class="ios-tag">${p.category || 'Lainnya'}</span>
                    ${p.featured ? '<span class="ios-tag featured">ðŸ”¥ Bestseller</span>' : ''}
                </div>
                <h3 class="product-ios-title">${p.name}</h3>
                <p class="product-ios-desc">${p.description || ''}</p>
                <div class="product-ios-footer">
                    <span class="product-ios-price">Rp ${formatRupiah(p.price || 0)}</span>
                    <div class="product-ios-actions">
                        <button class="ios-action edit" onclick="editProduct('${p.id}')" title="Edit"><i class="fas fa-pen"></i></button>
                        <button class="ios-action delete" onclick="deleteProduct('${p.id}')" title="Hapus"><i class="fas fa-trash"></i></button>
                        <button class="ios-action buy" onclick="addToCart('${p.id}')" title="Beli"><i class="fas fa-bag-shopping"></i> Beli</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Update stats
function updateStats() {
    document.getElementById('statProducts').textContent = products.length;
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    document.getElementById('statCategories').textContent = categories.length;
    const total = products.reduce((sum, p) => sum + (parseInt(p.price) || 0), 0);
    document.getElementById('statValue').textContent = 'Rp' + formatRupiah(total);
    document.getElementById('statCart').textContent = cart.length;
}

// Search
function searchProducts() {
    const term = document.getElementById('searchInput').value;
    renderProducts(term);
}

// Add/Edit product
let editingId = null;
let currentImage = null;
let isFeatured = false;

function openSheet(id) {
    editingId = id;
    const sheet = document.getElementById('productSheetOverlay');

    if (id) {
        const p = products.find(x => x.id === id);
        if (!p) return;
        document.getElementById('sheetTitle').textContent = 'Edit Produk';
        document.getElementById('productName').value = p.name || '';
        document.getElementById('productCategory').value = p.category || '';
        document.getElementById('productDesc').value = p.description || '';
        document.getElementById('productPrice').value = p.price || '';
        document.getElementById('productLink').value = p.link || '';
        isFeatured = p.featured || false;
        document.getElementById('featuredToggle').classList.toggle('active', isFeatured);
        if (p.image) {
            currentImage = p.image;
            document.getElementById('imagePreview').src = p.image;
            document.getElementById('imagePreview').style.display = 'block';
        }
    } else {
        document.getElementById('sheetTitle').textContent = 'Produk Baru';
        document.getElementById('productForm').reset();
        document.getElementById('imagePreview').style.display = 'none';
        currentImage = null;
        isFeatured = false;
        document.getElementById('featuredToggle').classList.remove('active');
    }

    sheet.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeSheet(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('productSheetOverlay').classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => {
        document.getElementById('productForm').reset();
        document.getElementById('imagePreview').style.display = 'none';
        currentImage = null;
        editingId = null;
        isFeatured = false;
        document.getElementById('featuredToggle').classList.remove('active');
    }, 300);
}

function handleImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Maksimal 2MB'); return; }

    const reader = new FileReader();
    reader.onload = (ev) => {
        currentImage = ev.target.result;
        document.getElementById('imagePreview').src = currentImage;
        document.getElementById('imagePreview').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function toggleFeatured() {
    isFeatured = !isFeatured;
    document.getElementById('featuredToggle').classList.toggle('active', isFeatured);
}

async function saveProduct() {
    const name = document.getElementById('productName').value.trim();
    const category = document.getElementById('productCategory').value;
    const description = document.getElementById('productDesc').value.trim();
    const price = parseInt(document.getElementById('productPrice').value) || 0;
    const link = document.getElementById('productLink').value.trim();

    if (!name || !category || !description || price <= 0 || !link) {
        alert('Lengkapi semua field');
        return;
    }

    const product = {
        id: editingId || Date.now().toString(),
        name, category, description, price, link,
        image: currentImage,
        featured: isFeatured,
        created_at: editingId ? undefined : new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    if (editingId) {
        // Update
        if (supabaseClient) {
            await supabaseClient.from('products').update(product).eq('id', editingId);
        }
        const idx = products.findIndex(p => p.id === editingId);
        if (idx !== -1) products[idx] = product;
    } else {
        // Add
        if (supabaseClient) {
            const { data } = await supabaseClient.from('products').insert([product]).select().single();
            if (data) product.id = data.id;
        }
        products.unshift(product);
    }

    localStorage.setItem('digitalStore_products', JSON.stringify(products));
    renderProducts();
    updateStats();
    closeSheet();
}

function editProduct(id) { openSheet(id); }

async function deleteProduct(id) {
    if (!confirm('Hapus produk ini?')) return;
    if (supabaseClient) {
        await supabaseClient.from('products').delete().eq('id', id);
    }
    products = products.filter(p => p.id !== id);
    cart = cart.filter(item => item.id !== id);
    localStorage.setItem('digitalStore_products', JSON.stringify(products));
    localStorage.setItem('digitalStore_cart', JSON.stringify(cart));
    renderProducts();
    updateStats();
    updateCartUI();
}

// Cart
function addToCart(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    if (cart.find(item => item.id === id)) {
        alert('Sudah di keranjang');
        return;
    }
    cart.push({...product});
    localStorage.setItem('digitalStore_cart', JSON.stringify(cart));
    updateCartUI();
    alert('Ditambahkan ke keranjang');
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    localStorage.setItem('digitalStore_cart', JSON.stringify(cart));
    updateCartUI();
}

function clearCart() {
    if (cart.length === 0) return;
    if (confirm('Kosongkan keranjang?')) {
        cart = [];
        localStorage.setItem('digitalStore_cart', JSON.stringify(cart));
        updateCartUI();
    }
}

function updateCartUI() {
    const badge = document.getElementById('cartBadge');
    const container = document.getElementById('cartItemsContainer');
    const totalEl = document.getElementById('cartTotal');

    badge.textContent = cart.length;
    badge.style.display = cart.length > 0 ? 'flex' : 'none';
    document.getElementById('statCart').textContent = cart.length;

    if (cart.length === 0) {
        container.innerHTML = '<div class="cart-empty"><i class="fas fa-bag-shopping"></i><h3>Keranjang kosong</h3></div>';
        totalEl.textContent = 'Rp 0';
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="cart-item-ios">
            <img src="${item.image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop'}" alt="${item.name}">
            <div class="cart-item-info">
                <div class="cart-item-title">${item.name}</div>
                <div class="cart-item-price">Rp ${formatRupiah(item.price)}</div>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart('${item.id}')"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');

    const total = cart.reduce((sum, item) => sum + (parseInt(item.price) || 0), 0);
    totalEl.textContent = 'Rp ' + formatRupiah(total);
}

function toggleCart() {
    const overlay = document.getElementById('cartSheetOverlay');
    overlay.classList.toggle('active');
    document.body.style.overflow = overlay.classList.contains('active') ? 'hidden' : '';
}

function checkout() {
    if (cart.length === 0) { alert('Keranjang kosong'); return; }

    let msg = 'ðŸ›’ PESANAN\n\n';
    let total = 0;
    cart.forEach((item, i) => {
        msg += `${i+1}. ${item.name} - Rp ${formatRupiah(item.price)}\n`;
        total += parseInt(item.price) || 0;
    });
    msg += `\nTotal: Rp ${formatRupiah(total)}`;

    navigator.clipboard.writeText(msg).then(() => alert('Disalin!'));
    cart = [];
    localStorage.setItem('digitalStore_cart', JSON.stringify(cart));
    updateCartUI();
    toggleCart();
}

// Settings
function showSettings() {
    document.getElementById('settingsSheetOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeSettings(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('settingsSheetOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

function toggleSetting(el, key) {
    const toggle = el.querySelector('.toggle-switch');
    toggle.classList.toggle('active');
    localStorage.setItem('setting_' + key, toggle.classList.contains('active'));
}

async function resetData() {
    if (!confirm('Reset SEMUA data?')) return;
    if (supabaseClient) {
        await supabaseClient.from('products').delete().neq('id', '0');
    }
    products = [];
    cart = [];
    localStorage.removeItem('digitalStore_products');
    localStorage.removeItem('digitalStore_cart');

function closeProfile(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('profileSheetOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

// Tab
function switchTab(tab, el) {
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    if (tab === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollToProducts() {
    document.querySelector('.section-ios').scrollIntoView({ behavior: 'smooth' });
}

// Utilities
function formatRupiah(num) {
    return (parseInt(num) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Drag & drop
function setupDragDrop() {
    const upload = document.getElementById('imageUpload');
    if (!upload) return;
    upload.addEventListener('dragover', (e) => { e.preventDefault(); upload.style.borderColor = 'var(--ios-blue)'; });
    upload.addEventListener('dragleave', () => { upload.style.borderColor = 'rgba(255,255,255,0.2)'; });
    upload.addEventListener('drop', (e) => {
        e.preventDefault();
        upload.style.borderColor = 'rgba(255,255,255,0.2)';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const input = document.getElementById('productImage');
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            handleImage({ target: input });
        }
    });
}

// Keyboard
function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSheet(); closeSettings(); closeHelp(); closeProfile();
            const cartOverlay = document.getElementById('cartSheetOverlay');
            if (cartOverlay && cartOverlay.classList.contains('active')) toggleCart();
        }
    });
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    init();
    setupDragDrop();
    setupKeyboard();
});

// ===== WRAPPER UNTUK COMPATIBILITY =====
// Agar index.html yang pakai Auth.signInWithGoogle() tetap jalan tanpa error bentrok nama
if (typeof Auth === 'undefined') {

// ===================================================
// ===== JEMBATAN COMPATIBILITY (AUTH & APP GLOBAL) =====
// ===================================================

// 1. Jembatan untuk sistem Auth Supabase (Memperbaiki Login Google)
if (typeof Auth === 'undefined') {
    window.Auth = {
        signInWithGoogle: typeof signInWithGoogle === 'function' ? signInWithGoogle : async () => {},
        signOut: typeof signOut === 'function' ? signOut : async () => {},
        getUser: async () => typeof currentUser !== 'undefined' ? currentUser : null,
        currentUser: typeof currentUser !== 'undefined' ? currentUser : null
    };
} else {
    if (typeof signInWithGoogle === 'function') Auth.signInWithGoogle = signInWithGoogle;
    if (typeof signOut === 'function') Auth.signOut = signOut;
    Auth.getUser = async () => typeof currentUser !== 'undefined' ? currentUser : null;
    Auth.currentUser = typeof currentUser !== 'undefined' ? currentUser : null;
}

// 2. Jembatan untuk objek App (Memperbaiki Semua Tombol Ikon Menu & "+ Baru")
if (typeof App === 'undefined') {
    window.App = {
        showPage: function(pageId) {
            if (typeof showPage === 'function') {
                showPage(pageId); 
            } else {
                const pages = document.querySelectorAll('.page, section, [data-page]');
                pages.forEach(p => p.classList.remove('active'));
                const targetPage = document.getElementById(pageId);
                if (targetPage) targetPage.classList.add('active');
            }
        },
        openModal: function(modalId) {
            if (typeof openModal === 'function') {
                openModal(modalId);
            } else {
                const modal = document.getElementById(modalId || 'productModal');
                if (modal) modal.style.display = 'block';
            }
        },
        closeModal: function(modalId) {
            if (typeof closeModal === 'function') {
                closeModal(modalId);
            } else {
                const modal = document.getElementById(modalId || 'productModal');
                if (modal) modal.style.display = 'none';
            }
        },
        init: typeof init === 'function' ? init : function() {}
    };
}
