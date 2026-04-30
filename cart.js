/* =====================================================
   HALOI THREADS — UNIVERSAL CART + RAZORPAY CHECKOUT
   =====================================================*/

const HaloiCart = {
    key: 'haloi_cart_v2',
    items: [],

    /* ── INIT ────────────────────────────────────────── */
    init() {
        const stored = localStorage.getItem(this.key);
        if (stored) {
            try { this.items = JSON.parse(stored); }
            catch (e) { this.items = []; }
        }
        this.updateGlobalTotals();
        if (document.getElementById('cart-items-wrapper')) {
            this.render();
        }
        // Wire checkout button
        const btn = document.getElementById('btn-checkout');
        if (btn) btn.onclick = () => this.openCheckout();
    },

    /* ── PERSISTENCE ─────────────────────────────────── */
    save() {
        localStorage.setItem(this.key, JSON.stringify(this.items));
        this.updateGlobalTotals();
    },

    /* ── ADD ─────────────────────────────────────────── */
    add(product) {
        let safePrice = product.price;
        if (typeof safePrice === 'string') {
            safePrice = Number(safePrice.replace(/[^0-9.]/g, ''));
        }
        const existing = this.items.find(i => i.id === product.id && i.variant === (product.variant || 'Standard'));
        if (existing) {
            existing.qty++;
        } else {
            this.items.push({
                id:      product.id,
                name:    product.name,
                price:   safePrice,
                image:   product.image || '',
                variant: product.variant || 'Standard',
                qty:     1
            });
        }
        this.save();
        this.render();
        this.open();
    },

    /* ── UPDATE QTY ──────────────────────────────────── */
    updateQty(id, variant, delta) {
        const item = this.items.find(i => i.id === id && i.variant === variant);
        if (!item) return;
        const newQty = item.qty + delta;
        if (newQty < 1) return;
        item.qty = newQty;
        this.save();
        const key = id + '_' + variant.replace(/\s+/g,'');
        const qtyEl = document.getElementById('qty-val-' + key);
        if (qtyEl) qtyEl.innerText = newQty;
        this.recalcTotals();
    },

    /* ── REMOVE ──────────────────────────────────────── */
    remove(id, variant) {
        this.items = this.items.filter(i => !(i.id === id && i.variant === variant));
        this.save();
        this.render();
    },

    /* ── CLEAR ───────────────────────────────────────── */
    clear() {
        this.items = [];
        this.save();
        this.render();
    },

    /* ── DRAWER OPEN/CLOSE ───────────────────────────── */
    open() {
        const overlay = document.getElementById('cart-overlay');
        const drawer  = document.getElementById('cart-drawer');
        if (overlay && drawer) {
            overlay.classList.add('active');
            setTimeout(() => drawer.classList.add('active'), 10);
        }
    },
    close() {
        const overlay = document.getElementById('cart-overlay');
        const drawer  = document.getElementById('cart-drawer');
        if (drawer)  drawer.classList.remove('active');
        if (overlay) setTimeout(() => overlay.classList.remove('active'), 450);
    },

    /* ── TOTALS ──────────────────────────────────────── */
    getTotal() {
        return this.items.reduce((s, i) => s + (i.price * i.qty), 0);
    },
    recalcTotals() {
        const total  = this.getTotal();
        const fmt    = new Intl.NumberFormat('en-IN').format(total);
        const subEl  = document.getElementById('cart-subtotal');
        const totEl  = document.getElementById('cart-total');
        if (subEl) subEl.innerText = '₹' + fmt;
        if (totEl) totEl.innerText = '₹' + fmt;
    },
    updateGlobalTotals() {
        const qty = this.items.reduce((s, i) => s + i.qty, 0);
        document.querySelectorAll('#nav-cart-count, .cart-badge').forEach(el => {
            el.innerText = '(' + qty + ')';
        });
    },

    /* ── RENDER DRAWER ───────────────────────────────── */
    render() {
        const container  = document.getElementById('cart-items-wrapper');
        const checkoutBtn = document.getElementById('btn-checkout');
        if (!container) return;

        if (this.items.length === 0) {
            container.innerHTML = '<div class="empty-cart-msg">Your selection is currently empty.</div>';
            this.recalcTotals();
            if (checkoutBtn) { checkoutBtn.disabled = true; checkoutBtn.innerText = 'Cart Empty'; }
            return;
        }
        if (checkoutBtn) { checkoutBtn.disabled = false; checkoutBtn.innerText = 'Proceed to Checkout'; }

        let html = '';
        this.items.forEach(item => {
            const fmtPrice = new Intl.NumberFormat('en-IN').format(item.price);
            const key = item.id + '_' + item.variant.replace(/\s+/g,'');
            html += `
            <div class="cart-item">
                <div class="item-image">
                    ${item.image ? `<img src="${item.image}" alt="${item.name}">` : ''}
                </div>
                <div class="item-details">
                    <div class="item-top">
                        <div>
                            <h4 class="item-name">${item.name}</h4>
                            <span class="item-variant">${item.variant}</span>
                        </div>
                        <div class="item-remove" onclick="HaloiCart.remove('${item.id}','${item.variant}')">Remove</div>
                    </div>
                    <div class="item-bottom">
                        <div class="qty-wrapper">
                            <div class="qty-btn" onclick="HaloiCart.updateQty('${item.id}','${item.variant}',-1)">−</div>
                            <div class="qty-val" id="qty-val-${key}">${item.qty}</div>
                            <div class="qty-btn" onclick="HaloiCart.updateQty('${item.id}','${item.variant}',1)">+</div>
                        </div>
                        <div class="item-price">₹${fmtPrice}</div>
                    </div>
                </div>
            </div>`;
        });
        container.innerHTML = html;
        this.recalcTotals();
    },

    /* ── CHECKOUT MODAL ──────────────────────────────── */
    openCheckout() {
        if (this.items.length === 0) return;
        this.close();

        // Build order summary
        const total = this.getTotal();
        const fmt   = new Intl.NumberFormat('en-IN').format(total);
        let   rows  = '';
        this.items.forEach(i => {
            rows += `<div class="checkout-summary-row"><span>${i.name} × ${i.qty}</span><span>₹${new Intl.NumberFormat('en-IN').format(i.price * i.qty)}</span></div>`;
        });

        const modal = document.getElementById('checkout-modal');
        const box   = document.getElementById('checkout-box');
        if (!modal || !box) return;

        box.innerHTML = `
        <div class="checkout-close">
            <h2>Checkout</h2>
            <span onclick="HaloiCart.closeCheckout()">✕ Close</span>
        </div>

        <div class="checkout-summary">
            <div class="text-label" style="margin-bottom:14px;">Order Summary</div>
            ${rows}
            <div class="checkout-summary-total">
                <span>Total</span>
                <span style="color:var(--accent-muga);">₹${fmt}</span>
            </div>
        </div>

        <div class="checkout-field">
            <label>Full Name</label>
            <input type="text" id="co-name" placeholder="Your full name" autocomplete="name">
        </div>
        <div class="checkout-field">
            <label>Email Address</label>
            <input type="email" id="co-email" placeholder="email@example.com" autocomplete="email">
        </div>
        <div class="checkout-field">
            <label>Phone Number</label>
            <input type="tel" id="co-phone" placeholder="+91 98765 43210" autocomplete="tel">
        </div>
        <div class="checkout-field">
            <label>Shipping Address</label>
            <input type="text" id="co-addr" placeholder="Street, City, State, PIN" autocomplete="street-address">
        </div>
        <div class="checkout-row">
            <div class="checkout-field">
                <label>Pincode</label>
                <input type="text" id="co-pin" placeholder="560001" maxlength="6">
            </div>
            <div class="checkout-field">
                <label>State</label>
                <select id="co-state">
                    <option value="">Select State</option>
                    <option>Assam</option><option>Delhi</option><option>Maharashtra</option>
                    <option>Karnataka</option><option>Tamil Nadu</option><option>West Bengal</option>
                    <option>Uttar Pradesh</option><option>Rajasthan</option><option>Gujarat</option>
                    <option>Punjab</option><option>Other</option>
                </select>
            </div>
        </div>

        <button class="btn-pay" onclick="HaloiCart.initiateRazorpay()">
            Pay ₹${fmt} Securely
        </button>
        <p class="razorpay-note">Powered by Razorpay · 256-bit SSL Encryption</p>`;

        modal.classList.add('active');
    },
    closeCheckout() {
        const modal = document.getElementById('checkout-modal');
        if (modal) modal.classList.remove('active');
    },

    /* ── RAZORPAY INTEGRATION ────────────────────────── */
    initiateRazorpay() {
        const name  = document.getElementById('co-name')?.value?.trim();
        const email = document.getElementById('co-email')?.value?.trim();
        const phone = document.getElementById('co-phone')?.value?.trim();
        const addr  = document.getElementById('co-addr')?.value?.trim();

        if (!name || !email || !phone || !addr) {
            alert('Please fill in all required fields before proceeding.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            alert('Please enter a valid email address.');
            return;
        }

        const total = this.getTotal();

        // Check if Razorpay SDK is loaded
        if (typeof Razorpay === 'undefined') {
            alert('Payment gateway is loading. Please try again in a moment.');
            this._loadRazorpay(() => this.initiateRazorpay());
            return;
        }

        const options = {
            // REPLACE with your actual Razorpay Key ID from dashboard.razorpay.com
            key: 'rzp_test_REPLACE_WITH_YOUR_KEY',
            amount: total * 100, // amount in paise
            currency: 'INR',
            name: 'Haloi Threads',
            description: 'Premium Streetwear Order',
            image: '',
            prefill: {
                name:    name,
                email:   email,
                contact: phone.replace(/\D/g, '')
            },
            notes: {
                shipping_address: addr,
                order_items: this.items.map(i => `${i.name} x${i.qty}`).join(', ')
            },
            theme: {
                color: '#9e8f6b',
                backdrop_color: 'rgba(3,3,3,0.9)'
            },
            handler: (response) => {
                // Payment successful
                this._onPaymentSuccess(response, name, email);
            },
            modal: {
                ondismiss: () => {
                    console.log('Payment dismissed');
                }
            }
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', (response) => {
            alert('Payment failed: ' + response.error.description + '\nPlease try again.');
        });
        rzp.open();
    },

    _loadRazorpay(callback) {
        if (document.getElementById('razorpay-sdk')) { callback(); return; }
        const script = document.createElement('script');
        script.id    = 'razorpay-sdk';
        script.src   = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = callback;
        document.head.appendChild(script);
    },

    _onPaymentSuccess(response, name, email) {
        // Close checkout modal
        this.closeCheckout();

        // Show success screen
        const modal = document.getElementById('checkout-modal');
        const box   = document.getElementById('checkout-box');
        if (box) {
            box.innerHTML = `
            <div style="text-align:center; padding:40px 20px;">
                <div style="font-size:2.5rem; margin-bottom:20px;">✓</div>
                <h2 style="color:var(--accent-muga); margin-bottom:16px; font-size:1rem; letter-spacing:.2em;">ORDER CONFIRMED</h2>
                <p style="color:#888; font-size:.8rem; line-height:1.8; letter-spacing:.08em; text-transform:uppercase;">
                    Thank you, ${name}.<br>
                    A confirmation has been sent to ${email}.<br>
                    Payment ID: ${response.razorpay_payment_id}
                </p>
                <div style="margin-top:30px; width:1px; height:40px; background:var(--accent-muga); margin-left:auto; margin-right:auto; opacity:.5;"></div>
                <button onclick="HaloiCart._closeSuccess()" class="btn-luxury" style="margin-top:20px; opacity:1;">Continue Shopping</button>
            </div>`;
            modal.classList.add('active');
        }

        // Save order to order history
        const orders = JSON.parse(localStorage.getItem('ht_orders') || '[]');
        const newOrder = {
            id:        Date.now(),
            date:      new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' }),
            total:     this.getTotal(),
            status:    'Processing',
            paymentId: response.razorpay_payment_id,
            items:     this.items.map(i => ({ name: i.name, qty: i.qty, price: i.price, variant: i.variant }))
        };
        orders.unshift(newOrder);
        localStorage.setItem('ht_orders', JSON.stringify(orders));

        // Clear the cart
        this.clear();
    },

    _closeSuccess() {
        this.closeCheckout();
    }
};

// Auto-load Razorpay SDK on page load
window.addEventListener('load', () => {
    HaloiCart._loadRazorpay(() => {});
    HaloiCart.init();
});
