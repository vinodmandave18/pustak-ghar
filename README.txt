Pustak Ghar - Book Store & E-book (HTML, CSS, JavaScript + Razorpay)

FILES
index.html        customer store          admin.html     admin panel
js/core.js        database (localStorage), login/auth, helpers
js/store.js       store logic             js/admin.js    admin logic
css/style.css, css/admin.css

RUN (Windows, VS Code)
1. Unzip, open the folder in VS Code (File > Open Folder).
2. Install the "Live Server" extension. Right-click index.html > Open with Live Server.
3. Admin panel: open admin.html the same way.
   Demo admin login:  admin@pustakghar.com  /  Admin@123   (change it in Settings)

DEMO MODE
Until a Razorpay key is saved, checkout opens a simulated payment window (UPI / card / netbanking).
It is NOT Razorpay and no money moves. It lets you test the whole flow with no account.

RAZORPAY (real test mode)
1. razorpay.com > create an account, stay in Test Mode.
2. Dashboard > Account & Settings > API Keys > Generate Test Key.
3. Admin panel > Settings > paste the Key Id (rzp_test_...) > Save. Never paste the Key Secret.
4. Test card 4111 1111 1111 1111, any future expiry, any CVV. Test UPI: success@razorpay

FEATURES
Customer: register / login / forgot password, profile, change password, search, category filter, sort,
 book detail page, reviews and star ratings (buyers only), wishlist, cart with stock limits, coupon codes,
 shipping and tax rules, Razorpay checkout, order tracking, payment history, printable invoice,
 cancel paperback order, e-book reader with sample, text size and download.
Admin: dashboard (revenue, 7-day chart, best sellers, low stock), books CRUD + stock + hide/show,
 orders (search, filter, status updates, refund marking), payments (totals, search, CSV),
 users (view, block, promote, delete), coupons CRUD, review moderation, settings (store name,
 Razorpay key, shipping, tax, low-stock level), backup / restore / reset, activity log, CSV exports.

IMPORTANT LIMITS (write these in your report)
- All data is kept in the browser's localStorage, so it is a single-browser demo, not a shared database.
- Password hashing and login run in the browser. A real site needs a server for login and a database.
- Razorpay is used without server-side order creation and signature verification. Real payments
  require a backend (Node/Express) to create orders and verify the payment signature.
- Refunds marked in the admin panel only update records. Send actual refunds from the Razorpay dashboard.
