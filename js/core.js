/* =====================================================================
   core.js  -  shared helpers, "database" (localStorage) and authentication
   Used by both index.html (store) and admin.html (admin panel).
   ===================================================================== */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const round2 = n => Math.round(n * 100) / 100;
const money = n => { const v = round2(n); return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }); };
const fdate = d => new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const fday  = d => new Date(d).toLocaleDateString("en-IN", { dateStyle: "medium" });

function toast(msg, bad) {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg; t.classList.toggle("bad", !!bad); t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2800);
}

/* ---------- modal (one reusable dialog) ---------- */
function openModal(html, wide) {
  let m = $("#modal");
  if (!m) { m = document.createElement("div"); m.id = "modal"; m.className = "modal"; document.body.appendChild(m);
    m.addEventListener("click", e => { if (e.target === m || e.target.closest("[data-close]")) closeModal(); }); }
  m.innerHTML = `<div class="modal-box ${wide ? "wide" : ""}" role="dialog" aria-modal="true"><button class="x" data-close aria-label="Close">×</button>${html}</div>`;
  m.hidden = false; document.body.style.overflow = "hidden";
  const f = m.querySelector("input,select,textarea"); if (f) f.focus();
  return m;
}
function closeModal() { const m = $("#modal"); if (m) { m.hidden = true; m.innerHTML = ""; } document.body.style.overflow = ""; }
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

/* ---------- csv / file helpers ---------- */
const toCSV = rows => rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
function downloadFile(name, text, type = "text/csv") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* =====================================================================
   DATABASE  (all data lives in the browser's localStorage under "pg_")
   Tables: books, users, orders, coupons, reviews
   ===================================================================== */
const DEFAULT_SETTINGS = {
  storeName: "Pustak Ghar", supportEmail: "support@pustakghar.example",
  razorKey: "rzp_test_YOUR_KEY_ID",
  shipping: 49, freeShipAbove: 500, taxPct: 0, lowStock: 5
};
const SEED_BOOKS = [
  ["Pride and Prejudice","Jane Austen","Classics",349,99,25,"#23305E","#F2A93B","A sharp, funny story of manners, money and marriage in Regency England, centred on Elizabeth Bennet and Mr Darcy.",["It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife."]],
  ["Alice's Adventures in Wonderland","Lewis Carroll","Classics",299,79,18,"#1F8A8A","#F3F5F9","A girl follows a white rabbit down a hole and meets a world where logic is turned upside down.",["Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it."]],
  ["The Adventures of Sherlock Holmes","Arthur Conan Doyle","Mystery",399,99,14,"#3B2F4A","#E8C547","Twelve short cases featuring the detective Sherlock Holmes and his friend Dr Watson.",["To Sherlock Holmes she is always the woman."]],
  ["Frankenstein","Mary Shelley","Mystery",329,89,10,"#27402F","#D9E4C0","A young scientist builds a living creature and then cannot face what he has made.",["You will rejoice to hear that no disaster has accompanied the commencement of an enterprise which you have regarded with such evil forebodings."]],
  ["The Art of War","Sun Tzu","Strategy",249,59,30,"#8A2B2B","#F7E7CE","Ancient Chinese advice on strategy, planning and winning without needless conflict.",["Sun Tzu said: The art of war is of vital importance to the State."]],
  ["Gitanjali","Rabindranath Tagore","Poetry",199,49,12,"#1B4E7A","#F6C98D","Tagore's own English version of his devotional poems, published in 1912.",["Gitanjali (Song Offerings) is Tagore's own English rendering of his verse, published in 1912. Add the full text here from the admin panel."]],
  ["Dracula","Bram Stoker","Mystery",379,89,9,"#2A1618","#C9414B","A solicitor travels to Transylvania and finds a count with terrible plans.",["Left Munich at 8:35 P.M., on 1st May, arriving at Vienna early next morning."]],
  ["Arthashastra","Kautilya","Strategy",499,null,6,"#6B4A1E","#F2E2B3","A classical Indian treatise on statecraft, economics and military strategy.",[]],
  ["Data Structures Made Simple","Course Notes","Study",450,null,20,"#144D4D","#BFE9E0","Arrays, lists, stacks, queues, trees and graphs explained step by step for MCA students.",[]],
  ["Web Development Basics","Course Notes","Study",399,149,3,"#32407A","#BFD0FF","HTML, CSS and JavaScript from scratch, with small projects at each stage.",["HTML gives a page its structure, CSS gives it style, and JavaScript makes it respond. Add your own notes here."]]
];

const DB = {
  get(k, d) { try { const v = localStorage.getItem("pg_" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { localStorage.setItem("pg_" + k, JSON.stringify(v)); },
  uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },
  table(n) { return DB.get(n, []); },
  byId(n, id) { return DB.table(n).find(r => r.id === id); },
  put(n, row) { const t = DB.table(n); const i = t.findIndex(r => r.id === row.id); if (i >= 0) t[i] = row; else t.push(row); DB.set(n, t); return row; },
  del(n, id) { DB.set(n, DB.table(n).filter(r => r.id !== id)); },
  settings() { return { ...DEFAULT_SETTINGS, ...DB.get("settings", {}) }; },
  saveSettings(s) { DB.set("settings", s); },
  log(text) { const l = DB.get("log", []); const u = Auth.user();
    l.unshift({ at: new Date().toISOString(), by: u ? u.email : "guest", text }); DB.set("log", l.slice(0, 300)); },
  async init() {
    if (DB.get("seeded")) return;
    DB.set("books", SEED_BOOKS.map((b, i) => ({ id: "b" + (i + 1), title: b[0], author: b[1], cat: b[2], price: b[3], ebook: b[4], stock: b[5],
      c1: b[6], c2: b[7], desc: b[8], text: b[9], active: true, createdAt: new Date().toISOString() })));
    const salt = DB.uid("s");
    DB.set("users", [{ id: "u-admin", name: "Store Admin", email: "admin@pustakghar.com", phone: "9999999999", address: "", role: "admin",
      blocked: false, salt, hash: await hashPw("Admin@123", salt), wishlist: [], owned: [], createdAt: new Date().toISOString(), lastLogin: null }]);
    DB.set("coupons", [
      { id: "c1", code: "WELCOME10", type: "percent", value: 10, minOrder: 200, maxUses: 0, used: 0, expiry: "", active: true },
      { id: "c2", code: "FLAT50", type: "flat", value: 50, minOrder: 400, maxUses: 100, used: 0, expiry: "", active: true }]);
    DB.set("orders", []); DB.set("reviews", []); DB.set("log", []); DB.set("seeded", true);
  },
  exportAll() { const o = {}; ["books","users","orders","coupons","reviews","settings","log"].forEach(k => o[k] = DB.get(k)); return JSON.stringify(o, null, 2); },
  importAll(json) { const o = JSON.parse(json); ["books","users","orders","coupons","reviews","settings","log"].forEach(k => { if (o[k] !== undefined) DB.set(k, o[k]); }); DB.set("seeded", true); },
  resetAll() { Object.keys(localStorage).filter(k => k.startsWith("pg_")).forEach(k => localStorage.removeItem(k)); }
};

/* =====================================================================
   AUTH  -  salted SHA-256 password hashes, sessions, lockout, roles
   NOTE: this is a browser-only demo. Real sites must authenticate on a server.
   ===================================================================== */
async function hashPw(pw, salt) {
  const data = new TextEncoder().encode(salt + pw);
  if (window.crypto && crypto.subtle) {
    const b = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  }
  let h = 5381; for (const c of salt + pw) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return "weak" + h;
}
const pwProblem = p => p.length < 8 ? "Password must be at least 8 characters." : !/[A-Za-z]/.test(p) || !/[0-9]/.test(p) ? "Password must contain a letter and a number." : "";

const Auth = {
  user() { const id = DB.get("session"); const u = id ? DB.byId("users", id) : null; return u && !u.blocked ? u : null; },
  isAdmin() { const u = Auth.user(); return !!u && u.role === "admin"; },
  async register({ name, email, phone, password }) {
    email = email.trim().toLowerCase(); name = name.trim();
    if (name.length < 2) throw new Error("Enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email address.");
    if (!/^[6-9][0-9]{9}$/.test(phone)) throw new Error("Enter a valid 10-digit Indian mobile number.");
    const pe = pwProblem(password); if (pe) throw new Error(pe);
    if (DB.table("users").some(u => u.email === email)) throw new Error("An account with this email already exists. Log in instead.");
    const salt = DB.uid("s");
    const u = { id: DB.uid("u"), name, email, phone, address: "", role: "user", blocked: false, salt, hash: await hashPw(password, salt),
      wishlist: [], owned: [], createdAt: new Date().toISOString(), lastLogin: new Date().toISOString() };
    DB.put("users", u); DB.set("session", u.id); DB.log("Registered new account"); return u;
  },
  async login(email, password) {
    email = email.trim().toLowerCase();
    const locks = DB.get("locks", {}), L = locks[email] || { n: 0, until: 0 };
    if (L.until > Date.now()) throw new Error("Too many failed attempts. Try again in " + Math.ceil((L.until - Date.now()) / 1000) + " seconds.");
    const u = DB.table("users").find(x => x.email === email);
    if (!u || u.hash !== await hashPw(password, u.salt)) {
      L.n++; if (L.n >= 5) { L.until = Date.now() + 60000; L.n = 0; } locks[email] = L; DB.set("locks", locks);
      throw new Error("Email or password is incorrect.");
    }
    if (u.blocked) throw new Error("This account has been blocked. Contact " + DB.settings().supportEmail + ".");
    delete locks[email]; DB.set("locks", locks);
    u.lastLogin = new Date().toISOString(); DB.put("users", u); DB.set("session", u.id); DB.log("Logged in"); return u;
  },
  logout() { DB.log("Logged out"); DB.set("session", null); },
  update(fields) { const u = Auth.user(); if (!u) throw new Error("Please log in."); Object.assign(u, fields); DB.put("users", u); return u; },
  async changePassword(oldPw, newPw) {
    const u = Auth.user(); if (!u) throw new Error("Please log in.");
    if (u.hash !== await hashPw(oldPw, u.salt)) throw new Error("Your current password is incorrect.");
    const pe = pwProblem(newPw); if (pe) throw new Error(pe);
    u.salt = DB.uid("s"); u.hash = await hashPw(newPw, u.salt); DB.put("users", u); DB.log("Changed password");
  },
  async resetPassword(email, phone, newPw) {   // demo "forgot password": verifies email + mobile on file
    email = email.trim().toLowerCase();
    const u = DB.table("users").find(x => x.email === email && x.phone === phone.trim());
    if (!u) throw new Error("No account matches that email and mobile number.");
    const pe = pwProblem(newPw); if (pe) throw new Error(pe);
    u.salt = DB.uid("s"); u.hash = await hashPw(newPw, u.salt); DB.put("users", u); DB.log("Password reset for " + email);
  }
};
