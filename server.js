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
const NODE_ENV = String(process.env.NODE_ENV || '').toLowerCase();
const ADMIN_PIN = String(process.env.ADMIN_PIN || (NODE_ENV === 'production' ? '' : '2468')).trim();
const MIN_ADMIN_PIN_LENGTH = 12;
const SESSION_TTL = 12 * 60 * 60 * 1000;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const DEFAULT_SETTINGS = {
  restaurantName: 'Barbeque Nation',
  outletName: 'Sentrum Mall, Kanyapur, Asansol',
  tagline: 'Live grills & buffet',
  currency: '\u20b9',
  tableCount: 17,
  orderingOpen: true,
  taxRate: 0,
  serviceChargeRate: 0,
  footerNote: 'Demo menu. Prices in INR. Tell your server about allergies. Independent demo - not affiliated with or endorsed by Barbeque Nation.',
};

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

function seedData() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    orderSeq: 1000,
    billSeq: 2000,
    categories: [
      { id: 'grills', name: 'From the grill', sort: 1 },
      { id: 'curries', name: 'Curries & mains', sort: 2 },
      { id: 'breads', name: 'Breads & rice', sort: 3 },
      { id: 'desserts', name: 'Desserts', sort: 4 },
      { id: 'drinks', name: 'Drinks', sort: 5 },
    ],
    items: [
      { id: 'paneer-tikka', categoryId: 'grills', name: 'Paneer Tikka', description: 'Charred cottage cheese, peppers and mint chutney.', price: 325, emoji: '🍢', tag: 'Vegetarian', dietary: 'Vegetarian', available: true, sort: 1 },
      { id: 'tandoori-mushroom', categoryId: 'grills', name: 'Tandoori Mushroom', description: 'Smoky mushrooms with a yoghurt and spice marinade.', price: 295, emoji: '🍄', tag: 'Vegetarian', dietary: 'Vegetarian', available: true, sort: 2 },
      { id: 'chicken-malai-tikka', categoryId: 'grills', name: 'Chicken Malai Tikka', description: 'Creamy chicken skewers finished over live coals.', price: 375, emoji: '🍗', tag: 'Bestseller', dietary: 'Non-veg', available: true, sort: 3 },
      { id: 'mutton-seekh', categoryId: 'grills', name: 'Mutton Seekh Kebab', description: 'Minced mutton kebabs with warm spices.', price: 425, emoji: '🍖', tag: 'Non-veg', dietary: 'Non-veg', available: true, sort: 4 },
      { id: 'grilled-pineapple', categoryId: 'grills', name: 'Grilled Pineapple', description: 'Caramelised pineapple with chaat masala.', price: 225, emoji: '🍍', tag: 'Vegetarian', dietary: 'Vegetarian', available: true, sort: 5 },

      { id: 'butter-chicken', categoryId: 'curries', name: 'Butter Chicken', description: 'Tender chicken in a silky tomato and butter gravy.', price: 395, emoji: '🍛', tag: 'Bestseller', dietary: 'Non-veg', available: true, sort: 1 },
      { id: 'dal-makhani', categoryId: 'curries', name: 'Dal Makhani', description: 'Black lentils simmered overnight with butter.', price: 265, emoji: '🥘', tag: 'Vegetarian', dietary: 'Vegetarian', available: true, sort: 2 },
      { id: 'paneer-butter-masala', categoryId: 'curries', name: 'Paneer Butter Masala', description: 'Cottage cheese in a rich, mildly sweet tomato gravy.', price: 325, emoji: '🧀', tag: 'Vegetarian', dietary: 'Vegetarian', available: true, sort: 3 },
      { id: 'veg-biryani', categoryId: 'curries', name: 'Veg Biryani', description: 'Fragrant rice with vegetables and warm spices.', price: 295, emoji: '🍚', tag: 'Vegetarian', dietary: 'Vegetarian', available: true, sort: 4 },

      { id: 'butter-naan', categoryId: 'breads', name: 'Butter Naan', description: 'Soft tandoor bread brushed with butter.', price: 65, emoji: '🫓', tag: 'Vegetarian', dietary: 'Vegetarian', available: true, sort: 1 },
      { id: 'laccha-paratha', categoryId: 'breads', name: 'Laccha Paratha', description: 'Layered whole-wheat flatbread.', price: 70, emoji: '🫓', tag: 'Vegetarian', dietary: 'Vegetarian', available: true, sort: 2 },
      { id: 'jeera-rice', categoryId: 'breads', name: 'Jeera Rice', description: 'Basmati rice tossed with roasted cumin.', price: 195, emoji: '🍚', tag: 'Vegetarian', dietary: 'Vegetarian', available: true, sort: 3 },

      { id: 'gulab-jamun', categoryId: 'desserts', name: 'Gulab Jamun', description: 'Warm milk dumplings in cardamom syrup.', price: 145, emoji: '🍮', tag: 'Vegetarian', dietary: 'Vegetarian', available: true, sort: 1 },
      { id: 'sizzling-brownie', categoryId: 'desserts', name: 'Sizzling Brownie', description: 'Chocolate brownie with vanilla ice cream.', price: 225, emoji: '🍫', tag: 'Bestseller', dietary: 'Vegetarian', available: true, sort: 2 },

      { id: 'masala-lemonade', categoryId: 'drinks', name: 'Masala Lemonade', description: 'Fresh lime, soda and a pinch of chaat masala.', price: 145, emoji: '🥤', tag: 'Vegetarian', dietary: 'Vegetarian', available: true, sort: 1 },
      { id: 'sweet-lassi', categoryId: 'drinks', name: 'Sweet Lassi', description: 'Chilled yoghurt drink with a touch of cardamom.', price: 155, emoji: '🥛', tag: 'Vegetarian', dietary: 'Vegetarian', available: true, sort: 2 },
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
    fs.writeFileSync(DATA_FILE, JSON.stringify(fresh, null, 2), { mode: 0o600 });
    return fresh;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const seededItemsById = new Map(seedData().items.map((item) => [item.id, item]));
    const settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };
    delete settings.upiVpa;
    delete settings.upiPayeeName;
    const result = {
      ...seedData(),
      ...parsed,
      settings,
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      items: Array.isArray(parsed.items) ? parsed.items.map((item) => ({
        ...item,
        dietary: typeof item.dietary === 'string'
          ? item.dietary
          : (seededItemsById.get(item.id) || {}).dietary || inferDietaryFromTag(item.tag),
      })) : [],
      orders: Array.isArray(parsed.orders)
        ? parsed.orders.map((order) => ({
            ...order,
            guestToken: typeof order.guestToken === 'string' ? order.guestToken : crypto.randomBytes(24).toString('hex'),
          }))
        : [],
      serviceRequests: Array.isArray(parsed.serviceRequests) ? parsed.serviceRequests : [],
      bills: Array.isArray(parsed.bills) ? parsed.bills : [],
      billSeq: Number.isInteger(parsed.billSeq) && parsed.billSeq >= 2000 ? parsed.billSeq : 2000,
    };
    return result;
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
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
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
    if (!bucket && rateBuckets.size >= 10000) {
      for (const [k, v] of rateBuckets) if (v.reset < now) rateBuckets.delete(k);
      if (rateBuckets.size >= 10000) return false;
    }
    bucket = { count: 0, reset: now + windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= max;
}

function rateLimit(key, max, windowMs, message = 'Too many requests. Please wait a moment.') {
  return (req, res, next) => {
    if (allow(`${key}:${req.ip}`, max, windowMs)) return next();
    res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
    return res.status(429).json({ error: message });
  };
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

function guestMatches(order, req) {
  const supplied = req.query.token || (req.body && req.body.token);
  return tokenMatches(supplied, order.guestToken);
}

function tokenMatches(supplied, stored) {
  if (typeof supplied !== 'string' || typeof stored !== 'string') return false;
  const suppliedBuffer = Buffer.from(supplied);
  const storedBuffer = Buffer.from(stored);
  return suppliedBuffer.length === storedBuffer.length &&
    crypto.timingSafeEqual(suppliedBuffer, storedBuffer);
}

function requireGuest(order, req, res) {
  if (guestMatches(order, req)) return true;
  res.status(403).json({ error: 'This order belongs to another guest session.' });
  return false;
}

function requireSameOrigin(req, res, next) {
  const origin = req.headers.origin;
  if (!origin) return next();
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    const originUrl = new URL(origin);
    if (!host || originUrl.host !== String(host).split(',')[0].trim()) {
      return res.status(403).json({ error: 'Cross-origin request rejected.' });
    }
  } catch {
    return res.status(403).json({ error: 'Invalid request origin.' });
  }
  return next();
}

function publicOrder(order, includeGuestToken = false) {
  const publicData = {
    id: order.id,
    code: order.code,
    table: order.table,
    items: order.items,
    note: order.note,
    total: order.total,
    status: order.status,
    handoff: order.handoff || null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
  if (includeGuestToken) publicData.guestToken = order.guestToken;
  return publicData;
}

function publicServiceRequest(request, includeGuestToken = false) {
  const publicData = {
    id: request.id,
    table: request.table,
    type: request.type,
    note: request.note,
    status: request.status,
    createdAt: request.createdAt,
    resolvedAt: request.resolvedAt || null,
  };
  if (includeGuestToken) publicData.guestToken = request.guestToken;
  return publicData;
}

function billTotals(bill, taxRate = db.settings.taxRate, serviceChargeRate = db.settings.serviceChargeRate) {
  const subtotal = money(bill.items.reduce((sum, item) => sum + item.price * item.qty, 0));
  const serviceCharge = money(subtotal * serviceChargeRate / 100);
  const tax = money(subtotal * taxRate / 100);
  return {
    subtotal,
    taxRate,
    tax,
    serviceChargeRate,
    serviceCharge,
    total: money(subtotal + tax + serviceCharge),
  };
}

function publicBill(bill) {
  const totals = ['finalized', 'void'].includes(bill.status) && bill.totals
    ? bill.totals
    : billTotals(bill);
  return {
    id: bill.id,
    code: bill.code,
    table: bill.table,
    status: bill.status,
    orderIds: bill.orderIds,
    orderCodes: bill.orderCodes,
    items: bill.items,
    adjustments: bill.adjustments,
    createdAt: bill.createdAt,
    createdBy: bill.createdBy,
    finalizedAt: bill.finalizedAt || null,
    finalizedBy: bill.finalizedBy || null,
    voidedAt: bill.voidedAt || null,
    voidedBy: bill.voidedBy || null,
    restaurantName: bill.restaurantName || db.settings.restaurantName,
    outletName: bill.outletName || db.settings.outletName,
    currency: bill.currency || db.settings.currency,
    ...totals,
  };
}

function percentage(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    throw new HttpError(400, `${field} must be between 0 and 100.`);
  }
  return Math.round(number * 100) / 100;
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
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
  if (NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(requireSameOrigin);

/* ---------- Public API ---------- */

app.get('/api/health', rateLimit('health', 120, 60 * 1000), (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/api/qr', rateLimit('qr', 60, 60 * 1000), async (req, res, next) => {
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

/* Service Requests (Call Waiter / Table Services) */
app.post('/api/service-requests', rateLimit('service-create', 20, 10 * 60 * 1000), (req, res, next) => {
  try {
    if (!db.settings.orderingOpen) {
      throw new HttpError(409, 'Guest ordering is currently closed.');
    }
    const body = req.body || {};
    const table = Number(body.table);
    if (!Number.isInteger(table) || table < 1 || table > db.settings.tableCount) {
      throw new HttpError(400, 'Please choose a valid table.');
    }
    const validTypes = ['water', 'cutlery', 'bill', 'waiter', 'clean', 'other'];
    if (typeof body.type !== 'string' || !validTypes.includes(body.type)) {
      throw new HttpError(400, 'Please choose a valid service request.');
    }
    const type = body.type;
    const note = asString(body.note, 'Note', { max: 140, required: false });
    const now = new Date().toISOString();
    const serviceRequest = {
      id: crypto.randomUUID(),
      guestToken: crypto.randomBytes(24).toString('hex'),
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
    res.status(201).json({ serviceRequest: publicServiceRequest(serviceRequest, true) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/service-requests', rateLimit('service-read', 120, 60 * 1000), (req, res) => {
  const table = typeof req.query.table === 'string' ? Number(req.query.table) : NaN;
  if (!Number.isInteger(table) || table < 1 || table > db.settings.tableCount) {
    return res.status(400).json({ error: 'Please choose a valid table.' });
  }
  const request = (db.serviceRequests || []).find((entry) =>
    entry.table === table && tokenMatches(req.get('x-guest-token'), entry.guestToken));
  if (!request) return res.status(403).json({ error: 'This service request belongs to another guest session.' });
  return res.json({ serviceRequests: [publicServiceRequest(request)] });
});

app.get('/api/menu', rateLimit('menu', 120, 60 * 1000), (req, res) => {
  if (!db.settings.orderingOpen) {
    return res.json({ orderingOpen: false, restaurant: publicRestaurant() });
  }
  res.json({
    orderingOpen: true,
    restaurant: publicRestaurant(),
    categories: [...db.categories].sort((a, b) => a.sort - b.sort),
    items: [...db.items].sort((a, b) => a.sort - b.sort),
    tableCount: db.settings.tableCount,
  });
});

app.get('/api/ordering-status', rateLimit('ordering-status', 120, 60 * 1000), (req, res) => {
  res.json({ orderingOpen: Boolean(db.settings.orderingOpen) });
});

app.post('/api/orders', rateLimit('orders', 15, 10 * 60 * 1000, 'Too many orders from this device. Please wait a moment.'), (req, res, next) => {
  try {
    if (!db.settings.orderingOpen) {
      throw new HttpError(409, 'Guest ordering is currently closed.');
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
    const order = {
      id: crypto.randomUUID(),
      guestToken: crypto.randomBytes(24).toString('hex'),
      code: String(db.orderSeq),
      table,
      items: orderItems,
      note,
      total,
      status: 'new',
      handoff: null,
      createdAt: now,
      updatedAt: now,
      history: [{ status: 'new', at: now }],
    };
    db.orders.push(order);
    saveDb();
    res.status(201).json({ order: publicOrder(order, true) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/orders/:id', rateLimit('order-read', 120, 60 * 1000), (req, res) => {
  const order = db.orders.find((entry) => entry.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found. Please check the link or ask a server.' });
  if (!requireGuest(order, req, res)) return;
  res.json({ order: publicOrder(order, true), restaurant: publicRestaurant() });
});

app.post('/api/orders/:id/cancel', rateLimit('order-cancel', 15, 10 * 60 * 1000), (req, res, next) => {
  try {
    const order = db.orders.find((entry) => entry.id === req.params.id);
    if (!order) throw new HttpError(404, 'Order not found.');
    if (!requireGuest(order, req, res)) return;
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

app.post('/api/admin/login', rateLimit('login', 10, 10 * 60 * 1000, 'Too many attempts. Please wait a few minutes.'), (req, res, next) => {
  try {
    const pin = req.body && req.body.pin;
    if (typeof pin !== 'string' || pin.length > 128 || !pinMatches(pin)) {
      throw new HttpError(401, 'That PIN is not correct.');
    }
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + SESSION_TTL);
    res.cookie('qr_admin', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: NODE_ENV === 'production' || req.secure,
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
  res.json({ orders: orders.map((order) => publicOrder(order)), serverTime: new Date().toISOString() });
});

app.get('/api/admin/orders.csv', requireAdmin, (req, res) => {
  const orders = [...db.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const esc = (value) => {
    const text = String(value ?? '');
    const safeText = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  };
  const rows = [['Order', 'Table', 'Status', 'Handoff', 'Items', 'Note', 'Total', 'Placed at']];
  for (const order of orders) {
    rows.push([
      order.code,
      order.table,
      order.status,
      order.handoff || '',
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
    if ((db.bills || []).some((bill) =>
      bill.status !== 'void' && bill.orderIds && bill.orderIds.includes(order.id))) {
      throw new HttpError(409, 'This order is already included in a bill and can no longer be changed.');
    }
    const status = req.body && req.body.status;
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Unknown order status.');
    const requestedHandoff = req.body && req.body.handoff;
    if (requestedHandoff !== undefined && !['table', 'pickup'].includes(requestedHandoff)) {
      throw new HttpError(400, 'Choose table service or guest pickup.');
    }

    if (requestedHandoff !== undefined && order.status !== 'ready') {
      throw new HttpError(409, 'Choose the handoff after the order is ready.');
    }
    if (status === 'preparing' && order.status !== 'new') {
      throw new HttpError(409, 'Only new orders can be started.');
    }
    if (status === 'ready' && order.status !== 'preparing' && requestedHandoff === undefined) {
      throw new HttpError(409, 'Only preparing orders can be marked ready.');
    }
    if (status === 'cancelled' && !['new', 'preparing'].includes(order.status)) {
      throw new HttpError(409, 'Only new or preparing orders can be cancelled.');
    }
    if (status === 'completed' && (order.status !== 'ready' || !(requestedHandoff || order.handoff))) {
      throw new HttpError(409, 'Choose table service or guest pickup before completing the order.');
    }

    const handoffChanged = requestedHandoff !== undefined && order.handoff !== requestedHandoff;
    const statusChanged = order.status !== status;
    if (handoffChanged) {
      order.handoff = requestedHandoff;
      order.updatedAt = new Date().toISOString();
    }
    if (statusChanged) {
      const now = new Date().toISOString();
      order.status = status;
      order.updatedAt = now;
      order.history.push({ status, at: now });
    }
    if (handoffChanged || statusChanged) saveDb();
    res.json({ order: publicOrder(order) });
  } catch (err) {
    next(err);
  }
});

/* ---------- Admin billing ---------- */

app.get('/api/admin/bills', requireAdmin, (req, res) => {
  const billedOrderIds = new Set((db.bills || [])
    .filter((bill) => bill.status !== 'void')
    .flatMap((bill) => bill.orderIds || []));
  const eligibleOrders = db.orders
    .filter((order) => order.status === 'completed' && !billedOrderIds.has(order.id))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((order) => ({
      id: order.id,
      code: order.code,
      table: order.table,
      total: order.total,
      createdAt: order.createdAt,
    }));
  const items = db.items
    .filter((item) => item.available)
    .map((item) => ({ id: item.id, name: item.name, price: item.price }));
  res.json({
    bills: [...(db.bills || [])]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(publicBill),
    eligibleOrders,
    availableItems: items,
    settings: {
      restaurantName: db.settings.restaurantName,
      outletName: db.settings.outletName,
      currency: db.settings.currency,
      taxRate: db.settings.taxRate,
      serviceChargeRate: db.settings.serviceChargeRate,
    },
  });
});

app.post('/api/admin/bills', requireAdmin, (req, res, next) => {
  try {
    db.bills = db.bills || [];
    const table = Number(req.body && req.body.table);
    if (!Number.isInteger(table) || table < 1 || table > db.settings.tableCount) {
      throw new HttpError(400, 'Please choose a valid table.');
    }
    const createdBy = asString(req.body && req.body.staffName, 'Staff name', { max: 60 });
    if (db.bills.some((bill) => bill.table === table && bill.status === 'draft')) {
      throw new HttpError(409, 'This table already has a draft bill. Open it to continue.');
    }
    const billedOrderIds = new Set(db.bills
      .filter((bill) => bill.status !== 'void')
      .flatMap((bill) => bill.orderIds || []));
    const orders = db.orders.filter((order) =>
      order.table === table && order.status === 'completed' && !billedOrderIds.has(order.id));
    if (orders.length === 0) throw new HttpError(409, 'There are no completed, unbilled orders for this table.');

    const now = new Date().toISOString();
    db.billSeq = Math.max(2000, Number(db.billSeq) || 2000) + 1;
    const bill = {
      id: crypto.randomUUID(),
      code: `B-${db.billSeq}`,
      table,
      status: 'draft',
      orderIds: orders.map((order) => order.id),
      orderCodes: orders.map((order) => order.code),
      items: orders.flatMap((order) => order.items.map((item) => ({
        id: crypto.randomUUID(),
        orderId: order.id,
        orderCode: order.code,
        itemId: item.id,
        name: item.name,
        price: item.price,
        qty: item.qty,
        orderedQty: item.qty,
        manual: false,
      }))),
      adjustments: [{
        type: 'bill_created',
        staffName: createdBy,
        at: now,
        orderCodes: orders.map((order) => order.code),
      }],
      createdAt: now,
      createdBy,
      finalizedAt: null,
      finalizedBy: null,
      voidedAt: null,
      voidedBy: null,
      restaurantName: db.settings.restaurantName,
      outletName: db.settings.outletName,
      currency: db.settings.currency,
      totals: null,
    };
    db.bills.push(bill);
    saveDb();
    res.status(201).json({ bill: publicBill(bill) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/bills/:id/adjustments', requireAdmin, (req, res, next) => {
  try {
    const bill = (db.bills || []).find((entry) => entry.id === req.params.id);
    if (!bill) throw new HttpError(404, 'Bill not found.');
    if (bill.status !== 'draft') throw new HttpError(409, 'Finalized bills cannot be changed.');
    const body = req.body || {};
    const staffName = asString(body.staffName, 'Staff name', { max: 60 });
    const reason = asString(body.reason, 'Reason', { max: 240 });
    const now = new Date().toISOString();

    if (body.action === 'set-quantity') {
      const item = bill.items.find((entry) => entry.id === body.lineId);
      if (!item) throw new HttpError(404, 'Bill item not found.');
      const quantity = Number(body.quantity);
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 20) {
        throw new HttpError(400, 'Quantity must be a whole number from 0 to 20.');
      }
      if (quantity === item.qty) throw new HttpError(400, 'Enter a different quantity to record a correction.');
      bill.adjustments.push({
        type: 'quantity_changed',
        lineId: item.id,
        itemName: item.name,
        before: item.qty,
        after: quantity,
        staffName,
        reason,
        at: now,
      });
      item.qty = quantity;
    } else if (body.action === 'add-item') {
      const itemId = asString(body.itemId, 'Menu item', { max: 100 });
      const quantity = Number(body.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        throw new HttpError(400, 'Added quantity must be a whole number from 1 to 20.');
      }
      const menuItem = db.items.find((entry) => entry.id === itemId && entry.available);
      if (!menuItem) throw new HttpError(400, 'Choose an available menu item.');
      const billItem = {
        id: crypto.randomUUID(),
        orderId: null,
        orderCode: null,
        itemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        qty: quantity,
        orderedQty: 0,
        manual: true,
      };
      bill.items.push(billItem);
      bill.adjustments.push({
        type: 'item_added',
        lineId: billItem.id,
        itemName: billItem.name,
        quantity,
        price: billItem.price,
        staffName,
        reason,
        at: now,
      });
    } else {
      throw new HttpError(400, 'Choose a valid bill adjustment.');
    }

    saveDb();
    res.json({ bill: publicBill(bill) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/bills/:id/finalize', requireAdmin, (req, res, next) => {
  try {
    const bill = (db.bills || []).find((entry) => entry.id === req.params.id);
    if (!bill) throw new HttpError(404, 'Bill not found.');
    if (bill.status !== 'draft') throw new HttpError(409, 'This bill has already been finalized.');
    if (!bill.items.some((item) => item.qty > 0)) throw new HttpError(400, 'A bill must include at least one item.');
    const staffName = asString(req.body && req.body.staffName, 'Staff name', { max: 60 });
    const now = new Date().toISOString();
    const totals = billTotals(bill);
    bill.status = 'finalized';
    bill.finalizedAt = now;
    bill.finalizedBy = staffName;
    bill.restaurantName = db.settings.restaurantName;
    bill.outletName = db.settings.outletName;
    bill.currency = db.settings.currency;
    bill.totals = totals;
    bill.adjustments.push({ type: 'bill_finalized', staffName, at: now });
    saveDb();
    res.json({ bill: publicBill(bill) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/bills/:id/void', requireAdmin, (req, res, next) => {
  try {
    const bill = (db.bills || []).find((entry) => entry.id === req.params.id);
    if (!bill) throw new HttpError(404, 'Bill not found.');
    if (bill.status !== 'draft') throw new HttpError(409, 'Only draft bills can be voided.');
    const staffName = asString(req.body && req.body.staffName, 'Staff name', { max: 60 });
    const reason = asString(req.body && req.body.reason, 'Reason', { max: 240 });
    const now = new Date().toISOString();
    bill.status = 'void';
    bill.voidedAt = now;
    bill.voidedBy = staffName;
    bill.totals = billTotals(bill);
    bill.adjustments.push({ type: 'bill_voided', staffName, reason, at: now });
    saveDb();
    res.json({ bill: publicBill(bill) });
  } catch (err) {
    next(err);
  }
});

/* Admin Service Requests (Call Waiter / Table Assistance Queue) */
app.get('/api/admin/service-requests', requireAdmin, (req, res) => {
  const requests = [...(db.serviceRequests || [])]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100);
  res.json({ serviceRequests: requests.map((request) => publicServiceRequest(request)), serverTime: new Date().toISOString() });
});

app.patch('/api/admin/service-requests/:id', requireAdmin, (req, res, next) => {
  try {
    db.serviceRequests = db.serviceRequests || [];
    const request = db.serviceRequests.find((entry) => entry.id === req.params.id);
    if (!request) throw new HttpError(404, 'Service request not found.');
    const status = req.body && req.body.status;
    if (!['pending', 'resolved'].includes(status)) throw new HttpError(400, 'Unknown service request status.');
    request.status = status;
    if (status === 'resolved') {
      request.resolvedAt = new Date().toISOString();
    }
    saveDb();
    res.json({ serviceRequest: publicServiceRequest(request) });
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
    dietary: '',
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
  if (!existing || body.dietary !== undefined) {
    const dietary = asString(body.dietary, 'Dietary classification', { max: 20, required: false });
    if (dietary && dietary !== 'Vegetarian' && dietary !== 'Non-veg') {
      throw new HttpError(400, 'Please choose a valid dietary classification.');
    }
    item.dietary = dietary || inferDietaryFromTag(item.tag);
  }
  if (body.available !== undefined) {
    if (typeof body.available !== 'boolean') throw new HttpError(400, 'Availability must be true or false.');
    item.available = body.available;
  }
  if (body.sort !== undefined) {
    const sort = Number(body.sort);
    if (!Number.isInteger(sort) || sort < 0 || sort > 10000) {
      throw new HttpError(400, 'Please enter a valid item position.');
    }
    item.sort = sort;
  }

  function inferDietaryFromTag(tag) {
    const normalizedTag = String(tag || '').trim().toLowerCase();
    if (normalizedTag === 'vegetarian') return 'Vegetarian';
    if (normalizedTag === 'non-veg') return 'Non-veg';
    return '';
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
  res.json({ settings: { ...db.settings } });
});

app.patch('/api/admin/ordering-status', requireAdmin, (req, res, next) => {
  try {
    const orderingOpen = req.body && req.body.orderingOpen;
    if (typeof orderingOpen !== 'boolean') {
      throw new HttpError(400, 'Ordering status must be open or closed.');
    }
    db.settings.orderingOpen = orderingOpen;
    saveDb();
    res.json({ orderingOpen });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/admin/settings', requireAdmin, (req, res, next) => {
  try {
    const body = req.body || {};
    if (body.restaurantName !== undefined) db.settings.restaurantName = asString(body.restaurantName, 'Restaurant name', { max: 60 });
    if (body.outletName !== undefined) db.settings.outletName = asString(body.outletName, 'Outlet name', { max: 100, required: false });
    if (body.tagline !== undefined) db.settings.tagline = asString(body.tagline, 'Tagline', { max: 100, required: false });
    if (body.currency !== undefined) db.settings.currency = asString(body.currency, 'Currency symbol', { max: 6 });
    if (body.footerNote !== undefined) db.settings.footerNote = asString(body.footerNote, 'Footer note', { max: 200, required: false });
    if (body.taxRate !== undefined) db.settings.taxRate = percentage(body.taxRate, 'Tax rate');
    if (body.serviceChargeRate !== undefined) db.settings.serviceChargeRate = percentage(body.serviceChargeRate, 'Service charge rate');
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
    if (!sessionFor(req)) return res.redirect('/admin404');
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

const serveAdminDashboard = (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
};

app.get('/admin404', serveAdminDashboard);
app.get(['/admin', '/admin.html'], (req, res) => res.sendStatus(404));

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
  if (NODE_ENV === 'production' && ADMIN_PIN.length < MIN_ADMIN_PIN_LENGTH) {
    console.error(`Refusing to start in production: set ADMIN_PIN to at least ${MIN_ADMIN_PIN_LENGTH} characters.`);
    process.exit(1);
  }
  const server = app.listen(port, HOST, () => {
    currentPort = server.address().port;
    const configuredPublicUrl = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/+$/, '');
    BASE_URL = configuredPublicUrl || `http://${LAN_IP}:${currentPort}`;
    const line = '─'.repeat(52);
    console.log(`\n  ${db.settings.restaurantName} is ready\n  ${line}`);
    console.log(`  Menu (this device)   http://localhost:${currentPort}/menu?table=1`);
    console.log(`  Staff dashboard      http://localhost:${currentPort}/admin404`);
    console.log(`  QR / phone address   ${BASE_URL}`);
    console.log(`  Admin PIN            ${process.env.ADMIN_PIN ? 'set via ADMIN_PIN' : '2468  (set ADMIN_PIN to change)'}`);
    if (BASE_URL.includes('localhost')) {
      console.log('\n  Heads up: no LAN address was detected, so QR codes point to localhost.');
      console.log('  Phones will not be able to open them. Set PUBLIC_URL to your computer\'s LAN URL.');
    } else if (!configuredPublicUrl) {
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
