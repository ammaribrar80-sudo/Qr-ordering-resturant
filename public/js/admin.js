'use strict';

(() => {
  const byId = (id) => document.getElementById(id);

  const els = {
    loginView: byId('loginView'),
    loginForm: byId('loginForm'),
    pinInput: byId('pinInput'),
    loginBtn: byId('loginBtn'),
    loginError: byId('loginError'),
    appView: byId('appView'),

    adminRestaurantName: byId('adminRestaurantName'),
    soundBtn: byId('soundBtn'),
    soundLabel: byId('soundLabel'),
    logoutBtn: byId('logoutBtn'),
    ordersBadge: byId('ordersBadge'),

    lastUpdated: byId('lastUpdated'),
    refreshOrdersBtn: byId('refreshOrdersBtn'),
    exportBtn: byId('exportBtn'),
    exportBtn2: byId('exportBtn2'),
    statActive: byId('statActive'),
    statActiveSub: byId('statActiveSub'),
    statSales: byId('statSales'),
    statSalesSub: byId('statSalesSub'),
    statTables: byId('statTables'),
    statTablesSub: byId('statTablesSub'),
    statCompleted: byId('statCompleted'),
    statCompletedSub: byId('statCompletedSub'),

    orderFilters: byId('orderFilters'),
    filterNote: byId('filterNote'),
    ordersGrid: byId('ordersGrid'),
    ordersEmpty: byId('ordersEmpty'),

    addCategoryBtn: byId('addCategoryBtn'),
    addItemBtn: byId('addItemBtn'),
    categoryManage: byId('categoryManage'),
    adminMenuList: byId('adminMenuList'),
    menuEmpty: byId('menuEmpty'),

    printQrBtn: byId('printQrBtn'),
    refreshTablesBtn: byId('refreshTablesBtn'),
    qrBaseUrl: byId('qrBaseUrl'),
    copyBaseBtn: byId('copyBaseBtn'),
    qrWarning: byId('qrWarning'),
    tableCountLabel: byId('tableCountLabel'),
    qrGrid: byId('qrGrid'),
    settingsShortcut: byId('settingsShortcut'),

    settingsForm: byId('settingsForm'),
    settingName: byId('settingName'),
    settingTagline: byId('settingTagline'),
    settingCurrency: byId('settingCurrency'),
    settingTables: byId('settingTables'),
    settingFooter: byId('settingFooter'),
    saveSettingsBtn: byId('saveSettingsBtn'),

    itemDialog: byId('itemDialog'),
    itemForm: byId('itemForm'),
    itemDialogTitle: byId('itemDialogTitle'),
    itemDialogClose: byId('itemDialogClose'),
    itemId: byId('itemId'),
    itemName: byId('itemName'),
    itemDescription: byId('itemDescription'),
    itemCategory: byId('itemCategory'),
    itemPrice: byId('itemPrice'),
    itemEmoji: byId('itemEmoji'),
    itemTag: byId('itemTag'),
    itemAvailable: byId('itemAvailable'),
    itemError: byId('itemError'),
    itemCancelBtn: byId('itemCancelBtn'),
    itemSaveBtn: byId('itemSaveBtn'),
    emojiRow: byId('emojiRow'),

    categoryDialog: byId('categoryDialog'),
    categoryForm: byId('categoryForm'),
    categoryDialogTitle: byId('categoryDialogTitle'),
    categoryDialogClose: byId('categoryDialogClose'),
    categoryName: byId('categoryName'),
    categoryError: byId('categoryError'),
    categoryCancelBtn: byId('categoryCancelBtn'),
    categorySaveBtn: byId('categorySaveBtn'),

    confirmDialog: byId('confirmDialog'),
    confirmTitle: byId('confirmTitle'),
    confirmText: byId('confirmText'),
    confirmCancel: byId('confirmCancel'),
    confirmOk: byId('confirmOk'),

    adminToast: byId('adminToast'),
  };

  const TABS = ['orders', 'menu', 'tables', 'settings'];
  const ACTIVE_STATUSES = ['new', 'preparing', 'ready'];
  const EMOJIS = ['🍽️', '🍔', '🍕', '🥗', '🍝', '🍣', '🥩', '🍗', '🍟', '🥦', '🍄', '🍅', '🍤', '🌮', '🥪', '🍰', '🍫', '🍋', '🍨', '☕', '🍺', '🍷', '🥤', '🫧'];
  const STATUS_META = {
    new: { label: 'New' },
    preparing: { label: 'Preparing' },
    ready: { label: 'Ready' },
    completed: { label: 'Served' },
    cancelled: { label: 'Cancelled' },
  };
  const NEXT_STATUS = {
    new: { status: 'preparing', label: 'Start preparing' },
    preparing: { status: 'ready', label: 'Mark ready' },
    ready: { status: 'completed', label: 'Mark served' },
  };

  const ICON_EDIT = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  const ICON_TRASH = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

  const state = {
    authenticated: false,
    settings: null,
    orders: [],
    categories: [],
    items: [],
    filter: 'active',
    menuCategory: 'all',
    knownOrderIds: new Set(),
    ordersLoaded: false,
    loadingOrders: false,
    lastUpdated: null,
    pollTimer: null,
    sound: true,
    audioCtx: null,
    tablesData: null,
    tablesLoaded: false,
    tablesLoading: false,
    editingItemId: null,
    editingCategoryId: null,
    confirmResolve: null,
    booted: false,
  };

  let toastTimer = null;

  /* ---------------------------------------------------------------- */
  /*  Utilities                                                        */
  /* ---------------------------------------------------------------- */

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function money(value) {
    const currency = state.settings?.currency || '$';
    const amount = Number(value || 0).toFixed(2);
    return currency.length > 1 ? `${currency} ${amount}` : `${currency}${amount}`;
  }

  function toast(message, type = '') {
    els.adminToast.textContent = message;
    els.adminToast.className = `toast show ${type}`.trim();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.adminToast.className = 'toast';
    }, 3200);
  }

  function timeAgo(iso) {
    const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 45) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    return `${Math.round(hours / 24)} d ago`;
  }

  function timeLabel(iso) {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '—';
    }
  }

  function isToday(iso) {
    const date = new Date(iso);
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  async function api(url, options = {}) {
    const res = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    if (res.status === 401) {
      const message = (body && body.error) || 'Please sign in again.';
      showLogin('Your session expired. Please sign in again.');
      throw new Error(message);
    }
    if (!res.ok) {
      throw new Error((body && body.error) || 'Something went wrong. Please try again.');
    }
    return body;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        return ok;
      } catch {
        return false;
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Audio                                                            */
  /* ---------------------------------------------------------------- */

  function ensureAudio() {
    if (!state.audioCtx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioCtor) state.audioCtx = new AudioCtor();
    }
    if (state.audioCtx && state.audioCtx.state === 'suspended') {
      state.audioCtx.resume().catch(() => {});
    }
  }

  function playNewOrderSound() {
    if (!state.sound || !state.audioCtx) return;
    const ctx = state.audioCtx;
    const now = ctx.currentTime;
    [880, 1174.66].forEach((frequency, index) => {
      const start = now + index * 0.13;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.13, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.26);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.28);
    });
  }

  function updateSoundButton() {
    els.soundLabel.textContent = state.sound ? 'Sound on' : 'Sound off';
    els.soundBtn.classList.toggle('is-off', !state.sound);
    els.soundBtn.setAttribute('aria-pressed', String(state.sound));
  }

  /* ---------------------------------------------------------------- */
  /*  Login / session                                                  */
  /* ---------------------------------------------------------------- */

  function showLogin(message = '') {
    state.authenticated = false;
    state.booted = false;
    state.ordersLoaded = false;
    state.knownOrderIds.clear();
    stopPolling();
    for (const dialog of document.querySelectorAll('dialog[open]')) {
      try {
        dialog.close();
      } catch {
        /* ignore */
      }
    }
    els.appView.hidden = true;
    els.loginView.hidden = false;
    els.pinInput.value = '';
    if (message) {
      els.loginError.textContent = message;
      els.loginError.hidden = false;
    } else {
      els.loginError.hidden = true;
      els.loginError.textContent = '';
    }
    document.title = 'Staff sign in — Barbeque Nation';
    setTimeout(() => els.pinInput.focus(), 120);
  }

  function showApp() {
    state.authenticated = true;
    els.loginView.hidden = true;
    els.appView.hidden = false;
    document.body.classList.remove('no-scroll');
    updateBadge();
  }

  async function checkSession() {
    try {
      const res = await fetch('/api/admin/session', { credentials: 'same-origin' });
      if (res.ok) {
        await boot();
        return;
      }
      showLogin();
    } catch {
      showLogin('Could not reach the server. Check that it is running, then try again.');
    }
  }

  async function boot() {
    state.booted = true;
    state.ordersLoaded = false;
    state.knownOrderIds.clear();
    state.loadingOrders = false;
    state.tablesLoaded = false;
    state.tablesData = null;
    showApp();
    try {
      await loadSettings();
      await Promise.all([loadMenuData(), loadOrders()]);
      startPolling();
      const hash = window.location.hash.replace('#', '');
      setTab(TABS.includes(hash) ? hash : 'orders');
      document.addEventListener('pointerdown', ensureAudio, { once: true });
    } catch (err) {
      if (state.authenticated) toast(err.message || 'Could not load the dashboard.', 'error');
    }
  }

  els.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const pin = els.pinInput.value.trim();
    if (!pin) {
      els.loginError.textContent = 'Please enter your PIN.';
      els.loginError.hidden = false;
      els.pinInput.focus();
      return;
    }
    els.loginBtn.disabled = true;
    els.loginBtn.textContent = 'Signing in…';
    els.loginError.hidden = true;
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      let body = null;
      try {
        body = await res.json();
      } catch {
        /* ignore */
      }
      if (!res.ok) throw new Error((body && body.error) || 'Could not sign in.');
      ensureAudio();
      await boot();
    } catch (err) {
      els.loginError.textContent = err.message || 'Could not sign in.';
      els.loginError.hidden = false;
      els.pinInput.select();
    } finally {
      els.loginBtn.disabled = false;
      els.loginBtn.textContent = 'Sign in';
    }
  });

  els.logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      /* ignore */
    }
    showLogin();
    toast('Signed out.');
  });

  els.soundBtn.addEventListener('click', () => {
    state.sound = !state.sound;
    try {
      localStorage.setItem('copper-admin-sound', state.sound ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    if (state.sound) ensureAudio();
    updateSoundButton();
    toast(state.sound ? 'New-order sound is on.' : 'New-order sound is off.');
  });

  /* ---------------------------------------------------------------- */
  /*  Settings                                                         */
  /* ---------------------------------------------------------------- */

  function applySettings({ populateForm = false } = {}) {
    const settings = state.settings;
    if (!settings) return;
    els.adminRestaurantName.textContent = settings.restaurantName;
    els.tableCountLabel.textContent = settings.tableCount;
    updateBadge();
    if (populateForm) {
      els.settingName.value = settings.restaurantName;
      els.settingTagline.value = settings.tagline || '';
      els.settingCurrency.value = settings.currency;
      els.settingTables.value = settings.tableCount;
      els.settingFooter.value = settings.footerNote || '';
    }
  }

  async function loadSettings() {
    const result = await api('/api/admin/settings');
    state.settings = result.settings;
    applySettings({ populateForm: true });
  }

  els.settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const tableCount = Number(els.settingTables.value);
    if (!Number.isInteger(tableCount) || tableCount < 1 || tableCount > 100) {
      toast('Table count must be between 1 and 100.', 'error');
      els.settingTables.focus();
      return;
    }
    els.saveSettingsBtn.disabled = true;
    els.saveSettingsBtn.textContent = 'Saving…';
    try {
      const result = await api('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          restaurantName: els.settingName.value,
          tagline: els.settingTagline.value,
          currency: els.settingCurrency.value,
          tableCount,
          footerNote: els.settingFooter.value,
        }),
      });
      state.settings = result.settings;
      state.tablesLoaded = false;
      state.tablesData = null;
      applySettings({ populateForm: true });
      renderOrders();
      renderStats();
      renderOrderFilters();
      renderMenuAdmin();
      toast('Settings saved.');
    } catch (err) {
      toast(err.message || 'Could not save settings.', 'error');
    } finally {
      els.saveSettingsBtn.disabled = false;
      els.saveSettingsBtn.textContent = 'Save settings';
    }
  });

  function populateSettings() {
    if (state.settings) applySettings({ populateForm: true });
  }

  /* ---------------------------------------------------------------- */
  /*  Tabs                                                             */
  /* ---------------------------------------------------------------- */

  function setTab(tab) {
    const target = TABS.includes(tab) ? tab : 'orders';
    for (const button of document.querySelectorAll('.admin-tab')) {
      const active = button.dataset.tab === target;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    }
    for (const name of TABS) {
      const panel = byId(`tab-${name}`);
      if (panel) panel.hidden = name !== target;
    }
    try {
      window.history.replaceState(null, '', `#${target}`);
    } catch {
      /* ignore */
    }
    if (target === 'tables') loadTables();
    if (target === 'settings') populateSettings();
    if (target === 'orders') updateLastUpdated();
  }

  document.querySelectorAll('.admin-tab').forEach((button) => {
    button.addEventListener('click', () => setTab(button.dataset.tab));
  });

  els.settingsShortcut.addEventListener('click', () => setTab('settings'));

  /* ---------------------------------------------------------------- */
  /*  Orders                                                           */
  /* ---------------------------------------------------------------- */

  function startPolling() {
    stopPolling();
    state.pollTimer = setInterval(() => {
      if (state.authenticated && document.visibilityState === 'visible') loadOrders();
    }, 5000);
  }

  function stopPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function visibleOrders() {
    if (state.filter === 'active') return state.orders.filter((order) => ACTIVE_STATUSES.includes(order.status));
    if (state.filter === 'all') return [...state.orders];
    return state.orders.filter((order) => order.status === state.filter);
  }

  function sortedOrders(orders) {
    const priority = { new: 0, preparing: 1, ready: 2, completed: 3, cancelled: 4 };
    return [...orders].sort((a, b) => {
      const pa = priority[a.status] ?? 9;
      const pb = priority[b.status] ?? 9;
      if (pa !== pb) return pa - pb;
      if (pa <= 2) return new Date(a.createdAt) - new Date(b.createdAt);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function updateLastUpdated() {
    if (!state.lastUpdated) {
      els.lastUpdated.textContent = 'Not updated yet';
      return;
    }
    els.lastUpdated.textContent = `Updated ${timeLabel(state.lastUpdated.toISOString())}`;
  }

  function updateBadge() {
    const newCount = state.orders.filter((order) => order.status === 'new').length;
    els.ordersBadge.textContent = String(newCount);
    els.ordersBadge.classList.toggle('hidden', newCount === 0);
    if (!state.authenticated) return;
    const name = state.settings?.restaurantName || 'Barbeque Nation';
    document.title = newCount > 0 ? `(${newCount}) Live orders — ${name}` : `Live orders — ${name}`;
  }

  function renderStats() {
    const active = state.orders.filter((order) => ACTIVE_STATUSES.includes(order.status));
    const newCount = active.filter((order) => order.status === 'new').length;
    const today = state.orders.filter((order) => isToday(order.createdAt) && order.status !== 'cancelled');
    const sales = today.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const activeTables = new Set(active.map((order) => order.table)).size;
    const completedToday = state.orders.filter(
      (order) => order.status === 'completed' && isToday(order.updatedAt)
    ).length;

    els.statActive.textContent = String(active.length);
    els.statActiveSub.textContent = newCount
      ? `${newCount} waiting to start`
      : active.length
        ? 'All orders in progress'
        : 'No open tables';
    els.statSales.textContent = money(sales);
    els.statSalesSub.textContent = `Across ${today.length} ${today.length === 1 ? 'order' : 'orders'}`;
    els.statTables.textContent = String(activeTables);
    els.statTablesSub.textContent = activeTables ? 'With open orders' : 'All tables clear';
    els.statCompleted.textContent = String(completedToday);
    els.statCompletedSub.textContent = completedToday ? 'Orders served today' : 'No orders served yet';
  }

  function renderOrderFilters() {
    const activeCount = state.orders.filter((order) => ACTIVE_STATUSES.includes(order.status)).length;
    const counts = {
      active: activeCount,
      new: state.orders.filter((order) => order.status === 'new').length,
      preparing: state.orders.filter((order) => order.status === 'preparing').length,
      ready: state.orders.filter((order) => order.status === 'ready').length,
      completed: state.orders.filter((order) => order.status === 'completed').length,
      all: state.orders.length,
    };
    const filters = [
      ['active', 'Active'],
      ['new', 'New'],
      ['preparing', 'Preparing'],
      ['ready', 'Ready'],
      ['completed', 'Served'],
      ['all', 'All'],
    ];
    els.orderFilters.innerHTML = filters
      .map(
        ([key, label]) =>
          `<button class="filter-chip ${state.filter === key ? 'active' : ''}" type="button" data-filter="${key}">
            ${label} <span class="count">${counts[key]}</span>
          </button>`
      )
      .join('');
    const shown = visibleOrders().length;
    els.filterNote.textContent = state.orders.length
      ? `Showing ${shown} ${shown === 1 ? 'order' : 'orders'} · updates every 5s`
      : 'Updates every 5 seconds';
  }

  function emptyMessage() {
    const messages = {
      active: ['No active orders right now', 'New orders will appear here automatically, with their table number and items.'],
      new: ['No new orders waiting', 'When a guest sends an order, it will land here first.'],
      preparing: ['Nothing in the kitchen', 'Orders you start preparing will show up here.'],
      ready: ['No orders waiting to be served', 'Marked-ready orders will appear here.'],
      completed: ['No served orders yet', 'Orders you complete will be kept here for reference.'],
      all: ['No orders yet', 'Scan a table QR code and place a test order to see the whole flow.'],
    };
    return messages[state.filter] || messages.all;
  }

  function orderCard(order) {
    const meta = STATUS_META[order.status] || STATUS_META.new;
    const next = NEXT_STATUS[order.status];
    const isActive = ACTIVE_STATUSES.includes(order.status);
    const lines = order.items
      .map(
        (line) => `
        <div class="order-item-line">
          <span class="order-item-qty">${line.qty}×</span>
          <span class="order-item-name">${esc(line.name)}</span>
          <span class="order-item-price">${money(line.price * line.qty)}</span>
        </div>`
      )
      .join('');
    const note = order.note
      ? `<div class="order-card-note"><strong>Note</strong><span>${esc(order.note)}</span></div>`
      : '';
    const actions = next
      ? `<button class="btn btn-dark btn-sm" type="button" data-order-id="${esc(order.id)}" data-next="${next.status}">${next.label}</button>`
      : `<span class="order-done-note">${order.status === 'completed' ? '✓ Served' : '✕ Cancelled'}</span>`;
    const cancel = isActive
      ? `<button class="order-cancel" type="button" data-cancel-order="${esc(order.id)}">Cancel</button>`
      : '';

    return `
      <article class="order-card status-${esc(order.status)}">
        <div class="order-card-top">
          <div class="table-badge"><span>TABLE</span><strong>${esc(order.table)}</strong></div>
          <div class="order-id-block">
            <strong>Order #${esc(order.code)}</strong>
            <span>${esc(timeAgo(order.createdAt))} · ${esc(timeLabel(order.createdAt))}</span>
          </div>
          <span class="admin-status ${esc(order.status)}">${esc(meta.label)}</span>
        </div>
        <div class="order-card-items">${lines}</div>
        ${note}
        <div class="order-card-total">
          <span>Total</span>
          <strong>${money(order.total)}</strong>
        </div>
        <div class="order-card-foot">
          ${actions}
          ${cancel}
        </div>
      </article>`;
  }

  function renderOrders() {
    const orders = sortedOrders(visibleOrders());
    const [title, text] = emptyMessage();
    const emptyTitle = els.ordersEmpty.querySelector('h2');
    const emptyText = els.ordersEmpty.querySelector('p');
    if (emptyTitle) emptyTitle.textContent = title;
    if (emptyText) emptyText.textContent = text;
    els.ordersEmpty.classList.toggle('hidden', orders.length > 0);
    els.ordersGrid.classList.toggle('hidden', orders.length === 0);
    els.ordersGrid.innerHTML = orders.map(orderCard).join('');
  }

  async function loadOrders({ manual = false } = {}) {
    if (state.loadingOrders || !state.authenticated) return;
    state.loadingOrders = true;
    if (manual) {
      els.refreshOrdersBtn.disabled = true;
      els.refreshOrdersBtn.classList.add('is-loading');
    }
    try {
      const result = await api('/api/admin/orders');
      const orders = Array.isArray(result.orders) ? result.orders : [];

      if (state.ordersLoaded) {
        const fresh = orders.filter((order) => order.status === 'new' && !state.knownOrderIds.has(order.id));
        if (fresh.length > 0) {
          playNewOrderSound();
          const tables = [...new Set(fresh.map((order) => order.table))].join(', ');
          toast(`New order${fresh.length > 1 ? 's' : ''} — table ${tables}`);
        }
      }

      state.knownOrderIds = new Set(orders.map((order) => order.id));
      state.ordersLoaded = true;
      state.orders = orders;
      state.lastUpdated = new Date(result.serverTime || Date.now());
      renderOrders();
      renderStats();
      renderOrderFilters();
      updateBadge();
      updateLastUpdated();
    } catch (err) {
      if (state.authenticated) toast(err.message || 'Could not load orders.', 'error');
    } finally {
      state.loadingOrders = false;
      if (manual) {
        els.refreshOrdersBtn.disabled = false;
        els.refreshOrdersBtn.classList.remove('is-loading');
      }
    }
  }

  async function updateOrderStatus(orderId, status, button) {
    const order = state.orders.find((entry) => entry.id === orderId);
    if (!order) return;
    if (button) {
      button.disabled = true;
      button.textContent = 'Updating…';
    }
    try {
      const result = await api(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      const index = state.orders.findIndex((entry) => entry.id === orderId);
      if (index !== -1) state.orders[index] = result.order;
      renderOrders();
      renderStats();
      renderOrderFilters();
      updateBadge();
      const label = STATUS_META[status]?.label || status;
      toast(`Order #${order.code} — ${label.toLowerCase()}.`);
    } catch (err) {
      toast(err.message || 'Could not update the order.', 'error');
      renderOrders();
    }
  }

  async function cancelOrder(orderId) {
    const order = state.orders.find((entry) => entry.id === orderId);
    if (!order) return;
    const confirmed = await askConfirm({
      title: `Cancel order #${order.code}?`,
      text: `This will mark the order for table ${order.table} as cancelled. This cannot be undone.`,
      okLabel: 'Cancel order',
    });
    if (!confirmed) return;
    try {
      const result = await api(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      });
      const index = state.orders.findIndex((entry) => entry.id === orderId);
      if (index !== -1) state.orders[index] = result.order;
      renderOrders();
      renderStats();
      renderOrderFilters();
      updateBadge();
      toast(`Order #${order.code} cancelled.`);
    } catch (err) {
      toast(err.message || 'Could not cancel the order.', 'error');
    }
  }

  els.orderFilters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    state.filter = button.dataset.filter;
    renderOrderFilters();
    renderOrders();
  });

  els.ordersGrid.addEventListener('click', (event) => {
    const advance = event.target.closest('[data-order-id][data-next]');
    const cancel = event.target.closest('[data-cancel-order]');
    if (advance) {
      updateOrderStatus(advance.dataset.orderId, advance.dataset.next, advance);
    } else if (cancel) {
      cancelOrder(cancel.dataset.cancelOrder);
    }
  });

  els.refreshOrdersBtn.addEventListener('click', () => loadOrders({ manual: true }));

  async function exportCsv() {
    const buttons = [els.exportBtn, els.exportBtn2];
    buttons.forEach((button) => {
      button.disabled = true;
    });
    try {
      const res = await fetch('/api/admin/orders.csv', { credentials: 'same-origin' });
      if (res.status === 401) {
        showLogin('Your session expired. Please sign in again.');
        return;
      }
      if (!res.ok) {
        let message = 'Could not export orders.';
        try {
          const body = await res.json();
          if (body && body.error) message = body.error;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast('Orders exported as CSV.');
    } catch (err) {
      toast(err.message || 'Could not export orders.', 'error');
    } finally {
      buttons.forEach((button) => {
        button.disabled = false;
      });
    }
  }

  els.exportBtn.addEventListener('click', exportCsv);
  els.exportBtn2.addEventListener('click', exportCsv);

  /* ---------------------------------------------------------------- */
  /*  Menu                                                             */
  /* ---------------------------------------------------------------- */

  function categoryName(id) {
    return state.categories.find((category) => category.id === id)?.name || 'Uncategorised';
  }

  function renderMenuAdmin() {
    if (state.menuCategory !== 'all' && !state.categories.some((category) => category.id === state.menuCategory)) {
      state.menuCategory = 'all';
    }

    const allPill = `<span class="category-pill-wrap">
      <button class="category-pill ${state.menuCategory === 'all' ? 'active' : ''}" type="button" data-cat-filter="all">
        All <span class="cat-count">${state.items.length}</span>
      </button>
    </span>`;
    const categoryPills = state.categories
      .map((category) => {
        const count = state.items.filter((item) => item.categoryId === category.id).length;
        return `<span class="category-pill-wrap">
          <button class="category-pill ${state.menuCategory === category.id ? 'active' : ''}" type="button" data-cat-filter="${esc(category.id)}">
            ${esc(category.name)} <span class="cat-count">${count}</span>
          </button>
          <button class="category-mini" type="button" data-edit-cat="${esc(category.id)}" aria-label="Rename ${esc(category.name)}" title="Rename category">✎</button>
          <button class="category-mini danger" type="button" data-delete-cat="${esc(category.id)}" aria-label="Delete ${esc(category.name)}" title="Delete category">✕</button>
        </span>`;
      })
      .join('');
    els.categoryManage.innerHTML = allPill + categoryPills;

    const items =
      state.menuCategory === 'all'
        ? [...state.items]
        : state.items.filter((item) => item.categoryId === state.menuCategory);

    const rows = items
      .map((item) => {
        const category = categoryName(item.categoryId);
        return `<div class="admin-menu-row ${item.available ? '' : 'is-unavailable'}" data-menu-item="${esc(item.id)}">
          <div class="menu-dish-cell">
            <div class="menu-emoji" aria-hidden="true">${esc(item.emoji || '🍽️')}</div>
            <div>
              <strong>${esc(item.name)}</strong>
              <p>${esc(item.description || 'No description')}</p>
              ${item.tag ? `<span class="mini-tag">${esc(item.tag)}</span>` : ''}
            </div>
          </div>
          <div class="menu-cat-cell">${esc(category)}</div>
          <div class="menu-price-cell">${money(item.price)}</div>
          <div class="menu-toggle-cell">
            <button class="switch ${item.available ? 'on' : ''}" type="button" role="switch" aria-checked="${item.available}" data-toggle-item="${esc(item.id)}" aria-label="Toggle availability for ${esc(item.name)}"></button>
            <span class="switch-label">${item.available ? 'Available' : 'Sold out'}</span>
          </div>
          <div class="menu-actions-cell">
            <button class="icon-mini" type="button" data-edit-item="${esc(item.id)}" title="Edit dish" aria-label="Edit ${esc(item.name)}">${ICON_EDIT}</button>
            <button class="icon-mini danger" type="button" data-delete-item="${esc(item.id)}" title="Delete dish" aria-label="Delete ${esc(item.name)}">${ICON_TRASH}</button>
          </div>
        </div>`;
      })
      .join('');

    els.adminMenuList.innerHTML = rows;
    els.adminMenuList.closest('.menu-list-card').hidden = items.length === 0;
    els.menuEmpty.classList.toggle('hidden', items.length > 0);
  }

  async function loadMenuData() {
    const result = await api('/api/admin/menu');
    state.categories = Array.isArray(result.categories) ? result.categories : [];
    state.items = Array.isArray(result.items) ? result.items : [];
    renderMenuAdmin();
  }

  function populateItemCategories(selectedId) {
    if (state.categories.length === 0) {
      els.itemCategory.innerHTML = '<option value="">No categories yet</option>';
      return;
    }
    els.itemCategory.innerHTML = state.categories
      .map(
        (category) =>
          `<option value="${esc(category.id)}" ${category.id === selectedId ? 'selected' : ''}>${esc(category.name)}</option>`
      )
      .join('');
    if (selectedId && state.categories.some((category) => category.id === selectedId)) {
      els.itemCategory.value = selectedId;
    }
  }

  function openItemDialog(itemId = null) {
    if (state.categories.length === 0) {
      toast('Add a category before adding a dish.', 'error');
      openCategoryDialog();
      return;
    }
    const item = itemId ? state.items.find((entry) => entry.id === itemId) : null;
    state.editingItemId = item ? item.id : null;
    els.itemDialogTitle.textContent = item ? 'Edit dish' : 'Add a dish';
    els.itemId.value = item ? item.id : '';
    els.itemName.value = item ? item.name : '';
    els.itemDescription.value = item ? item.description : '';
    els.itemPrice.value = item ? item.price : '';
    els.itemEmoji.value = item ? item.emoji : '🍽️';
    els.itemTag.value = item ? item.tag : '';
    els.itemAvailable.checked = item ? Boolean(item.available) : true;
    els.itemError.hidden = true;
    els.itemError.textContent = '';
    const defaultCategory =
      item?.categoryId ||
      (state.menuCategory !== 'all' ? state.menuCategory : state.categories[0]?.id);
    populateItemCategories(defaultCategory);
    if (!els.itemDialog.open) els.itemDialog.showModal();
    setTimeout(() => els.itemName.focus(), 80);
  }

  function closeItemDialog() {
    if (els.itemDialog.open) els.itemDialog.close();
  }

  els.addItemBtn.addEventListener('click', () => openItemDialog());
  els.itemDialogClose.addEventListener('click', closeItemDialog);
  els.itemCancelBtn.addEventListener('click', closeItemDialog);

  els.emojiRow.innerHTML = EMOJIS.map(
    (emoji) => `<button class="emoji-pick" type="button" data-emoji="${emoji}" aria-label="Use ${emoji}">${emoji}</button>`
  ).join('');
  els.emojiRow.addEventListener('click', (event) => {
    const button = event.target.closest('[data-emoji]');
    if (button) els.itemEmoji.value = button.dataset.emoji;
  });

  els.itemForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!els.itemForm.checkValidity()) {
      els.itemForm.reportValidity();
      return;
    }
    const editing = Boolean(state.editingItemId);
    const payload = {
      name: els.itemName.value,
      description: els.itemDescription.value,
      categoryId: els.itemCategory.value,
      price: Number(els.itemPrice.value),
      emoji: els.itemEmoji.value,
      tag: els.itemTag.value,
      available: els.itemAvailable.checked,
    };
    els.itemSaveBtn.disabled = true;
    els.itemSaveBtn.textContent = 'Saving…';
    els.itemError.hidden = true;
    try {
      await api(editing ? `/api/admin/items/${encodeURIComponent(state.editingItemId)}` : '/api/admin/items', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      closeItemDialog();
      await loadMenuData();
      toast(editing ? 'Dish updated.' : 'Dish added to the menu.');
    } catch (err) {
      els.itemError.textContent = err.message || 'Could not save the dish.';
      els.itemError.hidden = false;
    } finally {
      els.itemSaveBtn.disabled = false;
      els.itemSaveBtn.textContent = 'Save dish';
    }
  });

  async function deleteItem(itemId) {
    const item = state.items.find((entry) => entry.id === itemId);
    if (!item) return;
    const confirmed = await askConfirm({
      title: `Delete ${item.name}?`,
      text: 'This removes the dish from the guest menu. Past orders keep their record.',
      okLabel: 'Delete dish',
    });
    if (!confirmed) return;
    try {
      await api(`/api/admin/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
      await loadMenuData();
      toast('Dish removed from the menu.');
    } catch (err) {
      toast(err.message || 'Could not delete the dish.', 'error');
    }
  }

  async function toggleItem(itemId, button) {
    const item = state.items.find((entry) => entry.id === itemId);
    if (!item) return;
    button.disabled = true;
    try {
      const result = await api(`/api/admin/items/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ available: !item.available }),
      });
      Object.assign(item, result.item);
      renderMenuAdmin();
      toast(`${item.name} is now ${item.available ? 'available' : 'sold out'}.`);
    } catch (err) {
      toast(err.message || 'Could not update availability.', 'error');
      renderMenuAdmin();
    }
  }

  els.adminMenuList.addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit-item]');
    const del = event.target.closest('[data-delete-item]');
    const toggle = event.target.closest('[data-toggle-item]');
    if (edit) openItemDialog(edit.dataset.editItem);
    else if (del) deleteItem(del.dataset.deleteItem);
    else if (toggle) toggleItem(toggle.dataset.toggleItem, toggle);
  });

  els.categoryManage.addEventListener('click', (event) => {
    const filter = event.target.closest('[data-cat-filter]');
    const edit = event.target.closest('[data-edit-cat]');
    const del = event.target.closest('[data-delete-cat]');
    if (filter) {
      state.menuCategory = filter.dataset.catFilter;
      renderMenuAdmin();
    } else if (edit) {
      openCategoryDialog(edit.dataset.editCat);
    } else if (del) {
      deleteCategory(del.dataset.deleteCat);
    }
  });

  function openCategoryDialog(categoryId = null) {
    const category = categoryId ? state.categories.find((entry) => entry.id === categoryId) : null;
    state.editingCategoryId = category ? category.id : null;
    els.categoryDialogTitle.textContent = category ? 'Rename category' : 'New category';
    els.categoryName.value = category ? category.name : '';
    els.categoryError.hidden = true;
    els.categoryError.textContent = '';
    if (!els.categoryDialog.open) els.categoryDialog.showModal();
    setTimeout(() => els.categoryName.focus(), 80);
  }

  function closeCategoryDialog() {
    if (els.categoryDialog.open) els.categoryDialog.close();
  }

  els.addCategoryBtn.addEventListener('click', () => openCategoryDialog());
  els.categoryDialogClose.addEventListener('click', closeCategoryDialog);
  els.categoryCancelBtn.addEventListener('click', closeCategoryDialog);

  els.categoryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const editing = Boolean(state.editingCategoryId);
    const name = els.categoryName.value.trim();
    if (!name) {
      els.categoryError.textContent = 'Please enter a category name.';
      els.categoryError.hidden = false;
      return;
    }
    els.categorySaveBtn.disabled = true;
    els.categorySaveBtn.textContent = 'Saving…';
    els.categoryError.hidden = true;
    try {
      const result = await api(
        editing ? `/api/admin/categories/${encodeURIComponent(state.editingCategoryId)}` : '/api/admin/categories',
        {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify({ name }),
        }
      );
      closeCategoryDialog();
      if (!editing && result.category) state.menuCategory = result.category.id;
      await loadMenuData();
      toast(editing ? 'Category renamed.' : 'Category added.');
    } catch (err) {
      els.categoryError.textContent = err.message || 'Could not save the category.';
      els.categoryError.hidden = false;
    } finally {
      els.categorySaveBtn.disabled = false;
      els.categorySaveBtn.textContent = 'Save category';
    }
  });

  async function deleteCategory(categoryId) {
    const category = state.categories.find((entry) => entry.id === categoryId);
    if (!category) return;
    const confirmed = await askConfirm({
      title: `Delete “${category.name}”?`,
      text: 'Categories with dishes cannot be deleted. Move or delete the dishes first.',
      okLabel: 'Delete category',
    });
    if (!confirmed) return;
    try {
      await api(`/api/admin/categories/${encodeURIComponent(categoryId)}`, { method: 'DELETE' });
      if (state.menuCategory === categoryId) state.menuCategory = 'all';
      await loadMenuData();
      toast('Category deleted.');
    } catch (err) {
      toast(err.message || 'Could not delete the category.', 'error');
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Tables & QR                                                      */
  /* ---------------------------------------------------------------- */

  async function loadTables(force = false) {
    if (state.tablesLoading) return;
    if (state.tablesLoaded && !force && state.tablesData) return;
    state.tablesLoading = true;
    els.qrGrid.innerHTML = '<div class="qr-loading"><span class="spinner" aria-hidden="true"></span></div>';
    try {
      const result = await api('/api/admin/tables');
      state.tablesData = result;
      state.tablesLoaded = true;
      renderTables();
    } catch (err) {
      els.qrGrid.innerHTML = `<div class="qr-loading"><p style="font-size:12px;color:var(--muted)">${esc(err.message || 'Could not load QR codes.')}</p></div>`;
    } finally {
      state.tablesLoading = false;
    }
  }

  function renderTables() {
    const data = state.tablesData;
    if (!data) return;
    els.qrBaseUrl.textContent = data.baseUrl;
    const unreachable = /localhost|127\.0\.0\.1/i.test(data.baseUrl);
    if (unreachable) {
      els.qrWarning.hidden = false;
      els.qrWarning.textContent = `These codes point to ${data.baseUrl}, which phones cannot reach. Set PUBLIC_URL to your computer's LAN address (${data.lanUrl}) and restart the server.`;
    } else {
      els.qrWarning.hidden = true;
    }
    els.tableCountLabel.textContent = String(data.tables.length);
    els.qrGrid.innerHTML = data.tables
      .map(
        (table) => `
        <article class="qr-card">
          <div class="qr-card-head"><span>Table</span><strong>${String(table.table).padStart(2, '0')}</strong></div>
          <div class="qr-svg">${table.svg}</div>
          <p class="qr-url" title="${esc(table.url)}">${esc(table.url)}</p>
          <div class="qr-actions">
            <button class="btn btn-ghost btn-sm" type="button" data-copy-url="${esc(table.url)}">Copy link</button>
            <button class="btn btn-ghost btn-sm" type="button" data-download-table="${table.table}">SVG</button>
            <a class="btn btn-ghost btn-sm" href="/menu?table=${table.table}" target="_blank" rel="noopener">Preview</a>
          </div>
        </article>`
      )
      .join('');
  }

  els.refreshTablesBtn.addEventListener('click', () => loadTables(true));

  els.printQrBtn.addEventListener('click', () => {
    const popup = window.open('/api/admin/qr-sheet', '_blank');
    if (!popup) toast('Allow pop-ups for this site to open the printable QR sheet.', 'error');
  });

  els.copyBaseBtn.addEventListener('click', async () => {
    if (!state.tablesData) return;
    const copied = await copyText(state.tablesData.baseUrl);
    toast(copied ? 'Base address copied.' : 'Could not copy the address.', copied ? '' : 'error');
  });

  els.qrGrid.addEventListener('click', async (event) => {
    const copy = event.target.closest('[data-copy-url]');
    const download = event.target.closest('[data-download-table]');
    if (copy) {
      const copied = await copyText(copy.dataset.copyUrl);
      toast(copied ? 'Menu link copied.' : 'Could not copy the link.', copied ? '' : 'error');
      return;
    }
    if (download && state.tablesData) {
      const table = state.tablesData.tables.find((entry) => entry.table === Number(download.dataset.downloadTable));
      if (!table) return;
      const blob = new Blob([table.svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `table-${table.table}-qr.svg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast(`QR code for table ${table.table} downloaded.`);
    }
  });

  /* ---------------------------------------------------------------- */
  /*  Confirm dialog                                                   */
  /* ---------------------------------------------------------------- */

  function finishConfirm(value) {
    if (!els.confirmDialog.open) return;
    const resolve = state.confirmResolve;
    state.confirmResolve = null;
    els.confirmDialog.close();
    if (resolve) resolve(value);
  }

  function askConfirm({ title, text, okLabel = 'Confirm' }) {
    if (state.confirmResolve) {
      state.confirmResolve(false);
      state.confirmResolve = null;
    }
    els.confirmTitle.textContent = title;
    els.confirmText.textContent = text;
    els.confirmOk.textContent = okLabel;
    if (!els.confirmDialog.open) els.confirmDialog.showModal();
    setTimeout(() => els.confirmCancel.focus(), 60);
    return new Promise((resolve) => {
      state.confirmResolve = resolve;
    });
  }

  els.confirmOk.addEventListener('click', () => finishConfirm(true));
  els.confirmCancel.addEventListener('click', () => finishConfirm(false));
  els.confirmDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    finishConfirm(false);
  });
  els.confirmDialog.addEventListener('close', () => {
    if (state.confirmResolve) {
      const resolve = state.confirmResolve;
      state.confirmResolve = null;
      resolve(false);
    }
  });

  /* ---------------------------------------------------------------- */
  /*  Misc                                                             */
  /* ---------------------------------------------------------------- */

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.authenticated) loadOrders();
  });

  window.addEventListener('hashchange', () => {
    if (!state.authenticated) return;
    const hash = window.location.hash.replace('#', '');
    if (TABS.includes(hash)) setTab(hash);
  });

  try {
    state.sound = localStorage.getItem('copper-admin-sound') !== 'off';
  } catch {
    state.sound = true;
  }
  updateSoundButton();

  checkSession();
})();
