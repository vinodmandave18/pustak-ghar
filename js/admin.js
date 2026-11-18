/* =====================================================================
   admin.js  -  admin panel: dashboard, books/stock, orders, payments,
   users, coupons, reviews, settings (Razorpay key, shipping, tax),
   backup/restore and activity log. Only users with role "admin" can enter.
   ===================================================================== */
const ICON = {
  dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  books: '<path d="M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h14"/>',
  orders: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  payments: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  users: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2"/><path d="M17 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.9"/>',
  coupons: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
  reviews: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L8 14.2 3 9.3l6.9-1z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  log: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'
};
const PAGES = [["dashboard", "Dashboard"], ["books", "Books & stock"], ["orders", "Orders"], ["payments", "Payments"], ["users", "Users"], ["coupons", "Coupons"], ["reviews", "Reviews"], ["settings", "Settings"], ["log", "Activity log"]];
const payMode = () => { const k = DB.settings().razorKey; return k.includes("YOUR_KEY_ID") ? "demo" : k.startsWith("rzp_live") ? "live" : "test"; };
const ORDER_STATUSES = ["Placed", "Packed", "Shipped", "Delivered", "Cancelled", "Completed"];
const badge = s => `<span class="badge ${String(s).toLowerCase().replace(/\s+/g, "-")}">${esc(s)}</span>`;
const orders = () => DB.table("orders").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
const users = () => DB.table("users");
const bookTitle = id => { const b = DB.byId("books", id); return b ? b.title : "(deleted book)"; };
const revenueOf = list => list.filter(o => o.paymentStatus === "Paid").reduce((s, o) => s + o.total, 0);
let page = "dashboard";

/* ---------- gate / shell ---------- */
function boot() {
  const ok = Auth.isAdmin();
  $("#gate").hidden = ok; $("#app").hidden = !ok;
  if (!ok) return;
  const S = DB.settings(); $("#sideBrand").textContent = S.storeName + " admin"; $("#who").innerHTML = `<span class="avatar">${esc(Auth.user().name.slice(0, 1).toUpperCase())}</span>${esc(Auth.user().email)}`;
  go((location.hash || "#dashboard").slice(1));
}
function go(p) {
  if (!PAGES.some(x => x[0] === p)) p = "dashboard"; page = p;
  const low = DB.table("books").filter(b => b.price && b.stock <= DB.settings().lowStock).length;
  $("#menu").innerHTML = PAGES.map(x => `<a href="#${x[0]}" class="${x[0] === p ? "on" : ""}"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON[x[0]]}</svg><span>${x[1]}</span>${x[0] === "books" && low ? `<span class="pill">${low}</span>` : ""}</a>`).join("");
  $("#pageTitle").textContent = PAGES.find(x => x[0] === p)[1];
  $("#content").innerHTML = ({ dashboard, books, orders: ordersPage, payments, users: usersPage, coupons, reviews, settings, log })[p]();
}
window.addEventListener("hashchange", boot);
$("#adminLogin").addEventListener("submit", async e => {
  e.preventDefault(); const f = e.target, d = Object.fromEntries(new FormData(f)), err = $(".err", f);
  try { await DB.init(); await Auth.login(d.email, d.password); if (!Auth.isAdmin()) { Auth.logout(); throw new Error("This account does not have admin access."); } boot(); }
  catch (x) { err.textContent = x.message; }
});
$("#adminLogout").onclick = () => { Auth.logout(); boot(); };

/* ---------- dashboard ---------- */
function dashboard() {
  const O = orders(), U = users().filter(u => u.role === "user"), B = DB.table("books"), S = DB.settings();
  const low = B.filter(b => b.price && b.stock <= S.lowStock), pending = O.filter(o => ["Placed", "Packed", "Shipped"].includes(o.status));
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const key = d.toDateString();
    return { label: d.toLocaleDateString("en-IN", { weekday: "short" }), v: revenueOf(O.filter(o => new Date(o.createdAt).toDateString() === key)) }; });
  const max = Math.max(...days.map(d => d.v), 1);
  const sold = {}; O.filter(o => o.paymentStatus === "Paid").forEach(o => o.items.forEach(i => sold[i.bookId] = (sold[i.bookId] || 0) + i.qty));
  const top = Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const byStatus = ORDER_STATUSES.map(s => [s, O.filter(o => o.status === s).length]).filter(x => x[1]);
  return `${payMode() === "demo" ? `<div class="notice"><strong>Payments are in demo mode.</strong> Customers see a simulated checkout. Add your Razorpay Key Id in <a href="#settings">Settings</a> to accept real Razorpay test payments.</div>` : ""}<div class="kpis">
    <div class="kpi"><b>${money(revenueOf(O))}</b><span>Revenue (paid)</span></div>
    <div class="kpi"><b>${O.length}</b><span>Orders</span></div>
    <div class="kpi"><b>${pending.length}</b><span>Orders to fulfil</span></div>
    <div class="kpi"><b>${U.length}</b><span>Customers</span></div>
    <div class="kpi"><b>${B.length}</b><span>Books listed</span></div>
    <div class="kpi ${low.length ? "warn" : ""}"><b>${low.length}</b><span>Low or out of stock</span></div></div>
  <div class="two"><div class="panel"><h2>Revenue, last 7 days</h2><div class="bars">${days.map(d => `<div><em>${d.v ? money(d.v) : ""}</em><i style="height:${d.v / max * 100}%"></i>${d.label}</div>`).join("")}</div></div>
  <div class="panel"><h2>Best sellers</h2>${top.length ? `<table class="tbl"><tbody>${top.map(t => `<tr><td>${esc(bookTitle(t[0]))}</td><td>${t[1]} sold</td></tr>`).join("")}</tbody></table>` : `<p class="mute">No sales yet.</p>`}
  <h2 style="margin-top:16px">Orders by status</h2>${byStatus.length ? byStatus.map(s => `${badge(s[0])} ${s[1]} `).join("&nbsp; ") : `<p class="mute">No orders yet.</p>`}</div></div>
  <div class="panel"><h2>Low stock alerts</h2>${low.length ? `<table class="tbl"><tbody>${low.map(b => `<tr><td>${esc(b.title)}</td><td>${b.stock} left</td><td><button class="btn sm" onclick="editBook('${b.id}')">Restock</button></td></tr>`).join("")}</tbody></table>` : `<p class="mute">All paperbacks are above the low-stock level (${S.lowStock}).</p>`}</div>
  <div class="panel"><h2>Recent orders</h2>${O.length ? orderTable(O.slice(0, 6)) : `<p class="mute">No orders yet.</p>`}</div>`;
}

/* ---------- books ---------- */
function books() {
  const B = DB.table("books"), S = DB.settings();
  return `<div class="toolbar"><input class="grow" id="bq" placeholder="Search books" oninput="filterRows(this,'#bookRows')"><button class="btn" onclick="editBook()">+ Add book</button>
    <button class="btn alt" onclick="exportBooks()">Export CSV</button></div>
  <div class="panel scroll"><table class="tbl"><thead><tr><th>Title</th><th>Category</th><th>Paperback</th><th>E-book</th><th>Stock</th><th>Status</th><th></th></tr></thead><tbody id="bookRows">
  ${B.map(b => `<tr><td><strong>${esc(b.title)}</strong><br><small class="mute">${esc(b.author)}</small></td><td>${esc(b.cat)}</td><td>${b.price ? money(b.price) : "—"}</td><td>${b.ebook ? money(b.ebook) : "—"}</td>
  <td>${b.price ? `<span class="${b.stock <= S.lowStock ? "good" : ""}" style="${b.stock <= S.lowStock ? "color:var(--err);font-weight:700" : ""}">${b.stock}</span>` : "—"}</td><td>${badge(b.active === false ? "Hidden" : "Active")}</td>
  <td class="acts"><button class="btn sm" onclick="editBook('${b.id}')">Edit</button><button class="btn sm alt" onclick="toggleBook('${b.id}')">${b.active === false ? "Show" : "Hide"}</button><button class="btn sm red" onclick="deleteBook('${b.id}')">Delete</button></td></tr>`).join("")}
  </tbody></table></div>`;
}
function filterRows(input, sel) { const q = input.value.toLowerCase(); $$(sel + " tr").forEach(tr => tr.hidden = !tr.textContent.toLowerCase().includes(q)); }
function editBook(id) {
  const b = id ? DB.byId("books", id) : { title: "", author: "", cat: "", price: "", ebook: "", stock: 0, c1: "#23305E", c2: "#F2A93B", desc: "", text: [], active: true };
  openModal(`<h2>${id ? "Edit book" : "Add a book"}</h2><form id="bookForm" data-id="${id || ""}"><div class="grid2">
    <label>Title<input name="title" value="${esc(b.title)}" required></label><label>Author<input name="author" value="${esc(b.author)}" required></label>
    <label>Category<input name="cat" value="${esc(b.cat)}" list="cats" required></label><datalist id="cats">${[...new Set(DB.table("books").map(x => x.cat))].map(c => `<option>${esc(c)}</option>`).join("")}</datalist>
    <label>Stock (paperback copies)<input name="stock" type="number" min="0" value="${b.stock}"></label>
    <label>Paperback price ₹ (blank = not sold)<input name="price" type="number" min="0" step="0.01" value="${b.price ?? ""}"></label>
    <label>E-book price ₹ (blank = not sold)<input name="ebook" type="number" min="0" step="0.01" value="${b.ebook ?? ""}"></label>
    <label>Cover colour<input name="c1" type="color" value="${b.c1}"></label><label>Cover text colour<input name="c2" type="color" value="${b.c2}"></label>
    <label class="full">Description<textarea name="desc" rows="2">${esc(b.desc)}</textarea></label>
    <label class="full">E-book text (separate paragraphs with a blank line)<textarea name="text" rows="6">${esc(b.text.join("\n\n"))}</textarea></label>
    <label class="full"><span><input type="checkbox" name="active" ${b.active !== false ? "checked" : ""}> Visible in the store</span></label></div>
    <p class="err" role="alert"></p><button class="btn">Save book</button></form>`, true);
}
function saveBook(f) {
  const d = Object.fromEntries(new FormData(f)), err = $(".err", f), id = f.dataset.id;
  const price = d.price === "" ? null : +d.price, ebook = d.ebook === "" ? null : +d.ebook;
  if (price === null && ebook === null) return err.textContent = "Set a paperback price, an e-book price, or both.";
  if ((price !== null && price <= 0) || (ebook !== null && ebook <= 0)) return err.textContent = "Prices must be greater than zero.";
  const old = id ? DB.byId("books", id) : null;
  DB.put("books", { ...(old || { createdAt: new Date().toISOString() }), id: id || DB.uid("b"), title: d.title.trim(), author: d.author.trim(), cat: d.cat.trim(), price, ebook,
    stock: price === null ? 0 : Math.max(0, parseInt(d.stock) || 0), c1: d.c1, c2: d.c2, desc: d.desc.trim(), text: d.text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean), active: !!d.active });
  DB.log((id ? "Edited" : "Added") + " book " + d.title); closeModal(); toast("Book saved."); go("books");
}
function toggleBook(id) { const b = DB.byId("books", id); b.active = b.active === false; DB.put("books", b); DB.log((b.active ? "Showed " : "Hid ") + b.title); go("books"); }
function deleteBook(id) { const b = DB.byId("books", id); if (!confirm("Delete \"" + b.title + "\" permanently? Past orders keep their own copy of the title.")) return; DB.del("books", id); DB.log("Deleted book " + b.title); go("books"); }
function exportBooks() { downloadFile("books.csv", toCSV([["Title", "Author", "Category", "Paperback", "E-book", "Stock", "Active"], ...DB.table("books").map(b => [b.title, b.author, b.cat, b.price, b.ebook, b.stock, b.active !== false])])); }

/* ---------- orders ---------- */
function orderTable(list) {
  return `<div class="scroll"><table class="tbl"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr></thead><tbody>
  ${list.map(o => `<tr><td>${o.id}</td><td>${fdate(o.createdAt)}</td><td>${esc(o.customer.name)}<br><small class="mute">${esc(o.customer.email)}</small></td><td>${o.items.reduce((s, i) => s + i.qty, 0)}</td><td>${money(o.total)}</td><td>${badge(o.paymentStatus)}</td><td>${badge(o.status)}</td><td><button class="btn sm" onclick="viewOrder('${o.id}')">Open</button></td></tr>`).join("")}</tbody></table></div>`;
}
function ordersPage() {
  return `<div class="toolbar"><input class="grow" placeholder="Search by order, name, email or payment ID" oninput="filterRows(this,'#ordWrap tbody')">
    <select id="ostat" onchange="ordFilter()"><option value="">All statuses</option>${ORDER_STATUSES.map(s => `<option>${s}</option>`).join("")}</select>
    <button class="btn alt" onclick="exportOrders()">Export CSV</button></div><div class="panel" id="ordWrap">${orders().length ? orderTable(orders()) : `<p class="mute">No orders yet.</p>`}</div>`;
}
function ordFilter() { const v = $("#ostat").value; $$("#ordWrap tbody tr").forEach(tr => tr.hidden = v && !tr.cells[6].textContent.includes(v)); }
function viewOrder(id) {
  const o = DB.byId("orders", id), paper = o.items.some(i => i.fmt === "paper");
  openModal(`<h2>${o.id}</h2><dl class="kv"><dt>Placed</dt><dd>${fdate(o.createdAt)}</dd><dt>Customer</dt><dd>${esc(o.customer.name)}, ${esc(o.customer.phone)}, ${esc(o.customer.email)}</dd>
    ${o.address ? `<dt>Ship to</dt><dd>${esc(o.address)}</dd>` : ""}<dt>Payment</dt><dd>${esc(o.method)} · ${esc(o.paymentId)} · ${badge(o.paymentStatus)}</dd>
    <dt>Amounts</dt><dd>Subtotal ${money(o.subtotal)}${o.discount ? ", discount −" + money(o.discount) + " (" + esc(o.coupon) + ")" : ""}${o.shipping ? ", shipping " + money(o.shipping) : ""}${o.tax ? ", tax " + money(o.tax) : ""} → <strong>${money(o.total)}</strong></dd></dl>
    <table class="tbl"><tbody>${o.items.map(i => `<tr><td>${esc(i.title)}</td><td>${i.fmt === "ebook" ? "E-book" : "Paperback"}</td><td>× ${i.qty}</td><td>${money(i.price * i.qty)}</td></tr>`).join("")}</tbody></table>
    <h3>Status history</h3><ul>${o.history.map(h => `<li>${badge(h.status)} ${fdate(h.at)}</li>`).join("")}</ul>
    <div class="toolbar">${paper ? `<select id="newStatus">${["Placed", "Packed", "Shipped", "Delivered", "Cancelled"].map(s => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select><button class="btn" onclick="setStatus('${o.id}')">Update status</button>` : ""}
    ${o.paymentStatus !== "Refunded" && o.paymentStatus === "Paid" || o.paymentStatus === "Refund pending" ? `<button class="btn red" onclick="markRefunded('${o.id}')">Mark as refunded</button>` : ""}</div>
    <p class="mute">Marking a refund here only updates this store's records. Send the money back from your Razorpay dashboard (Payments → select payment → Refund).</p>`, true);
}
function setStatus(id) {
  const o = DB.byId("orders", id), s = $("#newStatus").value; if (s === o.status) return;
  if (s === "Cancelled" && o.status !== "Cancelled") { o.items.forEach(i => { const b = DB.byId("books", i.bookId); if (b && i.fmt === "paper") { b.stock += i.qty; DB.put("books", b); } }); o.paymentStatus = "Refund pending"; }
  o.status = s; o.history.push({ status: s, at: new Date().toISOString() }); DB.put("orders", o); DB.log("Order " + id + " set to " + s); closeModal(); toast("Status updated."); go("orders");
}
function markRefunded(id) {
  const o = DB.byId("orders", id); if (!confirm("Mark " + id + " as refunded (" + money(o.total) + ")?")) return;
  o.paymentStatus = "Refunded"; o.history.push({ status: "Refunded", at: new Date().toISOString() }); DB.put("orders", o);
  const u = DB.byId("users", o.userId); if (u) { o.items.filter(i => i.fmt === "ebook").forEach(i => u.owned = u.owned.filter(x => x !== i.bookId)); DB.put("users", u); }
  DB.log("Refunded " + id); closeModal(); toast("Marked as refunded. E-book access removed."); go(page);
}
function exportOrders() { downloadFile("orders.csv", toCSV([["Order", "Date", "Customer", "Email", "Items", "Total", "Payment ID", "Payment", "Status"], ...orders().map(o => [o.id, o.createdAt, o.customer.name, o.customer.email, o.items.map(i => i.title + " x" + i.qty).join("; "), o.total, o.paymentId, o.paymentStatus, o.status])])); }

/* ---------- payments ---------- */
function payments() {
  const O = orders(), paid = revenueOf(O), ref = O.filter(o => o.paymentStatus === "Refunded").reduce((s, o) => s + o.total, 0), pend = O.filter(o => o.paymentStatus === "Refund pending").reduce((s, o) => s + o.total, 0);
  return `<div class="kpis"><div class="kpi"><b>${money(paid)}</b><span>Collected (net)</span></div><div class="kpi"><b>${money(ref)}</b><span>Refunded</span></div><div class="kpi ${pend ? "warn" : ""}"><b>${money(pend)}</b><span>Refunds pending</span></div><div class="kpi"><b>${O.length ? money(paid / O.filter(o => o.paymentStatus === "Paid").length || 0) : "₹0"}</b><span>Average order value</span></div></div>
  <div class="toolbar"><input class="grow" placeholder="Search payment ID, order or customer" oninput="filterRows(this,'#payRows')"><button class="btn alt" onclick="exportPayments()">Export CSV</button></div>
  <div class="panel scroll"><table class="tbl"><thead><tr><th>Date</th><th>Payment ID</th><th>Order</th><th>Customer</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead><tbody id="payRows">
  ${O.map(o => `<tr><td>${fdate(o.createdAt)}</td><td>${esc(o.paymentId)}</td><td><button class="textbtn" onclick="viewOrder('${o.id}')">${o.id}</button></td><td>${esc(o.customer.name)}</td><td>${esc(o.method)}</td><td>${money(o.total)}</td><td>${badge(o.paymentStatus)}</td></tr>`).join("") || `<tr><td colspan="7" class="mute">No payments yet.</td></tr>`}</tbody></table></div>`;
}
function exportPayments() { downloadFile("payments.csv", toCSV([["Date", "Payment ID", "Order", "Customer", "Method", "Amount", "Status"], ...orders().map(o => [o.createdAt, o.paymentId, o.id, o.customer.name, o.method, o.total, o.paymentStatus])])); }

/* ---------- users ---------- */
function usersPage() {
  const O = orders();
  return `<div class="toolbar"><input class="grow" placeholder="Search name, email or phone" oninput="filterRows(this,'#userRows')"><button class="btn alt" onclick="exportUsers()">Export CSV</button></div>
  <div class="panel scroll"><table class="tbl"><thead><tr><th>Name</th><th>Contact</th><th>Role</th><th>Orders</th><th>Spent</th><th>Joined</th><th>Last login</th><th>Status</th><th></th></tr></thead><tbody id="userRows">
  ${users().map(u => { const mine = O.filter(o => o.userId === u.id), me = u.id === Auth.user().id; return `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}<br><small class="mute">${esc(u.phone)}</small></td><td>${esc(u.role)}</td><td>${mine.length}</td><td>${money(revenueOf(mine))}</td><td>${fday(u.createdAt)}</td><td>${u.lastLogin ? fdate(u.lastLogin) : "—"}</td><td>${badge(u.blocked ? "Blocked" : "Active")}</td>
  <td class="acts"><button class="btn sm alt" onclick="viewUser('${u.id}')">View</button>${me ? "" : `<button class="btn sm alt" onclick="blockUser('${u.id}')">${u.blocked ? "Unblock" : "Block"}</button><button class="btn sm alt" onclick="roleUser('${u.id}')">${u.role === "admin" ? "Make customer" : "Make admin"}</button><button class="btn sm red" onclick="deleteUser('${u.id}')">Delete</button>`}</td></tr>`; }).join("")}</tbody></table></div>`;
}
function viewUser(id) {
  const u = DB.byId("users", id), mine = orders().filter(o => o.userId === id);
  openModal(`<h2>${esc(u.name)}</h2><dl class="kv"><dt>Email</dt><dd>${esc(u.email)}</dd><dt>Mobile</dt><dd>${esc(u.phone)}</dd><dt>Address</dt><dd>${esc(u.address) || "—"}</dd><dt>E-books owned</dt><dd>${u.owned.map(bookTitle).map(esc).join(", ") || "—"}</dd><dt>Wishlist</dt><dd>${u.wishlist.map(bookTitle).map(esc).join(", ") || "—"}</dd></dl>
    <h3>Orders</h3>${mine.length ? orderTable(mine) : `<p class="mute">No orders yet.</p>`}`, true);
}
function blockUser(id) { const u = DB.byId("users", id); u.blocked = !u.blocked; DB.put("users", u); DB.log((u.blocked ? "Blocked " : "Unblocked ") + u.email); go("users"); }
function roleUser(id) { const u = DB.byId("users", id); if (!confirm("Change " + u.email + " to " + (u.role === "admin" ? "customer" : "admin") + "?")) return; u.role = u.role === "admin" ? "user" : "admin"; DB.put("users", u); DB.log("Role of " + u.email + " is now " + u.role); go("users"); }
function deleteUser(id) { const u = DB.byId("users", id); if (!confirm("Delete " + u.email + "? Their order records are kept.")) return; DB.del("users", id); DB.log("Deleted user " + u.email); go("users"); }
function exportUsers() { downloadFile("users.csv", toCSV([["Name", "Email", "Phone", "Role", "Joined", "Blocked"], ...users().map(u => [u.name, u.email, u.phone, u.role, u.createdAt, u.blocked])])); }

/* ---------- coupons ---------- */
function coupons() {
  return `<div class="toolbar"><button class="btn" onclick="editCoupon()">+ New coupon</button></div><div class="panel scroll"><table class="tbl"><thead><tr><th>Code</th><th>Discount</th><th>Min order</th><th>Used</th><th>Expires</th><th>Status</th><th></th></tr></thead><tbody>
  ${DB.table("coupons").map(c => `<tr><td><strong>${esc(c.code)}</strong></td><td>${c.type === "percent" ? c.value + "%" : money(c.value)}</td><td>${money(c.minOrder)}</td><td>${c.used}${c.maxUses ? " / " + c.maxUses : ""}</td><td>${c.expiry || "Never"}</td><td>${badge(c.active ? "Active" : "Blocked")}</td>
  <td class="acts"><button class="btn sm" onclick="editCoupon('${c.id}')">Edit</button><button class="btn sm red" onclick="deleteCoupon('${c.id}')">Delete</button></td></tr>`).join("") || `<tr><td colspan="7" class="mute">No coupons yet.</td></tr>`}</tbody></table></div>`;
}
function editCoupon(id) {
  const c = id ? DB.byId("coupons", id) : { code: "", type: "percent", value: 10, minOrder: 0, maxUses: 0, expiry: "", active: true };
  openModal(`<h2>${id ? "Edit coupon" : "New coupon"}</h2><form id="couponForm" data-id="${id || ""}"><div class="grid2">
    <label>Code<input name="code" value="${esc(c.code)}" required style="text-transform:uppercase"></label>
    <label>Type<select name="type"><option value="percent" ${c.type === "percent" ? "selected" : ""}>Percent off</option><option value="flat" ${c.type === "flat" ? "selected" : ""}>Flat ₹ off</option></select></label>
    <label>Value<input name="value" type="number" min="1" step="0.01" value="${c.value}" required></label><label>Minimum order ₹<input name="minOrder" type="number" min="0" value="${c.minOrder}"></label>
    <label>Max uses (0 = unlimited)<input name="maxUses" type="number" min="0" value="${c.maxUses}"></label><label>Expiry date<input name="expiry" type="date" value="${c.expiry}"></label>
    <label class="full"><span><input type="checkbox" name="active" ${c.active ? "checked" : ""}> Active</span></label></div><p class="err" role="alert"></p><button class="btn">Save coupon</button></form>`);
}
function deleteCoupon(id) { const c = DB.byId("coupons", id); if (!confirm("Delete coupon " + c.code + "?")) return; DB.del("coupons", id); DB.log("Deleted coupon " + c.code); go("coupons"); }

/* ---------- reviews ---------- */
function reviews() {
  const R = DB.table("reviews").sort((a, b) => b.at.localeCompare(a.at));
  return `<div class="panel scroll"><table class="tbl"><thead><tr><th>Date</th><th>Book</th><th>Customer</th><th>Rating</th><th>Comment</th><th></th></tr></thead><tbody>
  ${R.map(r => `<tr><td>${fday(r.at)}</td><td>${esc(bookTitle(r.bookId))}</td><td>${esc(r.name)}</td><td>${"★".repeat(r.rating)}</td><td>${esc(r.comment)}</td><td><button class="btn sm red" onclick="deleteReview('${r.id}')">Delete</button></td></tr>`).join("") || `<tr><td colspan="6" class="mute">No reviews yet.</td></tr>`}</tbody></table></div>`;
}
function deleteReview(id) { if (!confirm("Delete this review?")) return; DB.del("reviews", id); DB.log("Deleted a review"); go("reviews"); }

/* ---------- settings ---------- */
function settings() {
  const S = DB.settings();
  return `<form id="settingsForm" class="panel"><h2>Store</h2><div class="grid2">
    <label>Store name<input name="storeName" value="${esc(S.storeName)}" required></label><label>Support email<input name="supportEmail" type="email" value="${esc(S.supportEmail)}"></label>
    <h2>Payments (Razorpay)</h2><p>Current mode: ${badge(payMode() === "demo" ? "Demo (simulated)" : payMode() === "live" ? "Razorpay LIVE" : "Razorpay TEST")}</p><label>Razorpay Key Id (test or live)<input name="razorKey" value="${esc(S.razorKey)}" placeholder="rzp_test_xxxxxxxxxxxxxx"></label>
    <p class="mute">Use the Key Id only. Never paste your Key Secret here: this page is visible in the browser.</p>
    <h2>Shipping, tax and stock</h2><label>Shipping fee ₹<input name="shipping" type="number" min="0" value="${S.shipping}"></label><label>Free shipping above ₹<input name="freeShipAbove" type="number" min="0" value="${S.freeShipAbove}"></label>
    <label>Tax % added at checkout<input name="taxPct" type="number" min="0" max="50" step="0.01" value="${S.taxPct}"></label><label>Low-stock alert at or below<input name="lowStock" type="number" min="0" value="${S.lowStock}"></label></div>
    <p class="err" role="alert"></p><button class="btn">Save settings</button></form>
  <div class="panel"><h2>Admin password</h2><form id="adminPwForm" class="grid2"><label>Current password<input name="old" type="password" required autocomplete="current-password"></label><label>New password<input name="nw" type="password" required autocomplete="new-password"></label><p class="err" role="alert"></p><button class="btn">Change password</button></form></div>
  <div class="panel"><h2>Backup and restore</h2><p class="mute">All data is saved in this browser. Download a backup before clearing browser data or changing computers.</p>
    <div class="acts"><button class="btn" onclick="downloadFile('pustak-ghar-backup.json',DB.exportAll(),'application/json')">Download backup</button>
    <label class="btn alt">Restore backup<input type="file" accept=".json" hidden onchange="restoreFile(this)"></label>
    <button class="btn red" onclick="resetDemo()">Reset to demo data</button></div></div>`;
}
function restoreFile(inp) { const f = inp.files[0]; if (!f) return; const r = new FileReader();
  r.onload = () => { try { DB.importAll(r.result); toast("Backup restored."); boot(); } catch { toast("That file is not a valid backup.", true); } }; r.readAsText(f); }
async function resetDemo() { if (!confirm("This deletes ALL books, users, orders and settings and restores the demo data. Continue?")) return; DB.resetAll(); await DB.init(); toast("Demo data restored. Please sign in again."); boot(); }

/* ---------- log ---------- */
function log() {
  const L = DB.get("log", []);
  return `<div class="panel scroll"><table class="tbl"><thead><tr><th>When</th><th>Who</th><th>What happened</th></tr></thead><tbody>${L.map(l => `<tr><td>${fdate(l.at)}</td><td>${esc(l.by)}</td><td>${esc(l.text)}</td></tr>`).join("") || `<tr><td colspan="3" class="mute">Nothing logged yet.</td></tr>`}</tbody></table></div>`;
}

/* ---------- form handlers ---------- */
document.addEventListener("submit", async e => {
  const f = e.target;
  if (f.id === "bookForm") { e.preventDefault(); saveBook(f); }
  if (f.id === "couponForm") { e.preventDefault(); const d = Object.fromEntries(new FormData(f)), err = $(".err", f), id = f.dataset.id, code = d.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,20}$/.test(code)) return err.textContent = "Code must be 3–20 letters or numbers.";
    if (DB.table("coupons").some(c => c.code === code && c.id !== id)) return err.textContent = "That code already exists.";
    if (d.type === "percent" && +d.value > 100) return err.textContent = "A percent discount cannot exceed 100.";
    const old = id ? DB.byId("coupons", id) : { used: 0 };
    DB.put("coupons", { id: id || DB.uid("c"), code, type: d.type, value: +d.value, minOrder: +d.minOrder || 0, maxUses: parseInt(d.maxUses) || 0, used: old.used, expiry: d.expiry, active: !!d.active });
    DB.log("Saved coupon " + code); closeModal(); toast("Coupon saved."); go("coupons"); }
  if (f.id === "settingsForm") { e.preventDefault(); const d = Object.fromEntries(new FormData(f));
    const key = d.razorKey.trim(), kerr = $(".err", f);
    if (key && !/^rzp_(test|live)_[A-Za-z0-9]{6,}$/.test(key)) return kerr.textContent = "That does not look like a Razorpay Key Id. It starts with rzp_test_ or rzp_live_.";
    kerr.textContent = "";
    DB.saveSettings({ storeName: d.storeName.trim(), supportEmail: d.supportEmail.trim(), razorKey: key || DEFAULT_SETTINGS.razorKey, shipping: +d.shipping || 0, freeShipAbove: +d.freeShipAbove || 0, taxPct: +d.taxPct || 0, lowStock: parseInt(d.lowStock) || 0 });
    DB.log("Updated settings"); toast("Settings saved."); boot(); }
  if (f.id === "adminPwForm") { e.preventDefault(); const d = Object.fromEntries(new FormData(f)), err = $(".err", f);
    try { await Auth.changePassword(d.old, d.nw); f.reset(); err.textContent = ""; toast("Password changed."); } catch (x) { err.textContent = x.message; } }
});

(async () => { await DB.init(); boot(); })();
