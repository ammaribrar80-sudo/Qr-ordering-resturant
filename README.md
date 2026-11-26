# 🍽️ Barbeque Nation — QR Table Ordering & Kitchen Dashboard

> A full-stack, contactless QR table ordering system and real-time kitchen operations dashboard built with Node.js, Express, and Vanilla JavaScript.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.22-blue.svg)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)
[![Zero Build Steps](https://img.shields.io/badge/Build-Vanilla%20JS%20%2F%20No%20Bundler-success.svg)](#)

---

## 🌟 Highlights & Features

- **📱 Guest Table Ordering (`/menu?table=1`)**:
  - Automatically loads with the scanned table number preset.
  - Staff can pause and reopen guest ordering from the protected dashboard; QR scans show a closed notice while ordering is paused.
  - Category tabs navigation with smooth scrolling.
  - Dietary filters (Vegetarian, Non-veg, Bestseller) and instant search.
  - Interactive cart drawer with item notes, quantity modifiers, and subtotal.
  - Direct order submission to kitchen (zero app download required).

- **🔔 Live Guest Order Tracking (`/order?id=...`)**:
  - Real-time milestone stepper (`Received` → `Cooking` → `Ready` → `Handed over`).
  - Auto-polling keeps guests updated without manual page refreshes.
  - Guest order cancellation before preparation begins.
  - When an order is ready, staff can serve it at the table or ask the guest to collect it at the counter. Pickup instructions appear on the guest tracking page.
  - Payment is handled directly with restaurant staff; the app does not collect or verify payments.

- **👨‍🍳 Staff Operations Dashboard**:
  - Protected with staff passcode authentication (development default: `2468`; production requires a private `ADMIN_PIN` of at least 12 characters).
  - The staff page is not linked from guest-facing pages. Open it directly at `/admin404`; `/admin` and `/admin.html` return 404. The URL is not secret, so the staff PIN remains essential.
  - Sign-out does not close ordering; staff control guest ordering separately.
  - **Live Orders Queue**: Instant order cards with elapsed timers, highlighted kitchen instructions, and one-click status transitions.
  - **Synthesized Kitchen Audio Chime**: Audible alert using Web Audio API when a new table order arrives.
  - **Menu Management**: Full CRUD for dishes & categories with instantaneous "In Stock / Sold Out" toggles.
  - **Tables & QR Generator**: Dynamically generates QR SVGs for every table, allows one-click link copying, SVG downloads, and printable sheets.
  - **Restaurant Settings**: Customise restaurant name, outlet location, tagline, currency symbol, and table count.
  - **CSV Export**: One-click download of all restaurant orders for accounting and reporting.

---

## 🚀 Quickstart

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or newer
- npm

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/qr-restaurant.git
cd qr-restaurant
npm install
```

### 2. Start the Server
```bash
npm start
```

If PowerShell shows script execution restrictions on Windows, run:
```powershell
npm.cmd start
```

The server automatically detects an open port (default `3000` or fallback `4000`) and displays:
- **Landing Page & Table Simulator**: `http://localhost:4000`
- **Guest Menu**: `http://localhost:4000/menu?table=1`
- **Staff Kitchen Dashboard**: `http://localhost:4000/admin404` *(PIN: `2468`)*

---

## 📱 Testing From a Mobile Phone (Same Wi-Fi)

When the server starts, it prints your local network IP (e.g., `http://192.168.1.50:4000`).
1. Make sure your phone and computer are connected to the same Wi-Fi.
2. Open that URL on your phone's browser, or scan any table QR code from **Staff Dashboard → Tables & QR**.

---

## 🎨 Customizing Styles & Animations

All styles are organized cleanly in `public/css/`:
- `public/css/base.css` — Color tokens (`--ink`, `--accent`, `--cream`), typography, buttons, and animations (`fadeInUp`, `popBounce`).
- `public/css/menu.css` — Guest ordering UI, category nav, menu cards, and floating cart bar.
- `public/css/admin.css` — Staff kitchen dashboard, order cards, and table grid.

Feel free to tweak colors, fonts, or animations to match any restaurant brand!

---

## ☁️ Deploy a Free Render Demo

The included `render.yaml` configures a free Render web service for presenting this prototype:

1. Push the repository to GitHub.
2. In [Render](https://render.com), choose **New + → Blueprint** and select the repository.
3. Set `ADMIN_PIN` to a unique private passphrase of at least 12 characters, then deploy the Blueprint.
4. Open the Render service URL. QR codes use Render's external URL automatically; set `PUBLIC_URL` only if you use a custom domain.
5. Open the staff login at `<your-render-service-url>/admin404`. The route itself is not secret; access is protected by `ADMIN_PIN`.

**Free-demo limitations:** Render free web services sleep after 15 minutes without traffic and can take about a minute to wake. Their filesystem is temporary, so menu edits and orders can be lost when the service sleeps, restarts, or redeploys. Use this free setup for a demo only, not for restaurant operations or customer order records. Durable data requires a paid Render service with persistent storage or a separate database.

## 🔒 Security Checks

- Guest service-request status is private to the browser session that created the request; staff lists never include guest tokens.
- Secret and database files are excluded from Git. The repository's GitHub Actions workflow scans Git history for secrets, runs the security regression tests, and audits production dependencies.
- Run the focused tests locally with `npm test`. Production startup is refused when `ADMIN_PIN` is shorter than 12 characters.
- Configure the `Security checks` workflow as a required status check in GitHub branch protection if merges to `main` must be blocked when a check fails.

---

## 📁 Project Structure

```text
qr-restaurant/
├── server.js              # Express REST API, QR generator & state
├── render.yaml            # Free Render demo service configuration
├── package.json           # Dependencies (express, qrcode)
├── README.md              # Documentation & guides
├── data/
│   └── db.json            # Auto-seeded local JSON database
└── public/
    ├── index.html         # Landing page & quick table simulator
    ├── menu.html          # Guest ordering menu
    ├── order.html         # Live order tracking
    ├── admin.html         # Staff kitchen & management dashboard
    ├── css/
    │   ├── base.css       # Design tokens, variables & animations
    │   ├── menu.css       # Guest menu & cart styles
    │   └── admin.css      # Staff dashboard styles
    └── js/
        ├── index.js        # Landing page & table QR interactions
        ├── menu.js        # Guest cart & order submission
        ├── order.js       # Live order polling & status stepper
        └── admin.js       # Live order board, chime & menu CRUD
```

---

## 📄 License
MIT © 2026
