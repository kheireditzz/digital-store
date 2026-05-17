/* ============================================
   DIGITAL STORE - SUPABASE EDITION (FIXED)
   JavaScript Application with Cloud Sync
   ============================================ */

// ============================================
// KONFIGURASI - GANTI DENGAN DATA SUPABASE ANDA
// ============================================
const SUPABASE_URL = 'https://xjjilzbqdsqopbxfggiv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nrgI-f90SYolBJ8fzwv_EQ_MMx6f1wq';

// Google OAuth Credentials
const GOOGLE_CLIENT_ID = '307105085538-3i914434c0dl1disga93ik52907bbr3o.apps.googleusercontent.com';

// ============================================
// SUPABASE CLIENT
// ============================================
let supabase = null;
let isSupabaseReady = false;

function initSupabase() {
    try {
        // Check if supabase library loaded
        if (typeof window.supabase === 'undefined') {
            console.error('❌ Supabase library not loaded');
            return false;
        }

        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        isSupabaseReady = true;
        console.log('✅ Supabase connected');
        return true;
    } catch (e) {
        console.error('❌ Supabase init failed:', e);
        isSupabaseReady = false;
        return false;
    }
}

// ============================================
// AUTH MODULE
// ============================================
const Auth = {
    currentUser: null,

    async signInWithGoogle() {
        if (!isSupabaseReady || !supabase) {
            alert('Supabase belum siap. Coba refresh halaman.');
            return;
        }

        try {
            console.log('🔐 Starting Google OAuth...');
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '') + '/index.html',
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent'
                    }
                }
            });

            if (error) {
                console.error('OAuth error:', error);
                alert('Gagal login: ' + error.message);
                return;
            }

            console.log('✅ OAuth initiated, redirecting...');
            // Browser akan redirect otomatis ke Google
        } catch (err) {
            console.error('Auth exception:', err);
            alert('Error: ' + err.message);
        }
    },

    async signOut() {
        if (!supabase) return;
        try {
            await supabase.auth.signOut();
            Auth.currentUser = null;
            App.showAuthScreen();
            alert('Berhasil keluar');
        } catch (err) {
            alert('Gagal keluar');
        }
    },

    async getUser() {
        if (!supabase) return null;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            return user;
        } catch {
            return null;
        }
    },

    async init() {
        if (!supabase) {
            console.log('⚠️ Supabase not available, skipping auth init');
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                Auth.currentUser = session.user;
                App.showAppScreen(session.user);
                await DB.loadProducts();
            }

            supabase.auth.onAuthStateChange((event, session) => {
                console.log('Auth event:', event);
                if (event === 'SIGNED_IN' && session?.user) {
                    Auth.currentUser = session.user;
                    App.showAppScreen(session.user);
                    DB.loadProducts();
                } else if (event === 'SIGNED_OUT') {
                    Auth.currentUser = null;
                    App.showAuthScreen();
                }
            });
        } catch (e) {
            console.error('Auth init error:', e);
        }
    }
};

// ============================================
// DATABASE MODULE (Supabase)
// ============================================
const DB = {
    products: [],

    async loadProducts() {
        if (!isSupabaseReady) {
            console.log('⚠️ Offline mode - loading from LocalStorage');
            DB.products = JSON.parse(localStorage.getItem('digitalStore_products')) || [];
            App.renderProducts();
            App.updateStats();
            return;
        }

        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            DB.products = data || [];
            localStorage.setItem('digitalStore_products', JSON.stringify(DB.products));

            App.renderProducts();
            App.updateStats();
            App.updateSyncStatus(true);
            console.log(`📦 Loaded ${DB.products.length} products`);
        } catch (err) {
            console.error('Load error:', err);
            DB.products = JSON.parse(localStorage.getItem('digitalStore_products')) || [];
            App.renderProducts();
            App.updateStats();
            App.updateSyncStatus(false);
        }
    },

    async addProduct(product) {
        if (!isSupabaseReady) {
            DB.products.unshift(product);
            localStorage.setItem('digitalStore_products', JSON.stringify(DB.products));
            return product;
        }

        try {
            const user = await Auth.getUser();
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
                    user_id: user?.id
                }])
                .select()
                .single();

            if (error) throw error;
            DB.products.unshift(data);
            localStorage.setItem('digitalStore_products', JSON.stringify(DB.products));
            return data;
        } catch (err) {
            console.error('Add error:', err);
            DB.products.unshift(product);
            localStorage.setItem('digitalStore_products', JSON.stringify(DB.products));
            return product;
        }
    },

    async updateProduct(id, updates) {
        if (!isSupabaseReady) {
            const idx = DB.products.findIndex(p => p.id === id);
            if (idx !== -1) {
                DB.products[idx] = { ...DB.products[idx], ...updates };
                localStorage.setItem('digitalStore_products', JSON.stringify(DB.products));
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

            const idx = DB.products.findIndex(p => p.id === id);
            if (idx !== -1) {
                DB.products[idx] = { ...DB.products[idx], ...updates };
                localStorage.setItem('digitalStore_products', JSON.stringify(DB.products));
            }
        } catch (err) {
            console.error('Update error:', err);
        }
    },

    async deleteProduct(id) {
        if (!isSupabaseReady) {
            DB.products = DB.products.filter(p => p.id !== id);
            localStorage.setItem('digitalStore_products', JSON.stringify(DB.products));
            return;
        }

        try {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) throw error;
            DB.products = DB.products.filter(p => p.id !== id);
            localStorage.setItem('digitalStore_products', JSON.stringify(DB.products));
        } catch (err) {
            console.error('Delete error:', err);
        }
    },

    subscribeToChanges() {
        if (!isSupabaseReady) return;
        supabase
            .channel('products_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
                console.log('🔄 Realtime update:', payload);
                DB.loadProducts();
            })
            .subscribe();
    }
};

// ============================================
// APP MODULE
// ============================================
const App = {
    cart: [],
    currentImage: null,
    editingId: null,
    isFeatured: false,
    currentUser: null,

    // ---------- SCREEN MANAGEMENT ----------
    showAuthScreen() {
        const authScreen = document.getElementById('authScreen');
        const appContainer = document.getElementById('appContainer');
        const tabBar = document.getElementById('tabBar');

        if (authScreen) authScreen.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
        if (tabBar) tabBar.style.display = 'none';
    },

    showAppScreen(user) {
        App.currentUser = user;
        const authScreen = document.getElementById('authScreen');
        const appContainer = document.getElementById('appContainer');
        const tabBar = document.getElementById('tabBar');
        const userGreeting = document.getElementById('userGreeting');
        const userAvatar = document.getElementById('userAvatar');
        const userIcon = document.getElementById('userIcon');

        if (authScreen) authScreen.style.display = 'none';
        if (appContainer) appContainer.style.display = 'block';
        if (tabBar) tabBar.style.display = 'flex';

        if (user && userGreeting) {
            const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Pengguna';
            userGreeting.textContent = `Halo, ${name} 👋`;

            if (user.user_metadata?.avatar_url && userAvatar && userIcon) {
                userAvatar.src = user.user_metadata.avatar_url;
                userAvatar.style.display = 'block';
                userIcon.style.display = 'none';
            }
        }

        App.cart = JSON.parse(localStorage.getItem('digitalStore_cart')) || [];
        App.updateCartUI();
    },

    // ---------- LOADING ----------
    showLoading(show) {
        const el = document.getElementById('loadingOverlay');
        if (el) el.classList.toggle('active', show);
    },

    // ---------- SYNC STATUS ----------
    updateSyncStatus(online) {
        const el = document.getElementById('syncStatus');
        if (!el) return;
        if (online) {
            el.classList.remove('offline');
            el.innerHTML = '<i class="fas fa-wifi"></i><span>Online • Tersinkronisasi</span>';
        } else {
            el.classList.add('offline');
            el.innerHTML = '<i class="fas fa-wifi-slash"></i><span>Offline • Mode lokal</span>';
        }
    },

    // ---------- RENDER PRODUCTS ----------
    renderProducts(searchTerm = '') {
        const container = document.getElementById('productsContainer');
        if (!container) return;

        let filtered = DB.products;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = DB.products.filter(p => 
                p.name?.toLowerCase().includes(term) ||
                p.category?.toLowerCase().includes(term) ||
                p.description?.toLowerCase().includes(term)
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-ios">
                    <i class="fas fa-cube"></i>
                    <h3>Belum ada produk</h3>
                    <p>Tap "+ Baru" untuk menambahkan produk pertama Anda</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map((product, index) => `
            <div class="product-ios" style="animation-delay: ${index * 0.05}s">
                <img src="${product.image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=300&fit=crop'}" 
                     alt="${App.escapeHtml(product.name)}" 
                     class="product-ios-image"
                     loading="lazy"
                     onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=300&fit=crop'">
                <div class="product-ios-body">
                    <div class="product-ios-meta">
                        <span class="ios-tag">${App.escapeHtml(product.category)}</span>
                        ${product.featured ? '<span class="ios-tag featured">🔥 Bestseller</span>' : ''}
                    </div>
                    <h3 class="product-ios-title">${App.escapeHtml(product.name)}</h3>
                    <p class="product-ios-desc">${App.escapeHtml(product.description)}</p>
                    <div class="product-ios-footer">
                        <span class="product-ios-price">Rp ${App.formatRupiah(product.price)}</span>
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
    },

    // ---------- STATS ----------
    updateStats() {
        document.getElementById('statProducts').textContent = DB.products.length;
        const categories = [...new Set(DB.products.map(p => p.category).filter(Boolean))];
        document.getElementById('statCategories').textContent = categories.length;
        const totalValue = DB.products.reduce((sum, p) => sum + (parseInt(p.price) || 0), 0);
        document.getElementById('statValue').textContent = 'Rp' + App.formatRupiah(totalValue);
        document.getElementById('statCart').textContent = App.cart.length;

        const profileProductCount = document.getElementById('profileProductCount');
        const profileCartCount = document.getElementById('profileCartCount');
        if (profileProductCount) profileProductCount.textContent = DB.products.length;
        if (profileCartCount) profileCartCount.textContent = App.cart.length;
    },

    // ---------- SEARCH ----------
    search() {
        const term = document.getElementById('searchInput')?.value || '';
        App.renderProducts(term);
    },

    // ---------- PROFILE ----------
    toggleProfile() {
        const overlay = document.getElementById('profileSheetOverlay');
        if (overlay) {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        if (App.currentUser) {
            const name = App.currentUser.user_metadata?.full_name || App.currentUser.email?.split('@')[0] || 'Pengguna';
            const email = App.currentUser.email || '';
            const profileName = document.getElementById('profileName');
            const profileEmail = document.getElementById('profileEmail');
            const profileAvatar = document.getElementById('profileAvatar');

            if (profileName) profileName.textContent = name;
            if (profileEmail) profileEmail.textContent = email;
            if (profileAvatar && App.currentUser.user_metadata?.avatar_url) {
                profileAvatar.src = App.currentUser.user_metadata.avatar_url;
            }
        }
        App.updateStats();
    },

    closeProfile(e) {
        if (e && e.target !== e.currentTarget) return;
        const overlay = document.getElementById('profileSheetOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    // ---------- PRODUCT SHEET ----------
    openSheet(productId = null) {
        App.editingId = productId;
        const sheetOverlay = document.getElementById('productSheetOverlay');
        const sheetTitle = document.getElementById('sheetTitle');
        const productForm = document.getElementById('productForm');
        const imagePreview = document.getElementById('imagePreview');
        const featuredToggle = document.getElementById('featuredToggle');

        if (!sheetOverlay) return;

        if (productId) {
            const product = DB.products.find(p => p.id === productId);
            if (!product) return;

            if (sheetTitle) sheetTitle.textContent = 'Edit Produk';
            document.getElementById('productId').value = product.id;
            document.getElementById('productName').value = product.name || '';
            document.getElementById('productCategory').value = product.category || '';
            document.getElementById('productDesc').value = product.description || '';
            document.getElementById('productPrice').value = product.price || '';
            document.getElementById('productLink').value = product.link || '';

            App.isFeatured = product.featured || false;
            if (featuredToggle) featuredToggle.classList.toggle('active', App.isFeatured);

            if (product.image) {
                App.currentImage = product.image;
                if (imagePreview) {
                    imagePreview.src = product.image;
                    imagePreview.style.display = 'block';
                }
            } else {
                App.currentImage = null;
                if (imagePreview) imagePreview.style.display = 'none';
            }
        } else {
            if (sheetTitle) sheetTitle.textContent = 'Produk Baru';
            if (productForm) productForm.reset();
            if (imagePreview) imagePreview.style.display = 'none';
            App.currentImage = null;
            App.isFeatured = false;
            if (featuredToggle) featuredToggle.classList.remove('active');
        }

        sheetOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    closeSheet(e) {
        if (e && e.target !== e.currentTarget) return;
        const sheetOverlay = document.getElementById('productSheetOverlay');
        if (sheetOverlay) {
            sheetOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
        setTimeout(() => {
            const productForm = document.getElementById('productForm');
            const imagePreview = document.getElementById('imagePreview');
            const featuredToggle = document.getElementById('featuredToggle');

            if (productForm) productForm.reset();
            if (imagePreview) imagePreview.style.display = 'none';
            App.currentImage = null;
            App.editingId = null;
            App.isFeatured = false;
            if (featuredToggle) featuredToggle.classList.remove('active');
        }, 300);
    },

    // ---------- IMAGE ----------
    handleImage(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            App.showToast('Ukuran file maksimal 2MB', 'error');
            return;
        }

        if (!file.type.startsWith('image/')) {
            App.showToast('File harus berupa gambar', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            App.currentImage = e.target.result;
            const imagePreview = document.getElementById('imagePreview');
            if (imagePreview) {
                imagePreview.src = App.currentImage;
                imagePreview.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    },

    toggleFeatured() {
        App.isFeatured = !App.isFeatured;
        const featuredToggle = document.getElementById('featuredToggle');
        if (featuredToggle) featuredToggle.classList.toggle('active', App.isFeatured);
    },

    // ---------- SAVE PRODUCT ----------
    async saveProduct() {
        const name = document.getElementById('productName')?.value.trim();
        const category = document.getElementById('productCategory')?.value;
        const description = document.getElementById('productDesc')?.value.trim();
        const price = parseInt(document.getElementById('productPrice')?.value) || 0;
        const link = document.getElementById('productLink')?.value.trim();

        if (!name || !category || !description || price <= 0 || !link) {
            App.showToast('Lengkapi semua field dengan benar', 'error');
            return;
        }

        App.showLoading(true);

        const productData = {
            id: App.editingId || Date.now().toString(),
            name,
            category,
            description,
            price,
            link,
            image: App.currentImage,
            featured: App.isFeatured,
            created_at: App.editingId ? undefined : new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (App.editingId) {
            await DB.updateProduct(App.editingId, productData);
            App.showToast('Produk diperbarui', 'success');
        } else {
            await DB.addProduct(productData);
            App.showToast('Produk ditambahkan', 'success');
        }

        App.renderProducts();
        App.updateStats();
        App.closeSheet();
        App.showLoading(false);
    },

    async editProduct(id) {
        App.openSheet(id);
    },

    async deleteProduct(id) {
        const product = DB.products.find(p => p.id === id);
        const name = product ? product.name : 'produk ini';

        if (confirm(`Hapus "${name}"?`)) {
            App.showLoading(true);
            await DB.deleteProduct(id);
            App.cart = App.cart.filter(item => item.id !== id);
            localStorage.setItem('digitalStore_cart', JSON.stringify(App.cart));
            App.renderProducts();
            App.updateStats();
            App.updateCartUI();
            App.showToast('Produk dihapus', 'info');
            App.showLoading(false);
        }
    },

    // ---------- CART ----------
    addToCart(productId) {
        const product = DB.products.find(p => p.id === productId);
        if (!product) return;

        const existing = App.cart.find(item => item.id === productId);
        if (existing) {
            App.showToast('Produk sudah ada di keranjang', 'info');
            App.toggleCart();
            return;
        }

        App.cart.push({ ...product });
        localStorage.setItem('digitalStore_cart', JSON.stringify(App.cart));
        App.updateCartUI();
        App.showToast('Ditambahkan ke keranjang', 'success');
    },

    removeFromCart(productId) {
        App.cart = App.cart.filter(item => item.id !== productId);
        localStorage.setItem('digitalStore_cart', JSON.stringify(App.cart));
        App.updateCartUI();
        App.showToast('Dihapus dari keranjang', 'info');
    },

    clearCart() {
        if (App.cart.length === 0) {
            App.showToast('Keranjang sudah kosong', 'info');
            return;
        }
        if (confirm('Kosongkan semua isi keranjang?')) {
            App.cart = [];
            localStorage.setItem('digitalStore_cart', JSON.stringify(App.cart));
            App.updateCartUI();
            App.showToast('Keranjang dikosongkan', 'info');
        }
    },

    updateCartUI() {
        const cartBadge = document.getElementById('cartBadge');
        const cartItemsContainer = document.getElementById('cartItemsContainer');
        const cartTotal = document.getElementById('cartTotal');

        const count = App.cart.length;
        if (cartBadge) {
            cartBadge.textContent = count;
            cartBadge.style.display = count > 0 ? 'flex' : 'none';
        }
        const statCart = document.getElementById('statCart');
        if (statCart) statCart.textContent = count;

        if (!cartItemsContainer) return;

        if (App.cart.length === 0) {
            cartItemsContainer.innerHTML = `
                <div class="cart-empty">
                    <i class="fas fa-bag-shopping"></i>
                    <h3>Keranjang kosong</h3>
                    <p>Belum ada produk yang dipilih</p>
                </div>
            `;
            if (cartTotal) cartTotal.textContent = 'Rp 0';
            return;
        }

        cartItemsContainer.innerHTML = App.cart.map(item => `
            <div class="cart-item-ios">
                <img src="${item.image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop'}" 
                     alt="${App.escapeHtml(item.name)}"
                     onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop'">
                <div class="cart-item-info">
                    <div class="cart-item-title">${App.escapeHtml(item.name)}</div>
                    <div class="cart-item-price">Rp ${App.formatRupiah(item.price)}</div>
                </div>
                <button class="cart-item-remove" onclick="App.removeFromCart('${item.id}')" title="Hapus">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');

        const totalValue = App.cart.reduce((sum, item) => sum + (parseInt(item.price) || 0), 0);
        if (cartTotal) cartTotal.textContent = 'Rp ' + App.formatRupiah(totalValue);
    },

    toggleCart() {
        const overlay = document.getElementById('cartSheetOverlay');
        if (!overlay) return;

        const isActive = overlay.classList.contains('active');
        if (isActive) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        } else {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    checkout() {
        if (App.cart.length === 0) {
            App.showToast('Keranjang masih kosong', 'error');
            return;
        }

        let message = '🛒 *PESANAN DIGITALSTORE*\n\n';
        let total = 0;

        App.cart.forEach((item, index) => {
            message += `${index + 1}. *${item.name}*\n`;
            message += `   💰 Rp ${App.formatRupiah(item.price)}\n`;
            message += `   🔗 ${item.link}\n\n`;
            total += parseInt(item.price) || 0;
        });

        message += `━━━━━━━━━━━━━━\n`;
        message += `*TOTAL: Rp ${App.formatRupiah(total)}*\n\n`;
        message += `Terima kasih telah berbelanja! 🙏`;

        navigator.clipboard.writeText(message).then(() => {
            App.showToast('Detail pesanan disalin!', 'success');
        }).catch(() => {
            App.showToast('Gagal menyalin, screenshot saja', 'error');
        });

        App.cart = [];
        localStorage.setItem('digitalStore_cart', JSON.stringify(App.cart));
        App.updateCartUI();
        App.toggleCart();
    },

    // ---------- SETTINGS ----------
    showSettings() {
        const overlay = document.getElementById('settingsSheetOverlay');
        if (overlay) {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    closeSettings(e) {
        if (e && e.target !== e.currentTarget) return;
        const overlay = document.getElementById('settingsSheetOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    toggleSetting(el, key) {
        const toggle = el.querySelector('.toggle-switch');
        if (toggle) {
            toggle.classList.toggle('active');
            const isActive = toggle.classList.contains('active');
            localStorage.setItem(`setting_${key}`, isActive);
            App.showToast(`${key.charAt(0).toUpperCase() + key.slice(1)} ${isActive ? 'aktif' : 'nonaktif'}`, 'info');
        }
    },

    async resetData() {
        if (confirm('⚠️ Yakin reset SEMUA data?\n\nIni akan menghapus semua produk dari cloud dan lokal.')) {
            App.showLoading(true);

            if (isSupabaseReady) {
                try {
                    await supabase.from('products').delete().neq('id', '0');
                } catch (e) {
                    console.error('Reset cloud error:', e);
                }
            }

            DB.products = [];
            App.cart = [];
            localStorage.removeItem('digitalStore_products');
            localStorage.removeItem('digitalStore_cart');
            App.renderProducts();
            App.updateStats();
            App.updateCartUI();
            App.closeSettings();
            App.showToast('Semua data direset', 'success');
            App.showLoading(false);
        }
    },

    // ---------- HELP ----------
    showHelp() {
        const overlay = document.getElementById('helpSheetOverlay');
        if (overlay) {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    closeHelp(e) {
        if (e && e.target !== e.currentTarget) return;
        const overlay = document.getElementById('helpSheetOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    // ---------- TAB ----------
    switchTab(tab, el) {
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        if (el) el.classList.add('active');
        if (tab === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    scrollToProducts() {
        const section = document.querySelector('.section-ios');
        if (section) section.scrollIntoView({ behavior: 'smooth' });
    },

    // ---------- TOAST ----------
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-circle-xmark',
            info: 'fa-circle-info'
        };

        const toast = document.createElement('div');
        toast.className = `toast-ios ${type}`;
        toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${App.escapeHtml(message)}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            toast.style.transition = 'all 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // ---------- UTILITIES ----------
    formatRupiah(number) {
        if (typeof number !== 'number') number = parseInt(number) || 0;
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // ---------- INIT ----------
    async init() {
        console.log('🚀 DigitalStore initializing...');

        // Init Supabase
        const hasSupabase = initSupabase();

        if (hasSupabase) {
            await Auth.init();
            DB.subscribeToChanges();
        } else {
            // Mode offline
            App.showAppScreen(null);
            DB.products = JSON.parse(localStorage.getItem('digitalStore_products')) || [];
            App.renderProducts();
            App.updateStats();
            App.updateCartUI();
            App.updateSyncStatus(false);
        }

        // Setup drag & drop
        const imageUpload = document.getElementById('imageUpload');
        if (imageUpload) {
            imageUpload.addEventListener('dragover', (e) => {
                e.preventDefault();
                imageUpload.style.borderColor = 'var(--ios-blue)';
                imageUpload.style.background = 'rgba(10,132,255,0.1)';
            });
            imageUpload.addEventListener('dragleave', () => {
                imageUpload.style.borderColor = 'rgba(255,255,255,0.2)';
                imageUpload.style.background = 'rgba(255,255,255,0.03)';
            });
            imageUpload.addEventListener('drop', (e) => {
                e.preventDefault();
                imageUpload.style.borderColor = 'rgba(255,255,255,0.2)';
                imageUpload.style.background = 'rgba(255,255,255,0.03)';
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    const input = document.getElementById('productImage');
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    input.files = dt.files;
                    App.handleImage({ target: input });
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                App.closeSheet();
                App.closeSettings();
                App.closeHelp();
                App.closeProfile();
                const cartOverlay = document.getElementById('cartSheetOverlay');
                if (cartOverlay && cartOverlay.classList.contains('active')) App.toggleCart();
            }
        });

        // Prevent double tap zoom
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) e.preventDefault();
            lastTouchEnd = now;
        }, { passive: false });

        console.log('✅ DigitalStore initialized');
    }
};

// Start app when DOM ready
document.addEventListener('DOMContentLoaded', App.init);
