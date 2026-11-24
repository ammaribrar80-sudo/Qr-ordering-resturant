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
  - Category tabs navigation with smooth scrolling.
  - Dietary filters (Vegetarian, Non-veg, Bestseller) and instant search.
  - Interactive cart drawer with item notes, quantity modifiers, and subtotal.
  - Direct order submission to kitchen (zero app download required).

- **🔔 Live Guest Order Tracking (`/order?id=...`)**:
  - Real-time milestone stepper (`Received` → `Cooking` → `Ready` → `Served`).
  - Auto-polling keeps guests updated without manual page refreshes.
  - Guest order cancellation before preparation begins.

- **👨‍🍳 Staff Operations Dashboard (`/admin`)**:
  - Protected with staff PIN authentication (Default: `2468`).
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
- **Staff Kitchen Dashboard**: `http://localhost:4000/admin` *(PIN: `2468`)*

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

## ☁️ Deploy Free to the Cloud (Live Demo Link)

To share this sample with clients or employers worldwide without running it locally, deploy it to **Render** or **Railway** for free:

### Deploy to Render (Recommended)
1. Push this repository to your GitHub account.
2. Go to [Render.com](https://render.com) and create a free account.
3. Click **New +** → **Web Service** and select your GitHub repository.
4. Set the following settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Click **Deploy Web Service**. Render gives you a free HTTPS live URL (e.g. `https://qr-restaurant-demo.onrender.com`)!

---

## 📁 Project Structure

```text
qr-restaurant/
├── server.js              # Express REST API, QR generator & state
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
        ├── menu.js        # Guest cart & order submission
        ├── order.js       # Live order polling & status stepper
        └── admin.js       # Live order board, chime & menu CRUD
```

---

## 📄 License
MIT © 2026
