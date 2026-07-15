
    // ── State ───────────────────────────────────────────────────
    const _state = {
      token: localStorage.getItem("fi_token") || "",
      cart: JSON.parse(localStorage.getItem("fi_cart") || "[]"),
      products: [],
      razorpayKeyId: "",
      shopName: "Fabric Infinity"
    };

    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));

    function parseMoney(value) {
      if (typeof value === "number") return Number.isFinite(value) ? value : 0;
      const match = String(value || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/);
      return match ? Number(match[0]) : 0;
    }

    function inr(n) { return "INR " + Number(n || 0).toLocaleString("en-IN"); }
    function saveCart() { localStorage.setItem("fi_cart", JSON.stringify(_state.cart)); }
    function slugify(text) {
      return String(text || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    function makeCartId(item) {
      return item._id || item.id || `static-${slugify(item.name)}`;
    }

    function getUnitPrice(item) {
      return parseMoney(item.unitPrice ?? item.price ?? 0);
    }
    function findCatalogPrice(name) {
      const allCatalog = [
        ...(typeof collections !== "undefined" ? collections : []),
        ...(typeof bestsellerData !== "undefined" ? bestsellerData : []),
        ...(typeof newArrivals !== "undefined" ? newArrivals : [])
      ];
      const found = allCatalog.find((item) => String(item.name || "").trim() === String(name || "").trim());
      return found ? parseMoney(found.price) : 0;
    }

    function normalizeCartItem(item) {
      const unitPrice = getUnitPrice(item) || findCatalogPrice(item.name);
      return {
        ...item,
        unitPrice,
        price: unitPrice,
        quantity: Number(item.quantity) || 1
      };
    }

    function normalizeCart() {
      _state.cart = _state.cart.map(normalizeCartItem);
      saveCart();
    }

    function askMeters(defaultValue = 1) {
      const answer = window.prompt("How many meters would you like? (e.g. 2, 2.5, 3)", String(defaultValue));
      if (answer === null) return null; // user cancelled
      const meters = parseFloat(answer);
      if (!Number.isFinite(meters) || meters <= 0 || meters > 500) return null;
      return meters;
    }

    function toCartItem(item) {
      const unitPrice = getUnitPrice(item);
      return {
        _id: makeCartId(item),
        name: item.name,
        price: unitPrice,
        unitPrice,
        imageUrl: item.imageUrl || item.image || "",
        quantity: 1
      };
    }

    async function api(path, opts = {}) {
      const headers = { ...(opts.headers || {}) };
      if (_state.token) headers["Authorization"] = "Bearer " + _state.token;
      const res = await fetch(path, { ...opts, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Error " + res.status);
      return data;
    }

    // ── Cart ────────────────────────────────────────────────────
    function cartTotals() {
      const sub = _state.cart.reduce((s, i) => s + getUnitPrice(i) * i.quantity, 0);
      const ship = sub === 0 || sub >= 2499 ? 0 : 99;
      return { sub, ship, total: sub + ship };
    }

    function updateCartCount() {
      const total = _state.cart.reduce((s, i) => s + i.quantity, 0);
      const el = $("#cartCount");
      if (el) {
        el.textContent = total;
        el.dataset.count = total;
      }
    }

    function renderCartDrawer() {
      updateCartCount();
      const wrap = $("#cartItemsWrap");
      if (!wrap) return;
      const t = cartTotals();
      if ($("#cartSubtotalAmt")) $("#cartSubtotalAmt").textContent = inr(t.sub);
      if ($("#cartShippingAmt")) $("#cartShippingAmt").textContent = t.ship === 0 ? "Free" : inr(t.ship);
      if ($("#cartTotalAmt")) $("#cartTotalAmt").textContent = inr(t.total);
      if (!_state.cart.length) { wrap.innerHTML = '<p style="color:#5f7395;padding:8px">Your cart is empty.</p>'; return; }
      wrap.innerHTML = _state.cart.map(item => `
        <div style="display:grid;grid-template-columns:60px 1fr auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #eff4ff;">
          <img src="${item.imageUrl}" alt="${item.name}" style="width:60px;height:60px;border-radius:8px;object-fit:cover"/>
          <div>
            <strong style="font-size:.9rem">${item.name}</strong><br>
            <span style="color:#5f7395;font-size:.84rem">${inr(getUnitPrice(item))} × ${item.quantity} m = <strong style="color:#132038">${inr(getUnitPrice(item) * item.quantity)}</strong></span><br>
            <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
              <button class="btn" data-dec="${item._id}" style="padding:2px 8px;font-size:1rem">−</button>
              <span style="font-weight:700">${item.quantity} m</span>
              <button class="btn" data-inc="${item._id}" style="padding:2px 8px;font-size:1rem">+</button>
            </div>
          </div>
          <button class="btn" data-rem="${item._id}" style="font-size:.8rem;padding:6px 10px">✕</button>
        </div>`).join("");
      $$("[data-dec]").forEach(b => b.addEventListener("click", () => { changeQty(b.dataset.dec, -1); }));
      $$("[data-inc]").forEach(b => b.addEventListener("click", () => { changeQty(b.dataset.inc, 1); }));
      $$("[data-rem]").forEach(b => b.addEventListener("click", () => { removeFromCart(b.dataset.rem); }));
    }

    function addToCart(itemOrId) {
      const item = typeof itemOrId === "string"
        ? _state.products.find((x) => x._id === itemOrId)
        : itemOrId;
      if (!item) return;
      const meters = askMeters(1);
      if (meters === null) return;
      const cartItem = toCartItem(item);
      const ex = _state.cart.find((x) => x._id === cartItem._id);
      if (ex) ex.quantity += meters;
      else _state.cart.push({ ...cartItem, quantity: meters });
      saveCart(); renderCartDrawer(); openCart();
    }

    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cart-add]");
      if (!btn) return;
      e.preventDefault();
      addToCart({
        _id: btn.dataset.id || "",
        name: btn.dataset.name || "",
        price: btn.dataset.price || 0,
        imageUrl: btn.dataset.image || ""
      });
    });

    function removeFromCart(id) { _state.cart = _state.cart.filter(x => x._id !== id); saveCart(); renderCartDrawer(); }
    function changeQty(id, d) {
      const it = _state.cart.find(x => x._id === id);
      if (!it) return;
      it.quantity += d;
      if (it.quantity <= 0) removeFromCart(id);
      else { saveCart(); renderCartDrawer(); }
    }

    function openCart() {
      const d = $("#cartDrawer"); const b = $("#cartBackdrop");
      if (d) d.style.right = "0"; if (b) b.style.display = "block";
    }
    function closeCart() {
      const d = $("#cartDrawer"); const b = $("#cartBackdrop");
      if (d) d.style.right = "-440px"; if (b) b.style.display = "none";
    }

    // ── Storefront Products ─────────────────────────────────────
    function productCard(p) {
      const displayPrice = (p.offerPrice && p.offerPrice < p.price) ? p.offerPrice : p.price;
      const hasOffer     = p.offerPrice && p.offerPrice < p.price;
      const badges = [p.fabricType, p.width, p.occasion].filter(Boolean);
      return `<article class="card">
        <div class="card-media" style="position:relative;">
          <img src="${p.imageUrl}" alt="${p.name}" loading="lazy"/>
          ${hasOffer ? `<span style="position:absolute;top:10px;left:10px;background:#de4f63;color:#fff;font-size:.72rem;font-weight:800;padding:3px 8px;border-radius:999px;">SALE</span>` : ""}
          ${p.productType ? `<span style="position:absolute;top:10px;right:10px;background:rgba(255,255,255,.92);color:#0b2e67;font-size:.7rem;font-weight:800;padding:3px 8px;border-radius:999px;border:1px solid #d4e2f8;">${p.productType}</span>` : ""}
        </div>
        <div class="card-body">
          <span class="tag">${p.category}</span>
          <h4 style="margin:6px 0 4px">${p.name}</h4>
          ${badges.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">${badges.map(b=>`<span style="font-size:.7rem;background:#eef3ff;color:#3a5c9a;border-radius:999px;padding:2px 8px;font-weight:700;">${b}</span>`).join("")}</div>` : ""}
          ${p.colour ? `<p style="font-size:.78rem;color:#5f7395;margin-bottom:4px;">🎨 ${p.colour}${p.pattern ? " · " + p.pattern : ""}</p>` : ""}
          <div class="price-row">
            <div>
              <strong style="color:#0b2e67;">${inr(displayPrice)}<span style="font-size:.78rem;font-weight:500;color:#5f7395"> /${p.lengthUnit||"m"}</span></strong>
              ${hasOffer ? `<span style="font-size:.78rem;text-decoration:line-through;color:#aab8cc;margin-left:6px;">${inr(p.price)}</span>` : ""}
            </div>
            <button class="btn" data-cart-add="true" data-id="${p._id}" data-name="${p.name.replace(/\"/g,"&quot;")}" data-price="${String(displayPrice).replace(/\"/g,"&quot;")}" data-image="${p.imageUrl}" style="padding:6px 12px">Add to Cart</button>
          </div>
        </div>
      </article>`;
    }

    async function loadStorefrontProducts() {
      try {
        const data = await api("/api/products");
        _state.products = data.products || [];
      } catch(e) { _state.products = []; }
      normalizeCart();

      const liveGrid = $("#liveProductsGrid");
      const meta = $("#liveProductsMeta");
      if (meta) meta.textContent = _state.products.length + " products available";

      if (liveGrid) {
        if (!_state.products.length) {
          liveGrid.innerHTML = '<p style="color:#5f7395">No products found. Add products from the Owner Dashboard.</p>';
        } else {
          liveGrid.innerHTML = _state.products.map(p => productCard(p)).join("");
        }
      }
      updateCartCount();
    }

    // ── Checkout ────────────────────────────────────────────────
    function openCheckout() {
      if (!_state.cart.length) { alert("Your cart is empty."); return; }
      closeCart();
      const modal = $("#checkoutModal");
      if (!modal) return;
      modal.style.display = "flex";
      const t = cartTotals();
      const summary = $("#checkoutOrderSummary");
      if (summary) {
        summary.innerHTML = _state.cart.map((i, index) => {
          const unitPrice = getUnitPrice(i);
          return `<div style="display:grid;grid-template-columns:1fr auto;gap:10px;padding:8px 0;border-bottom:1px solid #e8f0fd;align-items:center">
            <div>
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
                <span>${i.name}</span>
                <strong>${inr(unitPrice * i.quantity)}</strong>
              </div>
              <div style="color:#5f7395;font-size:.84rem;margin-top:4px">${inr(unitPrice)} / meter &nbsp;·&nbsp; <span style="color:#132038;font-weight:700">${i.quantity} m × ${inr(unitPrice)} = ${inr(unitPrice * i.quantity)}</span></div>
            </div>
            <label style="display:flex;align-items:center;gap:8px;justify-self:end;color:#2a4b7a;font-weight:700;font-size:.85rem">
              Meter
              <input type="number" min="0.25" step="0.25" value="${i.quantity}" data-checkout-qty="${i._id}" style="width:90px;border:1px solid #bdd2f2;border-radius:10px;padding:8px 10px;font:inherit" />
            </label>
          </div>`;
        }).join("") +
          `<div style="display:flex;justify-content:space-between;padding:6px 0 0;font-weight:800"><span>Total (incl. shipping ${inr(t.ship)})</span><strong>${inr(t.total)}</strong></div>`;
      }
      const msg = $("#checkoutMsg");
      if (msg) { msg.textContent = ""; msg.style.color = ""; }
    }
    function closeCheckout() { const m = $("#checkoutModal"); if (m) m.style.display = "none"; }

    function showOrderSuccess(order) {
      const existing = document.getElementById("orderSuccessModal");
      if (existing) existing.remove();
      const div = document.createElement("div");
      div.id = "orderSuccessModal";
      div.style.cssText = "position:fixed;inset:0;background:rgba(3,11,26,.75);z-index:180;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(5px);";
      div.innerHTML = `
    <div style="width:min(480px,100%);background:linear-gradient(150deg,#f9fcff,#e6f0ff);border:1px solid #bdd4f8;border-radius:22px;padding:28px;box-shadow:0 30px 90px rgba(3,18,50,.3);text-align:center;">
      <div style="width:68px;height:68px;border-radius:50%;background:linear-gradient(135deg,#1fa97a,#17855f);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:1.9rem;">✓</div>
      <h3 style="font-family:'Cormorant Garamond',serif;font-size:2rem;margin:0 0 6px;color:#0b2e67;">Order Placed!</h3>
      <p style="color:#4e6790;margin-bottom:14px;">Thank you for your order. We'll process it right away.</p>
      <div style="background:#fff;border:1px solid #d5e2f5;border-radius:12px;padding:14px;margin-bottom:16px;text-align:left;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#5f7395;font-size:.88rem">Order Number</span><strong style="color:#0b2e67">${order.orderNo}</strong></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#5f7395;font-size:.88rem">Payment Method</span><strong style="color:#0b2e67">${order.paymentMethod === "COD" ? "Cash on Delivery" : "Online Payment"}</strong></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#5f7395;font-size:.88rem">Payment Status</span><strong style="color:${order.paymentStatus === "PAID" ? "#1fa97a" : "#be7a14"}">${order.paymentStatus === "PAID" ? "Paid" : "Pending"}</strong></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#5f7395;font-size:.88rem">Total Amount</span><strong style="color:#0b2e67;font-size:1.05rem">INR ${Number(order.total).toLocaleString("en-IN")}</strong></div>
      </div>
      ${order.paymentMethod === "COD" ? '<p style="background:#fff9ef;border:1px solid #ffe3a0;border-radius:9px;padding:10px;color:#7a5a00;font-size:.88rem;margin-bottom:14px;">💰 Please keep the exact amount ready for the delivery person.</p>' : '<p style="background:#effff7;border:1px solid #a8e8cc;border-radius:9px;padding:10px;color:#166340;font-size:.88rem;margin-bottom:14px;">✓ Your payment has been confirmed. Order is being processed.</p>'}
      <button onclick="document.getElementById('orderSuccessModal').remove()" class="btn primary" style="padding:13px 30px;font-size:1rem;width:100%;">Continue Shopping</button>
    </div>`;
      document.body.appendChild(div);
    }

    async function handleCheckoutSubmit(e) {
      e.preventDefault();
      const msg = $("#checkoutMsg");
      msg.textContent = "Placing order..."; msg.style.color = "#5f7395";
      try {
        $$('[data-checkout-qty]').forEach((input) => {
          const item = _state.cart.find((x) => x._id === input.dataset.checkoutQty);
          if (!item) return;
          const meters = Number(input.value);
          if (Number.isFinite(meters) && meters > 0) item.quantity = meters;
        });
        saveCart();
        renderCartDrawer();

        const addr = {
          fullName: $("#cName").value.trim(), phone: $("#cPhone").value.trim(),
          email: $("#cEmail").value.trim(), addressLine1: $("#cAddress1").value.trim(),
          addressLine2: $("#cAddress2").value.trim(), city: $("#cCity").value.trim(),
          state: $("#cState").value.trim(), pincode: $("#cPincode").value.trim()
        };
        const method = $("#cMethod").value;
        const payload = { items: _state.cart.map(i => ({ productId: i._id, quantity: i.quantity })), shippingAddress: addr, paymentMethod: method };
        const data = await api("/api/orders/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

        if (method === "RAZORPAY" && data.razorpayOrder) {
          if (!_state.razorpayKeyId) throw new Error("Razorpay not configured");
          await new Promise((resolve, reject) => {
            const rzp = new Razorpay({
              key: _state.razorpayKeyId, amount: data.razorpayOrder.amount, currency: "INR",
              name: _state.shopName, description: "Order " + data.order.orderNo,
              order_id: data.razorpayOrder.id,
              prefill: { name: addr.fullName, email: addr.email, contact: addr.phone },
              handler: async (resp) => {
                try {
                  await api("/api/payments/razorpay/verify", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ orderId: data.order._id, razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature })
                  });
                  resolve();
                } catch(err) { reject(err); }
              }
            });
            rzp.on("payment.failed", (e) => reject(new Error(e.error?.description || "Payment failed")));
            rzp.open();
          });
        }

        _state.cart = []; saveCart(); renderCartDrawer();
        closeCheckout();
        showOrderSuccess(data.order);
      } catch(err) { msg.textContent = err.message; msg.style.color = "#de4f63"; }
    }

    // ── Owner Auth ──────────────────────────────────────────────
    function openOwnerModal() {
      const m = $("#ownerModal"); if (!m) return;
      $("#ownerError").textContent = "";
      $("#ownerPassword").value = "";
      m.classList.add("open");
      setTimeout(() => { const e = $("#ownerEmail"); if (e && !e.value) e.focus(); else $("#ownerPassword").focus(); }, 80);
    }
    function closeOwnerModal() { const m = $("#ownerModal"); if (m) m.classList.remove("open"); }

    async function doOwnerLogin() {
      const email = ($("#ownerEmail")?.value || "").trim();
      const pass = $("#ownerPassword")?.value || "";
      const errEl = $("#ownerError");
      if (!email || !pass) { errEl.textContent = "Email and password are required."; return; }
      errEl.textContent = "Logging in...";
      try {
        const data = await api("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: pass }) });
        _state.token = data.token;
        localStorage.setItem("fi_token", data.token);
        closeOwnerModal();
        openDashboard();
      } catch(err) { errEl.textContent = err.message || "Invalid credentials."; }
    }

    function openDashboard() {
      const d = $("#ownerDashboard"); if (!d) return;
      d.classList.add("open");
      document.body.style.overflow = "hidden";
      loadDashboardData();
    }
    function closeDashboard() {
      const d = $("#ownerDashboard"); if (!d) return;
      d.classList.remove("open");
      document.body.style.overflow = "";
      _state.token = ""; localStorage.removeItem("fi_token");
    }

    // ── Dashboard Tabs ──────────────────────────────────────────
    const TABS = ["tabOverview", "tabProducts", "tabOrders", "tabCategories", "tabSettings", "tabShipping"];
    function switchTab(tabId) {
      TABS.forEach(t => { const el = $("#" + t); if (el) el.style.display = t === tabId ? "block" : "none"; });
      $$(".dash-nav a").forEach(a => a.classList.toggle("active", a.dataset.tab === tabId));
      const titles = {
        tabOverview: "Dashboard", tabProducts: "Products",
        tabOrders: "Orders", tabCategories: "Categories",
        tabSettings: "Settings", tabShipping: "Shipping"
      };
      const h = $("#dashTabTitle"); if (h && titles[tabId]) h.textContent = titles[tabId];
    }

    // ── Dashboard: Load Data ────────────────────────────────────
    async function loadDashboardData() {
      try {
        const [ordersData, productsData] = await Promise.all([
          api("/api/admin/orders"), api("/api/admin/products")
        ]);
        const orders = ordersData.orders || [];
        const products = productsData.products || [];

        // Metrics
        const totalSales = orders.reduce((s, o) => s + o.total, 0);
        const paidSales = orders.filter(o => o.paymentStatus === "PAID").reduce((s, o) => s + o.total, 0);
        const pendingOrders = orders.filter(o => ["NEW", "PROCESSING"].includes(o.orderStatus)).length;
        const codOrders = orders.filter(o => o.paymentMethod === "COD").length;
        const activeProducts = products.filter(p => p.isActive).length;

        if ($("#metricSales")) $("#metricSales").textContent = inr(totalSales);
        if ($("#metricOrders")) $("#metricOrders").textContent = orders.length;
        if ($("#metricProducts")) $("#metricProducts").textContent = activeProducts;
        if ($("#metricPending")) $("#metricPending").textContent = pendingOrders;
        if ($("#metricRevenue")) $("#metricRevenue").textContent = inr(paidSales);
        if ($("#metricCod")) $("#metricCod").textContent = codOrders;
        if ($("#ordersCountBadge")) $("#ordersCountBadge").textContent = orders.length;
        if ($("#bbProducts")) $("#bbProducts").textContent = activeProducts;
        if ($("#bbOrders")) $("#bbOrders").textContent = orders.length;
        if ($("#bbPending")) $("#bbPending").textContent = pendingOrders;
        if ($("#bbPaid")) $("#bbPaid").textContent = orders.filter(o => o.paymentStatus === "PAID").length;
        if ($("#bbCod")) $("#bbCod").textContent = codOrders;

        // Order status counts
        ["NEW","PROCESSING","PACKED","SHIPPED","DELIVERED"].forEach(s => {
          const id = "stat" + s.charAt(0) + s.slice(1).toLowerCase();
          const el = $("#" + id);
          if (el) el.textContent = orders.filter(o => o.orderStatus === s).length;
        });

        // Recent orders
        const recentEl = $("#recentOrders");
        if (recentEl) {
          const recent = orders.slice(0, 5);
          recentEl.innerHTML = recent.length ? recent.map(o => `
            <div class="recent-item" style="margin-bottom:8px">
              <img src="${(o.items[0]?.imageUrl) || ""}" alt="" style="width:40px;height:40px;border-radius:8px;object-fit:cover;background:#e8f0ff"/>
              <div><strong style="font-size:.86rem">${o.orderNo}</strong><span style="font-size:.76rem;color:#647fa9">${o.shippingAddress.fullName} · ${new Date(o.createdAt).toLocaleDateString()}</span></div>
              <div style="text-align:right"><strong style="font-size:.86rem">${inr(o.total)}</strong><br><span style="font-size:.74rem;color:#647fa9">${o.orderStatus}</span></div>
            </div>`).join("") : '<p style="color:#5f7395;font-size:.88rem">No orders yet.</p>';
        }

        // Low stock
        const lowStockEl = $("#lowStock");
        if (lowStockEl) {
          const low = products.filter(p => p.stock < 20).slice(0, 5);
          lowStockEl.innerHTML = low.length ? low.map(p => `
            <div class="mini-row" style="margin-bottom:8px">
              <img src="${p.imageUrl}" alt="" style="width:34px;height:34px;border-radius:8px;object-fit:cover"/>
              <div><strong style="font-size:.84rem">${p.name}</strong><span style="font-size:.76rem;color:#6c84ab">Stock: ${p.stock}</span></div>
              <span class="pill" style="color:#b43d4e;background:#fff1f4;border-color:#f5c8d1">Low</span>
            </div>`).join("") : '<p style="color:#5f7395;font-size:.88rem">No low stock items.</p>';
        }

        // Populate products table
        renderAdminProducts(products);
        // Populate orders table
        renderAdminOrders(orders);
      } catch(err) { console.error("Dashboard load error", err); }
    }

    // ── Admin Products Table ─────────────────────────────────────
    function renderAdminProducts(products) {
      const tbody = $("#productTableBody"); if (!tbody) return;
      tbody.innerHTML = products.map(p => {
        const displayPrice = (p.offerPrice && p.offerPrice < p.price) ? p.offerPrice : p.price;
        const stockWarn    = p.minStockAlert && p.stock <= p.minStockAlert;
        return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5eefb"><img src="${p.imageUrl}" style="width:44px;height:44px;border-radius:8px;object-fit:cover"/></td>
        <td style="padding:8px;border-bottom:1px solid #e5eefb;min-width:160px;">
          <input data-field="name" data-id="${p._id}" value="${p.name.replace(/"/g,"&quot;")}" style="width:100%;border:1px solid #d5e2f5;border-radius:7px;padding:5px 7px;font:inherit;margin-bottom:3px"/>
          <span style="font-size:.72rem;color:#7a94bc;font-family:monospace;">${p.sku || "—"}</span>
        </td>
        <td style="padding:8px;border-bottom:1px solid #e5eefb">
          <span style="font-size:.84rem;font-weight:700;color:#132038;">${p.category}</span>
          ${p.subcategory ? `<br><span style="font-size:.72rem;color:#7a94bc;">${p.subcategory}</span>` : ""}
        </td>
        <td style="padding:8px;border-bottom:1px solid #e5eefb;font-size:.82rem;">
          <span style="background:#eef3ff;color:#0b2e67;border-radius:999px;padding:2px 8px;font-weight:700;">${p.productType||"Fabric"}</span>
        </td>
        <td style="padding:8px;border-bottom:1px solid #e5eefb;white-space:nowrap;">
          <strong style="color:#0b2e67;">${inr(displayPrice)}</strong>
          ${(p.offerPrice && p.offerPrice < p.price) ? `<br><span style="font-size:.72rem;text-decoration:line-through;color:#aab8cc;">${inr(p.price)}</span>` : ""}
        </td>
        <td style="padding:8px;border-bottom:1px solid #e5eefb;">
          <input type="number" data-field="stock" data-id="${p._id}" value="${p.stock}" min="0" style="width:70px;border:1px solid ${stockWarn?"#f5c6c6":"#d5e2f5"};border-radius:7px;padding:5px 7px;font:inherit;color:${stockWarn?"#c0392b":"inherit"}"/>
          ${stockWarn ? `<br><span style="font-size:.7rem;color:#c0392b;font-weight:700;">⚠ Low</span>` : ""}
        </td>
        <td style="padding:8px;border-bottom:1px solid #e5eefb;font-size:.8rem;white-space:nowrap;">
          ${p.fabricType ? p.fabricType : "—"}
          ${p.width ? `<br><span style="color:#7a94bc;">${p.width}</span>` : ""}
          ${p.gsm ? `<br><span style="color:#7a94bc;">${p.gsm} GSM</span>` : ""}
        </td>
        <td style="padding:8px;border-bottom:1px solid #e5eefb">
          <span class="pill" style="color:${p.isActive?"#1a6e3e":"#8a3030"}">${p.isActive ? "Active" : "Inactive"}</span>
        </td>
        <td style="padding:8px;border-bottom:1px solid #e5eefb;white-space:nowrap">
          <button class="btn" data-save="${p._id}" style="font-size:.8rem;padding:5px 10px;margin-right:4px">Save</button>
          <button class="btn" data-toggle="${p._id}" data-active="${p.isActive}" style="font-size:.78rem;padding:5px 10px;margin-right:4px">${p.isActive?"Hide":"Show"}</button>
          <button class="btn" data-delete="${p._id}" style="font-size:.8rem;padding:5px 10px;color:#c0392b;border-color:#f5c6c6">Delete</button>
        </td>
      </tr>`;
      }).join("");
      $$("[data-save]").forEach(b => b.addEventListener("click", async () => {
        const id = b.dataset.save;
        const g = f => document.querySelector(`[data-field="${f}"][data-id="${id}"]`)?.value;
        try {
          await api(`/api/admin/products/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: g("name"), stock: Number(g("stock")) })
          });
          b.textContent = "✓"; setTimeout(() => { b.textContent = "Save"; }, 1500);
        } catch(e) { alert(e.message); }
      }));
      $$("[data-toggle]").forEach(b => b.addEventListener("click", async () => {
        const id = b.dataset.toggle;
        const newActive = b.dataset.active === "true" ? false : true;
        try {
          await api(`/api/admin/products/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: newActive })
          });
          await loadDashboardData();
        } catch(e) { alert(e.message); }
      }));
      $$("[data-delete]").forEach(b => b.addEventListener("click", async () => {
        if (!confirm("Delete this product permanently?")) return;
        try { await api(`/api/admin/products/${b.dataset.delete}`, { method: "DELETE" }); b.closest("tr").remove(); } catch(e) { alert(e.message); }
      }));
    }

    // ── Admin Orders Table ───────────────────────────────────────
    function renderAdminOrders(orders) {
      const tbody = $("#orderTableBody"); if (!tbody) return;
      tbody.innerHTML = orders.map(o => `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5eefb"><strong>${o.orderNo}</strong><br><span style="color:#647fa9;font-size:.76rem">${new Date(o.createdAt).toLocaleString()}</span></td>
        <td style="padding:8px;border-bottom:1px solid #e5eefb">${o.shippingAddress.fullName}<br><span style="color:#647fa9;font-size:.76rem">${o.shippingAddress.phone}</span></td>
        <td style="padding:8px;border-bottom:1px solid #e5eefb;font-size:.82rem">${o.items.map(i=>i.name+"×"+i.quantity).join(", ")}</td>
        <td style="padding:8px;border-bottom:1px solid #e5eefb;font-weight:700">${inr(o.total)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5eefb"><span class="pill">${o.paymentMethod}</span><br><span class="pill" style="margin-top:3px;color:${o.paymentStatus==="PAID"?"#1a6e3e":o.paymentStatus==="FAILED"?"#8a3030":"#7a5a00"}">${o.paymentStatus}</span></td>
        <td style="padding:8px;border-bottom:1px solid #e5eefb"><span class="pill">${o.orderStatus}</span></td>
        <td style="padding:8px;border-bottom:1px solid #e5eefb;white-space:nowrap">
          <select data-oid="${o._id}" style="border:1px solid #d5e2f5;border-radius:7px;padding:4px 6px;font:inherit;font-size:.84rem">${["NEW","PROCESSING","PACKED","SHIPPED","DELIVERED","CANCELLED"].map(s=>`<option${o.orderStatus===s?" selected":""}>${s}</option>`).join("")}</select>
          <button class="btn" data-osave="${o._id}" style="font-size:.8rem;padding:5px 10px;margin-left:4px">Update</button>
        </td>
      </tr>`).join("");
      $$("[data-osave]").forEach(b => b.addEventListener("click", async () => {
        const id = b.dataset.osave;
        const st = document.querySelector(`[data-oid="${id}"]`)?.value;
        try { await api(`/api/admin/orders/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderStatus: st }) }); b.textContent = "✓"; setTimeout(() => { b.textContent = "Update"; }, 1500); } catch(e) { alert(e.message); }
      }));
    }

    // ── Static decorative data (kept exactly as before) ──────────────
    const productImages = [
      "assets/WhatsApp-Image-2026-06-24-at-2.24.13-PM-1.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.24.13-PM-2.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.24.14-PM.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.24.37-PM-1.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.24.37-PM.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.24.38-PM-1.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.24.38-PM.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.25.04-PM-1.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.25.04-PM.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.25.05-PM.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.25.06-PM-1.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.25.06-PM.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.25.07-PM.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.25.43-PM-1.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.25.43-PM.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.25.44-PM-1.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.25.44-PM.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.26.12-PM.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.26.13-PM-1.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.26.13-PM-2.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.26.13-PM-3.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.26.13-PM.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.26.14-PM-1.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.26.14-PM-2.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.26.14-PM.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.26.40-PM.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.26.41-PM.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.26.42-PM-1.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.26.42-PM-2.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.26.42-PM.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.26.43-PM.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.27.18-PM.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.27.19-PM-1.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.27.19-PM-2.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.27.19-PM.jpeg",
      "assets/WhatsApp-Image-2026-06-24-at-2.27.20-PM.jpeg"
    ];
    const categoryData = [
      { title: "Fabric by Meter", text: "Ajrakh, Dabu, Bagru, Indigo, Ikat and more.", image: productImages[15] },
      { title: "Dress Materials", text: "Printed and premium unstitched suit sets.", image: productImages[13] },
      { title: "Sarees", text: "Cotton and festive sarees with handcrafted motifs.", image: productImages[29] },
      { title: "Dupattas", text: "Handblock and modal silk dupattas for layering.", image: productImages[18] }
    ];
    const collections = [
      { name: "Ajrakh Collection", tag: "Ajrakh", image: productImages[0], price: "INR 449 / meter" },
      { name: "Handblock Collection", tag: "Handblock", image: productImages[10], price: "INR 399 / meter" },
      { name: "Cambric Cotton", tag: "Cambric", image: productImages[16], price: "INR 349 / meter" },
      { name: "Cotton Linen", tag: "Linen", image: productImages[11], price: "INR 499 / meter" },
      { name: "Indigo Handblock", tag: "Indigo", image: productImages[21], price: "INR 459 / meter" },
      { name: "Bagru Kalamkari", tag: "Bagru", image: productImages[5], price: "INR 429 / meter" },
      { name: "Batik Cotton", tag: "Batik", image: productImages[9], price: "INR 379 / meter" },
      { name: "Vanaspati Ajrakh", tag: "Ajrakh", image: productImages[26], price: "INR 489 / meter" }
    ];
    const bestsellerData = [0, 6, 7, 4, 12, 20, 24, 30].map((i, idx) => ({
      name: ["Royal Ajrakh", "Indigo Bloom", "Batik Grid", "Floral Bagru", "Classic Batik", "Indigo Stripe", "Indigo Vine", "Monochrome Dot"][idx],
      image: productImages[i],
      price: `INR ${399 + idx * 20} / meter`
    }));
    const newArrivals = [27, 28, 31, 34, 32, 2].map((i, idx) => ({
      name: ["Vanaspati Gold", "Vanaspati Bloom", "Monochrome Wild", "Black White Lotus", "Indigo Petal", "Ajrakh Ruby"][idx],
      image: productImages[i],
      text: "New this week"
    }));
    const heroSlides = [
      { img: productImages[15], title: "Ajrakh Heritage Collection", text: "Earthy classics with timeless motifs and premium drape." },
      { img: productImages[21], title: "Indigo Handblock Stories", text: "Deep indigo palettes handcrafted for modern styling." },
      { img: productImages[33], title: "Black & White Essentials", text: "Minimal monochrome prints for elegant everyday dressing." }
    ];

    function mkCard(item, mode = "product") {
      const imageSrc = encodeURI(item.image);
      if (mode === "category") return `<article class="card"><div class="card-media"><img src="${imageSrc}" alt="${item.title}" loading="lazy"></div><div class="card-body"><h4>${item.title}</h4><p class="muted">${item.text}</p></div></article>`;
      if (mode === "new") return `<article class="card"><div class="card-media"><img src="${imageSrc}" alt="${item.name}" loading="lazy"></div><div class="card-body"><div class="tag">${item.text}</div><h4>${item.name}</h4></div></article>`;
      return `<article class="card"><div class="card-media"><img src="${imageSrc}" alt="${item.name}" loading="lazy"></div><div class="card-body"><div class="tag">${item.tag || "Premium"}</div><h4>${item.name}</h4><div class="price-row"><span class="muted">${item.price}</span><button class="btn" data-cart-add="true" data-name="${item.name.replace(/\"/g, "&quot;")}" data-price="${String(item.price).replace(/\"/g, "&quot;")}" data-image="${imageSrc}">Add to Cart</button></div></div></article>`;
    }
    document.getElementById("categoryGrid").innerHTML = categoryData.map((c) => mkCard(c, "category")).join("");
    document.getElementById("bestsellerGrid").innerHTML = bestsellerData.map((c) => mkCard(c)).join("");
    document.getElementById("newArrivals").innerHTML = newArrivals.map((c) => mkCard(c, "new")).join("");

    const tags = ["All", "Ajrakh", "Handblock", "Indigo", "Bagru", "Batik", "Cambric", "Linen"];
    const chips = document.getElementById("filterChips");
    const collectionGrid = document.getElementById("collectionGrid");
    chips.innerHTML = tags.map((t, i) => `<button class="chip ${i === 0 ? "active" : ""}" data-tag="${t}">${t}</button>`).join("");
    function renderCollections(tag = "All") {
      const filtered = tag === "All" ? collections : collections.filter((c) => c.tag === tag);
      collectionGrid.innerHTML = filtered.map((c) => mkCard(c)).join("");
      document.querySelectorAll(".chip").forEach((el) => el.classList.toggle("active", el.dataset.tag === tag));
    }
    chips.addEventListener("click", (e) => {
      if (!e.target.classList.contains("chip")) return;
      renderCollections(e.target.dataset.tag);
    });
    renderCollections();

    const sliderWrap = document.getElementById("heroSlider");
    const slideTitle = document.getElementById("slideTitle");
    const slideText = document.getElementById("slideText");
    heroSlides.forEach((s, i) => {
      const div = document.createElement("div");
      div.className = `slide ${i === 0 ? "active" : ""}`;
      div.style.backgroundImage = `linear-gradient(45deg, rgba(4,18,46,.05), rgba(4,18,46,.2)), url('${encodeURI(s.img)}')`;
      sliderWrap.appendChild(div);
    });
    let slideIndex = 0;
    const slideEls = [...sliderWrap.querySelectorAll(".slide")];
    setInterval(() => {
      slideIndex = (slideIndex + 1) % heroSlides.length;
      slideEls.forEach((el, idx) => el.classList.toggle("active", idx === slideIndex));
      slideTitle.textContent = heroSlides[slideIndex].title;
      slideText.textContent = heroSlides[slideIndex].text;
    }, 4300);

    document.getElementById("instaGrid").innerHTML = productImages.slice(0, 12).map((src) => `<figure><img src="${encodeURI(src)}" alt="Fabric Infinity Instagram" loading="lazy"></figure>`).join("");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add("show"); });
    }, { threshold: 0.14 });
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    // ── Mobile nav toggle ──────────────────────────────────────
    const menuToggle = document.getElementById("menuToggle");
    const nav = document.getElementById("mainNav");
    const navCloseBtn = document.getElementById("navCloseBtn");

    function openMobileNav() {
      nav.classList.add("open");
      menuToggle.setAttribute("aria-expanded", "true");
      if (navCloseBtn) navCloseBtn.style.display = "flex";
      document.body.style.overflow = "hidden";
    }
    function closeMobileNav() {
      nav.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
      if (navCloseBtn) navCloseBtn.style.display = "none";
      document.body.style.overflow = "";
    }

    menuToggle.addEventListener("click", () => {
      nav.classList.contains("open") ? closeMobileNav() : openMobileNav();
    });
    if (navCloseBtn) navCloseBtn.addEventListener("click", closeMobileNav);

    // Close nav when clicking any link on mobile
    nav.addEventListener("click", (e) => {
      const link = e.target.closest("a");
      if (!link || window.innerWidth > 1140) return;
      const hasMegaId = link.dataset.megaid;
      if (hasMegaId) {
        // It's a top-level dropdown trigger — toggle accordion, don't close nav
        return;
      }
      // It's a category chip or static link — close nav after brief delay
      setTimeout(closeMobileNav, 220);
    });

    function renderMiniList(targetId, rows, lowStock = false) {
      const target = document.getElementById(targetId);
      target.innerHTML = rows.map((r) => `<div class="mini-row"><img src="${encodeURI(r.img)}" alt="${r.name}" /><div><strong>${r.name}</strong><span>${r.sub}</span></div><span class="pill" style="${lowStock ? "color:#b43d4e;background:#fff1f4;border-color:#f5c8d1;" : ""}">${r.meta}</span></div>`).join("");
    }
    const recentOrders = [
      { id: "#FI1258", name: "Indigo Floral Print", price: "INR 1,899", status: "New", cls: "status-new", img: productImages[21], time: "2 mins ago" },
      { id: "#FI1257", name: "Ajrakh Handblock", price: "INR 2,499", status: "Processing", cls: "status-process", img: productImages[0], time: "15 mins ago" },
      { id: "#FI1256", name: "Bagru Cotton", price: "INR 1,799", status: "Packed", cls: "status-packed", img: productImages[5], time: "45 mins ago" },
      { id: "#FI1255", name: "Cotton Linen", price: "INR 2,199", status: "Shipped", cls: "status-new", img: productImages[11], time: "1 hour ago" },
      { id: "#FI1254", name: "Mustard Handblock", price: "INR 1,699", status: "Delivered", cls: "status-packed", img: productImages[9], time: "2 hours ago" }
    ];
    document.getElementById("recentOrders").innerHTML = recentOrders.map((o) => `<div class="recent-item"><img src="${encodeURI(o.img)}" alt="${o.name}" /><div><strong>${o.id} ${o.name}</strong><span>${o.time}</span></div><div style="text-align:right"><strong>${o.price}</strong><span class="${o.cls}">${o.status}</span></div></div>`).join("");
    renderMiniList("topSelling", [
      { img: productImages[21], name: "Indigo Floral Print", sub: "820 mtrs", meta: "INR 1,99,800" },
      { img: productImages[0], name: "Ajrakh Handblock", sub: "610 mtrs", meta: "INR 1,64,700" },
      { img: productImages[5], name: "Dabu Print Cotton", sub: "560 mtrs", meta: "INR 1,00,240" },
      { img: productImages[8], name: "Cambric Cotton Plain", sub: "470 mtrs", meta: "INR 70,500" },
      { img: productImages[11], name: "Cotton Linen Floral", sub: "420 mtrs", meta: "INR 92,580" }
    ]);
    renderMiniList("lowStock", [
      { img: productImages[0], name: "Ajrakh Handblock", sub: "Stock: 18 mtrs", meta: "Low Stock" },
      { img: productImages[21], name: "Indigo Dabu Print", sub: "Stock: 15 mtrs", meta: "Low Stock" },
      { img: productImages[9], name: "Mustard Handblock", sub: "Stock: 12 mtrs", meta: "Low Stock" },
      { img: productImages[11], name: "Ikat Cotton Fabric", sub: "Stock: 20 mtrs", meta: "Low Stock" },
      { img: productImages[16], name: "Modal Silk Fabric", sub: "Stock: 10 mtrs", meta: "Low Stock" }
    ], true);

    // ── Mega Menu: Storefront ────────────────────────────────────
    let _megaMenuData = [];

    function buildMegaSkeletonHTML() {
      return `<div class="mega-skeleton">${[1,2,3,4].map(() =>
        `<div class="mega-skeleton-col">
          <div class="mega-skeleton-line head"></div>
          ${[1,2,3,4,5,6].map(i => `<div class="mega-skeleton-line" style="width:${55+Math.random()*35|0}%"></div>`).join("")}
        </div>`
      ).join("")}</div>`;
    }

    function buildMegaPanelHTML(menu) {
      if (!menu.columns || !menu.columns.length) {
        return `<div style="color:#5f7395;font-size:.9rem;padding:8px">No categories added yet.</div>`;
      }
      return menu.columns
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(col => `
          <div class="mega-col">
            <div class="mega-col-head">${col.heading}</div>
            <ul>${col.items.map(item => {
              // Check if any loaded product matches this category label
              const label = item.label.toLowerCase().trim();
              const hasProducts = _state.products && _state.products.some(p =>
                p.category && p.category.toLowerCase().trim() === label
              );
              const unavailableTag = (!hasProducts && _state.products && _state.products.length > 0)
                ? `<span style="font-size:.68rem;color:#aab8cc;font-weight:600;margin-left:4px;vertical-align:middle;">(Soon)</span>`
                : "";
              return `<li><a href="${item.href || '#shop'}" class="${item.highlight ? 'mega-highlight' : ''}"
                  onclick="filterByCategory('${item.label.replace(/'/g,"\\'")}',event)"
                >${item.label}${unavailableTag}</a></li>`;
            }).join("")}</ul>
          </div>
        `).join("");
    }

    function injectMegaMenuItems(menus) {
      _megaMenuData = menus;
      const list = $("#megaNavList");
      if (!list) return;

      // Remove previously injected dynamic items
      $$(".mega-nav-item").forEach(el => el.remove());

      // Find the anchor point (Home li) — insert AFTER it in correct order
      // by appending to the list but BEFORE the static links (New Arrivals etc)
      const staticLinks = list.querySelectorAll("li:not(.mega-nav-item)");
      // Insert point: after Home (first li), before "New Arrivals" (second static li)
      const insertBefore = staticLinks[1] || null; // "New Arrivals" li

      menus.forEach(menu => {
        const li = document.createElement("li");
        li.className = "mega-nav-item";
        const hasColumns = menu.columns && menu.columns.length > 0;
        li.innerHTML = `
          <a href="#shop" data-megaid="${menu._id}" style="justify-content:space-between;">
            <span>${menu.navLabel}</span>
            <span class="nav-arrow">▾</span>
          </a>
          <div class="mega-panel${hasColumns && menu.columns.length <= 2 ? ' mega-small' : ''}" id="mega-${menu._id}">
            ${buildMegaPanelHTML(menu)}
          </div>`;

        // Insert in correct order before the static "New Arrivals" link
        if (insertBefore) {
          list.insertBefore(li, insertBefore);
        } else {
          list.appendChild(li);
        }

        // Toggle open on click (touch-friendly + desktop)
        const trigger = li.querySelector("a[data-megaid]");
        trigger.addEventListener("click", (e) => {
          // On desktop only prevent navigation when panel has content
          if (window.innerWidth > 1140 && menu.columns && menu.columns.length) {
            e.preventDefault();
          }
          const isOpen = li.classList.contains("mega-open");
          // Close all others
          $$(".mega-nav-item").forEach(x => x.classList.remove("mega-open"));
          if (!isOpen) li.classList.add("mega-open");
        });
      });

      // Close on outside click
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".mega-nav-item")) {
          $$(".mega-nav-item").forEach(x => x.classList.remove("mega-open"));
        }
      });
    }

    // Filter storefront to show only products matching clicked category
    function filterByCategory(label, e) {
      if (e) e.preventDefault();
      // Close all mega panels
      $$(".mega-nav-item").forEach(x => x.classList.remove("mega-open"));

      const lbl = label.toLowerCase().trim();
      const matched = _state.products.filter(p =>
        p.category && p.category.toLowerCase().trim() === lbl
      );

      const grid  = document.getElementById("liveProductsGrid");
      const meta  = document.getElementById("liveProductsMeta");
      const sec   = document.getElementById("new");

      if (grid) {
        if (matched.length === 0) {
          const waPhone = (_state.shopPhone || "918530361444").replace(/\D/g,"");
          grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:48px 20px;">
              <div style="font-size:3rem;margin-bottom:12px;">🧵</div>
              <h3 style="font-family:'Cormorant Garamond',serif;color:#132038;margin-bottom:8px;">${label}</h3>
              <p style="color:#5f7395;font-size:1rem;margin-bottom:16px;">
                Currently not available — we're sourcing fresh stock for this category.
              </p>
              <p style="color:#7a94bc;font-size:.88rem;">
                Browse our other collections or
                <a href="https://wa.me/${waPhone}?text=Hi!%20I'm%20interested%20in%20${encodeURIComponent(label)}%20fabric."
                   target="_blank" rel="noopener"
                   style="color:#1464ce;font-weight:700;">WhatsApp us to pre-order</a>.
              </p>
              <button class="btn" onclick="loadStorefrontProducts()" style="margin-top:16px;">← View All Products</button>
            </div>`;
        } else {
          grid.innerHTML = matched.map(p => productCard(p)).join("");
        }
      }
      if (meta) meta.textContent = matched.length > 0
        ? `Showing ${matched.length} product${matched.length !== 1 ? "s" : ""} in "${label}"`
        : `No products in "${label}" yet`;
      if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    async function loadMegaMenu() {
      // Show skeleton immediately
      const list = $("#megaNavList");
      if (list) {
        const insertBefore = list.querySelectorAll("li:not(.mega-nav-item)")[1] || null;
        const skeletonLi = document.createElement("li");
        skeletonLi.id = "megaNavSkeleton";
        skeletonLi.className = "mega-nav-item";
        skeletonLi.innerHTML = `<a href="#shop">FABRICS <span class="nav-arrow">▾</span></a><div class="mega-panel" style="display:flex">${buildMegaSkeletonHTML()}</div>`;
        if (insertBefore) list.insertBefore(skeletonLi, insertBefore); else list.appendChild(skeletonLi);
        setTimeout(() => { const sk = $("#megaNavSkeleton"); if (sk) sk.remove(); }, 1200);
      }
      try {
        const data = await api("/api/mega-menu");
        const menus = (data.menus || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const sk = $("#megaNavSkeleton"); if (sk) sk.remove();
        injectMegaMenuItems(menus);
      } catch(e) {
        const sk = $("#megaNavSkeleton"); if (sk) sk.remove();
        console.warn("Mega menu load failed", e);
      }
    }

    // ── Categories Dashboard ─────────────────────────────────────
    let _adminMenus = [];

    function renderMenuManager(menus) {
      _adminMenus = menus;
      const wrap = $("#menuManagerList");
      if (!wrap) return;
      if (!menus.length) {
        wrap.innerHTML = `<p style="color:#5f7395;font-size:.9rem">No menus yet. Add one above.</p>`;
        return;
      }
      wrap.innerHTML = menus.map((menu, mi) => `
        <div style="background:#f8fbff;border:1px solid #d4e2f8;border-radius:14px;padding:16px;" id="menuCard-${menu._id}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <input value="${menu.navLabel.replace(/"/g,'&quot;')}" data-mfield="navLabel" data-mid="${menu._id}" style="font:inherit;font-weight:800;font-size:1rem;border:1px solid #d0e0f8;border-radius:8px;padding:5px 10px;width:160px;"/>
              <input value="${menu.slug}" data-mfield="slug" data-mid="${menu._id}" placeholder="slug" style="font:inherit;font-size:.84rem;color:#5f7395;border:1px solid #d0e0f8;border-radius:8px;padding:5px 10px;width:130px;"/>
              <label style="display:flex;align-items:center;gap:6px;font-size:.84rem;font-weight:700;color:#3d5e89;cursor:pointer;">
                <input type="checkbox" data-mfield="isActive" data-mid="${menu._id}" ${menu.isActive ? "checked" : ""} style="width:16px;height:16px;accent-color:#0b2e67;cursor:pointer;"/>
                Active
              </label>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn" data-msave="${menu._id}" style="font-size:.8rem;padding:5px 12px;">Save Label</button>
              <button class="btn" data-mdelete="${menu._id}" style="font-size:.8rem;padding:5px 12px;color:#c0392b;border-color:#f5c6c6;">Delete Menu</button>
            </div>
          </div>

          <!-- Columns -->
          <div style="display:grid;gap:10px;" id="colsWrap-${menu._id}">
            ${menu.columns.map((col, ci) => `
              <div style="background:#fff;border:1px solid #e0eaf8;border-radius:10px;padding:12px;" id="col-${menu._id}-${ci}">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap;">
                  <input value="${col.heading.replace(/"/g,'&quot;')}" data-col-heading="${menu._id}-${ci}" placeholder="Column heading" style="font:inherit;font-weight:700;font-size:.9rem;border:1px solid #d0e0f8;border-radius:7px;padding:4px 8px;flex:1;min-width:120px;"/>
                  <button class="btn" data-col-save="${menu._id}" data-col-idx="${ci}" style="font-size:.78rem;padding:4px 10px;">Save Col</button>
                  <button class="btn" data-col-del="${menu._id}" data-col-idx="${ci}" style="font-size:.78rem;padding:4px 10px;color:#c0392b;border-color:#f5c6c6;">✕ Col</button>
                </div>
                <!-- Items list -->
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;" id="items-${menu._id}-${ci}">
                  ${col.items.map((item, ii) => `
                    <span style="display:inline-flex;align-items:center;gap:4px;background:${item.highlight ? '#ddeaff' : '#f0f5ff'};border:1px solid ${item.highlight ? '#9dc0f5' : '#d4e2f8'};border-radius:999px;padding:4px 10px;font-size:.82rem;font-weight:${item.highlight ? 700 : 500};color:${item.highlight ? '#1a5bc4' : '#2c456e'};">
                      ${item.label}
                      <button data-item-del="${menu._id}" data-item-col="${ci}" data-item-idx="${ii}" style="background:none;border:none;cursor:pointer;color:#c0392b;font-size:.9rem;padding:0 0 0 4px;line-height:1;" title="Remove">×</button>
                    </span>
                  `).join("")}
                </div>
                <!-- Add item form -->
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                  <input placeholder="Item label" data-new-item-label="${menu._id}-${ci}" style="border:1px solid #d0e0f8;border-radius:8px;padding:5px 9px;font:inherit;font-size:.84rem;width:160px;"/>
                  <label style="display:flex;align-items:center;gap:4px;font-size:.82rem;font-weight:700;color:#3d5e89;cursor:pointer;">
                    <input type="checkbox" data-new-item-highlight="${menu._id}-${ci}" style="accent-color:#1a5bc4;cursor:pointer;"/>
                    Highlight
                  </label>
                  <button class="btn" data-item-add="${menu._id}" data-item-col="${ci}" style="font-size:.8rem;padding:5px 10px;">+ Add Item</button>
                </div>
              </div>
            `).join("")}
          </div>

          <!-- Add column form -->
          <div style="display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap;">
            <input placeholder="New column heading" data-new-col-heading="${menu._id}" style="border:1px solid #d0e0f8;border-radius:8px;padding:6px 10px;font:inherit;font-size:.86rem;width:200px;"/>
            <button class="btn primary" data-col-add="${menu._id}" style="font-size:.82rem;padding:6px 14px;">+ Add Column</button>
            <span data-col-msg="${menu._id}" style="font-size:.82rem;font-weight:700;"></span>
          </div>
        </div>
      `).join("");

      // Wire up save label
      $$("[data-msave]").forEach(b => b.addEventListener("click", async () => {
        const id = b.dataset.msave;
        const label = document.querySelector(`[data-mfield="navLabel"][data-mid="${id}"]`)?.value.trim();
        const slug  = document.querySelector(`[data-mfield="slug"][data-mid="${id}"]`)?.value.trim();
        const isActive = document.querySelector(`[data-mfield="isActive"][data-mid="${id}"]`)?.checked;
        try {
          await api(`/api/admin/mega-menu/${id}`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ navLabel: label, slug, isActive }) });
          b.textContent = "✓ Saved"; setTimeout(() => { b.textContent = "Save Label"; }, 1500);
          await reloadAdminMenus();
        } catch(e) { alert(e.message); }
      }));

      // Wire up delete menu
      $$("[data-mdelete]").forEach(b => b.addEventListener("click", async () => {
        if (!confirm(`Delete "${b.closest("[id^='menuCard']").querySelector("[data-mfield='navLabel']")?.value}" menu? This will remove it from the navbar.`)) return;
        try {
          await api(`/api/admin/mega-menu/${b.dataset.mdelete}`, { method: "DELETE" });
          await reloadAdminMenus();
        } catch(e) { alert(e.message); }
      }));

      // Wire up save column heading
      $$("[data-col-save]").forEach(b => b.addEventListener("click", async () => {
        const id  = b.dataset.colSave;
        const ci  = Number(b.dataset.colIdx);
        const heading = document.querySelector(`[data-col-heading="${id}-${ci}"]`)?.value.trim();
        const menu = _adminMenus.find(m => m._id === id);
        if (!menu) return;
        const cols = JSON.parse(JSON.stringify(menu.columns));
        if (cols[ci]) cols[ci].heading = heading;
        try {
          await api(`/api/admin/mega-menu/${id}`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ columns: cols }) });
          b.textContent = "✓"; setTimeout(() => { b.textContent = "Save Col"; }, 1500);
          await reloadAdminMenus();
        } catch(e) { alert(e.message); }
      }));

      // Wire up delete column
      $$("[data-col-del]").forEach(b => b.addEventListener("click", async () => {
        const id = b.dataset.colDel;
        const ci = Number(b.dataset.colIdx);
        const menu = _adminMenus.find(m => m._id === id);
        if (!menu) return;
        if (!confirm(`Delete column "${menu.columns[ci]?.heading}"?`)) return;
        const cols = JSON.parse(JSON.stringify(menu.columns));
        cols.splice(ci, 1);
        try {
          await api(`/api/admin/mega-menu/${id}`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ columns: cols }) });
          await reloadAdminMenus();
        } catch(e) { alert(e.message); }
      }));

      // Wire up add column
      $$("[data-col-add]").forEach(b => b.addEventListener("click", async () => {
        const id      = b.dataset.colAdd;
        const heading = document.querySelector(`[data-new-col-heading="${id}"]`)?.value.trim();
        const msg     = document.querySelector(`[data-col-msg="${id}"]`);
        if (!heading) { if (msg) { msg.textContent = "Enter a heading"; msg.style.color = "#de4f63"; } return; }
        const menu = _adminMenus.find(m => m._id === id);
        if (!menu) return;
        const cols = JSON.parse(JSON.stringify(menu.columns));
        cols.push({ heading, items: [], order: cols.length });
        try {
          await api(`/api/admin/mega-menu/${id}`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ columns: cols }) });
          if (msg) { msg.textContent = "Column added!"; msg.style.color = "#1fa97a"; setTimeout(() => { msg.textContent = ""; }, 1500); }
          await reloadAdminMenus();
        } catch(e) { alert(e.message); }
      }));

      // Wire up add item
      $$("[data-item-add]").forEach(b => b.addEventListener("click", async () => {
        const id  = b.dataset.itemAdd;
        const ci  = Number(b.dataset.itemCol);
        const labelInput = document.querySelector(`[data-new-item-label="${id}-${ci}"]`);
        const hlInput    = document.querySelector(`[data-new-item-highlight="${id}-${ci}"]`);
        const label      = labelInput?.value.trim();
        if (!label) { alert("Enter a label"); return; }
        try {
          await api(`/api/admin/mega-menu/${id}/columns/${ci}/items`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ label, highlight: hlInput?.checked || false }) });
          if (labelInput) labelInput.value = "";
          if (hlInput) hlInput.checked = false;
          await reloadAdminMenus();
        } catch(e) { alert(e.message); }
      }));

      // Wire up delete item
      $$("[data-item-del]").forEach(b => b.addEventListener("click", async () => {
        const id  = b.dataset.itemDel;
        const ci  = Number(b.dataset.itemCol);
        const ii  = Number(b.dataset.itemIdx);
        try {
          await api(`/api/admin/mega-menu/${id}/columns/${ci}/items/${ii}`, { method: "DELETE" });
          await reloadAdminMenus();
        } catch(e) { alert(e.message); }
      }));
    }

    async function reloadAdminMenus() {
      try {
        const data = await api("/api/admin/mega-menu");
        renderMenuManager(data.menus || []);
        // Also refresh storefront navbar
        const pubData = await api("/api/mega-menu");
        injectMegaMenuItems((pubData.menus || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      } catch(e) { console.error("Reload menus error", e); }
    }

    async function loadAdminMenusTab() {
      const wrap = $("#menuManagerList");
      if (wrap) wrap.innerHTML = `<p style="color:#5f7395;font-size:.9rem">Loading menus...</p>`;
      await reloadAdminMenus();
    }

    // ── Icon Action Bar ──────────────────────────────────────────
    (function initIconBar() {

      // helper: close all flyouts
      function closeAll() {
        const sf = document.getElementById("searchFlyout");
        const af = document.getElementById("accountFlyout");
        if (sf) { sf.classList.remove("open"); document.getElementById("searchIconBtn")?.setAttribute("aria-expanded","false"); }
        if (af) { af.classList.remove("open"); document.getElementById("accountIconBtn")?.setAttribute("aria-expanded","false"); }
      }

      // ── Search ──
      const searchBtn    = document.getElementById("searchIconBtn");
      const searchFlyout = document.getElementById("searchFlyout");
      const searchInput  = document.getElementById("searchInput");
      const searchResults= document.getElementById("searchResults");

      if (searchBtn && searchFlyout) {
        searchBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const isOpen = searchFlyout.classList.contains("open");
          closeAll();
          if (!isOpen) {
            searchFlyout.classList.add("open");
            searchBtn.setAttribute("aria-expanded","true");
            setTimeout(() => searchInput?.focus(), 80);
          }
        });
      }

      function renderSearchResults(query) {
        if (!searchResults) return;
        const q = query.trim().toLowerCase();
        if (!q) { searchResults.innerHTML = ""; return; }
        const hits = _state.products.filter(p =>
          p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
        ).slice(0, 6);
        if (!hits.length) {
          searchResults.innerHTML = `<p class="search-no-results">No results for "<em>${query}</em>"</p>`;
          return;
        }
        searchResults.innerHTML = hits.map(p => `
          <div class="search-result-item" data-search-id="${p._id}">
            <img src="${p.imageUrl}" alt="${p.name}" loading="lazy"/>
            <div>
              <strong>${p.name}</strong>
              <span>${p.category} · INR ${Number(p.price).toLocaleString("en-IN")}/m</span>
            </div>
          </div>`).join("");
        searchResults.querySelectorAll(".search-result-item").forEach(el => {
          el.addEventListener("click", () => {
            const product = _state.products.find(p => p._id === el.dataset.searchId);
            if (product) addToCart(product);
            closeAll();
          });
        });
      }

      if (searchInput) {
        searchInput.addEventListener("input", () => renderSearchResults(searchInput.value));
        searchInput.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });
      }

      // ── Account flyout ──
      const accountBtn    = document.getElementById("accountIconBtn");
      const accountFlyout = document.getElementById("accountFlyout");

      if (accountBtn && accountFlyout) {
        accountBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const isOpen = accountFlyout.classList.contains("open");
          closeAll();
          if (!isOpen) {
            accountFlyout.classList.add("open");
            accountBtn.setAttribute("aria-expanded","true");
          }
        });
      }

      // Close on outside click
      document.addEventListener("click", (e) => {
        if (!e.target.closest("#searchIconBtn") && !e.target.closest("#searchFlyout") &&
            !e.target.closest("#accountIconBtn") && !e.target.closest("#accountFlyout")) {
          closeAll();
        }
      });

    })();

    // ── Wire up everything ───────────────────────────────────────
    // Cart
    const cartOpenBtn = document.getElementById("cartOpenBtn");
    if (cartOpenBtn) cartOpenBtn.addEventListener("click", openCart);
    const closeCartBtn = document.getElementById("closeCartBtn");
    if (closeCartBtn) closeCartBtn.addEventListener("click", closeCart);
    const cartBackdrop = document.getElementById("cartBackdrop");
    if (cartBackdrop) cartBackdrop.addEventListener("click", closeCart);
    const proceedCheckoutBtn = document.getElementById("proceedCheckoutBtn");
    if (proceedCheckoutBtn) proceedCheckoutBtn.addEventListener("click", openCheckout);

    // Checkout
    const closeCheckoutBtn = document.getElementById("closeCheckoutBtn");
    if (closeCheckoutBtn) closeCheckoutBtn.addEventListener("click", closeCheckout);
    const checkoutForm = document.getElementById("checkoutForm");
    if (checkoutForm) checkoutForm.addEventListener("submit", handleCheckoutSubmit);
    const checkoutModalEl = document.getElementById("checkoutModal");
    if (checkoutModalEl) checkoutModalEl.addEventListener("click", (e) => { if (e.target === checkoutModalEl) closeCheckout(); });

    // Owner modal — button now lives inside account flyout
    const ownerOpenBtn = document.getElementById("ownerOpenBtn");
    if (ownerOpenBtn) ownerOpenBtn.addEventListener("click", () => {
      // close account flyout first
      const af = document.getElementById("accountFlyout");
      if (af) af.classList.remove("open");
      openOwnerModal();
    });
    const ownerCancel = document.getElementById("ownerCancel");
    if (ownerCancel) ownerCancel.addEventListener("click", closeOwnerModal);
    const ownerLoginBtn = document.getElementById("ownerLogin");
    if (ownerLoginBtn) ownerLoginBtn.addEventListener("click", doOwnerLogin);
    const ownerPassInput = document.getElementById("ownerPassword");
    if (ownerPassInput) ownerPassInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doOwnerLogin(); });
    const ownerModalEl = document.getElementById("ownerModal");
    if (ownerModalEl) ownerModalEl.addEventListener("click", (e) => { if (e.target === ownerModalEl) closeOwnerModal(); });

    // Dashboard exit
    const exitDashboard = document.getElementById("exitDashboard");
    if (exitDashboard) exitDashboard.addEventListener("click", closeDashboard);
    const visitStoreBtn = document.getElementById("visitStoreBtn");
    if (visitStoreBtn) visitStoreBtn.addEventListener("click", () => { const d = document.getElementById("ownerDashboard"); if (d) d.classList.remove("open"); document.body.style.overflow = ""; });

    // ── Dashboard Mobile Sidebar ────────────────────────────────
    (function initDashMobileSidebar() {
      const menuBtn   = document.getElementById("dashMenuBtn");
      const side      = document.getElementById("dashSide");
      const overlay   = document.getElementById("dashSideOverlay");
      const closeBtn  = document.getElementById("dashSideClose");
      if (!menuBtn || !side) return;

      function isMobile() { return window.innerWidth <= 1140; }

      function openSidebar() {
        side.classList.add("mob-open");
        overlay.classList.add("mob-open");
        document.body.style.overflow = "hidden";
      }
      function closeSidebar() {
        side.classList.remove("mob-open");
        overlay.classList.remove("mob-open");
        document.body.style.overflow = "";
      }

      function applyMobileState() {
        if (isMobile()) {
          menuBtn.style.display = "flex";
          if (closeBtn) closeBtn.style.display = "flex";
        } else {
          menuBtn.style.display = "none";
          if (closeBtn) closeBtn.style.display = "none";
          closeSidebar();
        }
      }

      menuBtn.addEventListener("click", openSidebar);
      if (overlay) overlay.addEventListener("click", closeSidebar);
      if (closeBtn) closeBtn.addEventListener("click", closeSidebar);

      // Close sidebar when a nav tab is clicked on mobile
      document.getElementById("dashNav")?.querySelectorAll("a[data-tab]").forEach(a => {
        a.addEventListener("click", (e) => { e.preventDefault(); switchTab(a.dataset.tab); if (a.dataset.tab === "tabCategories") loadAdminMenusTab(); if (a.dataset.tab === "tabSettings") loadSettingsTab(); if (a.dataset.tab === "tabShipping") loadShippingTab(); if (isMobile()) setTimeout(closeSidebar, 200); });
      });

      applyMobileState();
      window.addEventListener("resize", applyMobileState);
    })();

    // ── AI Product Upload Form ───────────────────────────────────
    (function initAiProductForm() {
      const imgInput     = document.getElementById("productImageInput");
      const imgPreview   = document.getElementById("productImagePreview");
      const step1        = document.getElementById("aiStep1");
      const placeholder  = document.getElementById("aiStep1Placeholder");
      const previewWrap  = document.getElementById("aiStep1Preview");
      const detectStatus = document.getElementById("aiDetectStatus");
      const detectFile   = document.getElementById("aiDetectFileName");
      const redetectBtn  = document.getElementById("aiRedetectBtn");
      const fieldsWrap   = document.getElementById("aiFieldsWrap");
      const addProductForm = document.getElementById("addProductForm");
      const resetBtn     = document.getElementById("resetProductFormBtn");
      const toggleTrack  = document.getElementById("aiToggleTrack");
      const toggleThumb  = document.getElementById("aiToggleThumb");

      let aiEnabled = true;
      let lastFile   = null;
      let aiSuggestion = null;

      // Toggle AI on/off
      if (toggleTrack) {
        toggleTrack.classList.add("on");
        toggleTrack.addEventListener("click", () => {
          aiEnabled = !aiEnabled;
          toggleTrack.classList.toggle("on", aiEnabled);
        });
      }

      function setStatus(text, color) {
        if (detectStatus) { detectStatus.textContent = text; detectStatus.style.color = color || "#5f7395"; }
      }

      function fillFields(s) {
        // Map AI suggestion keys to form field IDs
        const map = {
          name: "pf_name", category: "pf_category", price: "pf_price",
          stock: "pf_stock", fabricType: "pf_fabricType", material: "pf_material",
          colour: "pf_colour", pattern: "pf_pattern", occasion: "pf_occasion",
          season: "pf_season", width: "pf_width", printType: "pf_printType",
          productType: "pf_productType", gsm: "pf_gsm"
        };
        Object.entries(map).forEach(([k, id]) => {
          const el = document.getElementById(id);
          if (el && s[k] !== undefined) { el.value = s[k]; el.classList.add("ai-filled"); }
        });
        const desc = document.getElementById("pf_desc");
        if (desc && s.description) { desc.value = s.description; desc.classList.add("ai-filled"); }
        // Auto-generate SEO slug from name
        const slug = document.getElementById("pf_seoSlug");
        if (slug && s.name) slug.value = s.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
        if (fieldsWrap) fieldsWrap.style.display = "block";
        if (redetectBtn) redetectBtn.style.display = "inline-block";
      }

      function clearFillMarks() {
        ["pf_name","pf_sku","pf_category","pf_subcategory","pf_productType","pf_brand",
         "pf_desc","pf_price","pf_costPrice","pf_wholesalePrice","pf_offerPrice","pf_gst",
         "pf_stock","pf_minStockAlert","pf_warehouseLocation",
         "pf_fabricType","pf_material","pf_weave","pf_printType","pf_gsm","pf_width",
         "pf_lengthUnit","pf_colour","pf_pattern","pf_occasion","pf_season",
         "pf_seoSlug","pf_metaTitle","pf_metaDesc","pf_keywords"
        ].forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove("ai-filled"); });
      }

      async function runAiDetect(file) {
        if (!aiEnabled) {
          // Just show fields empty for manual fill
          if (fieldsWrap) fieldsWrap.style.display = "block";
          setStatus("AI off — fill manually", "#7a94bc");
          return;
        }
        setStatus("✨ Analysing with AI…", "#1464ce");
        try {
          const fd = new FormData();
          fd.append("image", file);
          fd.append("imageName", file.name);
          const data = await api("/api/admin/ai-product-detect", { method: "POST", body: fd });
          aiSuggestion = data.suggestion || {};
          fillFields(aiSuggestion);
          setStatus("✓ AI filled all fields — edit if needed", "#1fa97a");
        } catch (err) {
          setStatus("AI failed: " + err.message + " — fill manually", "#de4f63");
          if (fieldsWrap) fieldsWrap.style.display = "block";
        }
      }

      function handleFile(file) {
        if (!file || !file.type.startsWith("image/")) return;
        lastFile = file;
        aiSuggestion = null;
        clearFillMarks();

        // Show preview
        const url = URL.createObjectURL(file);
        if (imgPreview) { imgPreview.src = url; }
        if (detectFile) detectFile.textContent = file.name;
        if (placeholder) placeholder.style.display = "none";
        if (previewWrap) previewWrap.style.display = "flex";
        if (fieldsWrap)  fieldsWrap.style.display = "none";
        if (redetectBtn) redetectBtn.style.display = "none";

        runAiDetect(file);
      }

      if (imgInput) {
        imgInput.addEventListener("change", () => { if (imgInput.files[0]) handleFile(imgInput.files[0]); });
      }

      // Drag & drop
      if (step1) {
        step1.addEventListener("dragover", (e) => { e.preventDefault(); step1.classList.add("drag-over"); });
        step1.addEventListener("dragleave", () => step1.classList.remove("drag-over"));
        step1.addEventListener("drop", (e) => {
          e.preventDefault();
          step1.classList.remove("drag-over");
          const file = e.dataTransfer?.files?.[0];
          if (file) { handleFile(file); }
        });
      }

      // Re-detect
      if (redetectBtn) {
        redetectBtn.addEventListener("click", () => { if (lastFile) runAiDetect(lastFile); });
      }

      // Reset
      function resetForm() {
        lastFile = null; aiSuggestion = null;
        if (addProductForm) addProductForm.reset();
        if (imgPreview)  { imgPreview.src = ""; }
        if (placeholder) placeholder.style.display = "block";
        if (previewWrap) previewWrap.style.display = "none";
        if (fieldsWrap)  fieldsWrap.style.display = "none";
        if (redetectBtn) redetectBtn.style.display = "none";
        clearFillMarks();
        const msg = document.getElementById("addProductMsg");
        if (msg) msg.textContent = "";
      }

      if (resetBtn) resetBtn.addEventListener("click", resetForm);

      // Submit — send all fields
      if (addProductForm) {
        addProductForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          if (!lastFile) { alert("Please select a product image first."); return; }
          const msg = document.getElementById("addProductMsg");
          msg.textContent = "Uploading…"; msg.style.color = "#5f7395";
          const g = id => document.getElementById(id)?.value?.trim() || "";
          const gn = id => document.getElementById(id)?.value || "";
          try {
            const fd = new FormData();
            fd.append("image",            lastFile);
            // basic
            fd.append("name",             g("pf_name"));
            fd.append("sku",              g("pf_sku"));
            fd.append("category",         g("pf_category"));
            fd.append("subcategory",      g("pf_subcategory"));
            fd.append("productType",      g("pf_productType"));
            fd.append("brand",            g("pf_brand") || "Fabric Infinity");
            fd.append("description",      g("pf_desc"));
            // pricing
            fd.append("price",            gn("pf_price"));
            fd.append("costPrice",        gn("pf_costPrice"));
            fd.append("wholesalePrice",   gn("pf_wholesalePrice"));
            fd.append("offerPrice",       gn("pf_offerPrice"));
            fd.append("gst",              gn("pf_gst") || "5");
            // inventory
            fd.append("stock",            gn("pf_stock"));
            fd.append("minStockAlert",    gn("pf_minStockAlert") || "10");
            fd.append("warehouseLocation",g("pf_warehouseLocation"));
            // fabric
            fd.append("fabricType",  g("pf_fabricType"));
            fd.append("material",    g("pf_material"));
            fd.append("weave",       g("pf_weave"));
            fd.append("printType",   g("pf_printType"));
            fd.append("gsm",         gn("pf_gsm") || "0");
            fd.append("width",       g("pf_width"));
            fd.append("lengthUnit",  g("pf_lengthUnit") || "Metre");
            fd.append("colour",      g("pf_colour"));
            fd.append("pattern",     g("pf_pattern"));
            fd.append("occasion",    g("pf_occasion"));
            fd.append("season",      g("pf_season"));
            // seo
            fd.append("seoSlug",   g("pf_seoSlug"));
            fd.append("metaTitle", g("pf_metaTitle"));
            fd.append("metaDesc",  g("pf_metaDesc"));
            fd.append("keywords",  g("pf_keywords"));
            await api("/api/admin/products", { method: "POST", body: fd });
            msg.textContent = "✓ Product added!"; msg.style.color = "#1fa97a";
            setTimeout(resetForm, 1200);
            await loadDashboardData();
          } catch(err) { msg.textContent = err.message; msg.style.color = "#de4f63"; }
        });
      }
    })();

    // Refresh buttons
    const refreshProductsBtn = document.getElementById("refreshProductsBtn");
    if (refreshProductsBtn) refreshProductsBtn.addEventListener("click", () => loadDashboardData());
    const refreshOrdersBtn = document.getElementById("refreshOrdersBtn");
    if (refreshOrdersBtn) refreshOrdersBtn.addEventListener("click", () => loadDashboardData());

    // Reset categories to default seed
    const reseedMenuBtn = document.getElementById("reseedMenuBtn");
    if (reseedMenuBtn) {
      reseedMenuBtn.addEventListener("click", async () => {
        if (!confirm("This will reset ALL mega-menu categories to the default Fabric Infinity tree. Any manual changes will be lost. Continue?")) return;
        const msg = document.getElementById("reseedMsg");
        msg.textContent = "Resetting…"; msg.style.color = "#5f7395";
        reseedMenuBtn.disabled = true;
        try {
          const data = await api("/api/admin/reseed-menu", { method: "POST" });
          msg.textContent = `✓ Done — ${data.count} menus: ${data.menus.join(", ")}`;
          msg.style.color = "#1fa97a";
          // Refresh storefront navbar live
          const pubData = await api("/api/mega-menu");
          injectMegaMenuItems((pubData.menus || []).sort((a,b) => (a.order??0)-(b.order??0)));
          await reloadAdminMenus();
        } catch(e) {
          msg.textContent = "Failed: " + e.message;
          msg.style.color = "#de4f63";
        } finally {
          reseedMenuBtn.disabled = false;
          setTimeout(() => { msg.textContent = ""; }, 4000);
        }
      });
    }

    // Add new top-level menu form
    const addMenuForm = document.getElementById("addMenuForm");
    if (addMenuForm) {
      addMenuForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const msg   = document.getElementById("addMenuMsg");
        const label = document.getElementById("newMenuLabel").value.trim();
        const slug  = document.getElementById("newMenuSlug").value.trim();
        if (!label || !slug) { msg.textContent = "Both fields required."; msg.style.color = "#de4f63"; return; }
        msg.textContent = "Adding..."; msg.style.color = "#5f7395";
        try {
          await api("/api/admin/mega-menu", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ navLabel: label, slug, columns: [], order: 99 }) });
          addMenuForm.reset();
          msg.textContent = "✓ Menu added!"; msg.style.color = "#1fa97a";
          setTimeout(() => { msg.textContent = ""; }, 2000);
          await reloadAdminMenus();
        } catch(err) { msg.textContent = err.message; msg.style.color = "#de4f63"; }
      });
    }

    // Load Razorpay config + storefront products
    (async () => {
      try {
        const cfg = await api("/api/payment/config");
        _state.razorpayKeyId = cfg.razorpayKeyId || "";
        if (cfg.shop?.name) _state.shopName = cfg.shop.name;
        if (cfg.shop?.phone) _state.shopPhone = cfg.shop.phone;
      } catch(e) {}
      await loadStorefrontProducts();
      await loadMegaMenu();
      renderCartDrawer();

      // If token exists, verify it's still valid
      if (_state.token) {
        try { await api("/api/auth/me"); } catch(e) { _state.token = ""; localStorage.removeItem("fi_token"); }
      }
    })();

    // Load Razorpay script if needed
    if (!window.Razorpay) {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      document.head.appendChild(s);
    }
    // ── Payment Method Card Toggle ───────────────────────────────
    (function setupPaymentCards() {
      function initPaymentCards() {
        const pmCOD = document.getElementById("pmCardCOD");
        const pmRzp = document.getElementById("pmCardRazorpay");
        const hiddenInput = document.getElementById("cMethod");
        if (!pmCOD || !pmRzp || !hiddenInput) return;
        function selectMethod(method) {
          hiddenInput.value = method;
          if (method === "COD") {
            pmCOD.style.border = "2px solid #1d4fa7";
            pmCOD.style.background = "linear-gradient(135deg,#e8f2ff,#f3f8ff)";
            pmRzp.style.border = "2px solid #d5e2f5";
            pmRzp.style.background = "#fff";
          } else {
            pmRzp.style.border = "2px solid #1d4fa7";
            pmRzp.style.background = "linear-gradient(135deg,#e8f2ff,#f3f8ff)";
            pmCOD.style.border = "2px solid #d5e2f5";
            pmCOD.style.background = "#fff";
          }
        }
        pmCOD.addEventListener("click", () => selectMethod("COD"));
        pmRzp.addEventListener("click", () => selectMethod("RAZORPAY"));
        selectMethod("COD");
      }
      // Re-init when checkout opens (called from openCheckout)
      const _origOpenCheckout = window.openCheckout;
      // Payment cards init on DOM ready
      document.addEventListener("DOMContentLoaded", initPaymentCards);
      setTimeout(initPaymentCards, 300);
    })();
    // ── Chat Widget ──────────────────────────────────────────────
    (function initChatWidget() {

      const launcher = document.getElementById("chatLauncher");
      const widget   = document.getElementById("chatWidget");
      if (!launcher || !widget) return;

      // ── open / close ────────────────────────────────────────
      function openWidget() {
        widget.classList.add("widget-open");
        launcher.classList.add("widget-open");
        launcher.setAttribute("aria-expanded", "true");
      }
      function closeWidget() {
        widget.classList.remove("widget-open");
        launcher.classList.remove("widget-open");
        launcher.setAttribute("aria-expanded", "false");
      }
      launcher.addEventListener("click", () => {
        widget.classList.contains("widget-open") ? closeWidget() : openWidget();
      });

      // ── tabs ─────────────────────────────────────────────────
      const tabs   = Array.from(document.querySelectorAll(".cw-tab"));
      const panels = Array.from(document.querySelectorAll(".cw-panel"));
      tabs.forEach(tab => {
        tab.addEventListener("click", () => {
          tabs.forEach(t => { t.classList.remove("cw-active"); t.setAttribute("aria-selected", "false"); });
          panels.forEach(p => p.classList.remove("cw-active"));
          tab.classList.add("cw-active");
          tab.setAttribute("aria-selected", "true");
          const target = document.getElementById(tab.dataset.cwtab);
          if (target) target.classList.add("cw-active");
        });
      });

      // ── WhatsApp link ────────────────────────────────────────
      // Pull phone from config API or fall back to a default
      const cwWaBtn = document.getElementById("cwWaBtn");
      (async () => {
        try {
          const cfg = await fetch("/api/payment/config").then(r => r.json());
          const phone = (cfg.shop?.phone || "+919000000000").replace(/\D/g, "");
          if (cwWaBtn) cwWaBtn.href = `https://wa.me/${phone}?text=Hi%20Fabric%20Infinity!%20I%20have%20a%20question.`;
        } catch (_) {
          if (cwWaBtn) cwWaBtn.href = "https://wa.me/?text=Hi%20Fabric%20Infinity!";
        }
      })();

      // ── Email form ────────────────────────────────────────────
      const cwEmailForm = document.getElementById("cwEmailForm");
      if (cwEmailForm) {
        cwEmailForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const name  = document.getElementById("cwEName")?.value.trim();
          const email = document.getElementById("cwEEmail")?.value.trim();
          const msg   = document.getElementById("cwEMsg")?.value.trim();
          const fb    = document.getElementById("cwEFeedback");
          const btn   = document.getElementById("cwESubmit");
          if (!name || !email || !msg) {
            fb.className = "cw-msg-err"; fb.textContent = "Please fill in all fields."; return;
          }
          // Build mailto link — opens user's mail client
          const subject = encodeURIComponent(`Customer Enquiry from ${name}`);
          const body    = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${msg}`);
          try {
            const cfg = await fetch("/api/payment/config").then(r => r.json()).catch(() => ({}));
            const shopEmail = cfg.shop?.email || "hello@fabricinfinity.com";
            window.open(`mailto:${shopEmail}?subject=${subject}&body=${body}`, "_blank");
            fb.className = "cw-msg-ok";
            fb.textContent = "✓ Your email client has been opened. Send the message from there!";
            cwEmailForm.reset();
          } catch (_) {
            fb.className = "cw-msg-err"; fb.textContent = "Could not open email client. Please email us directly.";
          }
        });
      }

      // ── AI Chat ───────────────────────────────────────────────
      const messagesWrap = document.getElementById("cwAiMessages");
      const aiInput      = document.getElementById("cwAiInput");
      const aiSend       = document.getElementById("cwAiSend");
      let chatHistory    = []; // { role, content }
      let aiLoading      = false;

      function scrollToBottom() {
        if (messagesWrap) messagesWrap.scrollTop = messagesWrap.scrollHeight;
      }

      function addBubble(text, role) {
        const div = document.createElement("div");
        div.className = `cw-bubble ${role}`;
        div.textContent = text;
        messagesWrap.appendChild(div);
        scrollToBottom();
        return div;
      }

      function showTyping() {
        const div = document.createElement("div");
        div.className = "cw-bubble typing";
        div.id = "cwTyping";
        div.innerHTML = `<span class="cw-dot"></span><span class="cw-dot"></span><span class="cw-dot"></span>`;
        messagesWrap.appendChild(div);
        scrollToBottom();
      }

      function removeTyping() {
        const el = document.getElementById("cwTyping");
        if (el) el.remove();
      }

      async function sendAiMessage() {
        if (aiLoading) return;
        const text = (aiInput?.value || "").trim();
        if (!text) return;
        aiInput.value = "";
        aiLoading = true;
        aiSend.disabled = true;

        addBubble(text, "user");
        chatHistory.push({ role: "user", content: text });
        showTyping();

        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: chatHistory })
          });
          removeTyping();
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            addBubble(err.message || "Sorry, something went wrong. Please try again.", "bot");
          } else {
            const data = await res.json();
            const reply = data.reply || "Sorry, I didn't get that. Please try again.";
            addBubble(reply, "bot");
            chatHistory.push({ role: "assistant", content: reply });
            // cap history to avoid ballooning
            if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
          }
        } catch (err) {
          removeTyping();
          addBubble("Network error. Please check your connection and try again.", "bot");
        } finally {
          aiLoading = false;
          aiSend.disabled = false;
          aiInput?.focus();
        }
      }

      if (aiSend)  aiSend.addEventListener("click", sendAiMessage);
      if (aiInput) aiInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAiMessage(); } });

      // Auto-open with a subtle delay on first visit
      const hasSeenWidget = sessionStorage.getItem("fi_chat_seen");
      if (!hasSeenWidget) {
        setTimeout(() => { openWidget(); sessionStorage.setItem("fi_chat_seen", "1"); }, 4500);
      }
    })();

    // ── Settings Tab ─────────────────────────────────────────────
    async function loadSettingsTab() {
      try {
        const s = await api("/api/admin/settings");
        if (document.getElementById("st_groqKey") && s.groqApiKeySet)
          document.getElementById("st_groqStatus").textContent = "✓ Key is set (masked for security)";
        if (document.getElementById("st_srEmail"))
          document.getElementById("st_srEmail").value = s.shiprocketEmail || "";
        if (s.shiprocketPasswordSet && document.getElementById("st_srPass"))
          document.getElementById("st_srPass").placeholder = "••••••••••• (set)";
        const fields = { st_shopName: s.shopName, st_shopPhone: s.shopPhone,
          st_shopEmail: s.shopEmail, st_shopAddress: s.shopAddress, st_announcement: s.announcement };
        Object.entries(fields).forEach(([id, val]) => { const el = document.getElementById(id); if (el && val) el.value = val; });
      } catch(e) { console.error("loadSettings:", e); }
    }

    // Save Groq key
    document.getElementById("st_saveGroq")?.addEventListener("click", async () => {
      const key = document.getElementById("st_groqKey")?.value.trim();
      const msg = document.getElementById("st_groqStatus");
      if (!key) { msg.textContent = "Paste your Groq API key first"; msg.style.color = "#de4f63"; return; }
      try {
        await api("/api/admin/settings", { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ groqApiKey: key }) });
        document.getElementById("st_groqKey").value = "";
        msg.textContent = "✓ Groq key saved!"; msg.style.color = "#1fa97a";
      } catch(e) { msg.textContent = e.message; msg.style.color = "#de4f63"; }
    });

    // Test Groq key
    document.getElementById("st_testGroq")?.addEventListener("click", async () => {
      const msg = document.getElementById("st_groqStatus");
      msg.textContent = "Testing…"; msg.style.color = "#5f7395";
      try {
        const r = await api("/api/chat", { method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ messages: [{ role: "user", content: "Say: Groq is working!" }] }) });
        msg.textContent = "✓ Groq working: " + (r.reply || "OK"); msg.style.color = "#1fa97a";
      } catch(e) { msg.textContent = "✗ " + e.message; msg.style.color = "#de4f63"; }
    });

    // Save Shiprocket
    document.getElementById("st_saveSR")?.addEventListener("click", async () => {
      const email = document.getElementById("st_srEmail")?.value.trim();
      const pass  = document.getElementById("st_srPass")?.value.trim();
      const msg   = document.getElementById("st_srMsg");
      if (!email) { msg.textContent = "Enter Shiprocket email"; msg.style.color = "#de4f63"; return; }
      msg.textContent = "Saving…"; msg.style.color = "#5f7395";
      try {
        const payload = { shiprocketEmail: email };
        if (pass) payload.shiprocketPassword = pass;
        await api("/api/admin/settings", { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });
        document.getElementById("st_srPass").value = "";
        msg.textContent = "✓ Shiprocket credentials saved!"; msg.style.color = "#1fa97a";
        setTimeout(() => { msg.textContent = ""; }, 3000);
      } catch(e) { msg.textContent = e.message; msg.style.color = "#de4f63"; }
    });

    // Save shop info
    document.getElementById("st_saveShop")?.addEventListener("click", async () => {
      const msg = document.getElementById("st_shopMsg");
      const payload = {
        shopName:     document.getElementById("st_shopName")?.value.trim(),
        shopPhone:    document.getElementById("st_shopPhone")?.value.trim(),
        shopEmail:    document.getElementById("st_shopEmail")?.value.trim(),
        shopAddress:  document.getElementById("st_shopAddress")?.value.trim(),
        announcement: document.getElementById("st_announcement")?.value.trim()
      };
      try {
        await api("/api/admin/settings", { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });
        msg.textContent = "✓ Saved!"; msg.style.color = "#1fa97a";
        // Update announcement bar live
        if (payload.announcement) {
          const bar = document.querySelector(".announcement");
          if (bar) bar.textContent = payload.announcement;
        }
        setTimeout(() => { msg.textContent = ""; }, 2500);
      } catch(e) { msg.textContent = e.message; msg.style.color = "#de4f63"; }
    });

    // ── Shipping Tab ─────────────────────────────────────────────
    async function loadShippingTab() {
      // Populate order select with pending/processing orders
      try {
        const data = await api("/api/admin/orders");
        const sel  = document.getElementById("sh_orderSelect");
        if (!sel) return;
        const pending = (data.orders || []).filter(o => ["NEW","PROCESSING","PACKED"].includes(o.orderStatus));
        sel.innerHTML = `<option value="">— Choose an order —</option>` +
          pending.map(o => `<option value="${o._id}">${o.orderNo} — ${o.shippingAddress?.fullName || ""} (${o.orderStatus})</option>`).join("");
      } catch(e) { console.error("loadShipping:", e); }
    }

    // Create shipment
    document.getElementById("sh_createBtn")?.addEventListener("click", async () => {
      const orderId = document.getElementById("sh_orderSelect")?.value;
      const pin     = document.getElementById("sh_pickupPin")?.value.trim() || "411021";
      const msg     = document.getElementById("sh_createMsg");
      if (!orderId) { msg.textContent = "Select an order first"; msg.style.color = "#de4f63"; return; }
      msg.textContent = "Creating shipment…"; msg.style.color = "#5f7395";
      try {
        const r = await api(`/api/admin/shipping/create/${orderId}`, {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ pickupPincode: pin })
        });
        msg.textContent = `✓ Shipment created! AWB: ${r.awb || "—"}`; msg.style.color = "#1fa97a";
        loadShippingTab();
      } catch(e) { msg.textContent = "✗ " + e.message; msg.style.color = "#de4f63"; }
    });

    // Track shipment
    document.getElementById("sh_trackBtn")?.addEventListener("click", async () => {
      const awb = document.getElementById("sh_awbInput")?.value.trim();
      const res = document.getElementById("sh_trackResult");
      if (!awb) { res.style.display = "block"; res.textContent = "Enter AWB number"; return; }
      res.style.display = "block"; res.textContent = "Tracking…";
      try {
        const data = await api(`/api/shipping/track/${awb}`);
        const info = data.tracking_data || data;
        const status = info.shipment_track?.[0]?.current_status || info.current_status || JSON.stringify(info);
        const location = info.shipment_track?.[0]?.location || "";
        res.innerHTML = `<strong style="color:#0b2e67;">Status:</strong> ${status}<br>
          ${location ? `<strong style="color:#0b2e67;">Location:</strong> ${location}` : ""}
          <details style="margin-top:8px;"><summary style="cursor:pointer;font-size:.8rem;color:#5f7395;">Raw response</summary>
          <pre style="font-size:.72rem;overflow:auto;max-height:200px;">${JSON.stringify(data, null, 2)}</pre></details>`;
      } catch(e) { res.textContent = "✗ " + e.message; }
    });

    // Check rates
    document.getElementById("sh_rateBtn")?.addEventListener("click", async () => {
      const fromPin = document.getElementById("sh_rateFrom")?.value.trim();
      const toPin   = document.getElementById("sh_rateTo")?.value.trim();
      const weight  = document.getElementById("sh_rateWeight")?.value || "0.5";
      const cod     = document.getElementById("sh_rateCOD")?.checked;
      const res     = document.getElementById("sh_rateResult");
      if (!toPin) { res.style.display = "block"; res.textContent = "Enter delivery pincode"; return; }
      res.style.display = "block"; res.textContent = "Checking rates…";
      try {
        const data = await api("/api/shipping/rates", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ pickupPincode: fromPin, deliveryPincode: toPin, weight, cod })
        });
        const couriers = data.data?.available_courier_companies || [];
        if (!couriers.length) { res.textContent = "No couriers available for this route"; return; }
        res.innerHTML = `<div style="display:grid;gap:8px;">` +
          couriers.slice(0, 6).map(c => `
            <div style="display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #d4e2f8;border-radius:9px;padding:8px 12px;">
              <div>
                <strong style="font-size:.88rem;color:#0b2e67;">${c.courier_name}</strong>
                <span style="font-size:.78rem;color:#5f7395;margin-left:8px;">${c.estimated_delivery_days} days</span>
              </div>
              <strong style="color:#1464ce;">₹${c.rate}</strong>
            </div>`).join("") + `</div>`;
      } catch(e) { res.textContent = "✗ " + e.message; }
    });

  