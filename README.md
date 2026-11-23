# Barbeque Nation — QR Table Ordering

A QR-code restaurant ordering demo with:

- Guest menu that opens with the table number preset
- Cart with quantities, kitchen notes, and order submission
- Live order tracking for guests
- Staff dashboard with live orders, status updates, menu management, table QR codes, and settings

This folder is a complete copy of the project and is ready to open in VS Code.

## Requirements

- Node.js 18 or newer (Node 24 was used during development)
- npm

## Run it

Open a terminal in this folder and run:

```powershell
npm start
```

Then open:

- Guest menu: http://localhost:3000/menu?table=1
- Staff dashboard: http://localhost:3000/admin
- Landing page: http://localhost:3000

The first time it runs, the server creates `data/db.json` and seeds the demo menu, 12 tables, and settings.

## Open it in VS Code

This is a full-stack app. `server.js` is the backend and it also serves the files in `public/`.

**Do not use the Live Server extension.** Live Server only serves static HTML/CSS/JS. It cannot run `server.js`, so the `/api/*` requests fail and the menu, login, and orders will not work.

Instead, use one of these:

1. Press **F5** in VS Code and choose **Run QR Restaurant (Express)**. This uses `.vscode/launch.json`.
2. Or open **Terminal → New Terminal** and run:

```powershell
npm start
```

If PowerShell reports that `npm.ps1` cannot be loaded, use:

```powershell
npm.cmd start
```

Then open `http://localhost:3000` in your browser.

## Staff dashboard PIN

The default PIN is:

```text
2468
```

Change it before using the app publicly by setting an environment variable:

```powershell
$env:ADMIN_PIN = "your-new-pin"
npm start
```

## Using it from a phone on the same Wi-Fi

When the server starts, it prints a QR/phone address using your computer's LAN IP, for example:

```text
http://192.168.31.26:3000
```

The QR codes in **Staff dashboard → Tables & QR** use that address. Phones must be on the same Wi-Fi network as this computer.

If the detected address is wrong, override it:

```powershell
$env:PUBLIC_URL = "http://YOUR-LAN-IP:3000"
npm start
```

You may also need to allow Node.js through Windows Firewall.

## Printing table QR codes

1. Sign in at `/admin` with the PIN.
2. Open **Tables & QR**.
3. Click **Print all codes**.
4. Print the sheet, cut out the cards, and place one on each table.

Each QR code opens the guest menu with its table number already attached, so orders arrive at the correct table.

## Changing restaurant details and menu

Use the staff dashboard:

- **Orders** — view live orders, advance statuses, cancel orders, export CSV
- **Menu** — add/edit/delete dishes and categories, change prices, mark items sold out
- **Tables & QR** — copy links, download individual SVG codes, print all codes
- **Settings** — restaurant name, tagline, currency, table count, footer note

## Project structure

```text
qr-restaurant/
├─ server.js              Express server and JSON API
├─ package.json
├─ public/
│  ├─ index.html          Landing page
│  ├─ menu.html           Guest menu
│  ├─ order.html          Order tracking page
│  ├─ admin.html          Staff dashboard
│  ├─ css/
│  │  ├─ base.css         Shared design system
│  │  ├─ menu.css         Guest menu and tracking styles
│  │  └─ admin.css        Staff dashboard styles
│  └─ js/
│     ├─ menu.js          Menu, cart, and order submission
│     ├─ order.js         Live order tracking
│     └─ admin.js         Dashboard, menu management, QR codes
└─ data/
   └─ db.json             Created automatically at first start
```

## Data storage

All data is stored locally in `data/db.json`.

- Back up that file to keep your data.
- Delete it to reset the demo (a fresh seeded database is created on the next start).
- This is suitable for a demo or single small restaurant. For production use, migrate to SQLite or PostgreSQL.

## Important for public demos

A `localhost` or `192.168.x.x` QR code only works on the local network. To share a sample with someone outside your Wi-Fi, you need either:

1. A temporary tunnel (for example Cloudflare Tunnel or ngrok), or
2. A real deployment with a domain and HTTPS.

Before sharing publicly:

- Change `ADMIN_PIN` from the default `2468`.
- Do not expose `data/db.json` directly.
- Use HTTPS so browser clipboard/QR features behave correctly.
- Keep the server running for as long as the demo link is needed.

## Scripts

```powershell
npm start       # start the server
npm run dev     # start with Node's watch mode
```
