/* ============================================
   DIGITAL STORE - SUPABASE EDITION
   JavaScript Application with Cloud Sync
   ============================================ */

// ============================================
// KONFIGURASI - GANTI DENGAN DATA SUPABASE ANDA
// ============================================
const SUPABASE_URL = 'https://xjjilzbqdsqopbxfggiv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nrgI-f90SYolBJ8fzwv_EQ_MMx6f1wq';

// Google OAuth Credentials (dari user)
const GOOGLE_CLIENT_ID = '307105085538-3i914434c0dl1disga93ik52907bbr3o.apps.googleusercontent.com';

// ============================================
// SUPABASE CLIENT
// ============================================
let supabase = null;

function initSupabase() {
    if (SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
        console.warn('⚠️  Belum konfigurasi Supabase URL!');
        return false;
    }
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase connected');
        return true;
    } catch (e) {
        console.error('❌ Supabase init failed:', e);
        return false;
    }
}

// ============================================
// AUTH MODULE
// ============================================
const Auth = (function() {
    let currentUser = null;

    async function signInWithGoogle() {
        if (!supabase) {
            App.showToast('Supabase belum dikonfigurasi', 'error');
            return;
        }

        App.showLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent'
                    }
                }
            });

            if (error) throw error;
            console.log('🔐 Google OAuth initiated');
        } catch (err) {
            console.error('Auth error:', err);
            App.showToast('Gagal masuk: ' + err.message, 'error');
            App.showLoading(false);
        }
    }

    async function signOut() {
        if (!supabase) return;

        App.showLoading(true);
        try {
            await supabase.auth.signOut();
            currentUser = null;
            App.closeProfile();
            App.showAuthScreen();
            App.showToast('Berhasil keluar', 'info');
        } catch (err) {
            App.showToast('Gagal keluar', 'error');
        } finally {
            App.showLoading(false);
        }
    }

    async function getUser() {
        if (!supabase) return null;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            return user;
        } catch {
            return null;
        }
    }

    async function init() {
        if (!supabase) return;

        // Check existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            currentUser = session.user;
            App.showAppScreen(currentUser);
            await DB.loadProducts();
        }

        // Listen auth changes
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                currentUser = session.user;
                App.showAppScreen(currentUser);
                DB.loadProducts();
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                App.showAuthScreen();
            }
        });
    }

    return { signInWithGoogle, signOut, getUser, init };
})();

// ============================================
// DATABASE MODULE (Supabase)
// ============================================
const DB = (function() {
    let products = [];
    let isOnline = true;

    // ---------- PRODUCTS ----------
    async function loadProducts() {
        if (!supabase) {
            // Fallback: load dari LocalStorage
            products = JSON.parse(localStorage.getItem('digitalStore_products')) || [];
            App.renderProducts();
            App.updateStats();
            return;
        }

        App.showLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            products = data || [];
            // Sync ke LocalStorage sebagai backup
            localStorage.setItem('digitalStore_products', JSON.stringify(products));

            App.renderProducts();
            App.updateStats();
            App.updateSyncStatus(true);
            console.log(`📦 Loaded ${products.length} products from cloud`);
        } catch (err) {
            console.error('Load error:', err);
            // Fallback ke LocalStorage
            products = JSON.parse(localStorage.getItem('digitalStore_products')) || [];
            App.renderProducts();
            App.updateStats();
            App.updateSyncStatus(false);
            App.showToast('Mode offline - menggunakan data lokal', 'info');
        } finally {
            App.showLoading(false);
        }
    }

    async function addProduct(product) {
        if (!supabase) {
            products.unshift(product);
            localStorage.setItem('digitalStore_products', JSON.stringify(products));
            return product;
        }

        try {
            const { data, error } = await supabase
                .from('products')
                .insert([{
                    name: product.name,
                    category: product.category,
                    description: product.description,
                    price: product.price,
                    link: product.link,
                    image: product.image,
                    featured: product.featured,
                    user_id: (await Auth.getUser())?.id
                }])
                .select()
                .single();

            if (error) throw error;

            products.unshift(data);
            localStorage.setItem('digitalStore_products', JSON.stringify(products));
            return data;
        } catch (err) {
            console.error('Add error:', err);
            // Fallback: simpan lokal dulu, sync nanti
            products.unshift(product);
            localStorage.setItem('digitalStore_products', JSON.stringify(products));
            App.showToast('Tersimpan lokal - akan sync saat online', 'info');
            return product;
        }
    }

    async function updateProduct(id, updates) {
        if (!supabase) {
            const idx = products.findIndex(p => p.id === id);
            if (idx !== -1) {
                products[idx] = { ...products[idx], ...updates };
                localStorage.setItem('digitalStore_products', JSON.stringify(products));
            }
            return;
        }

        try {
            const { error } = await supabase
                .from('products')
                .update({
                    name: updates.name,
                    category: updates.category,
                    description: updates.description,
                    price: updates.price,
                    link: updates.link,
                    image: updates.image,
                    featured: updates.featured,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;

            const idx = products.findIndex(p => p.id === id);
            if (idx !== -1) {
                products[idx] = { ...products[idx], ...updates };
                localStorage.setItem('digitalStore_products', JSON.stringify(products));
            }
        } catch (err) {
            console.error('Update error:', err);
            const idx = products.findIndex(p => p.id === id);
            if (idx !== -1) {
                products[idx] = { ...products[idx], ...updates };
                localStorage.setItem('digitalStore_products', JSON.stringify(products));
            }
        }
    }

    async function deleteProduct(id) {
        if (!supabase) {
            products = products.filter(p => p.id !== id);
            localStorage.setItem('digitalStore_products', JSON.stringify(products));
            return;
        }

        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', id);

            if (error) throw error;

            products = products.filter(p => p.id !== id);
            localStorage.setItem('digitalStore_products', JSON.stringify(products));
        } catch (err) {
            console.error('Delete error:', err);
            products = products.filter(p => p.id !== id);
            localStorage.setItem('digitalStore_products', JSON.stringify(products));
        }
    }

    // ---------- REALTIME ----------
    function subscribeToChanges() {
        if (!supabase) return;

        supabase
            .channel('products_changes')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'products' 
            }, (payload) => {
                console.log('🔄 Realtime update:', payload);
                loadProducts();
            })
            .subscribe();
    }

    // ---------- GETTERS ----------
    function getProducts() { return products; }
    function setProducts(p) { products = p; }

    return { 
        loadProducts, 
        addProduct, 
        updateProduct, 
        deleteProduct,
        subscribeToChanges,
        getProducts,
        setProducts
    };
})();

// ============================================
// APP MODULE
// ============================================
const App = (function() {
    let cart = [];
    let currentImage = null;
    let editingId = null;
    let isFeatured = false;
    let currentUser = null;

    const els = {};

    function cacheElements() {
        els.authScreen = document.getElementById('authScreen');
        els.appContainer = document.getElementById('appContainer');
        els.tabBar = document.getElementById('tabBar');
        els.productsContainer = document.getElementById('productsContainer');
        els.cartBadge = document.getElementById('cartBadge');
        els.cartItemsContainer = document.getElementById('cartItemsContainer');
        els.cartTotal = document.getElementById('cartTotal');
        els.toastContainer = document.getElementById('toastContainer');
        els.searchInput = document.getElementById('searchInput');
        els.sheetOverlay = document.getElementById('productSheetOverlay');
        els.sheetTitle = document.getElementById('sheetTitle');
        els.productForm = document.getElementById('productForm');
        els.imagePreview = document.getElementById('imagePreview');
        els.featuredToggle = document.getElementById('featuredToggle');
        els.imageUpload = document.getElementById('imageUpload');
        els.loadingOverlay = document.getElementById('loadingOverlay');
        els.userGreeting = document.getElementById('userGreeting');
        els.userAvatar = document.getElementById('userAvatar');
        els.userIcon = document.getElementById('userIcon');
        els.syncStatus = document.getElementById('syncStatus');
    }

    // ---------- SCREEN MANAGEMENT ----------
    function showAuthScreen() {
        els.authScreen.style.display = 'flex';
        els.appContainer.style.display = 'none';
        els.tabBar.style.display = 'none';
    }

    function showAppScreen(user) {
        currentUser = user;
        els.authScreen.style.display = 'none';
        els.appContainer.style.display = 'block';
        els.tabBar.style.display = 'flex';

        // Update user info
        if (user) {
            els.userGreeting.textContent = `Halo, ${user.user_metadata?.full_name || user.email?.split('@')[0] || 'Pengguna'} 👋`;
            if (user.user_metadata?.avatar_url) {
                els.userAvatar.src = user.user_metadata.avatar_url;
                els.userAvatar.style.display = 'block';
                els.userIcon.style.display = 'none';
            }
        }

        // Load cart from local
        cart = JSON.parse(localStorage.getItem('digitalStore_cart')) || [];
        updateCartUI();
    }

    // ---------- LOADING ----------
    function showLoading(show) {
        els.loadingOverlay.classList.toggle('active', show);
    }

    // ---------- SYNC STATUS ----------
    function updateSyncStatus(online) {
        if (!els.syncStatus) return;
        if (online) {
            els.syncStatus.classList.remove('offline');
            els.syncStatus.innerHTML = '<i class="fas fa-wifi"></i><span>Online • Tersinkronisasi</span>';
        } else {
            els.syncStatus.classList.add('offline');
            els.syncStatus.innerHTML = '<i class="fas fa-wifi-slash"></i><span>Offline • Mode lokal</span>';
        }
    }

    // ---------- RENDER PRODUCTS ----------
    function renderProducts(searchTerm = '') {
        const products = DB.getProducts();
        let filtered = products;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = products.filter(p => 
                p.name?.toLowerCase().includes(term) ||
                p.category?.toLowerCase().includes(term) ||
                p.description?.toLowerCase().includes(term)
            );
        }

        if (filtered.length === 0) {
            els.productsContainer.innerHTML = `
                <div class="empty-ios">
                    <i class="fas fa-cube"></i>
                    <h3>Belum ada produk</h3>
                    <p>Tap "+ Baru" untuk menambahkan produk pertama Anda</p>
                </div>
            `;
            return;
        }

        els.productsContainer.innerHTML = filtered.map((product, index) => `
            <div class="product-ios" style="animation-delay: ${index * 0.05}s">
                <img src="${product.image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=300&fit=crop'}" 
                     alt="${escapeHtml(product.name)}" 
                     class="product-ios-image"
                     loading="lazy"
                     onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=300&fit=crop'">
                <div class="product-ios-body">
                    <div class="product-ios-meta">
                        <span class="ios-tag">${escapeHtml(product.category)}</span>
                        ${product.featured ? '<span class="ios-tag featured">🔥 Bestseller</span>' : ''}
                    </div>
                    <h3 class="product-ios-title">${escapeHtml(product.name)}</h3>
                    <p class="product-ios-desc">${escapeHtml(product.description)}</p>
                    <div class="product-ios-footer">
                        <span class="product-ios-price">Rp ${formatRupiah(product.price)}</span>
                        <div class="product-ios-actions">
                            <button class="ios-action edit" onclick="App.editProduct('${product.id}')" title="Edit">
                                <i class="fas fa-pen"></i>
                            </button>
                            <button class="ios-action delete" onclick="App.deleteProduct('${product.id}')" title="Hapus">
                                <i class="fas fa-trash"></i>
                            </button>
                            <button class="ios-action buy" onclick="App.addToCart('${product.id}')" title="Beli">
                                <i class="fas fa-bag-shopping"></i> Beli
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // ---------- STATS ----------
    function updateStats() {
        const products = DB.getProducts();
        document.getElementById('statProducts').textContent = products.length;

        const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
        document.getElementById('statCategories').textContent = categories.length;

        const totalValue = products.reduce((sum, p) => sum + (parseInt(p.price) || 0), 0);
        document.getElementById('statValue').textContent = 'Rp' + formatRupiah(totalValue);
        document.getElementById('statCart').textContent = cart.length;

        // Update profile stats
        document.getElementById('profileProductCount').textContent = products.length;
        document.getElementById('profileCartCount').textContent = cart.length;
    }

    // ---------- SEARCH ----------
    function search() {
        const term = els.searchInput.value;
        renderProducts(term);
    }

    // ---------- PROFILE ----------
    function toggleProfile() {
        const overlay = document.getElementById('profileSheetOverlay');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Update profile info
        if (currentUser) {
            document.getElementById('profileName').textContent = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Pengguna';
            document.getElementById('profileEmail').textContent = currentUser.email || '';
            if (currentUser.user_metadata?.avatar_url) {
                document.getElementById('profileAvatar').src = currentUser.user_metadata.avatar_url;
            }
        }
        updateStats();
    }

    function closeProfile(e) {
        if (e && e.target !== e.currentTarget) return;
        document.getElementById('profileSheetOverlay').classList.remove('active');
        document.body.style.overflow = '';
    }

    // ---------- PRODUCT SHEET ----------
    function openSheet(productId = null) {
        editingId = productId;
        const products = DB.getProducts();

        if (productId) {
            const product = products.find(p => p.id === productId);
            if (!product) return;

            els.sheetTitle.textContent = 'Edit Produk';
            document.getElementById('productId').value = product.id;
            document.getElementById('productName').value = product.name || '';
            document.getElementById('productCategory').value = product.category || '';
            document.getElementById('productDesc').value = product.description || '';
            document.getElementById('productPrice').value = product.price || '';
            document.getElementById('productLink').value = product.link || '';

            isFeatured = product.featured || false;
            els.featuredToggle.classList.toggle('active', isFeatured);

            if (product.image) {
                currentImage = product.image;
                els.imagePreview.src = product.image;
                els.imagePreview.style.display = 'block';
            } else {
                currentImage = null;
                els.imagePreview.style.display = 'none';
            }
        } else {
            els.sheetTitle.textContent = 'Produk Baru';
            els.productForm.reset();
            els.imagePreview.style.display = 'none';
            currentImage = null;
            isFeatured = false;
            els.featuredToggle.classList.remove('active');
        }

        els.sheetOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeSheet(e) {
        if (e && e.target !== e.currentTarget) return;
        els.sheetOverlay.classList.remove('active');
        document.body.style.overflow = '';
        setTimeout(() => {
            els.productForm.reset();
            els.imagePreview.style.display = 'none';
            currentImage = null;
            editingId = null;
            isFeatured = false;
            els.featuredToggle.classList.remove('active');
        }, 300);
    }

    // ---------- IMAGE ----------
    function handleImage(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            showToast('Ukuran file maksimal 2MB', 'error');
            return;
        }

        if (!file.type.startsWith('image/')) {
            showToast('File harus berupa gambar', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            currentImage = e.target.result;
            els.imagePreview.src = currentImage;
            els.imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    function toggleFeatured() {
        isFeatured = !isFeatured;
        els.featuredToggle.classList.toggle('active', isFeatured);
    }

    // ---------- SAVE PRODUCT ----------
    async function saveProduct() {
        const name = document.getElementById('productName').value.trim();
        const category = document.getElementById('productCategory').value;
        const description = document.getElementById('productDesc').value.trim();
        const price = parseInt(document.getElementById('productPrice').value) || 0;
        const link = document.getElementById('productLink').value.trim();

        if (!name || !category || !description || price <= 0 || !link) {
            showToast('Lengkapi semua field dengan benar', 'error');
            return;
        }

        showLoading(true);

        const productData = {
            id: editingId || Date.now().toString(),
            name,
            category,
            description,
            price,
            link,
            image: currentImage,
            featured: isFeatured,
            created_at: editingId ? undefined : new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (editingId) {
            await DB.updateProduct(editingId, productData);
            showToast('Produk diperbarui', 'success');
        } else {
            await DB.addProduct(productData);
            showToast('Produk ditambahkan', 'success');
        }

        renderProducts();
        updateStats();
        closeSheet();
        showLoading(false);
    }

    async function editProduct(id) {
        openSheet(id);
    }

    async function deleteProduct(id) {
        const products = DB.getProducts();
        const product = products.find(p => p.id === id);
        const name = product ? product.name : 'produk ini';

        if (confirm(`Hapus "${name}"?`)) {
            showLoading(true);
            await DB.deleteProduct(id);
            cart = cart.filter(item => item.id !== id);
            localStorage.setItem('digitalStore_cart', JSON.stringify(cart));
            renderProducts();
            updateStats();
            updateCartUI();
            showToast('Produk dihapus', 'info');
            showLoading(false);
        }
    }

    // ---------- CART ----------
    function addToCart(productId) {
        const products = DB.getProducts();
        const product = products.find(p => p.id === productId);
        if (!product) return;

        const existing = cart.find(item => item.id === productId);
        if (existing) {
            showToast('Produk sudah ada di keranjang', 'info');
            toggleCart();
            return;
        }

        cart.push({ ...product });
        localStorage.setItem('digitalStore_cart', JSON.stringify(cart));
        updateCartUI();
        showToast('Ditambahkan ke keranjang', 'success');
    }

    function removeFromCart(productId) {
        cart = cart.filter(item => item.id !== productId);
        localStorage.setItem('digitalStore_cart', JSON.stringify(cart));
        updateCartUI();
        showToast('Dihapus dari keranjang', 'info');
    }

    function clearCart() {
        if (cart.length === 0) {
            showToast('Keranjang sudah kosong', 'info');
            return;
        }
        if (confirm('Kosongkan semua isi keranjang?')) {
            cart = [];
            localStorage.setItem('digitalStore_cart', JSON.stringify(cart));
            updateCartUI();
            showToast('Keranjang dikosongkan', 'info');
        }
    }

    function updateCartUI() {
        const count = cart.length;
        els.cartBadge.textContent = count;
        els.cartBadge.style.display = count > 0 ? 'flex' : 'none';
        document.getElementById('statCart').textContent = count;

        if (cart.length === 0) {
            els.cartItemsContainer.innerHTML = `
                <div class="cart-empty">
                    <i class="fas fa-bag-shopping"></i>
                    <h3>Keranjang kosong</h3>
                    <p>Belum ada produk yang dipilih</p>
                </div>
            `;
            els.cartTotal.textContent = 'Rp 0';
            return;
        }

        els.cartItemsContainer.innerHTML = cart.map(item => `
            <div class="cart-item-ios">
                <img src="${item.image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop'}" 
                     alt="${escapeHtml(item.name)}"
                     onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop'">
                <div class="cart-item-info">
                    <div class="cart-item-title">${escapeHtml(item.name)}</div>
                    <div class="cart-item-price">Rp ${formatRupiah(item.price)}</div>
                </div>
                <button class="cart-item-remove" onclick="App.removeFromCart('${item.id}')" title="Hapus">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');

        const totalValue = cart.reduce((sum, item) => sum + (parseInt(item.price) || 0), 0);
        els.cartTotal.textContent = 'Rp ' + formatRupiah(totalValue);
    }

    function toggleCart() {
        const overlay = document.getElementById('cartSheetOverlay');
        const isActive = overlay.classList.contains('active');

        if (isActive) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        } else {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    function checkout() {
        if (cart.length === 0) {
            showToast('Keranjang masih kosong', 'error');
            return;
        }

        let message = '🛒 *PESANAN DIGITALSTORE*\n\n';
        let total = 0;

        cart.forEach((item, index) => {
            message += `${index + 1}. *${item.name}*\n`;
            message += `   💰 Rp ${formatRupiah(item.price)}\n`;
            message += `   🔗 ${item.link}\n\n`;
            total += parseInt(item.price) || 0;
        });

        message += `━━━━━━━━━━━━━━\n`;
        message += `*TOTAL: Rp ${formatRupiah(total)}*\n\n`;
        message += `Terima kasih telah berbelanja! 🙏`;

        navigator.clipboard.writeText(message).then(() => {
            showToast('Detail pesanan disalin!', 'success');
        }).catch(() => {
            showToast('Gagal menyalin, screenshot saja', 'error');
        });

        cart = [];
        localStorage.setItem('digitalStore_cart', JSON.stringify(cart));
        updateCartUI();
        toggleCart();
    }

    // ---------- SETTINGS ----------
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
        const isActive = toggle.classList.contains('active');
        localStorage.setItem(`setting_${key}`, isActive);
        showToast(`${key.charAt(0).toUpperCase() + key.slice(1)} ${isActive ? 'aktif' : 'nonaktif'}`, 'info');
    }

    async function resetData() {
        if (confirm('⚠️ Yakin reset SEMUA data?\n\nIni akan menghapus semua produk dari cloud dan lokal.')) {
            showLoading(true);

            if (supabase) {
                try {
                    await supabase.from('products').delete().neq('id', '0');
                } catch (e) {
                    console.error('Reset cloud error:', e);
                }
            }

            DB.setProducts([]);
            cart = [];
            localStorage.removeItem('digitalStore_products');
            localStorage.removeItem('digitalStore_cart');
            renderProducts();
            updateStats();
            updateCartUI();
            closeSettings();
            showToast('Semua data direset', 'success');
            showLoading(false);
        }
    }

    // ---------- HELP ----------
    function showHelp() {
        document.getElementById('helpSheetOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeHelp(e) {
        if (e && e.target !== e.currentTarget) return;
        document.getElementById('helpSheetOverlay').classList.remove('active');
        document.body.style.overflow = '';
    }

    // ---------- TAB ----------
    function switchTab(tab, el) {
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        if (el) el.classList.add('active');
        if (tab === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function scrollToProducts() {
        document.querySelector('.section-ios').scrollIntoView({ behavior: 'smooth' });
    }

    // ---------- TOAST ----------
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast-ios ${type}`;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-circle-xmark',
            info: 'fa-circle-info'
        };

        toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${escapeHtml(message)}</span>`;
        els.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            toast.style.transition = 'all 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ---------- UTILITIES ----------
    function formatRupiah(number) {
        if (typeof number !== 'number') number = parseInt(number) || 0;
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ---------- DRAG DROP ----------
    function setupDragDrop() {
        const upload = els.imageUpload;
        if (!upload) return;

        upload.addEventListener('dragover', (e) => {
            e.preventDefault();
            upload.style.borderColor = 'var(--ios-blue)';
            upload.style.background = 'rgba(10,132,255,0.1)';
        });

        upload.addEventListener('dragleave', () => {
            upload.style.borderColor = 'rgba(255,255,255,0.2)';
            upload.style.background = 'rgba(255,255,255,0.03)';
        });

        upload.addEventListener('drop', (e) => {
            e.preventDefault();
            upload.style.borderColor = 'rgba(255,255,255,0.2)';
            upload.style.background = 'rgba(255,255,255,0.03)';

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

    // ---------- KEYBOARD ----------
    function setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSheet();
                closeSettings();
                closeHelp();
                closeProfile();
                const cartOverlay = document.getElementById('cartSheetOverlay');
                if (cartOverlay.classList.contains('active')) toggleCart();
            }
        });
    }

    // ---------- TOUCH ----------
    function setupTouch() {
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) e.preventDefault();
            lastTouchEnd = now;
        }, { passive: false });
    }

    // ---------- INIT ----------
    async function init() {
        cacheElements();

        // Init Supabase
        const hasSupabase = initSupabase();

        if (hasSupabase) {
            await Auth.init();
            DB.subscribeToChanges();
        } else {
            // Mode offline: langsung tampilkan app
            showAppScreen(null);
            const localProducts = JSON.parse(localStorage.getItem('digitalStore_products')) || [];
            DB.setProducts(localProducts);
            renderProducts();
            updateStats();
            updateCartUI();
            updateSyncStatus(false);
        }

        setupDragDrop();
        setupKeyboard();
        setupTouch();

        console.log('🚀 DigitalStore Supabase Edition initialized');
    }

    // ---------- PUBLIC API ----------
    return {
        init,
        search,
        openSheet,
        closeSheet,
        handleImage,
        toggleFeatured,
        saveProduct,
        editProduct,
        deleteProduct,
        addToCart,
        removeFromCart,
        clearCart,
        toggleCart,
        checkout,
        showSettings,
        closeSettings,
        toggleSetting,
        resetData,
        showHelp,
        closeHelp,
        switchTab,
        scrollToProducts,
        toggleProfile,
        closeProfile,
        showAuthScreen,
        showAppScreen,
        showLoading,
        updateSyncStatus,
        renderProducts,
        updateStats,
        showToast
    };
})();

// Start app
document.addEventListener('DOMContentLoaded', App.init);
