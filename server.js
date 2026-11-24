'use strict';

const express = require('express');
const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_PIN = String(process.env.ADMIN_PIN || '2468');
const SESSION_TTL = 12 * 60 * 60 * 1000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const DEFAULT_SETTINGS = {
  restaurantName: 'Barbeque Nation',
  outletName: 'Sentrum Mall, Kanyapur, Asansol',
  tagline: 'Live grills & buffet',
  currency: '\u20b9',
  tableCount: 17,
  footerNote: 'Demo menu. Prices in INR. Tell your server about allergies. Independent demo - not affiliated with or endorsed by Barbeque Nation.',
  upiVpa: 'barbequenation@okaxis',
  upiPayeeName: 'Barbeque Nation',
};

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

function seedData() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    orderSeq: 1000,
    categories: [
      { id: 'grills', name: 'From the grill', sort: 1 },
      { id: 'curries', name: 'Curries & mains', sort: 2 },
      { id: 'breads', name: 'Breads & rice', sort: 3 },
      { id: 'desserts', name: 'Desserts', sort: 4 },
      { id: 'drinks', name: 'Drinks', sort: 5 },
    ],
    items: [
      { id: 'paneer-tikka', categoryId: 'grills', name: 'Paneer Tikka', description: 'Charred cottage cheese, peppers and mint chutney.', price: 325, emoji: '🍢', tag: 'Vegetarian', available: true, sort: 1 },
      { id: 'tandoori-mushroom', categoryId: 'grills', name: 'Tandoori Mushroom', description: 'Smoky mushrooms with a yoghurt and spice marinade.', price: 295, emoji: '🍄', tag: 'Vegetarian', available: true, sort: 2 },
      { id: 'chicken-malai-tikka', categoryId: 'grills', name: 'Chicken Malai Tikka', description: 'Creamy chicken skewers finished over live coals.', price: 375, emoji: '🍗', tag: 'Bestseller', available: true, sort: 3 },
      { id: 'mutton-seekh', categoryId: 'grills', name: 'Mutton Seekh Kebab', description: 'Minced mutton kebabs with warm spices.', price: 425, emoji: '🍖', tag: 'Non-veg', available: true, sort: 4 },
      { id: 'grilled-pineapple', categoryId: 'grills', name: 'Grilled Pineapple', description: 'Caramelised pineapple with chaat masala.', price: 225, emoji: '🍍', tag: 'Vegetarian', available: true, sort: 5 },

      { id: 'butter-chicken', categoryId: 'curries', name: 'Butter Chicken', description: 'Tender chicken in a silky tomato and butter gravy.', price: 395, emoji: '🍛', tag: 'Bestseller', available: true, sort: 1 },
      { id: 'dal-makhani', categoryId: 'curries', name: 'Dal Makhani', description: 'Black lentils simmered overnight with butter.', price: 265, emoji: '🥘', tag: 'Vegetarian', available: true, sort: 2 },
      { id: 'paneer-butter-masala', categoryId: 'curries', name: 'Paneer Butter Masala', description: 'Cottage cheese in a rich, mildly sweet tomato gravy.', price: 325, emoji: '🧀', tag: 'Vegetarian', available: true, sort: 3 },
      { id: 'veg-biryani', categoryId: 'curries', name: 'Veg Biryani', description: 'Fragrant rice with vegetables and warm spices.', price: 295, emoji: '🍚', tag: 'Vegetarian', available: true, sort: 4 },

      { id: 'butter-naan', categoryId: 'breads', name: 'Butter Naan', description: 'Soft tandoor bread brushed with butter.', price: 65, emoji: '🫓', tag: 'Vegetarian', available: true, sort: 1 },
      { id: 'laccha-paratha', categoryId: 'breads', name: 'Laccha Paratha', description: 'Layered whole-wheat flatbread.', price: 70, emoji: '🫓', tag: 'Vegetarian', available: true, sort: 2 },
      { id: 'jeera-rice', categoryId: 'breads', name: 'Jeera Rice', description: 'Basmati rice tossed with roasted cumin.', price: 195, emoji: '🍚', tag: 'Vegetarian', available: true, sort: 3 },

      { id: 'gulab-jamun', categoryId: 'desserts', name: 'Gulab Jamun', description: 'Warm milk dumplings in cardamom syrup.', price: 145, emoji: '🍮', tag: 'Vegetarian', available: true, sort: 1 },
      { id: 'sizzling-brownie', categoryId: 'desserts', name: 'Sizzling Brownie', description: 'Chocolate brownie with vanilla ice cream.', price: 225, emoji: '🍫', tag: 'Bestseller', available: true, sort: 2 },

      { id: 'masala-lemonade', categoryId: 'drinks', name: 'Masala Lemonade', description: 'Fresh lime, soda and a pinch of chaat masala.', price: 145, emoji: '🥤', tag: 'Vegetarian', available: true, sort: 1 },
      { id: 'sweet-lassi', categoryId: 'drinks', name: 'Sweet Lassi', description: 'Chilled yoghurt drink with a touch of cardamom.', price: 155, emoji: '🥛', tag: 'Vegetarian', available: true, sort: 2 },
    ],
    orders: [],
    serviceRequests: [],
  };
}

/* ------------------------------------------------------------------ */
/*  Persistence                                                        */
/* ------------------------------------------------------------------ */

function loadDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const fresh = seedData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return {
      ...seedData(),
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      items: Array.isArray(parsed.items) ? parsed.items : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      serviceRequests: Array.isArray(parsed.serviceRequests) ? parsed.serviceRequests : [],
    };
  } catch (err) {
    const backup = `${DATA_FILE}.broken-${Date.now()}`;
    fs.copyFileSync(DATA_FILE, backup);
    console.error(`Could not read data file. Backed up to ${backup} and started fresh.`);
    const fresh = seedData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
}

let db = loadDb();

function saveDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const STATUSES = ['new', 'preparing', 'ready', 'completed', 'cancelled'];
const sessions = new Map();
const rateBuckets = new Map();

function getLanIP() {
  const candidates = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) candidates.push(net.address);
    }
  }
  return (
    candidates.find((ip) => /^192\.168\./.test(ip)) ||
    candidates.find((ip) => /^10\./.test(ip)) ||
    candidates.find((ip) => /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) ||
    candidates[0] ||
    'localhost'
  );
}

const LAN_IP = getLanIP();
let currentPort = PORT;
let BASE_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/+$/, '') || `http://${LAN_IP}:${PORT}`;

function getBaseUrl(req) {
  const explicit = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/+$/, '');
  if (explicit) return explicit;
  if (req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      return `${proto}://${host}`;
    }
  }
  return BASE_URL || `http://${LAN_IP}:${currentPort}`;
}

function allow(key, max, windowMs) {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.reset) {
    bucket = { count: 0, reset: now + windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) if (v.reset < now) rateBuckets.delete(k);
  }
  return bucket.count <= max;
}

function readCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function pinMatches(input) {
  const a = crypto.createHash('sha256').update(String(input)).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PIN).digest();
  return crypto.timingSafeEqual(a, b);
}

function sessionFor(req) {
  const token = readCookie(req, 'qr_admin');
  if (!token) return null;
  const expires = sessions.get(token);
  if (!expires || expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return token;
}

function requireAdmin(req, res, next) {
  if (!sessionFor(req)) return res.status(401).json({ error: 'Please sign in.' });
  next();
}

function publicOrder(order) {
  return {
    id: order.id,
    code: order.code,
    table: order.table,
    items: order.items,
    note: order.note,
    total: order.total,
    status: order.status,
    paymentMethod: order.paymentMethod || 'cash',
    paymentStatus: order.paymentStatus || 'pending',
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function money(value) {
  return Math.round(Number(value) * 100) / 100;
}

function asString(value, field, { min = 0, max = 200, required = true } = {}) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be text.`);
  const clean = value.trim();
  if (required && clean.length < Math.max(1, min)) throw new HttpError(400, `Please enter a ${field.toLowerCase()}.`);
  if (clean.length > max) throw new HttpError(400, `${field} is too long (max ${max} characters).`);
  return clean;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function publicRestaurant() {
  const s = db.settings;
  return {
    name: s.restaurantName,
    outletName: s.outletName,
    tagline: s.tagline,
    currency: s.currency,
    footerNote: s.footerNote,
    upiVpa: s.upiVpa || 'barbequenation@okaxis',
    upiPayeeName: s.upiPayeeName || s.restaurantName,
  };
}

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});

/* ---------- Public API ---------- */

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/api/qr', async (req, res, next) => {
  try {
    const baseUrl = getBaseUrl(req);
    const table = Math.max(1, parseInt(req.query.table, 10) || 1);
    const url = `${baseUrl}/menu?table=${table}`;
    const svg = await QRCode.toString(url, {
      type: 'svg',
      margin: 3,
      width: 240,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    if (req.query.json === '1') {
      return res.json({ table, url, svg, baseUrl });
    }
    res.type('image/svg+xml').send(svg);
  } catch (err) {
    next(err);
  }
});

app.get('/api/upi-qr', async (req, res, next) => {
  try {
    const amount = Number(req.query.amount) || 0;
    const table = Math.max(1, parseInt(req.query.table, 10) || 1);
    const orderCode = req.query.code || '';
    const vpa = db.settings.upiVpa || 'barbequenation@okaxis';
    const payee = db.settings.upiPayeeName || db.settings.restaurantName;
    const note = `Table ${table}${orderCode ? ' Order #' + orderCode : ''}`;
    const amountStr = amount > 0 ? money(amount).toFixed(2) : '';
    const upiUri = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(payee)}${amountStr ? '&am=' + amountStr : ''}&cu=INR&tn=${encodeURIComponent(note)}`;
    const svg = await QRCode.toString(upiUri, {
      type: 'svg',
      margin: 2,
      width: 200,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    res.json({ upiUri, svg, vpa, payee, amount: money(amount), note });
  } catch (err) {
    next(err);
  }
});

/* Service Requests (Call Waiter / Table Services) */
app.post('/api/service-requests', (req, res, next) => {
  try {
    if (!allow(`srv:${req.ip}`, 20, 10 * 60 * 1000)) {
      throw new HttpError(429, 'Too many requests. Please wait a moment.');
    }
    const body = req.body || {};
    const table = Number(body.table);
    if (!Number.isInteger(table) || table < 1 || table > db.settings.tableCount) {
      throw new HttpError(400, 'Please choose a valid table.');
    }
    const validTypes = ['water', 'cutlery', 'bill', 'waiter', 'clean', 'other'];
    const type = validTypes.includes(body.type) ? body.type : 'waiter';
    const note = (body.note || '').trim().slice(0, 140);
    const now = new Date().toISOString();
    const serviceRequest = {
      id: crypto.randomUUID(),
      table,
      type,
      note,
      status: 'pending',
      createdAt: now,
      resolvedAt: null,
    };
    db.serviceRequests = db.serviceRequests || [];
    db.serviceRequests.push(serviceRequest);
    saveDb();
    res.status(201).json({ serviceRequest });
  } catch (err) {
    next(err);
  }
});

app.get('/api/service-requests', (req, res) => {
  const table = parseInt(req.query.table, 10);
  const requests = (db.serviceRequests || [])
    .filter(r => !table || r.table === table)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20);
  res.json({ serviceRequests: requests });
});

app.get('/api/menu', (req, res) => {
  res.json({
    restaurant: publicRestaurant(),
    categories: [...db.categories].sort((a, b) => a.sort - b.sort),
    items: [...db.items].sort((a, b) => a.sort - b.sort),
    tableCount: db.settings.tableCount,
  });
});

app.post('/api/orders', (req, res, next) => {
  try {
    if (!allow(`order:${req.ip}`, 15, 10 * 60 * 1000)) {
      throw new HttpError(429, 'Too many orders from this device. Please wait a moment.');
    }

    const body = req.body || {};
    const table = Number(body.table);
    if (!Number.isInteger(table) || table < 1 || table > db.settings.tableCount) {
      throw new HttpError(400, 'Please choose a valid table.');
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new HttpError(400, 'Your order is empty.');
    }
    if (body.items.length > 50) throw new HttpError(400, 'That is too many items in one order.');
    if (body.note !== undefined && typeof body.note !== 'string') throw new HttpError(400, 'Note must be text.');
    const note = (body.note || '').trim().slice(0, 300);

    const quantities = new Map();
    for (const line of body.items) {
      const id = line && line.id;
      const qty = Number(line && line.qty);
      if (typeof id !== 'string' || !Number.isInteger(qty) || qty < 1 || qty > 20) {
        throw new HttpError(400, 'One of the items is invalid.');
      }
      quantities.set(id, Math.min(20, (quantities.get(id) || 0) + qty));
    }

    const orderItems = [];
    for (const [id, qty] of quantities) {
      const item = db.items.find((entry) => entry.id === id);
      if (!item) throw new HttpError(400, 'An item in your order is no longer on the menu.');
      if (!item.available) throw new HttpError(409, `${item.name} is sold out right now. Please remove it and try again.`);
      orderItems.push({ id: item.id, name: item.name, price: item.price, qty });
    }

    const total = money(orderItems.reduce((sum, line) => sum + line.price * line.qty, 0));
    db.orderSeq = Number(db.orderSeq || 100) + 1;
    const now = new Date().toISOString();
    const paymentMethod = body.paymentMethod === 'cash' ? 'cash' : 'counter';
    const paymentStatus = 'pending';

    const order = {
      id: crypto.randomUUID(),
      code: String(db.orderSeq),
      table,
      items: orderItems,
      note,
      total,
      status: 'new',
      paymentMethod,
      paymentStatus,
      createdAt: now,
      updatedAt: now,
      history: [{ status: 'new', at: now }],
    };
    db.orders.push(order);
    saveDb();
    res.status(201).json({ order: publicOrder(order) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/orders/:id/pay', (req, res, next) => {
  try {
    const order = db.orders.find((entry) => entry.id === req.params.id);
    if (!order) throw new HttpError(404, 'Order not found.');
    const method = req.body && req.body.method;
    const now = new Date().toISOString();

    if (method === 'upi') {
      order.paymentMethod = 'upi';
      order.paymentStatus = 'pending_verification';
      order.updatedAt = now;
      db.serviceRequests = db.serviceRequests || [];
      db.serviceRequests.push({
        id: crypto.randomUUID(),
        table: order.table,
        type: 'bill',
        note: `UPI payment submitted for Order #${order.code} (₹${Number(order.total).toFixed(2)}) — please verify and mark paid`,
        status: 'pending',
        createdAt: now,
        resolvedAt: null,
      });
      saveDb();
    } else if (method === 'cash') {
      order.paymentMethod = 'cash';
      order.paymentStatus = 'pending';
      order.updatedAt = now;
      db.serviceRequests = db.serviceRequests || [];
      db.serviceRequests.push({
        id: crypto.randomUUID(),
        table: order.table,
        type: 'bill',
        note: `Diner requested cash bill at Table ${order.table} for Order #${order.code} (₹${Number(order.total).toFixed(2)})`,
        status: 'pending',
        createdAt: now,
        resolvedAt: null,
      });
      saveDb();
    } else {
      throw new HttpError(400, 'Invalid payment method.');
    }

    res.json({ order: publicOrder(order) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/orders/:id', (req, res) => {
  const order = db.orders.find((entry) => entry.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found. Please check the link or ask a server.' });
  res.json({ order: publicOrder(order), restaurant: publicRestaurant() });
});

app.post('/api/orders/:id/cancel', (req, res, next) => {
  try {
    const order = db.orders.find((entry) => entry.id === req.params.id);
    if (!order) throw new HttpError(404, 'Order not found.');
    if (order.status !== 'new') {
      throw new HttpError(409, 'This order is already being prepared. Please ask a server for help.');
    }
    const now = new Date().toISOString();
    order.status = 'cancelled';
    order.updatedAt = now;
    order.history.push({ status: 'cancelled', at: now });
    saveDb();
    res.json({ order: publicOrder(order) });
  } catch (err) {
    next(err);
  }
});

/* ---------- Admin auth ---------- */

app.post('/api/admin/login', (req, res, next) => {
  try {
    if (!allow(`login:${req.ip}`, 10, 10 * 60 * 1000)) {
      throw new HttpError(429, 'Too many attempts. Please wait a few minutes.');
    }
    const pin = req.body && req.body.pin;
    if (typeof pin !== 'string' || !pinMatches(pin)) {
      throw new HttpError(401, 'That PIN is not correct.');
    }
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + SESSION_TTL);
    res.cookie('qr_admin', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure,
      maxAge: SESSION_TTL,
      path: '/',
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.get('/api/admin/session', requireAdmin, (req, res) => res.json({ ok: true }));

app.post('/api/admin/logout', (req, res) => {
  const token = sessionFor(req);
  if (token) sessions.delete(token);
  res.clearCookie('qr_admin', { path: '/' });
  res.json({ ok: true });
});

/* ---------- Admin orders ---------- */

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const orders = [...db.orders]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 400);
  res.json({ orders, serverTime: new Date().toISOString() });
});

app.get('/api/admin/orders.csv', requireAdmin, (req, res) => {
  const orders = [...db.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const esc = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [['Order', 'Table', 'Status', 'Payment Method', 'Payment Status', 'Items', 'Note', 'Total', 'Placed at']];
  for (const order of orders) {
    rows.push([
      order.code,
      order.table,
      order.status,
      order.paymentMethod || 'cash',
      order.paymentStatus || 'pending',
      order.items.map((line) => `${line.qty}x ${line.name}`).join('; '),
      order.note,
      money(order.total).toFixed(2),
      order.createdAt,
    ]);
  }
  const csv = '\uFEFF' + rows.map((row) => row.map(esc).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

app.patch('/api/admin/orders/:id', requireAdmin, (req, res, next) => {
  try {
    const order = db.orders.find((entry) => entry.id === req.params.id);
    if (!order) throw new HttpError(404, 'Order not found.');
    const status = req.body && req.body.status;
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Unknown order status.');
    if (order.status !== status) {
      const now = new Date().toISOString();
      order.status = status;
      order.updatedAt = now;
      order.history.push({ status, at: now });
      saveDb();
    }
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

/* Staff Payment Status Toggle (Anti-fraud soundbox/SMS confirmation) */
app.patch('/api/admin/orders/:id/payment', requireAdmin, (req, res, next) => {
  try {
    const order = db.orders.find((entry) => entry.id === req.params.id);
    if (!order) throw new HttpError(404, 'Order not found.');
    const paymentStatus = req.body && req.body.paymentStatus;
    if (!['pending', 'pending_verification', 'paid'].includes(paymentStatus)) {
      throw new HttpError(400, 'Invalid payment status.');
    }
    const now = new Date().toISOString();
    order.paymentStatus = paymentStatus;
    if (req.body.paymentMethod) order.paymentMethod = req.body.paymentMethod;
    order.updatedAt = now;
    saveDb();
    res.json({ order: publicOrder(order) });
  } catch (err) {
    next(err);
  }
});

/* Admin Service Requests (Call Waiter / Table Assistance Queue) */
app.get('/api/admin/service-requests', requireAdmin, (req, res) => {
  const requests = (db.serviceRequests || [])
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100);
  res.json({ serviceRequests: requests, serverTime: new Date().toISOString() });
});

app.patch('/api/admin/service-requests/:id', requireAdmin, (req, res, next) => {
  try {
    db.serviceRequests = db.serviceRequests || [];
    const request = db.serviceRequests.find((entry) => entry.id === req.params.id);
    if (!request) throw new HttpError(404, 'Service request not found.');
    const status = (req.body && req.body.status) || 'resolved';
    request.status = status;
    if (status === 'resolved') {
      request.resolvedAt = new Date().toISOString();
    }
    saveDb();
    res.json({ serviceRequest: request });
  } catch (err) {
    next(err);
  }
});

/* ---------- Admin menu ---------- */

app.get('/api/admin/menu', requireAdmin, (req, res) => {
  res.json({
    categories: [...db.categories].sort((a, b) => a.sort - b.sort),
    items: [...db.items].sort((a, b) => a.sort - b.sort),
  });
});

app.post('/api/admin/categories', requireAdmin, (req, res, next) => {
  try {
    const name = asString(req.body && req.body.name, 'Category name', { max: 40 });
    if (db.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      throw new HttpError(409, 'A category with that name already exists.');
    }
    const category = { id: crypto.randomUUID(), name, sort: db.categories.length + 1 };
    db.categories.push(category);
    saveDb();
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/admin/categories/:id', requireAdmin, (req, res, next) => {
  try {
    const category = db.categories.find((entry) => entry.id === req.params.id);
    if (!category) throw new HttpError(404, 'Category not found.');
    const name = asString(req.body && req.body.name, 'Category name', { max: 40 });
    if (db.categories.some((c) => c.id !== category.id && c.name.toLowerCase() === name.toLowerCase())) {
      throw new HttpError(409, 'A category with that name already exists.');
    }
    category.name = name;
    saveDb();
    res.json({ category });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res, next) => {
  try {
    const category = db.categories.find((entry) => entry.id === req.params.id);
    if (!category) throw new HttpError(404, 'Category not found.');
    if (db.items.some((item) => item.categoryId === category.id)) {
      throw new HttpError(409, 'Move or delete the items in this category first.');
    }
    db.categories = db.categories.filter((entry) => entry.id !== category.id);
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

function readItemBody(body, existing) {
  const item = existing ? { ...existing } : {
    id: crypto.randomUUID(),
    name: '',
    description: '',
    price: 0,
    emoji: '🍽️',
    tag: '',
    available: true,
    sort: db.items.length + 1,
    categoryId: db.categories[0] && db.categories[0].id,
  };

  if (!existing || body.name !== undefined) item.name = asString(body.name, 'Item name', { max: 80 });
  if (!existing || body.description !== undefined) item.description = asString(body.description, 'Description', { max: 240, required: false });
  if (!existing || body.categoryId !== undefined) {
    const categoryId = asString(body.categoryId, 'Category', { max: 100 });
    if (!db.categories.some((c) => c.id === categoryId)) throw new HttpError(400, 'Please choose a valid category.');
    item.categoryId = categoryId;
  }
  if (!existing || body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0 || price > 10000) throw new HttpError(400, 'Please enter a valid price.');
    item.price = money(price);
  }
  if (!existing || body.emoji !== undefined) {
    const emoji = asString(body.emoji, 'Emoji', { max: 12, required: false });
    item.emoji = emoji || '🍽️';
  }
  if (!existing || body.tag !== undefined) item.tag = asString(body.tag, 'Tag', { max: 30, required: false });
  if (body.available !== undefined) item.available = Boolean(body.available);
  if (body.sort !== undefined) {
    const sort = Number(body.sort);
    if (Number.isFinite(sort)) item.sort = sort;
  }
  return item;
}

app.post('/api/admin/items', requireAdmin, (req, res, next) => {
  try {
    const item = readItemBody(req.body || {});
    db.items.push(item);
    saveDb();
    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/admin/items/:id', requireAdmin, (req, res, next) => {
  try {
    const existing = db.items.find((entry) => entry.id === req.params.id);
    if (!existing) throw new HttpError(404, 'Item not found.');
    const item = readItemBody(req.body || {}, existing);
    Object.assign(existing, item);
    saveDb();
    res.json({ item: existing });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/admin/items/:id', requireAdmin, (req, res, next) => {
  try {
    const existing = db.items.find((entry) => entry.id === req.params.id);
    if (!existing) throw new HttpError(404, 'Item not found.');
    db.items = db.items.filter((entry) => entry.id !== existing.id);
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* ---------- Admin settings & tables ---------- */

app.get('/api/admin/settings', requireAdmin, (req, res) => {
  res.json({ settings: db.settings });
});

app.patch('/api/admin/settings', requireAdmin, (req, res, next) => {
  try {
    const body = req.body || {};
    if (body.restaurantName !== undefined) db.settings.restaurantName = asString(body.restaurantName, 'Restaurant name', { max: 60 });
    if (body.outletName !== undefined) db.settings.outletName = asString(body.outletName, 'Outlet name', { max: 100, required: false });
    if (body.tagline !== undefined) db.settings.tagline = asString(body.tagline, 'Tagline', { max: 100, required: false });
    if (body.currency !== undefined) db.settings.currency = asString(body.currency, 'Currency symbol', { max: 6 });
    if (body.upiVpa !== undefined) db.settings.upiVpa = asString(body.upiVpa, 'UPI ID', { max: 80, required: false });
    if (body.upiPayeeName !== undefined) db.settings.upiPayeeName = asString(body.upiPayeeName, 'UPI Payee Name', { max: 80, required: false });
    if (body.footerNote !== undefined) db.settings.footerNote = asString(body.footerNote, 'Footer note', { max: 200, required: false });
    if (body.tableCount !== undefined) {
      const count = Number(body.tableCount);
      if (!Number.isInteger(count) || count < 1 || count > 100) throw new HttpError(400, 'Table count must be between 1 and 100.');
      db.settings.tableCount = count;
    }
    saveDb();
    res.json({ settings: db.settings });
  } catch (err) {
    next(err);
  }
});

app.get('/api/admin/tables', requireAdmin, async (req, res, next) => {
  try {
    const baseUrl = getBaseUrl(req);
    const tables = [];
    for (let table = 1; table <= db.settings.tableCount; table += 1) {
      const url = `${baseUrl}/menu?table=${table}`;
      const svg = await QRCode.toString(url, {
        type: 'svg',
        margin: 3,
        width: 240,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      });
      tables.push({ table, url, svg });
    }
    res.json({ baseUrl, lanUrl: `http://${LAN_IP}:${currentPort}`, tables });
  } catch (err) {
    next(err);
  }
});

app.get('/api/admin/qr-sheet', async (req, res, next) => {
  try {
    if (!sessionFor(req)) return res.redirect('/admin');
    const baseUrl = getBaseUrl(req);
    const cards = [];
    for (let table = 1; table <= db.settings.tableCount; table += 1) {
      const url = `${baseUrl}/menu?table=${table}`;
      const svg = await QRCode.toString(url, {
        type: 'svg',
        margin: 3,
        width: 230,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      });
      cards.push(`
        <article class="card">
          <div class="qr">${svg}</div>
          <div class="table-label">TABLE</div>
          <div class="table-number">${table}</div>
          <div class="scan">Scan to view the menu &amp; order</div>
          <div class="url">${escapeHtml(url)}</div>
        </article>`);
    }
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Table QR codes — ${escapeHtml(db.settings.restaurantName)}</title>
<style>
  :root { --ink:#1f3d2f; --cream:#f7f3ea; --line:#dcd4c4; }
  * { box-sizing: border-box; }
  body { margin:0; padding:32px; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color:var(--ink); background:var(--cream); }
  .toolbar { display:flex; align-items:center; justify-content:space-between; gap:16px; max-width:1100px; margin:0 auto 28px; }
  .toolbar h1 { font-family: Georgia, serif; font-size:28px; margin:0; }
  .toolbar p { margin:6px 0 0; color:#6b7268; font-size:14px; }
  button { border:0; background:var(--ink); color:#fff; padding:12px 22px; border-radius:999px; font-size:15px; font-weight:600; cursor:pointer; }
  .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:20px; max-width:1100px; margin:0 auto; }
  .card { background:#fff; border:1px solid var(--line); border-radius:18px; padding:22px; text-align:center; break-inside:avoid; }
  .qr svg { width:100%; max-width:210px; height:auto; display:block; margin:0 auto; }
  .table-label { margin-top:10px; font-size:11px; letter-spacing:.28em; font-weight:700; color:#8b8f84; }
  .table-number { font-family: Georgia, serif; font-size:38px; line-height:1.1; }
  .scan { margin-top:4px; font-size:13px; color:#4c554c; }
  .url { margin-top:10px; font-size:10px; color:#9a9c93; word-break:break-all; }
  @media (max-width:800px) { .grid { grid-template-columns:repeat(2, 1fr); } body { padding:20px; } }
  @media print {
    body { background:#fff; padding:0; }
    .toolbar { display:none; }
    .grid { max-width:none; gap:10px; grid-template-columns:repeat(3, 1fr); }
    .card { border-color:#ccc; border-radius:12px; }
    .url { display:none; }
    @page { margin:12mm; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <div>
      <h1>${escapeHtml(db.settings.restaurantName)} — table QR codes</h1>
      <p>Each code opens the menu with the table number already filled in. Print and place one on every table.</p>
    </div>
    <button onclick="window.print()">Print sheet</button>
  </div>
  <main class="grid">${cards.join('')}</main>
</body>
</html>`);
  } catch (err) {
    next(err);
  }
});

/* ---------- Static site & errors ---------- */

app.use(express.static(PUBLIC_DIR, { extensions: ['html'], maxAge: 0 }));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

/* ------------------------------------------------------------------ */
/*  Start                                                              */
/* ------------------------------------------------------------------ */

function listenOnPort(port) {
  const server = app.listen(port, HOST, () => {
    currentPort = server.address().port;
    BASE_URL = (process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '') || `http://${LAN_IP}:${currentPort}`;
    const line = '─'.repeat(52);
    console.log(`\n  ${db.settings.restaurantName} is ready\n  ${line}`);
    console.log(`  Menu (this device)   http://localhost:${currentPort}/menu?table=1`);
    console.log(`  Staff dashboard      http://localhost:${currentPort}/admin`);
    console.log(`  QR / phone address   ${BASE_URL}`);
    console.log(`  Admin PIN            ${process.env.ADMIN_PIN ? 'set via ADMIN_PIN' : '2468  (set ADMIN_PIN to change)'}`);
    if (BASE_URL.includes('localhost')) {
      console.log('\n  Heads up: no LAN address was detected, so QR codes point to localhost.');
      console.log('  Phones will not be able to open them. Set PUBLIC_URL to your computer\'s LAN URL.');
    } else if (!process.env.PUBLIC_URL) {
      console.log('\n  Phones on the same Wi-Fi can scan the QR codes using the address above.');
      console.log('  If they cannot connect, allow Node through the firewall or set PUBLIC_URL.');
    }
    console.log(`  ${line}\n`);
  });

  server.on('error', (err) => {
    if ((err.code === 'EADDRINUSE' || err.code === 'EACCES') && !process.env.PORT) {
      const nextPort = port === 3000 ? 4000 : port === 4000 ? 5000 : port + 1;
      console.warn(`\n  Port ${port} was busy or restricted (${err.code}). Trying port ${nextPort}...`);
      listenOnPort(nextPort);
    } else {
      console.error('\n  Failed to start server:', err.message);
    }
  });
}

listenOnPort(PORT);
