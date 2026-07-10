(function () {
  const state = {
    products: [],
    cart: JSON.parse(localStorage.getItem("fi_cart") || "[]"),
    token: localStorage.getItem("fi_owner_token") || "",
    shop: {
      address: "Shop No.02, Fabric Infinity, 2, Baner - Pashan Link Rd, opp. Orange county phase -II, Pashan, Pune, Maharashtra 411021",
      phone: "+919000000000",
      email: "hello@fabricinfinity.com"
    },
    razorpayKeyId: "",
    orders: []
  };

  const qs = (s) => document.querySelector(s);
  const qsa = (s) => Array.from(document.querySelectorAll(s));

  async function api(path, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
    return data;
  }

  function inr(n) {
    return `INR ${Number(n || 0).toLocaleString("en-IN")}`;
  }

  function saveCart() {
    localStorage.setItem("fi_cart", JSON.stringify(state.cart));
  }

  function setShopInfo(shop) {
    state.shop = { ...state.shop, ...shop };
    qsa("[data-shop-address]").forEach((e) => (e.textContent = state.shop.address));
    qsa("[data-shop-phone]").forEach((e) => (e.textContent = state.shop.phone));
    qsa("[data-shop-email]").forEach((e) => (e.textContent = state.shop.email));
  }

  async function loadMeta() {
    try {
      const cfg = await api("/api/payment/config");
      state.razorpayKeyId = cfg.razorpayKeyId || "";
      if (cfg.shop) setShopInfo(cfg.shop);
    } catch {}
    try {
      const meta = await api("/api/shop/meta");
      setShopInfo({ address: meta.location, phone: meta.phone, email: meta.email });
    } catch {}
  }

  function productCard(p) {
    return `<article class="card">
      <div class="card-media"><img src="${encodeURI(p.imageUrl)}" alt="${p.name}" loading="lazy"/></div>
      <div class="card-body">
        <span class="tag">${p.category}</span>
        <h3>${p.name}</h3>
        <p class="muted">${p.description}</p>
        <div class="price-row">
          <strong>${inr(p.price)}</strong>
          <button class="btn" data-add="${p._id}">Add</button>
        </div>
      </div>
    </article>`;
  }

  function renderProductGrid(products, selector = "#productGrid") {
    const grid = qs(selector);
    if (!grid) return;
    if (!products.length) {
      grid.innerHTML = `<article class="panel"><p class="muted">No products found.</p></article>`;
      return;
    }
    grid.innerHTML = products.map(productCard).join("");
    qsa("[data-add]").forEach((btn) => btn.addEventListener("click", () => addToCart(btn.getAttribute("data-add"))));
  }

  function renderCategorySections() {
    qsa("[data-category-grid]").forEach((el) => {
      const category = String(el.getAttribute("data-category-grid") || "").trim();
      const list = state.products.filter((p) => p.category.toLowerCase().includes(category.toLowerCase()));
      renderProductGrid(list, `#${el.id}`);
      const metaId = el.getAttribute("data-meta-id");
      if (metaId && qs(`#${metaId}`)) qs(`#${metaId}`).textContent = `${list.length} products in ${category}`;
    });
  }

  function renderCategoryChips() {
    const wrap = qs("#categoryChips");
    if (!wrap) return;
    const cats = ["All", ...new Set(state.products.map((p) => p.category))];
    wrap.innerHTML = cats.map((c, i) => `<button class="chip ${i === 0 ? "active" : ""}" data-cat="${c}">${c}</button>`).join("");
    qsa("#categoryChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        qsa("#categoryChips .chip").forEach((x) => x.classList.remove("active"));
        chip.classList.add("active");
        const cat = chip.getAttribute("data-cat");
        const list = cat === "All" ? state.products : state.products.filter((p) => p.category === cat);
        renderProductGrid(list);
      });
    });
  }

  async function loadProducts() {
    const data = await api("/api/products");
    state.products = data.products || [];
    if (qs("#productsMeta")) qs("#productsMeta").textContent = `${state.products.length} live products loaded`;
    if (qs("#statProducts")) qs("#statProducts").textContent = String(state.products.length);
    renderCategoryChips();
    renderProductGrid(state.products);
    renderCategorySections();

    const pageCategory = document.body.getAttribute("data-page-category");
    if (pageCategory && pageCategory !== "All") {
      const filtered = state.products.filter((p) => p.category.toLowerCase().includes(pageCategory.toLowerCase()));
      renderProductGrid(filtered, "#categoryPageGrid");
      if (qs("#categoryPageMeta")) qs("#categoryPageMeta").textContent = `${filtered.length} products in ${pageCategory}`;
    }
  }

  function addToCart(id) {
    const product = state.products.find((p) => p._id === id);
    if (!product) return;
    const existing = state.cart.find((x) => x._id === id);
    if (existing) existing.quantity += 1;
    else state.cart.push({ _id: product._id, name: product.name, price: product.price, imageUrl: product.imageUrl, quantity: 1 });
    saveCart();
    renderCart();
  }

  function removeFromCart(id) {
    state.cart = state.cart.filter((x) => x._id !== id);
    saveCart();
    renderCart();
  }

  function changeQty(id, delta) {
    const item = state.cart.find((x) => x._id === id);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) removeFromCart(id);
    saveCart();
    renderCart();
  }

  function cartTotals() {
    const subtotal = state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const shipping = subtotal >= 2499 || subtotal === 0 ? 0 : 99;
    return { subtotal, shipping, total: subtotal + shipping };
  }

  function renderCart() {
    qsa("[data-cart-count]").forEach((e) => (e.textContent = String(state.cart.reduce((s, i) => s + i.quantity, 0))));
    const list = qs("#cartItems");
    if (!list) return;
    const totals = cartTotals();
    const subtotalEl = qs("#cartSubtotal");
    if (subtotalEl) subtotalEl.textContent = inr(totals.subtotal);
    if (!state.cart.length) {
      list.innerHTML = `<p class="muted">Your cart is empty.</p>`;
      return;
    }
    list.innerHTML = state.cart.map((item) => `
      <div class="cart-item">
        <img src="${encodeURI(item.imageUrl)}" alt="${item.name}" />
        <div>
          <strong>${item.name}</strong>
          <span class="muted">${inr(item.price)}</span>
          <div>
            <button class="btn" data-dec="${item._id}">-</button>
            <span>${item.quantity}</span>
            <button class="btn" data-inc="${item._id}">+</button>
          </div>
        </div>
        <button class="btn" data-remove="${item._id}">Remove</button>
      </div>
    `).join("");
    qsa("[data-dec]").forEach((b) => b.addEventListener("click", () => changeQty(b.getAttribute("data-dec"), -1)));
    qsa("[data-inc]").forEach((b) => b.addEventListener("click", () => changeQty(b.getAttribute("data-inc"), 1)));
    qsa("[data-remove]").forEach((b) => b.addEventListener("click", () => removeFromCart(b.getAttribute("data-remove"))));
  }

  function openCart() { const d = qs("#cartDrawer"); if (d) d.classList.add("open"); }
  function closeCart() { const d = qs("#cartDrawer"); if (d) d.classList.remove("open"); }

  function setupCartUi() {
    qsa("[data-open-cart]").forEach((b) => b.addEventListener("click", openCart));
    const closeBtn = qs("#closeCart");
    if (closeBtn) closeBtn.addEventListener("click", closeCart);
    const checkoutBtn = qs("#openCheckout");
    if (checkoutBtn) checkoutBtn.addEventListener("click", () => {
      if (!state.cart.length) return alert("Cart is empty");
      if (qs("#checkout")) {
        location.hash = "#checkout";
      } else {
        location.href = "/checkout.html";
      }
    });
    renderCart();
  }

  async function checkoutWithMethod(method, shippingAddress) {
    const payload = {
      items: state.cart.map((i) => ({ productId: i._id, quantity: i.quantity })),
      shippingAddress,
      paymentMethod: method
    };
    const data = await api("/api/orders/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (method === "COD") return data.order;

    if (!state.razorpayKeyId) throw new Error("Razorpay key missing on backend");
    await new Promise((resolve, reject) => {
      const options = {
        key: state.razorpayKeyId,
        amount: data.razorpayOrder.amount,
        currency: data.razorpayOrder.currency,
        name: state.shop.name,
        description: `Order ${data.order.orderNo}`,
        order_id: data.razorpayOrder.id,
        prefill: {
          name: shippingAddress.fullName,
          email: shippingAddress.email,
          contact: shippingAddress.phone
        },
        handler: async function (resp) {
          try {
            await api("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: data.order._id,
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature
              })
            });
            resolve();
          } catch (e) {
            reject(e);
          }
        }
      };
      const rzp = new Razorpay(options);
      rzp.on("payment.failed", (e) => reject(new Error(e.error?.description || "Payment failed")));
      rzp.open();
    });
    return data.order;
  }

  function setupCheckoutPage() {
    const form = qs("#checkoutForm");
    if (!form) return;
    const list = qs("#checkoutItems");
    if (list) {
      list.innerHTML = state.cart.map((i) => `<li>${i.name} x ${i.quantity} - ${inr(i.price * i.quantity)}</li>`).join("");
    }
    const totals = cartTotals();
    if (qs("#checkoutTotal")) qs("#checkoutTotal").textContent = `${inr(totals.total)} (including shipping ${inr(totals.shipping)})`;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = qs("#checkoutMsg");
      msg.textContent = "Placing order...";
      msg.className = "muted";
      try {
        if (!state.cart.length) throw new Error("Cart is empty");
        const shippingAddress = {
          fullName: qs("#cName").value.trim(),
          phone: qs("#cPhone").value.trim(),
          email: qs("#cEmail").value.trim(),
          addressLine1: qs("#cAddress1").value.trim(),
          addressLine2: qs("#cAddress2").value.trim(),
          city: qs("#cCity").value.trim(),
          state: qs("#cState").value.trim(),
          pincode: qs("#cPincode").value.trim()
        };
        const method = qs("#cMethod").value;
        const order = await checkoutWithMethod(method, shippingAddress);
        state.cart = [];
        saveCart();
        renderCart();
        msg.textContent = `Order placed successfully: ${order.orderNo}`;
        msg.className = "ok";
        setTimeout(() => { location.href = "/index.html"; }, 1400);
      } catch (err) {
        msg.textContent = err.message;
        msg.className = "error";
      }
    });
  }

  function setupOwnerAuth() {
    const modal = qs("#loginModal");
    if (!modal) return;
    qs("#openOwner").addEventListener("click", () => {
      modal.classList.add("open");
      qs("#loginMsg").textContent = "";
    });
    qs("#cancelLogin").addEventListener("click", () => modal.classList.remove("open"));
    const submit = async () => {
      const email = qs("#ownerEmail").value.trim();
      const password = qs("#ownerPassword").value;
      const msg = qs("#loginMsg");
      msg.textContent = "Logging in...";
      msg.className = "muted";
      try {
        const data = await api("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        state.token = data.token;
        localStorage.setItem("fi_owner_token", state.token);
        msg.textContent = "Login success";
        msg.className = "ok";
        setTimeout(() => {
          if (qs("#adminSection")) location.hash = "#owner-dashboard";
          else location.href = "/admin.html";
        }, 400);
      } catch (err) {
        msg.textContent = err.message;
        msg.className = "error";
      }
    };
    qs("#submitLogin").addEventListener("click", submit);
    qs("#ownerPassword").addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  }

  async function setupAdminPage() {
    const adminRoot = qs("#adminSection");
    const standaloneAdminPage = document.body.classList.contains("admin-page");
    if (!standaloneAdminPage && !adminRoot) return;
    if (!state.token) {
      if (standaloneAdminPage) {
        location.href = "/index.html";
      } else {
        if (qs("#adminLoginNotice")) qs("#adminLoginNotice").textContent = "Owner login required to view dashboard.";
      }
      return;
    }
    try {
      const me = await api("/api/auth/me");
      if (qs("#ownerIdentity")) qs("#ownerIdentity").textContent = me.user.email;
      if (qs("#adminLoginNotice")) qs("#adminLoginNotice").textContent = "";
    } catch {
      localStorage.removeItem("fi_owner_token");
      if (standaloneAdminPage) location.href = "/index.html";
      return;
    }

    qsa(".dash-nav button").forEach((btn) => {
      btn.addEventListener("click", () => {
        qsa(".dash-nav button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const tab = btn.getAttribute("data-tab");
        qsa(".dash-tabs").forEach((x) => x.classList.remove("active"));
        qs(`#${tab}`).classList.add("active");
      });
    });

    qs("#logoutBtn").addEventListener("click", () => {
      localStorage.removeItem("fi_owner_token");
      location.href = "/index.html";
    });

    async function loadAdminProducts() {
      const data = await api("/api/admin/products");
      const products = data.products || [];
      const tbody = qs("#productTableBody");
      if (!tbody) return;
      tbody.innerHTML = products.map((p) => `
        <tr>
          <td><img class="mini-img" src="${encodeURI(p.imageUrl)}" alt="${p.name}"></td>
          <td><input data-field="name" data-id="${p._id}" value="${p.name.replace(/"/g, "&quot;")}"></td>
          <td><input data-field="category" data-id="${p._id}" value="${p.category.replace(/"/g, "&quot;")}"></td>
          <td><input type="number" min="1" data-field="price" data-id="${p._id}" value="${p.price}"></td>
          <td><input type="number" min="0" data-field="stock" data-id="${p._id}" value="${p.stock}"></td>
          <td><span class="pill">${p.isActive ? "Active" : "Inactive"}</span></td>
          <td>
            <button class="btn" data-save="${p._id}">Save</button>
            <button class="btn" data-delete="${p._id}">Delete</button>
          </td>
        </tr>
      `).join("");
      qsa("[data-save]").forEach((b) => b.addEventListener("click", async () => {
        const id = b.getAttribute("data-save");
        const get = (f) => document.querySelector(`[data-field="${f}"][data-id="${id}"]`).value;
        try {
          await api(`/api/admin/products/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: get("name"),
              category: get("category"),
              price: Number(get("price")),
              stock: Number(get("stock"))
            })
          });
          await loadAdminProducts();
        } catch (e) { alert(e.message); }
      }));
      qsa("[data-delete]").forEach((b) => b.addEventListener("click", async () => {
        const id = b.getAttribute("data-delete");
        if (!confirm("Delete this product?")) return;
        try {
          await api(`/api/admin/products/${id}`, { method: "DELETE" });
          await loadAdminProducts();
        } catch (e) { alert(e.message); }
      }));
    }

    async function loadOrders() {
      const data = await api("/api/admin/orders");
      state.orders = data.orders || [];
      const tbody = qs("#orderTableBody");
      if (!tbody) return;
      tbody.innerHTML = state.orders.map((o) => `
        <tr>
          <td><strong>${o.orderNo}</strong><br><span class="muted">${new Date(o.createdAt).toLocaleString()}</span></td>
          <td>${o.shippingAddress.fullName}<br><span class="muted">${o.shippingAddress.phone}</span></td>
          <td>${inr(o.total)}</td>
          <td><span class="pill">${o.paymentMethod} / ${o.paymentStatus}</span></td>
          <td><span class="pill">${o.orderStatus}</span></td>
          <td>${o.shippingStatus || "N/A"}</td>
          <td>
            <select data-order="${o._id}">
              ${["NEW","PROCESSING","PACKED","SHIPPED","DELIVERED","CANCELLED"].map((x) => `<option ${o.orderStatus===x?"selected":""}>${x}</option>`).join("")}
            </select>
            <button class="btn" data-order-save="${o._id}">Update</button>
          </td>
        </tr>
      `).join("");
      qsa("[data-order-save]").forEach((b) => b.addEventListener("click", async () => {
        const id = b.getAttribute("data-order-save");
        const st = document.querySelector(`[data-order="${id}"]`).value;
        try {
          await api(`/api/admin/orders/${id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderStatus: st })
          });
          await loadOrders();
        } catch (e) { alert(e.message); }
      }));
    }

    const form = qs("#addProductForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const msg = qs("#addProductMsg");
        msg.textContent = "Adding...";
        msg.className = "muted";
        try {
          const fd = new FormData(form);
          await api("/api/admin/products", { method: "POST", body: fd });
          form.reset();
          msg.textContent = "Product added";
          msg.className = "ok";
          await loadAdminProducts();
        } catch (err) {
          msg.textContent = err.message;
          msg.className = "error";
        }
      });
    }

    await loadAdminProducts();
    await loadOrders();
  }

  function setupCommonUi() {
    const menuBtn = qs("#openMenu");
    if (menuBtn) menuBtn.addEventListener("click", () => qs("#topNav").classList.toggle("open"));
    qsa("#topNav a").forEach((a) => a.addEventListener("click", () => qs("#topNav").classList.remove("open")));
    setupCartUi();
    setupCheckoutPage();
    setupOwnerAuth();
  }

  async function bootstrap() {
    await loadMeta();
    await loadProducts();
    setupCommonUi();
    await setupAdminPage();
  }

  bootstrap().catch((err) => {
    console.error(err);
    if (qs("#productsMeta")) qs("#productsMeta").textContent = "Could not load backend data.";
  });
})();
