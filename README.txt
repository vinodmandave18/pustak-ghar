# 📚 Pustak Ghar – Book Store & E-book Platform

Pustak Ghar is an academic web development project that provides an online bookstore experience with paperback books, e-books, customer accounts, shopping cart, order management, and an administrative dashboard.

## 🛠️ Technologies Used

- HTML
- CSS
- JavaScript
- Razorpay (Test Mode)
- Browser localStorage

## ✨ Features

### Customer Module
- Customer registration and login
- Profile and password management
- Search, category filtering, and sorting
- Book details, reviews, and star ratings
- Wishlist and shopping cart
- Coupon codes, shipping, and tax rules
- Checkout and order tracking
- Payment history and printable invoices
- Paperback order cancellation
- E-book reader with sample, text-size controls, and download

### Admin Module
- Dashboard with revenue, sales charts, and best sellers
- Book management and stock control
- Order management and status updates
- Payment records and CSV exports
- User management
- Coupon management
- Review moderation
- Store settings and backup/restore
- Activity log

## 📂 Project Structure

```text
pustak-ghar/
│
├── index.html
├── admin.html
├── README.md
│
├── css/
│   ├── style.css
│   └── admin.css
│
└── js/
    ├── core.js
    ├── store.js
    └── admin.js
```

## 🚀 How to Run the Project

1. Download or clone this repository.
2. Open the project folder in Visual Studio Code.
3. Install the **Live Server** extension.
4. Right-click `index.html` and select **Open with Live Server**.
5. To access the admin panel, open `admin.html` using Live Server.

### Demo Admin Login

- **Email:** `admin@pustakghar.com`
- **Password:** `Admin@123`

Change the demo password after logging in.

## 💳 Razorpay Integration

The project supports a simulated checkout flow and Razorpay Test Mode.

To configure Razorpay Test Mode:

1. Create an account at [Razorpay](https://razorpay.com/).
2. Stay in Test Mode.
3. Generate a Test Key from Account & Settings → API Keys.
4. Enter the Test Key ID in Admin Panel → Settings.
5. Never expose your Razorpay Key Secret in frontend code.

**Demo checkout:** If no Razorpay key is configured, a simulated payment window opens. No real money is transferred.

## ⚠️ Project Limitations

- Data is stored in browser localStorage, so it is not a shared database.
- Authentication and password hashing run in the browser.
- Real-world applications require secure server-side authentication and a database.
- Real Razorpay payments require backend order creation and payment signature verification.
- Refund records in the admin panel are only updated locally. Actual refunds must be processed through Razorpay.

## 🎓 Project Information

**Project Name:** Pustak Ghar – Book Store & E-book Platform

**Project Type:** Academic Web Development Project

**Purpose:** To develop an online bookstore interface with customer and administrative features.
