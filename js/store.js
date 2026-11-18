/* =====================================================================
   store.js  -  customer side: catalogue, cart, coupons, login, checkout,
   orders & payment history, invoices, wishlist, reviews, e-book reader
   ===================================================================== */
let cart = DB.get("cart", []), coupon = null;
let filter = "All", query = "", sort = "new", view = "shop", acctTab = "orders", fontSize = 20, current = null;

const books  = () => DB.table("books").filter(b => b.active !== false);
const book   = id => DB.byId("books", id);
const priceOf = i => { const b = book(i.id); return b ? (i.fmt === "ebook" ? b.ebook : b.price) : 0; };
const reviewsOf = id => DB.table("reviews").filter(r => r.bookId === id);
const avgRating = id => { const r = reviewsOf(id); return r.length ? r.reduce((s, x) => s + x.rating, 0) / r.length : 0; };
const stars = n => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
const saveCart = () => DB.set("cart", cart);
const myOrders = () => { const u = Auth.user(); return u ? DB.table("orders").filter(o => o.userId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []; };

/* ---------- header ---------- */
function renderHeader() {
  const S = DB.settings(), u = Auth.user();
  $("#brandName").textContent = S.storeName; $("#footName").textContent = S.storeName; document.title = S.storeName + " – Book Store & E-books";
  $("#authArea").innerHTML = u
    ? `<button class="link" data-view="account">Hi, ${esc(u.name.split(" ")[0])}</button>${u.role === "admin" ? `<a class="link" href="admin.html">Admin</a>` : ""}<button class="link" id="logoutBtn">Log out</button>`
    : `<button class="link" id="loginBtn">Log in</button>`;
}

/* ---------- views ---------- */
function show(v) {
  if ((v === "account" || v === "wishlist" || v === "library") && !Auth.user()) { openAuth("login", "Log in to see this page."); return; }
  view = v;
  ["shop", "library", "wishlist", "account"].forEach(s => $("#" + s).hidden = s !== v);
  ({ shop: renderGrid, library: renderLibrary, wishlist: renderWishlist, account: renderAccount })[v]();
  window.scrollTo(0, 0);
}
function coverHTML(b) { return `<div class="cover" style="background:${b.c1};color:${b.c2}"><h3>${esc(b.title)}</h3><span>${esc(b.author)}</span></div>`; }
function renderChips() {
  const cats = ["All", ...new Set(books().map(b => b.cat))];
  $("#chips").innerHTML = cats.map(c => `<button class="chip ${c === filter ? "on" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
}
function cardHTML(b) {
  const u = Auth.user(), own = u && u.owned.includes(b.id), wish = u && u.wishlist.includes(b.id), r = avgRating(b.id), n = reviewsOf(b.id).length, low = DB.settings().lowStock;
  const prices = [b.price ? "Paperback " + money(b.price) : "", b.ebook ? "E-book " + money(b.ebook) : ""].filter(Boolean).join(" · ");
  return `<div class="card">
    <div class="cover-wrap"><button class="cover-btn" data-open="${b.id}" aria-label="View ${esc(b.title)}">${coverHTML(b)}</button>
      <button class="heart ${wish ? "on" : ""}" data-wish="${b.id}" aria-label="${wish ? "Remove from" : "Add to"} wishlist">${wish ? "♥" : "♡"}</button>
      ${b.price && b.stock > 0 && b.stock <= low ? `<span class="tag warn">Only ${b.stock} left</span>` : ""}${b.price && b.stock <= 0 ? `<span class="tag">Paperback sold out</span>` : ""}</div>
    <div class="meta"><button class="ctitle" data-open="${b.id}">${esc(b.title)}</button><small>${esc(b.author)} · ${esc(b.cat)}</small>
      <small class="stars">${n ? stars(r) + " " + r.toFixed(1) + " (" + n + ")" : "No reviews yet"}</small><div class="prices">${prices}</div></div>
    <div class="fmt">
      ${b.price ? `<button class="add" ${b.stock > 0 ? `data-add="${b.id}" data-fmt="paper"` : "disabled"}>${b.stock > 0 ? "+ Paperback" : "Sold out"}</button>` : ""}
      ${b.ebook ? (own ? `<button class="read" data-read="${b.id}">Read e-book</button>` : `<button class="add" data-add="${b.id}" data-fmt="ebook">+ E-book</button>`) : ""}
    </div></div>`;
}
function renderGrid() {
  renderChips();
  const q = query.toLowerCase();
  let list = books().filter(b => (filter === "All" || b.cat === filter) && (b.title + " " + b.author).toLowerCase().includes(q));
  const low = b => Math.min(...[b.price, b.ebook].filter(Boolean));
  list.sort({ new: (a, b) => b.createdAt.localeCompare(a.createdAt), rating: (a, b) => avgRating(b.id) - avgRating(a.id),
    low: (a, b) => low(a) - low(b), high: (a, b) => low(b) - low(a), title: (a, b) => a.title.localeCompare(b.title) }[sort]);
  $("#empty").hidden = list.length > 0; $("#grid").innerHTML = list.map(cardHTML).join("");
}
function renderLibrary() {
  const u = Auth.user(), list = books().filter(b => u.owned.includes(b.id));
  $("#ownedGrid").innerHTML = list.length ? list.map(b => `<div class="card">${coverHTML(b)}<button class="read" data-read="${b.id}">Read</button></div>`).join("")
    : `<p class="empty">You have no e-books yet. Buy one from the shop and it will appear here.</p>`;
}
function renderWishlist() {
  const u = Auth.user(), list = books().filter(b => u.wishlist.includes(b.id));
  $("#wishGrid").innerHTML = list.length ? list.map(cardHTML).join("") : `<p class="empty">Your wishlist is empty. Tap the heart on any book to save it here.</p>`;
}
function toggleWish(id) {
  const u = Auth.user(); if (!u) return openAuth("login", "Log in to save books to your wishlist.");
  u.wishlist = u.wishlist.includes(id) ? u.wishlist.filter(x => x !== id) : [...u.wishlist, id];
  DB.put("users", u); show(view);
}

/* ---------- book detail + reviews ---------- */
function openBook(id) {
  const b = book(id); if (!b) return; const u = Auth.user();
  const rv = reviewsOf(id).sort((a, c) => c.at.localeCompare(a.at)), r = avgRating(id);
  const bought = u && DB.table("orders").some(o => o.userId === u.id && o.paymentStatus !== "Refunded" && o.items.some(i => i.bookId === id));
  const mine = u && rv.find(x => x.userId === u.id);
  openModal(`<div class="detail"><div>${coverHTML(b)}</div><div>
      <h2>${esc(b.title)}</h2><p class="mute">${esc(b.author)} · ${esc(b.cat)}</p>
      <p class="stars">${rv.length ? stars(r) + " " + r.toFixed(1) + " from " + rv.length + " review(s)" : "No reviews yet"}</p>
      <p>${esc(b.desc)}</p>
      <div class="fmt">
        ${b.price ? `<button class="add" ${b.stock > 0 ? `data-add="${b.id}" data-fmt="paper"` : "disabled"}>Paperback<small>${money(b.price)} · ${b.stock > 0 ? b.stock + " in stock" : "Out of stock"}</small></button>` : ""}
        ${b.ebook ? (u && u.owned.includes(b.id) ? `<button class="read" data-read="${b.id}">Read e-book</button>` : `<button class="add" data-add="${b.id}" data-fmt="ebook">E-book<small>${money(b.ebook)}</small></button>`) : ""}
        ${b.ebook && b.text.length ? `<button class="add" data-sample="${b.id}">Read sample</button>` : ""}
      </div></div></div>
    <h3>Reviews</h3>
    ${bought && !mine ? `<form id="reviewForm" data-book="${b.id}" class="rform"><label>Your rating <select name="rating"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></label>
        <textarea name="comment" rows="2" maxlength="400" placeholder="What did you think of this book?" required></textarea><button class="add" type="submit">Post review</button></form>`
      : u ? (mine ? `<p class="mute">You have already reviewed this book.</p>` : `<p class="mute">Only customers who bought this book can review it.</p>`) : `<p class="mute">Log in and buy this book to leave a review.</p>`}
    ${rv.map(x => `<div class="review"><strong>${esc(x.name)}</strong> <span class="stars">${stars(x.rating)}</span> <small class="mute">${fday(x.at)}</small><p>${esc(x.comment)}</p></div>`).join("") || ""}`, true);
}

/* ---------- auth dialogs ---------- */
function openAuth(tab, note) {
  const forms = {
    login: `<h2>Log in</h2>${note ? `<p class="mute">${esc(note)}</p>` : ""}<form id="authForm" data-mode="login">
      <input name="email" type="email" placeholder="Email" required autocomplete="username"><input name="password" type="password" placeholder="Password" required autocomplete="current-password">
      <p class="err" role="alert"></p><button class="pay">Log in</button></form>
      <p class="mute"><button class="textbtn" data-auth="forgot">Forgot password?</button> · New here? <button class="textbtn" data-auth="register">Create an account</button></p>`,
    register: `<h2>Create your account</h2><form id="authForm" data-mode="register">
      <input name="name" placeholder="Full name" required autocomplete="name"><input name="email" type="email" placeholder="Email" required autocomplete="email">
      <input name="phone" type="tel" placeholder="10-digit mobile number" required maxlength="10" autocomplete="tel">
      <input name="password" type="password" placeholder="Password (8+ characters, letters and numbers)" required autocomplete="new-password">
      <p class="err" role="alert"></p><button class="pay">Create account</button></form>
      <p class="mute">Already registered? <button class="textbtn" data-auth="login">Log in</button></p>`,
    forgot: `<h2>Reset your password</h2><p class="mute">Enter the email and mobile number on your account, then choose a new password.</p><form id="authForm" data-mode="forgot">
      <input name="email" type="email" placeholder="Email" required><input name="phone" type="tel" placeholder="Mobile number" required maxlength="10">
      <input name="password" type="password" placeholder="New password" required autocomplete="new-password"><p class="err" role="alert"></p><button class="pay">Reset password</button></form>
      <p class="mute"><button class="textbtn" data-auth="login">Back to log in</button></p>`
  };
  openModal(forms[tab]);
}
async function submitAuth(e) {
  e.preventDefault(); const f = e.target, d = Object.fromEntries(new FormData(f)), err = $(".err", f), btn = $("button.pay", f);
  btn.disabled = true; err.textContent = "";
  try {
    if (f.dataset.mode === "login") { await Auth.login(d.email, d.password); toast("Welcome back!"); }
    else if (f.dataset.mode === "register") { await Auth.register(d); toast("Account created. Welcome!"); }
    else { await Auth.resetPassword(d.email, d.phone, d.password); toast("Password changed. Please log in."); return openAuth("login"); }
    closeModal(); renderHeader(); renderCart(); show(view);
  } catch (x) { err.textContent = x.message; btn.disabled = false; }
}

/* ---------- cart, coupons, totals ---------- */
function couponCheck(code, sub) {
  const c = DB.table("coupons").find(x => x.code === code.trim().toUpperCase());
  if (!c || !c.active) return { ok: false, msg: "That coupon code is not valid." };
  if (c.expiry && new Date(c.expiry + "T23:59:59") < new Date()) return { ok: false, msg: "That coupon has expired." };
  if (c.maxUses > 0 && c.used >= c.maxUses) return { ok: false, msg: "That coupon has been fully used." };
  if (sub < c.minOrder) return { ok: false, msg: "Add items worth " + money(c.minOrder) + " or more to use this coupon." };
  return { ok: true, c, disc: round2(c.type === "percent" ? sub * c.value / 100 : Math.min(c.value, sub)) };
}
function cleanCart() { cart = cart.filter(i => { const b = book(i.id); return b && b.active !== false && (i.fmt === "ebook" ? b.ebook : b.price); }); saveCart(); }
function totals() {
  const S = DB.settings(), sub = cart.reduce((s, i) => s + priceOf(i) * i.qty, 0); let disc = 0, cErr = "";
  if (coupon) { const c = couponCheck(coupon, sub); if (c.ok) disc = c.disc; else { cErr = c.msg; coupon = null; } }
  const hasPaper = cart.some(i => i.fmt === "paper"), ship = hasPaper && sub - disc < S.freeShipAbove ? S.shipping : 0;
  const tax = round2((sub - disc) * S.taxPct / 100);
  return { sub, disc, ship, tax, hasPaper, cErr, total: round2(sub - disc + ship + tax) };
}
function addToCart(id, fmt) {
  const b = book(id), hit = cart.find(i => i.id === id && i.fmt === fmt), u = Auth.user();
  if (fmt === "ebook" && u && u.owned.includes(id)) return toast("You already own this e-book.");
  if (hit) { if (fmt === "ebook") return toast("This e-book is already in your cart."); if (hit.qty >= b.stock) return toast("Only " + b.stock + " copies in stock.", true); hit.qty++; }
  else cart.push({ id, fmt, qty: 1 });
  saveCart(); renderCart(); toast("Added to cart");
}
function renderCart() {
  cleanCart(); const T = totals(), S = DB.settings(), u = Auth.user();
  $("#cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0);
  $("#cartItems").innerHTML = cart.length ? cart.map((i, n) => { const b = book(i.id); return `
    <div class="row"><div class="sw" style="background:${b.c1}"></div>
      <div class="t">${esc(b.title)}<small>${i.fmt === "ebook" ? "E-book" : "Paperback"} · ${money(priceOf(i))}</small></div>
      <div class="qty">${i.fmt === "paper" ? `<button data-q="${n}" data-d="-1" aria-label="Fewer">−</button><span>${i.qty}</span><button data-q="${n}" data-d="1" aria-label="More">+</button>` : ""}
      <button data-rm="${n}" aria-label="Remove ${esc(b.title)}">×</button></div></div>`; }).join("")
    : `<p class="empty">Your cart is empty. Add a paperback or e-book to get started.</p>`;
  $("#sums").innerHTML = cart.length ? `
    <div><span>Subtotal</span><span>${money(T.sub)}</span></div>
    ${T.disc ? `<div class="good"><span>Coupon ${esc(coupon)}</span><span>− ${money(T.disc)}</span></div>` : ""}
    ${T.hasPaper ? `<div><span>Shipping</span><span>${T.ship ? money(T.ship) : "Free"}</span></div>` : ""}
    ${S.taxPct ? `<div><span>Tax (${S.taxPct}%)</span><span>${money(T.tax)}</span></div>` : ""}
    <div class="grand"><span>Total</span><strong>${money(T.total)}</strong></div>
    ${T.hasPaper && S.freeShipAbove > T.sub - T.disc ? `<small class="mute">Free shipping above ${money(S.freeShipAbove)}.</small>` : ""}` : "";
  $("#payBtn").disabled = !cart.length;
  $("#payBtn").textContent = u ? (T.total > 0 ? "Pay " + money(T.total) + " securely" : "Place free order") : "Log in to pay";
  $("#address").hidden = !T.hasPaper; if (u && !$("#address").value) $("#address").value = u.address || "";
  if (T.cErr) $("#formErr").textContent = T.cErr;
}
function openCart(o) { $("#drawer").classList.toggle("open", o); $("#drawer").setAttribute("aria-hidden", !o); $("#scrim").hidden = !o; }

/* ---------- checkout + payment ---------- */
function checkout(e) {
  e.preventDefault(); const err = $("#formErr"); err.textContent = ""; const u = Auth.user();
  if (!u) { openCart(false); return openAuth("login", "Log in to place your order."); }
  cleanCart(); const T = totals(), S = DB.settings(), address = $("#address").value.trim();
  if (!cart.length) return;
  if (T.hasPaper && address.length < 10) return err.textContent = "Enter your full delivery address for paperbacks.";
  for (const i of cart) { const b = book(i.id); if (i.fmt === "paper" && i.qty > b.stock) return err.textContent = "Only " + b.stock + " copies of " + b.title + " are left. Reduce the quantity."; }
  if (T.total <= 0) return finalizeOrder("FREE-" + Date.now().toString(36).toUpperCase(), T, address);
  if (S.razorKey.includes("YOUR_KEY_ID")) return demoCheckout(T, address);   // no key yet: simulated checkout
  if (typeof Razorpay === "undefined") return err.textContent = "Razorpay did not load. Check your internet connection.";
  const rzp = new Razorpay({
    key: S.razorKey, amount: Math.round(T.total * 100), currency: "INR", name: S.storeName, description: cart.length + " item(s)",
    prefill: { name: u.name, email: u.email, contact: u.phone }, notes: { address }, theme: { color: "#23305E" },
    handler: res => finalizeOrder(res.razorpay_payment_id, T, address)
  });
  rzp.on("payment.failed", r => { err.textContent = "Payment failed: " + (r.error.description || "please try again."); DB.log("Payment failed: " + (r.error.reason || "unknown")); });
  rzp.open();
}
function finalizeOrder(paymentId, T, address, methodName) {
  const u = Auth.user(), now = new Date().toISOString(), status = T.hasPaper ? "Placed" : "Completed";
  const order = { id: "ORD-" + Date.now().toString(36).toUpperCase(), userId: u.id, customer: { name: u.name, email: u.email, phone: u.phone }, address: T.hasPaper ? address : "",
    items: cart.map(i => { const b = book(i.id); return { bookId: b.id, title: b.title, author: b.author, fmt: i.fmt, qty: i.qty, price: priceOf(i) }; }),
    subtotal: T.sub, discount: T.disc, coupon: coupon || null, shipping: T.ship, tax: T.tax, total: T.total,
    method: methodName || (T.total > 0 ? "Razorpay" : "Free (coupon)"), paymentId, paymentStatus: "Paid", status, createdAt: now, history: [{ status, at: now }] };
  DB.put("orders", order);
  cart.forEach(i => { const b = book(i.id); if (i.fmt === "paper") { b.stock -= i.qty; DB.put("books", b); } else if (!u.owned.includes(b.id)) u.owned.push(b.id); });
  if (coupon) { const c = DB.table("coupons").find(x => x.code === coupon); if (c) { c.used++; DB.put("coupons", c); } }
  if (T.hasPaper && address) u.address = address;
  DB.put("users", u); DB.log("Order " + order.id + " paid " + money(order.total));
  cart = []; coupon = null; saveCart(); $("#couponIn").value = ""; renderCart(); openCart(false);
  openModal(`<h2>Thank you, ${esc(u.name.split(" ")[0])}!</h2><p>Your payment of <strong>${money(order.total)}</strong> was successful.</p>
    <p class="mute">Order ${order.id} · Payment ID ${esc(paymentId)}</p>
    <p>${order.items.some(i => i.fmt === "ebook") ? "Your e-books are ready in <strong>My e-books</strong>. " : ""}${T.hasPaper ? "We will ship your paperbacks soon. Track them in your account." : ""}</p>
    <div class="fmt"><button class="add" data-invoice="${order.id}">View invoice</button><button class="add" data-view="account" data-close>My orders</button></div>`);
}

/* ---------- demo checkout (used while no Razorpay key is saved) ---------- */
let demoCtx = null;
function demoCheckout(T, address) {
  demoCtx = { T, address, method: "UPI" }; const S = DB.settings();
  openModal(`<div class="paybox"><div class="pay-head"><div><strong>${esc(S.storeName)}</strong><small>Secure checkout</small></div><div class="pay-amt">${money(T.total)}</div></div>
    <div class="demo-note"><strong>Demo mode.</strong> No real money moves. Add a Razorpay key in Admin → Settings to use real Razorpay test payments.</div>
    <div class="tabs">${["UPI", "Card", "Netbanking"].map((m, i) => `<button type="button" class="chip ${i ? "" : "on"}" data-pm="${m}">${m}</button>`).join("")}</div>
    <div id="pmBody"></div><p class="err" id="demoErr" role="alert"></p>
    <button class="pay full" id="demoPay">Pay ${money(T.total)}</button><p class="center"><button class="textbtn" id="demoFail">Simulate a failed payment</button></p></div>`);
  demoTab("UPI");
}
function demoTab(m) {
  demoCtx.method = m; $$("[data-pm]").forEach(b => b.classList.toggle("on", b.dataset.pm === m));
  $("#pmBody").innerHTML = m === "UPI" ? `<label>UPI ID<input id="pUpi" value="success@razorpay"></label>`
    : m === "Card" ? `<label>Card number<input id="pCard" value="4111 1111 1111 1111" inputmode="numeric"></label><div class="two-col"><label>Expiry (MM/YY)<input id="pExp" value="12/30"></label><label>CVV<input id="pCvv" value="123" maxlength="3" inputmode="numeric"></label></div>`
    : `<label>Choose your bank<select id="pBank"><option>State Bank of India</option><option>HDFC Bank</option><option>ICICI Bank</option><option>Axis Bank</option><option>Bank of Maharashtra</option></select></label>`;
}
function demoPay() {
  const m = demoCtx.method, err = $("#demoErr"); err.textContent = "";
  if (m === "UPI" && !/^[\w.\-]{2,}@[A-Za-z]{2,}$/.test($("#pUpi").value.trim())) return err.textContent = "Enter a valid UPI ID, for example name@bank.";
  if (m === "Card") {
    if ($("#pCard").value.replace(/\s/g, "").length !== 16) return err.textContent = "Enter the 16-digit card number.";
    if (!/^(0[1-9]|1[0-2])\/[0-9]{2}$/.test($("#pExp").value.trim())) return err.textContent = "Enter the expiry as MM/YY.";
    if (!/^[0-9]{3}$/.test($("#pCvv").value.trim())) return err.textContent = "Enter the 3-digit CVV.";
  }
  const { T, address } = demoCtx;
  $(".paybox").innerHTML = `<div class="processing"><div class="spinner"></div><p>Processing your payment…</p><small class="mute">Please do not close this window.</small></div>`;
  setTimeout(() => finalizeOrder("pay_demo_" + Math.random().toString(36).slice(2, 12).toUpperCase(), T, address, "Demo · " + m), 1600);
}
function demoFail() {
  closeModal(); DB.log("Demo payment failed (simulated)"); $("#formErr").textContent = "Payment failed (simulated). Your cart is safe. Try again."; toast("Payment failed. You were not charged.", true);
}

/* ---------- account: orders / payments / profile / security ---------- */
const badge = s => `<span class="badge ${s.toLowerCase().replace(/\s+/g, "-")}">${esc(s)}</span>`;
function renderAccount() {
  const u = Auth.user(), orders = myOrders(), spent = orders.filter(o => o.paymentStatus === "Paid").reduce((s, o) => s + o.total, 0);
  const tabs = [["orders", "Orders"], ["payments", "Payment history"], ["profile", "Profile"], ["security", "Password"]];
  let body = "";
  if (acctTab === "orders") body = orders.length ? orders.map(orderCard).join("") : `<p class="empty">No orders yet. Your purchases will show up here.</p>`;
  if (acctTab === "payments") body = orders.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Date</th><th>Order</th><th>Payment ID</th><th>Method</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>
      ${orders.map(o => `<tr><td>${fdate(o.createdAt)}</td><td>${o.id}</td><td>${esc(o.paymentId)}</td><td>${esc(o.method)}</td><td>${money(o.total)}</td><td>${badge(o.paymentStatus)}</td><td><button class="textbtn" data-invoice="${o.id}">Invoice</button></td></tr>`).join("")}</tbody></table></div>
      <p class="mute">Total paid: <strong>${money(spent)}</strong></p>` : `<p class="empty">No payments yet.</p>`;
  if (acctTab === "profile") body = `<form id="profileForm" class="stack"><label>Full name<input name="name" value="${esc(u.name)}" required></label>
      <label>Email<input value="${esc(u.email)}" disabled></label><label>Mobile<input name="phone" value="${esc(u.phone)}" maxlength="10" required></label>
      <label>Default delivery address<textarea name="address" rows="3">${esc(u.address)}</textarea></label><p class="err" role="alert"></p><button class="pay">Save profile</button></form>`;
  if (acctTab === "security") body = `<form id="pwForm" class="stack"><label>Current password<input name="old" type="password" required autocomplete="current-password"></label>
      <label>New password<input name="nw" type="password" required autocomplete="new-password"></label><p class="err" role="alert"></p><button class="pay">Change password</button></form>`;
  $("#account").innerHTML = `<h2>My account</h2><p class="mute">${esc(u.email)} · member since ${fday(u.createdAt)} · ${orders.length} order(s) · ${money(spent)} spent</p>
    <div class="tabs">${tabs.map(t => `<button class="chip ${t[0] === acctTab ? "on" : ""}" data-tab="${t[0]}">${t[1]}</button>`).join("")}</div><div class="tabbody">${body}</div>`;
}
const STEPS = ["Placed", "Packed", "Shipped", "Delivered"];
function orderCard(o) {
  const paper = o.items.some(i => i.fmt === "paper"), idx = STEPS.indexOf(o.status);
  return `<div class="order"><div class="row-between"><div><strong>${o.id}</strong> <small class="mute">${fdate(o.createdAt)}</small></div><div>${badge(o.status)} ${badge(o.paymentStatus)}</div></div>
    <ul class="items">${o.items.map(i => `<li>${esc(i.title)} <small class="mute">(${i.fmt === "ebook" ? "E-book" : "Paperback"} × ${i.qty})</small><span>${money(i.price * i.qty)}</span></li>`).join("")}</ul>
    ${paper && idx >= 0 ? `<ol class="track">${STEPS.map((s, n) => `<li class="${n <= idx ? "done" : ""}">${s}</li>`).join("")}</ol>` : ""}
    <div class="row-between"><small class="mute">Payment ${esc(o.paymentId)} · Total ${money(o.total)}</small>
    <span><button class="textbtn" data-invoice="${o.id}">Invoice</button>${o.status === "Placed" && o.items.every(i => i.fmt === "paper") && o.paymentStatus === "Paid" ? ` <button class="textbtn danger" data-cancel="${o.id}">Cancel order</button>` : ""}</span></div></div>`;
}
function cancelOrder(id) {
  const o = DB.byId("orders", id), u = Auth.user(); if (!o || o.userId !== u.id || o.status !== "Placed") return;
  if (!confirm("Cancel this order? Your refund will be processed by the store.")) return;
  o.status = "Cancelled"; o.paymentStatus = "Refund pending"; o.history.push({ status: "Cancelled", at: new Date().toISOString() }); DB.put("orders", o);
  o.items.forEach(i => { const b = book(i.bookId); if (b && i.fmt === "paper") { b.stock += i.qty; DB.put("books", b); } });
  DB.log("Customer cancelled " + id); toast("Order cancelled. A refund is pending."); renderAccount();
}
function invoice(id) {
  const o = DB.byId("orders", id), S = DB.settings(); if (!o) return;
  openModal(`<div class="invoice"><div class="row-between"><div><h2>${esc(S.storeName)}</h2><small class="mute">${esc(S.supportEmail)}</small></div><div class="right"><strong>INVOICE</strong><br>INV-${o.id.slice(4)}<br><small>${fdate(o.createdAt)}</small></div></div>
    <p><strong>Billed to</strong><br>${esc(o.customer.name)}<br>${esc(o.customer.email)} · ${esc(o.customer.phone)}${o.address ? "<br>" + esc(o.address) : ""}</p>
    <table class="tbl"><thead><tr><th>Item</th><th>Format</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>
    ${o.items.map(i => `<tr><td>${esc(i.title)}</td><td>${i.fmt === "ebook" ? "E-book" : "Paperback"}</td><td>${i.qty}</td><td>${money(i.price)}</td><td>${money(i.price * i.qty)}</td></tr>`).join("")}</tbody></table>
    <div class="sums"><div><span>Subtotal</span><span>${money(o.subtotal)}</span></div>${o.discount ? `<div><span>Discount (${esc(o.coupon)})</span><span>− ${money(o.discount)}</span></div>` : ""}
    ${o.shipping ? `<div><span>Shipping</span><span>${money(o.shipping)}</span></div>` : ""}${o.tax ? `<div><span>Tax</span><span>${money(o.tax)}</span></div>` : ""}
    <div class="grand"><span>Total paid</span><strong>${money(o.total)}</strong></div></div>
    <p class="mute">Payment ID ${esc(o.paymentId)} · ${esc(o.method)} · ${esc(o.paymentStatus)}</p>
    <button class="pay noprint" onclick="window.print()">Print / save as PDF</button></div>`, true);
}

/* ---------- e-book reader ---------- */
function openReader(id, sample) {
  current = book(id); const text = sample ? current.text.map(p => p.slice(0, 220)) : current.text;
  $("#rTitle").textContent = current.title + (sample ? " (sample)" : "");
  $("#rBody").innerHTML = `<h1>${esc(current.title)}</h1><p><em>${esc(current.author)}</em></p>${text.map(p => `<p>${esc(p)}</p>`).join("") || "<p>No text has been added to this e-book yet.</p>"}${sample ? "<p><em>Buy the e-book to read the rest.</em></p>" : ""}`;
  $("#rBody").style.fontSize = fontSize + "px"; $("#reader").hidden = false; document.body.style.overflow = "hidden"; closeModal();
  document.body.style.overflow = "hidden";
}
function closeReader() { $("#reader").hidden = true; document.body.style.overflow = ""; }

/* ---------- events ---------- */
document.addEventListener("click", e => {
  const t = e.target.closest("button"); if (!t) return; const d = t.dataset;
  if (d.cat) { filter = d.cat; renderGrid(); }
  else if (d.add) { addToCart(d.add, d.fmt); }
  else if (d.open) openBook(d.open);
  else if (d.read) openReader(d.read);
  else if (d.sample) openReader(d.sample, true);
  else if (d.wish) toggleWish(d.wish);
  else if (d.rm) { cart.splice(+d.rm, 1); saveCart(); renderCart(); }
  else if (d.q) { const i = cart[+d.q], b = book(i.id); i.qty += +d.d; if (i.qty > b.stock) { i.qty = b.stock; toast("Only " + b.stock + " in stock.", true); } if (i.qty < 1) cart.splice(+d.q, 1); saveCart(); renderCart(); }
  else if (d.view) { show(d.view); }
  else if (d.tab) { acctTab = d.tab; renderAccount(); }
  else if (d.pm) demoTab(d.pm);
  else if (t.id === "demoPay") demoPay();
  else if (t.id === "demoFail") demoFail();
  else if (d.auth) openAuth(d.auth);
  else if (d.invoice) invoice(d.invoice);
  else if (d.cancel) cancelOrder(d.cancel);
  else if (t.id === "loginBtn") openAuth("login");
  else if (t.id === "logoutBtn") { Auth.logout(); renderHeader(); renderCart(); show("shop"); toast("You are logged out."); }
});
document.addEventListener("submit", async e => {
  const f = e.target;
  if (f.id === "authForm") return submitAuth(e);
  if (f.id === "checkoutForm") return checkout(e);
  if (f.id === "reviewForm") { e.preventDefault(); const u = Auth.user(), d = Object.fromEntries(new FormData(f));
    DB.put("reviews", { id: DB.uid("r"), bookId: f.dataset.book, userId: u.id, name: u.name, rating: +d.rating, comment: d.comment.trim(), at: new Date().toISOString() });
    toast("Thanks for your review!"); openBook(f.dataset.book); show(view); }
  if (f.id === "profileForm") { e.preventDefault(); const d = Object.fromEntries(new FormData(f)), err = $(".err", f);
    if (d.name.trim().length < 2) return err.textContent = "Enter your full name.";
    if (!/^[6-9][0-9]{9}$/.test(d.phone)) return err.textContent = "Enter a valid 10-digit mobile number.";
    Auth.update({ name: d.name.trim(), phone: d.phone, address: d.address.trim() }); renderHeader(); toast("Profile saved."); }
  if (f.id === "pwForm") { e.preventDefault(); const d = Object.fromEntries(new FormData(f)), err = $(".err", f);
    try { await Auth.changePassword(d.old, d.nw); f.reset(); err.textContent = ""; toast("Password changed."); } catch (x) { err.textContent = x.message; } }
});
$("#search").addEventListener("input", e => { query = e.target.value; renderGrid(); });
$("#sort").addEventListener("change", e => { sort = e.target.value; renderGrid(); });
$("#openCart").onclick = () => { renderCart(); openCart(true); };
$("#closeCart").onclick = $("#scrim").onclick = () => openCart(false);
$("#applyCoupon").onclick = () => { const code = $("#couponIn").value.trim().toUpperCase(); if (!code) return; const c = couponCheck(code, totals().sub);
  if (c.ok) { coupon = code; $("#formErr").textContent = ""; toast("Coupon applied: you save " + money(c.disc)); } else { $("#formErr").textContent = c.msg; } renderCart(); };
$("#brand").onclick = e => { e.preventDefault(); show("shop"); };
$("#rClose").onclick = closeReader;
$("#rDown").onclick = () => downloadFile(current.title.replace(/\W+/g, "-") + ".txt", current.title + "\n" + current.author + "\n\n" + current.text.join("\n\n"), "text/plain");
$("#rBig").onclick = () => { fontSize = Math.min(32, fontSize + 2); $("#rBody").style.fontSize = fontSize + "px"; };
$("#rSmall").onclick = () => { fontSize = Math.max(14, fontSize - 2); $("#rBody").style.fontSize = fontSize + "px"; };
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeReader(); openCart(false); } });
window.addEventListener("storage", () => { renderHeader(); renderCart(); show(view); });

function renderHero() {
  const S = DB.settings(), fan = books().filter(b => b.ebook).slice(0, 3);
  $("#heroArt").innerHTML = fan.map((b, i) => `<div class="fan f${i}">${coverHTML(b)}</div>`).join("");
  $("#stripShip").textContent = S.freeShipAbove > 0 ? "Free shipping on paperback orders above " + money(S.freeShipAbove) : "Paperbacks delivered to your door";
  $("#shelfCount").textContent = books().length + " titles";
}
(async () => { await DB.init(); renderHeader(); renderHero(); renderCart(); show("shop"); })();
