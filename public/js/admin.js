// Staff Dashboard JS
(function() {
  'use strict';

  let currentTab = 'orders';
  let ordersFilter = 'all';
  let ordersList = [];
  let menuCategories = [];
  let menuItems = [];
  let billsList = [];
  let eligibleBillOrders = [];
  let availableBillItems = [];
  let selectedBillId = null;
  let knownOrderIds = new Set();
  let ordersInitialized = false;   // true after first successful fetch seeds the known set
  let requestsInitialized = false; // true after first successful fetch seeds the known set
  let pollTimer = null;
  let audioEnabled = true;

  // Web Audio Warm Bell Chime (iPhone-style resonant two-tone bell)
  let audioCtx = null;

  function unlockAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      if (!audioCtx) audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      return audioCtx;
    } catch (e) {
      return null;
    }
  }

  // Auto-unlock audio on any page interaction
  ['click', 'touchstart', 'keydown'].forEach(evt => {
    document.addEventListener(evt, () => unlockAudio(), { once: true, passive: true });
  });

  // Vibrate the device (mobile-friendly) — pattern: 200ms on, 100ms off, 200ms on
  function vibrateDevice() {
    try {
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch (e) { /* vibration not supported */ }
  }

  function notifyNewAlert() {
    playKitchenChime();
    vibrateDevice();
  }

  function playKitchenChime() {
    if (!audioEnabled) return;
    const ctx = unlockAudio();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Master lowpass filter to keep sound warm, soft and pleasant (never screechy)
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.connect(ctx.destination);

      // Note 1: Warm C5 bell (523.25 Hz)
      playBellNote(ctx, filter, 523.25, now, 0.28, 0.7);

      // Note 2: Melodic E5 bell (659.25 Hz) - classic two-tone chime
      playBellNote(ctx, filter, 659.25, now + 0.16, 0.32, 0.85);
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }

  function playBellNote(ctx, dest, freq, startTime, volume, duration) {
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, startTime);
    gain1.gain.setValueAtTime(0.0001, startTime);
    gain1.gain.exponentialRampToValueAtTime(volume, startTime + 0.008);
    gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc1.connect(gain1);
    gain1.connect(dest);
    osc1.start(startTime);
    osc1.stop(startTime + duration + 0.05);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.02, startTime);
    gain2.gain.setValueAtTime(0.0001, startTime);
    gain2.gain.exponentialRampToValueAtTime(volume * 0.35, startTime + 0.005);
    gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + (duration * 0.6));
    osc2.connect(gain2);
    gain2.connect(dest);
    osc2.start(startTime);
    osc2.stop(startTime + duration);
  }

  // DOM Elements
  const loginModal = document.getElementById('loginModal');
  const loginForm = document.getElementById('loginForm');
  const pinInput = document.getElementById('pinInput');
  const logoutBtn = document.getElementById('logoutBtn');
  const orderingState = document.getElementById('orderingState');
  const orderingToggleBtn = document.getElementById('orderingToggleBtn');
  const chimeToggleBtn = document.getElementById('chimeToggleBtn');
  const chimeIcon = document.getElementById('chimeIcon');
  const chimeLabel = document.getElementById('chimeLabel');
  const newOrdersCount = document.getElementById('newOrdersCount');
  const requestsCount = document.getElementById('requestsCount');
  const serviceAlertsBar = document.getElementById('serviceAlertsBar');
  const requestsContainer = document.getElementById('requestsContainer');
  const refreshRequestsBtn = document.getElementById('refreshRequestsBtn');
  const toastContainer = document.getElementById('toastContainer');

  let serviceRequestsList = [];
  let knownRequestIds = new Set();
  let guestOrderingOpen = true;

  function renderOrderingStatus() {
    orderingState.textContent = guestOrderingOpen ? 'Guest ordering is open' : 'Guest ordering is closed';
    orderingState.classList.toggle('is-closed', !guestOrderingOpen);
    orderingToggleBtn.textContent = guestOrderingOpen ? 'Close ordering' : 'Open ordering';
    orderingToggleBtn.disabled = false;
  }

  // Tabs
  const navItems = document.querySelectorAll('.admin-nav-item');
  const tabPanes = {
    orders: document.getElementById('tab-orders'),
    billing: document.getElementById('tab-billing'),
    requests: document.getElementById('tab-requests'),
    menu: document.getElementById('tab-menu'),
    tables: document.getElementById('tab-tables'),
    settings: document.getElementById('tab-settings'),
  };

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-action]') : null;
    if (!target) return;
    const { action, orderId, status, handoff, requestId, categoryId, categoryName, itemId, url, table } = target.dataset;
    switch (action) {
      case 'update-order-status':
        window.updateOrderStatus(orderId, status, handoff);
        break;
      case 'create-table-bill':
        createTableBill(Number(table));
        break;
      case 'select-bill':
        selectedBillId = target.dataset.billId;
        renderBilling();
        break;
      case 'update-bill-quantity': {
        const row = target.closest('.billing-item-row');
        const quantity = row && row.querySelector('[data-bill-quantity]');
        if (quantity) updateBillQuantity(target.dataset.lineId, Number(quantity.value));
        break;
      }
      case 'finalize-bill':
        finalizeBill(target.dataset.billId);
        break;
      case 'void-bill':
        voidBill(target.dataset.billId);
        break;
      case 'print-bill':
        window.print();
        break;
      case 'resolve-service-request':
        window.resolveServiceRequest(requestId);
        break;
      case 'edit-category':
        window.editCategory(categoryId, categoryName);
        break;
      case 'delete-category':
        window.deleteCategory(categoryId);
        break;
      case 'edit-item':
        window.editItem(itemId);
        break;
      case 'delete-item':
        window.deleteItem(itemId);
        break;
      case 'copy-qr-link':
        window.copyQrLink(url);
        break;
      case 'download-qr-svg':
        window.downloadQrSvg(Number(table));
        break;
    }
  });

  document.addEventListener('change', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-action="toggle-item-stock"]') : null;
    if (target) window.toggleItemStock(target.dataset.itemId, target.checked);
  });

  // Authentication check
  async function checkSession() {
    try {
      const res = await fetch('/api/admin/session');
      if (res.ok) {
        loginModal.classList.remove('active');
        initDashboard();
      } else {
        loginModal.classList.add('active');
        pinInput.focus();
      }
    } catch {
      loginModal.classList.add('active');
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = pinInput.value.trim();
    if (!pin) return;

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Incorrect PIN.');

      showToast('Welcome back, staff member!', 'success');
      loginModal.classList.remove('active');
      pinInput.value = '';
      initDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    if (pollTimer) clearInterval(pollTimer);
    loginModal.classList.add('active');
    showToast('Signed out successfully.');
  });

  orderingToggleBtn.addEventListener('click', async () => {
    orderingToggleBtn.disabled = true;
    try {
      const res = await fetch('/api/admin/ordering-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderingOpen: !guestOrderingOpen })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not change guest ordering status.');
      guestOrderingOpen = data.orderingOpen;
      renderOrderingStatus();
      showToast(guestOrderingOpen ? 'Guest ordering is open.' : 'Guest ordering is closed.', 'success');
    } catch (err) {
      orderingToggleBtn.disabled = false;
      showToast(err.message, 'error');
    }
  });

  // Sound chime toggle
  chimeToggleBtn.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    if (audioEnabled) {
      chimeIcon.textContent = '🔔';
      chimeLabel.textContent = 'Sound Alert: ON';
      chimeToggleBtn.classList.remove('muted');
      notifyNewAlert();
    } else {
      chimeIcon.textContent = '🔕';
      chimeLabel.textContent = 'Sound Alert: OFF';
      chimeToggleBtn.classList.add('muted');
    }
  });

  const testSoundBtn = document.getElementById('testSoundBtn');
  if (testSoundBtn) {
    testSoundBtn.addEventListener('click', () => {
      unlockAudio();
      playKitchenChime();
      showToast('🔔 Testing bell alert chime...', 'info');
    });
  }

  // Tab switching
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.dataset.tab;
      switchTab(tab);
    });
  });

  function switchTab(tab) {
    currentTab = tab;
    navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tab);
    });
    Object.keys(tabPanes).forEach(k => {
      if (tabPanes[k]) tabPanes[k].style.display = k === tab ? 'block' : 'none';
    });

    if (tab === 'orders') { fetchOrders(); fetchServiceRequests(); }
    if (tab === 'billing') loadBills();
    if (tab === 'requests') fetchServiceRequests();
    if (tab === 'menu') loadMenuData();
    if (tab === 'tables') loadTables();
    if (tab === 'settings') loadSettings();
  }

  function initDashboard() {
    loadSettings();
    switchTab('orders');
    fetchServiceRequests();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      fetchOrders(true);
      fetchServiceRequests(true);
    }, 3500);
  }

  if (refreshRequestsBtn) {
    refreshRequestsBtn.addEventListener('click', () => fetchServiceRequests());
  }

  /* ------------------------------------------------------------- */
  /*  Tab 1: Orders                                                */
  /* ------------------------------------------------------------- */

  const ordersContainer = document.getElementById('ordersContainer');
  const refreshOrdersBtn = document.getElementById('refreshOrdersBtn');
  const filterPills = document.querySelectorAll('.filter-pill');

  refreshOrdersBtn.addEventListener('click', () => fetchOrders());

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => {
        p.classList.remove('active', 'btn-dark');
        p.classList.add('btn-outline');
      });
      pill.classList.add('active', 'btn-dark');
      pill.classList.remove('btn-outline');
      ordersFilter = pill.dataset.filter;
      renderOrders();
    });
  });

  async function fetchOrders(isPolling = false) {
    try {
      const res = await fetch('/api/admin/orders');
      if (res.status === 401) {
        loginModal.classList.add('active');
        return;
      }
      const data = await res.json();
      const newOrders = data.orders || [];

      // Check for incoming new orders to sound the bell chime
      // ordersInitialized: skip ringing on the very first fetch (seeding phase),
      // but ring for ANY new order on every subsequent poll — including the first order ever.
      if (isPolling && ordersInitialized) {
        let hasNewIncoming = false;
        for (const order of newOrders) {
          if (!knownOrderIds.has(order.id) && order.status === 'new') {
            hasNewIncoming = true;
            break;
          }
        }
        if (hasNewIncoming) {
          notifyNewAlert();
          showToast('🔔 New table order received!', 'success');
        }
      }

      knownOrderIds = new Set(newOrders.map(o => o.id));
      ordersInitialized = true;
      ordersList = newOrders;

      // Update badge counter
      const newCount = ordersList.filter(o => o.status === 'new').length;
      if (newCount > 0) {
        newOrdersCount.textContent = newCount;
        newOrdersCount.style.display = 'inline-block';
      } else {
        newOrdersCount.style.display = 'none';
      }

      renderOrders();
    } catch (err) {
      if (!isPolling) ordersContainer.innerHTML = `<div style="text-align:center; color:var(--red); padding:30px;">${escapeHtml(err.message)}</div>`;
    }
  }

  function renderOrders() {
    const filtered = ordersList.filter(o => {
      if (ordersFilter === 'all') return true;
      return o.status === ordersFilter;
    });

    if (filtered.length === 0) {
      ordersContainer.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--muted);">
          <div style="font-size: 38px; margin-bottom: 10px;">📋</div>
          <p style="font-size: 16px; font-weight: 600;">No ${ordersFilter === 'all' ? '' : ordersFilter} orders</p>
          <p style="font-size: 13.5px; margin-top: 4px;">Orders placed by guests at tables will appear here live.</p>
        </div>
      `;
      return;
    }

    ordersContainer.innerHTML = '';

    for (const order of filtered) {
      const card = document.createElement('article');
      card.className = `order-card ${order.status === 'new' ? 'new-pulse' : ''}`;

      const itemsHtml = order.items.map(i => `
        <li>
          <span><span class="order-qty-pill">${i.qty}&times;</span>${escapeHtml(i.name)}</span>
          <span style="font-weight: 600;">₹${(i.price * i.qty).toFixed(2)}</span>
        </li>
      `).join('');

      const noteHtml = order.note ? `
        <div class="order-note-box">
          <strong>Note:</strong> ${escapeHtml(order.note)}
        </div>
      ` : '';
      const handoffNoteHtml = order.status === 'ready' && order.handoff === 'pickup'
        ? '<p style="font-size: 12.5px; color: var(--muted); margin: 10px 0;">The guest tracking page now asks them to collect at the counter. Call or announce the order if they are not watching it.</p>'
        : '';

      const timeAgo = formatElapsed(order.createdAt);

      let actionButtons = '';
      if (order.status === 'new') {
        actionButtons = `
          <button class="btn btn-outline btn-sm btn-danger" data-action="update-order-status" data-order-id="${order.id}" data-status="cancelled">Cancel</button>
          <button class="btn btn-primary btn-sm" data-action="update-order-status" data-order-id="${order.id}" data-status="preparing">🍳 Start Cooking</button>
        `;
      } else if (order.status === 'preparing') {
        actionButtons = `
          <button class="btn btn-outline btn-sm btn-danger" data-action="update-order-status" data-order-id="${order.id}" data-status="cancelled">Cancel</button>
          <button class="btn btn-primary btn-sm" data-action="update-order-status" data-order-id="${order.id}" data-status="ready" style="background: var(--amber);">🔔 Mark Ready</button>
        `;
      } else if (order.status === 'ready') {
        actionButtons = order.handoff === 'pickup'
          ? `<button class="btn btn-primary btn-sm" data-action="update-order-status" data-order-id="${order.id}" data-status="completed" data-handoff="pickup" style="background: var(--green);">✅ Mark Collected</button>`
          : `
            <button class="btn btn-primary btn-sm" data-action="update-order-status" data-order-id="${order.id}" data-status="completed" data-handoff="table" style="background: var(--green);">🍽️ Serve at Table</button>
            <button class="btn btn-outline btn-sm" data-action="update-order-status" data-order-id="${order.id}" data-status="ready" data-handoff="pickup">📣 Ask Guest to Collect</button>
          `;
      } else {
        actionButtons = `
          <span style="font-size: 12.5px; color: var(--muted); text-transform: capitalize;">${order.status}</span>
        `;
      }

      card.innerHTML = `
        <div class="order-card-header">
          <div>
            <div class="order-table-num">Table ${order.table}</div>
            <div class="order-code">Order #${escapeHtml(order.code)}</div>
            <div class="order-time">${timeAgo}</div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
            <span class="badge badge-status status-${order.status}">${order.status}</span>
            ${order.handoff === 'pickup' ? '<span class="badge">Guest pickup</span>' : order.handoff === 'table' ? '<span class="badge">Table service</span>' : ''}
          </div>
        </div>

        <ul class="order-items-list">${itemsHtml}</ul>
        ${noteHtml}
        ${handoffNoteHtml}

        <div class="order-card-footer">
          <span class="order-total-amount">Total: ₹${Number(order.total).toFixed(2)}</span>
          <div class="order-actions" style="display: flex; align-items: center; gap: 8px;">
            ${actionButtons}
          </div>
        </div>
      `;

      ordersContainer.appendChild(card);
    }
  }

  /* ------------------------------------------------------------- */
  /*  Service Requests Functions (Call Waiter)                     */
  /* ------------------------------------------------------------- */

  async function fetchServiceRequests(isPolling = false) {
    try {
      const res = await fetch('/api/admin/service-requests');
      if (!res.ok) return;
      const data = await res.json();
      const requests = data.serviceRequests || [];

      if (isPolling && requestsInitialized) {
        let hasNewPending = false;
        for (const req of requests) {
          if (!knownRequestIds.has(req.id) && req.status === 'pending') {
            hasNewPending = true;
            break;
          }
        }
        if (hasNewPending) {
          notifyNewAlert();
          showToast('🛎️ New table service request!', 'info');
        }
      }

      knownRequestIds = new Set(requests.map(r => r.id));
      requestsInitialized = true;
      serviceRequestsList = requests;

      const pendingCount = requests.filter(r => r.status === 'pending').length;
      if (requestsCount) {
        if (pendingCount > 0) {
          requestsCount.textContent = pendingCount;
          requestsCount.style.display = 'inline-block';
        } else {
          requestsCount.style.display = 'none';
        }
      }

      renderServiceAlertsBar();
      if (currentTab === 'requests') renderServiceRequests();
    } catch (e) {
      console.warn('Error fetching service requests:', e);
    }
  }

  function renderServiceAlertsBar() {
    if (!serviceAlertsBar) return;
    const pending = serviceRequestsList.filter(r => r.status === 'pending');
    if (pending.length === 0) {
      serviceAlertsBar.style.display = 'none';
      serviceAlertsBar.innerHTML = '';
      return;
    }

    const typeIcons = { water: '💧', cutlery: '🍴', bill: '🧾', waiter: '🙋', clean: '🧹', other: '💬' };
    serviceAlertsBar.style.display = 'flex';
    serviceAlertsBar.innerHTML = pending.map(req => `
      <div class="service-alert-item">
        <div class="alert-left">
          <span class="alert-icon">${typeIcons[req.type] || '🛎️'}</span>
          <span class="alert-table-badge">TABLE ${req.table}</span>
          <span class="alert-text">Request: <strong>${escapeHtml(req.type.toUpperCase())}</strong> ${req.note ? '— "' + escapeHtml(req.note) + '"' : ''}</span>
          <span class="alert-time">(${formatElapsed(req.createdAt)})</span>
        </div>
        <div class="alert-actions">
          <button class="btn btn-primary btn-sm" data-action="resolve-service-request" data-request-id="${escapeHtml(req.id)}" style="background: var(--green);">✅ Mark Resolved</button>
        </div>
      </div>
    `).join('');
  }

  function renderServiceRequests() {
    if (!requestsContainer) return;
    if (serviceRequestsList.length === 0) {
      requestsContainer.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--muted);">
          <div style="font-size: 38px; margin-bottom: 10px;">🛎️</div>
          <p style="font-size: 16px; font-weight: 600;">No table service requests</p>
          <p style="font-size: 13.5px; margin-top: 4px;">Diner requests for water, cutlery, or bills will appear here live.</p>
        </div>
      `;
      return;
    }

    const typeIcons = { water: '💧', cutlery: '🍴', bill: '🧾', waiter: '🙋', clean: '🧹', other: '💬' };
    requestsContainer.innerHTML = serviceRequestsList.map(req => {
      const isPending = req.status === 'pending';
      return `
        <article class="request-card ${isPending ? 'pending' : 'resolved'}">
          <div class="request-card-header">
            <div>
              <div class="order-table-num">Table ${req.table}</div>
              <div class="request-type-label">
                <span>${typeIcons[req.type] || '🛎️'}</span>
                <span>${escapeHtml(req.type.toUpperCase())}</span>
              </div>
            </div>
            <span class="badge ${isPending ? 'badge-pending-pay' : 'badge-paid'}">${isPending ? 'PENDING' : 'RESOLVED'}</span>
          </div>

          ${req.note ? `<div class="request-note-box"><strong>Note:</strong> ${escapeHtml(req.note)}</div>` : ''}

          <div style="font-size: 12px; color: var(--muted);">
            Requested: ${formatElapsed(req.createdAt)}
            ${req.resolvedAt ? `&bull; Resolved: ${formatElapsed(req.resolvedAt)}` : ''}
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
            ${isPending ? `
              <button class="btn btn-primary btn-sm" data-action="resolve-service-request" data-request-id="${escapeHtml(req.id)}" style="background: var(--green);">
                ✅ Resolve Request
              </button>
            ` : `<span style="font-size: 12.5px; color: var(--green); font-weight: 600;">✓ Completed</span>`}
          </div>
        </article>
      `;
    }).join('');
  }

  window.resolveServiceRequest = async function(id) {
    try {
      const res = await fetch(`/api/admin/service-requests/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resolve request.');
      showToast('Table service request resolved.', 'success');
      fetchServiceRequests();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.updateOrderStatus = async function(orderId, nextStatus, handoff) {
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, handoff })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update order status.');
      const message = handoff === 'table'
        ? `Order #${data.order.code} served at the table.`
        : handoff === 'pickup' && nextStatus === 'ready'
        ? `Order #${data.order.code} is ready for guest pickup.`
        : handoff === 'pickup'
        ? `Order #${data.order.code} marked collected.`
        : `Order #${data.order.code} updated to ${nextStatus}.`;
      showToast(message, 'success');
      fetchOrders();
      if (currentTab === 'billing') loadBills();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  /* ------------------------------------------------------------- */
  /*  Table billing                                                */
  /* ------------------------------------------------------------- */

  const unbilledTables = document.getElementById('unbilledTables');
  const billsHistory = document.getElementById('billsHistory');
  const billPrintArea = document.getElementById('billPrintArea');
  const refreshBillsBtn = document.getElementById('refreshBillsBtn');

  if (refreshBillsBtn) refreshBillsBtn.addEventListener('click', () => loadBills());

  async function loadBills() {
    try {
      const res = await fetch('/api/admin/bills');
      if (res.status === 401) {
        loginModal.classList.add('active');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load bills.');
      billsList = data.bills || [];
      eligibleBillOrders = data.eligibleOrders || [];
      availableBillItems = data.availableItems || [];
      window.billingCurrency = (data.settings && data.settings.currency) || '₹';
      if (selectedBillId && !billsList.some((bill) => bill.id === selectedBillId)) selectedBillId = null;
      renderBilling();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function renderBilling() {
    if (!unbilledTables || !billsHistory || !billPrintArea) return;
    const ordersByTable = new Map();
    eligibleBillOrders.forEach((order) => {
      if (!ordersByTable.has(order.table)) ordersByTable.set(order.table, []);
      ordersByTable.get(order.table).push(order);
    });

    if (ordersByTable.size === 0) {
      unbilledTables.innerHTML = '<div class="billing-empty">Completed, unbilled orders will appear here.</div>';
    } else {
      unbilledTables.innerHTML = `
        <label class="form-group">
        <span class="form-label">Staff name for bill creation</span>
          <input class="form-input" id="billingCreateStaff" maxlength="60" autocomplete="name" placeholder="Enter your name" required>
        </label>
        ${Array.from(ordersByTable.entries()).sort((a, b) => a[0] - b[0]).map(([table, orders]) => {
          const subtotal = orders.reduce((sum, order) => sum + Number(order.total), 0);
          const codes = orders.map((order) => `#${escapeHtml(order.code)}`).join(', ');
          return `
            <div class="billing-queue-item">
              <strong>Table ${table}</strong>
              <button class="btn btn-primary btn-sm" type="button" data-action="create-table-bill" data-table="${table}">Prepare bill</button>
              <span class="billing-queue-detail">${orders.length} completed ${orders.length === 1 ? 'order' : 'orders'} · ${escapeHtml(window.billingCurrency || '₹')}${subtotal.toFixed(2)}</span>
              <span class="billing-queue-detail">${codes}</span>
            </div>
          `;
        }).join('')}
      `;
    }

    if (billsList.length === 0) {
      billsHistory.innerHTML = '<div class="billing-empty">Bills you prepare will be listed here.</div>';
    } else {
      billsHistory.innerHTML = billsList.map((bill) => `
        <button class="billing-history-item ${bill.id === selectedBillId ? 'is-selected' : ''}" type="button" data-action="select-bill" data-bill-id="${escapeHtml(bill.id)}" aria-pressed="${bill.id === selectedBillId}">
          <span>
            <strong>${escapeHtml(bill.code)} · Table ${bill.table}</strong><br>
            <span class="billing-history-meta">${escapeHtml((bill.orderCodes || []).map((code) => `#${code}`).join(', '))}</span>
          </span>
          <span>
            <span class="billing-state ${bill.status === 'finalized' ? 'is-finalized' : bill.status === 'void' ? 'is-void' : ''}">${escapeHtml(bill.status)}</span><br>
            <strong>${escapeHtml(bill.currency)}${Number(bill.total).toFixed(2)}</strong>
          </span>
        </button>
      `).join('');
    }

    const selectedBill = billsList.find((bill) => bill.id === selectedBillId);
    if (!selectedBill) {
      billPrintArea.innerHTML = '<div class="billing-empty">Select a table or bill to review its itemized total.</div>';
      return;
    }
    renderBillDetail(selectedBill);
  }

  async function createTableBill(table) {
    const staffName = document.getElementById('billingCreateStaff');
    if (!staffName || !staffName.value.trim()) {
      showToast('Enter the staff member’s name before preparing a bill.', 'error');
      if (staffName) staffName.focus();
      return;
    }
    try {
      const res = await fetch('/api/admin/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, staffName: staffName.value.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not prepare this bill.');
      selectedBillId = data.bill.id;
      showToast(`${data.bill.code} prepared from completed orders.`, 'success');
      await loadBills();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function renderBillDetail(bill) {
    const editable = bill.status === 'draft';
    const currency = escapeHtml(bill.currency || '₹');
    const activeItems = bill.items.filter((item) => item.qty > 0);
    const itemRows = bill.items.filter((item) => editable || item.qty > 0).map((item) => `
      <tr class="billing-item-row ${item.qty === 0 ? 'is-void' : ''}">
        <td>
          ${escapeHtml(item.name)}
          <div class="billing-muted">${item.manual ? 'Added during billing' : `Order #${escapeHtml(item.orderCode)}`}</div>
        </td>
        <td class="bill-number">${currency}${Number(item.price).toFixed(2)}</td>
        <td class="bill-number">
          ${editable
            ? `<input type="number" min="0" max="20" step="1" value="${item.qty}" data-bill-quantity aria-label="Quantity of ${escapeHtml(item.name)}">`
            : `<span>${item.qty}</span>`}
          ${item.qty === 0 ? '<div class="billing-muted">Removed</div>' : ''}
        </td>
        <td class="bill-number bill-line-total">${currency}${(Number(item.price) * item.qty).toFixed(2)}</td>
        ${editable ? `<td class="billing-no-print"><button class="btn btn-outline btn-sm" type="button" data-action="update-bill-quantity" data-line-id="${escapeHtml(item.id)}">Save qty</button></td>` : ''}
      </tr>
    `).join('');
    const auditRows = (bill.adjustments || []).slice().reverse().map((entry) => {
      const action = entry.type === 'quantity_changed'
        ? `${escapeHtml(entry.itemName)} quantity ${entry.before} → ${entry.after}`
        : entry.type === 'item_added'
        ? `Added ${escapeHtml(entry.quantity)} × ${escapeHtml(entry.itemName)}`
        : entry.type === 'bill_created'
        ? `Bill created from orders ${(entry.orderCodes || []).map((code) => `#${escapeHtml(code)}`).join(', ')}`
        : entry.type === 'bill_voided'
        ? 'Draft bill voided'
        : 'Bill finalized';
      return `<li><strong>${escapeHtml(entry.staffName)} · ${new Date(entry.at).toLocaleString()}</strong><span>${action}${entry.reason ? ` — ${escapeHtml(entry.reason)}` : ''}</span></li>`;
    }).join('');

    billPrintArea.innerHTML = `
      <div class="billing-detail-header">
        <div>
          <h3>${escapeHtml(bill.restaurantName)}</h3>
          <div class="billing-muted">${escapeHtml(bill.outletName || '')}</div>
          <p class="billing-muted">Bill ${escapeHtml(bill.code)} · Table ${bill.table}</p>
          <p class="billing-muted">Issued: ${new Date(bill.finalizedAt || bill.createdAt).toLocaleString()}</p>
        </div>
        <div class="billing-no-print" style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
          <span class="billing-state ${bill.status === 'finalized' ? 'is-finalized' : bill.status === 'void' ? 'is-void' : ''}">${escapeHtml(bill.status)}</span>
          ${bill.status === 'finalized'
            ? '<button class="btn btn-outline btn-sm" type="button" data-action="print-bill">Print bill</button>'
            : '<span class="billing-muted">Finalize to print</span>'}
        </div>
      </div>
      <p class="billing-muted">Orders included: ${(bill.orderCodes || []).map((code) => `#${escapeHtml(code)}`).join(', ')}</p>
      <div class="billing-table-wrap">
      <table class="billing-items">
        <thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Amount</th>${editable ? '<th class="billing-no-print">Action</th>' : ''}</tr></thead>
        <tbody>${itemRows || '<tr><td colspan="5">No bill items.</td></tr>'}</tbody>
      </table>
      </div>
      <div class="billing-totals">
        <div class="billing-total-row"><span>Item subtotal</span><strong>${currency}${Number(bill.subtotal).toFixed(2)}</strong></div>
        <div class="billing-total-row"><span>Service charge (${Number(bill.serviceChargeRate).toFixed(2)}%)</span><span>${currency}${Number(bill.serviceCharge).toFixed(2)}</span></div>
        <div class="billing-total-row"><span>Tax (${Number(bill.taxRate).toFixed(2)}%)</span><span>${currency}${Number(bill.tax).toFixed(2)}</span></div>
        <div class="billing-total-row is-grand-total"><span>Total</span><strong>${currency}${Number(bill.total).toFixed(2)}</strong></div>
      </div>
      ${editable ? `
        <form class="billing-adjustment-form billing-no-print" id="addBillItemForm">
          <div class="form-group billing-wide-field">
            <label class="form-label" for="billStaffName">Staff name</label>
            <input class="form-input" id="billStaffName" maxlength="60" autocomplete="name" required>
          </div>
          <div class="form-group billing-wide-field">
            <label class="form-label" for="billAdjustmentReason">Reason for each correction or added item</label>
            <input class="form-input" id="billAdjustmentReason" maxlength="240" required placeholder="For example: one portion was not served">
          </div>
          <div class="form-group">
            <label class="form-label" for="billAddItem">Add menu item</label>
            <select class="form-input" id="billAddItem" required>
              <option value="">Choose an available item</option>
              ${availableBillItems.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${currency}${Number(item.price).toFixed(2)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="billAddQuantity">Quantity</label>
            <input class="form-input" id="billAddQuantity" type="number" min="1" max="20" step="1" value="1" required>
          </div>
          <button class="btn btn-outline billing-wide-field" type="submit">Add item with audit note</button>
        </form>
        <div class="billing-no-print" style="display:flex; justify-content:flex-end; margin-top:16px;">
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-outline" type="button" data-action="void-bill" data-bill-id="${escapeHtml(bill.id)}">Void draft</button>
            <button class="btn btn-primary" type="button" data-action="finalize-bill" data-bill-id="${escapeHtml(bill.id)}" ${activeItems.length ? '' : 'disabled'}>Finalize bill</button>
          </div>
        </div>
        <p class="billing-notice billing-no-print">Finalizing locks this bill and its totals. Corrections can no longer be made.</p>
      ` : bill.status === 'finalized' ? `
        <p class="billing-muted billing-no-print">Finalized by ${escapeHtml(bill.finalizedBy || '')} on ${new Date(bill.finalizedAt).toLocaleString()}.</p>
      ` : `
        <p class="billing-muted billing-no-print">Voided by ${escapeHtml(bill.voidedBy || '')} on ${new Date(bill.voidedAt).toLocaleString()}.</p>
      `}
      <h4 class="billing-no-print" style="margin:20px 0 0;">Audit history</h4>
      <ul class="billing-audit billing-no-print">${auditRows || '<li>No changes recorded.</li>'}</ul>
      <p class="billing-notice billing-no-print">This itemized bill records charges only; it does not collect or record payment. Tax is calculated on the item subtotal. Confirm rates and tax treatment for your location.</p>
    `;

    const addBillItemForm = document.getElementById('addBillItemForm');
    if (addBillItemForm) {
      addBillItemForm.addEventListener('submit', (event) => {
        event.preventDefault();
        addBillItem(bill.id);
      });
    }
  }

  function billAdjustmentCredentials() {
    const staffName = document.getElementById('billStaffName');
    const reason = document.getElementById('billAdjustmentReason');
    if (!staffName || !staffName.value.trim()) throw new Error('Enter the staff member’s name.');
    if (!reason || !reason.value.trim()) throw new Error('Enter a reason for this bill adjustment.');
    return { staffName: staffName.value.trim(), reason: reason.value.trim() };
  }

  async function updateBillQuantity(lineId, quantity) {
    try {
      const credentials = billAdjustmentCredentials();
      const res = await fetch(`/api/admin/bills/${encodeURIComponent(selectedBillId)}/adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credentials, action: 'set-quantity', lineId, quantity })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update this bill item.');
      await loadBills();
      showToast('Quantity correction recorded in the bill audit.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function addBillItem(billId) {
    try {
      const credentials = billAdjustmentCredentials();
      const res = await fetch(`/api/admin/bills/${encodeURIComponent(billId)}/adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...credentials,
          action: 'add-item',
          itemId: document.getElementById('billAddItem').value,
          quantity: Number(document.getElementById('billAddQuantity').value)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add this bill item.');
      await loadBills();
      showToast('Added item and reason saved to the bill audit.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function finalizeBill(billId) {
    if (!confirm('Finalize this bill? It will be locked against further changes.')) return;
    const staffName = document.getElementById('billStaffName');
    if (!staffName || !staffName.value.trim()) {
      showToast('Enter the staff member’s name before finalizing.', 'error');
      if (staffName) staffName.focus();
      return;
    }
    try {
      const res = await fetch(`/api/admin/bills/${encodeURIComponent(billId)}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffName: staffName.value.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not finalize this bill.');
      await loadBills();
      showToast(`${data.bill.code} finalized and locked.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function voidBill(billId) {
    if (!confirm('Void this draft bill? Its orders will become available for a new bill.')) return;
    try {
      const credentials = billAdjustmentCredentials();
      const res = await fetch(`/api/admin/bills/${encodeURIComponent(billId)}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not void this draft bill.');
      await loadBills();
      showToast(`${data.bill.code} voided; its orders are ready for a new bill.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  /* ------------------------------------------------------------- */
  /*  Tab 2: Menu Management                                       */
  /* ------------------------------------------------------------- */

  const menuCategoriesContainer = document.getElementById('menuCategoriesContainer');
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  const addItemBtn = document.getElementById('addItemBtn');

  // Item Modal
  const itemModal = document.getElementById('itemModal');
  const closeItemModal = document.getElementById('closeItemModal');
  const itemForm = document.getElementById('itemForm');
  const itemModalTitle = document.getElementById('itemModalTitle');
  const itemIdInput = document.getElementById('itemId');
  const itemNameInput = document.getElementById('itemName');
  const itemCategoryInput = document.getElementById('itemCategory');
  const itemPriceInput = document.getElementById('itemPrice');
  const itemEmojiInput = document.getElementById('itemEmoji');
  const itemTagInput = document.getElementById('itemTag');
  const itemDietaryInput = document.getElementById('itemDietary');
  const itemDescInput = document.getElementById('itemDesc');
  const itemAvailableInput = document.getElementById('itemAvailable');

  // Category Modal
  const categoryModal = document.getElementById('categoryModal');
  const closeCategoryModal = document.getElementById('closeCategoryModal');
  const categoryForm = document.getElementById('categoryForm');
  const categoryModalTitle = document.getElementById('categoryModalTitle');
  const categoryIdInput = document.getElementById('categoryId');
  const categoryNameInput = document.getElementById('categoryName');

  async function loadMenuData() {
    try {
      const res = await fetch('/api/admin/menu');
      if (!res.ok) throw new Error('Could not load menu.');
      const data = await res.json();
      menuCategories = data.categories || [];
      menuItems = data.items || [];
      renderMenuManagement();
    } catch (err) {
      menuCategoriesContainer.innerHTML = `<div style="text-align:center; color:var(--red); padding:30px;">${escapeHtml(err.message)}</div>`;
    }
  }

  function renderMenuManagement() {
    menuCategoriesContainer.innerHTML = '';

    // Populate category dropdown in Item Modal
    itemCategoryInput.innerHTML = '';
    for (const cat of menuCategories) {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      itemCategoryInput.appendChild(opt);
    }

    for (const cat of menuCategories) {
      const group = document.createElement('div');
      group.className = 'menu-category-group';

      const catItems = menuItems.filter(i => i.categoryId === cat.id);

      group.innerHTML = `
        <div class="menu-category-group-header">
          <div>
            <h3 style="font-family: var(--font-serif); font-size: 18px; display: inline;">${escapeHtml(cat.name)}</h3>
            <span style="font-size: 13px; color: var(--muted); margin-left: 8px;">(${catItems.length} items)</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-outline btn-sm" data-action="edit-category" data-category-id="${escapeHtml(cat.id)}" data-category-name="${escapeHtml(cat.name)}">Edit Name</button>
            <button class="btn btn-outline btn-sm btn-danger" data-action="delete-category" data-category-id="${escapeHtml(cat.id)}">Delete</button>
          </div>
        </div>
        <div class="menu-items-list" id="cat-items-${escapeHtml(cat.id)}"></div>
      `;

      const itemsListEl = group.querySelector('.menu-items-list');

      if (catItems.length === 0) {
        itemsListEl.innerHTML = `<div style="padding: 16px 20px; font-size: 13.5px; color: var(--muted);">No dishes in this category yet. Click "+ Add Dish" above.</div>`;
      } else {
        for (const item of catItems) {
          const row = document.createElement('div');
          row.className = 'menu-item-row';
          row.innerHTML = `
            <div class="item-left">
              <div class="item-row-emoji">${escapeHtml(item.emoji || '🍽️')}</div>
              <div>
                <div style="font-weight: 700; font-size: 15px; color: var(--ink);">
                  ${escapeHtml(item.name)}
                  ${item.tag ? `<span class="badge" style="margin-left: 6px; font-size: 10px;">${escapeHtml(item.tag)}</span>` : ''}
                  ${item.dietary && item.dietary.toLowerCase() !== (item.tag || '').toLowerCase() ? `<span class="badge" style="margin-left: 6px; font-size: 10px;">${escapeHtml(item.dietary)}</span>` : ''}
                </div>
                <div style="font-size: 13px; color: var(--muted);">${escapeHtml(item.description || 'No description')}</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 16px;">
              <span style="font-weight: 700; font-size: 15px;">₹${Number(item.price).toFixed(2)}</span>
              <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
                <input type="checkbox" data-action="toggle-item-stock" data-item-id="${escapeHtml(item.id)}" ${item.available ? 'checked' : ''}>
                <span>${item.available ? 'Available to order' : 'Sold Out'}</span>
              </label>
              <button class="btn btn-outline btn-sm" data-action="edit-item" data-item-id="${escapeHtml(item.id)}">Edit</button>
              <button class="btn btn-outline btn-sm btn-danger" data-action="delete-item" data-item-id="${escapeHtml(item.id)}">&times;</button>
            </div>
          `;
          itemsListEl.appendChild(row);
        }
      }

      menuCategoriesContainer.appendChild(group);
    }
  }

  // Toggle item availability
  window.toggleItemStock = async function(itemId, isAvailable) {
    try {
      const res = await fetch(`/api/admin/items/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: isAvailable })
      });
      if (!res.ok) throw new Error('Failed to update availability.');
      showToast(isAvailable ? 'Item marked in stock.' : 'Item marked sold out.');
      loadMenuData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Add & Edit Dish Item
  addItemBtn.addEventListener('click', () => {
    if (menuCategories.length === 0) {
      showToast('Please create at least one category first.', 'error');
      return;
    }
    itemModalTitle.textContent = 'Add Menu Item';
    itemIdInput.value = '';
    itemForm.reset();
    itemAvailableInput.checked = true;
    itemModal.classList.add('active');
  });

  window.editItem = function(itemId) {
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return;
    itemModalTitle.textContent = 'Edit Menu Item';
    itemIdInput.value = item.id;
    itemNameInput.value = item.name;
    itemCategoryInput.value = item.categoryId;
    itemPriceInput.value = item.price;
    itemEmojiInput.value = item.emoji || '';
    itemTagInput.value = item.tag || '';
    itemDietaryInput.value = item.dietary || '';
    itemDescInput.value = item.description || '';
    itemAvailableInput.checked = Boolean(item.available);
    itemModal.classList.add('active');
  };

  closeItemModal.addEventListener('click', () => itemModal.classList.remove('active'));

  itemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = itemIdInput.value;
    const payload = {
      name: itemNameInput.value.trim(),
      categoryId: itemCategoryInput.value,
      price: parseFloat(itemPriceInput.value),
      emoji: itemEmojiInput.value.trim() || '🍽️',
      tag: itemTagInput.value.trim(),
      dietary: itemDietaryInput.value,
      description: itemDescInput.value.trim(),
      available: itemAvailableInput.checked
    };

    try {
      const url = id ? `/api/admin/items/${encodeURIComponent(id)}` : '/api/admin/items';
      const method = id ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save item.');

      showToast(`Dish ${id ? 'updated' : 'added'} successfully!`, 'success');
      itemModal.classList.remove('active');
      loadMenuData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  window.deleteItem = async function(itemId) {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    try {
      const res = await fetch(`/api/admin/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete item.');
      showToast('Item deleted.', 'info');
      loadMenuData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Add & Edit Category
  addCategoryBtn.addEventListener('click', () => {
    categoryModalTitle.textContent = 'Add Category';
    categoryIdInput.value = '';
    categoryForm.reset();
    categoryModal.classList.add('active');
  });

  window.editCategory = function(catId, currentName) {
    categoryModalTitle.textContent = 'Edit Category Name';
    categoryIdInput.value = catId;
    categoryNameInput.value = currentName;
    categoryModal.classList.add('active');
  };

  closeCategoryModal.addEventListener('click', () => categoryModal.classList.remove('active'));

  categoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = categoryIdInput.value;
    const name = categoryNameInput.value.trim();

    try {
      const url = id ? `/api/admin/categories/${encodeURIComponent(id)}` : '/api/admin/categories';
      const method = id ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save category.');

      showToast(`Category ${id ? 'renamed' : 'created'}.`, 'success');
      categoryModal.classList.remove('active');
      loadMenuData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  window.deleteCategory = async function(catId) {
    if (!confirm('Delete this category? (It must be empty of items first)')) return;
    try {
      const res = await fetch(`/api/admin/categories/${encodeURIComponent(catId)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete category.');
      showToast('Category deleted.');
      loadMenuData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  /* ------------------------------------------------------------- */
  /*  Tab 3: Tables & QR                                           */
  /* ------------------------------------------------------------- */

  const tablesQrContainer = document.getElementById('tablesQrContainer');
  const qrAddressHelp = document.getElementById('qrAddressHelp');

  async function loadTables() {
    try {
      const res = await fetch('/api/admin/tables');
      if (!res.ok) throw new Error('Could not load tables.');
      const data = await res.json();

      qrAddressHelp.textContent = `Server address: ${data.baseUrl}. Phones on Wi-Fi will open this link when scanning.`;
      tablesQrContainer.innerHTML = '';

      for (const t of data.tables) {
        const card = document.createElement('div');
        card.className = 'qr-table-card';
        card.innerHTML = `
          <div>${t.svg}</div>
          <div class="qr-table-num">Table ${t.table}</div>
          <div class="qr-table-url">${escapeHtml(t.url)}</div>
          <div style="display: flex; justify-content: center; gap: 8px;">
            <button class="btn btn-outline btn-sm" data-action="copy-qr-link" data-url="${escapeHtml(t.url)}">📋 Copy URL</button>
            <button class="btn btn-outline btn-sm" data-action="download-qr-svg" data-table="${t.table}">⬇️ SVG</button>
          </div>
        `;
        tablesQrContainer.appendChild(card);
      }
    } catch (err) {
      tablesQrContainer.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--red); padding:30px;">${escapeHtml(err.message)}</div>`;
    }
  }

  window.copyQrLink = function(url) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('Table menu URL copied to clipboard!', 'success');
    });
  };

  window.downloadQrSvg = function(tableNum) {
    const card = Array.from(document.querySelectorAll('.qr-table-card')).find(c => c.querySelector('.qr-table-num').textContent.includes(`Table ${tableNum}`));
    if (!card) return;
    const svgEl = card.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `table-${tableNum}-qr.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ------------------------------------------------------------- */
  /*  Tab 4: Settings                                              */
  /* ------------------------------------------------------------- */

  const settingsForm = document.getElementById('settingsForm');
  const settingResName = document.getElementById('settingResName');
  const settingOutletName = document.getElementById('settingOutletName');
  const settingTagline = document.getElementById('settingTagline');
  const settingCurrency = document.getElementById('settingCurrency');
  const settingTaxRate = document.getElementById('settingTaxRate');
  const settingServiceChargeRate = document.getElementById('settingServiceChargeRate');
  const settingTableCount = document.getElementById('settingTableCount');
  const settingFooterNote = document.getElementById('settingFooterNote');

  async function loadSettings() {
    try {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) return;
      const data = await res.json();
      const s = data.settings || {};
      guestOrderingOpen = s.orderingOpen !== false;
      renderOrderingStatus();
      settingResName.value = s.restaurantName || '';
      settingOutletName.value = s.outletName || '';
      settingTagline.value = s.tagline || '';
      settingCurrency.value = s.currency || '₹';
      settingTaxRate.value = Number(s.taxRate || 0);
      settingServiceChargeRate.value = Number(s.serviceChargeRate || 0);
      window.billingCurrency = s.currency || '₹';
      settingTableCount.value = s.tableCount || 17;
      settingFooterNote.value = s.footerNote || '';

      document.title = `${s.restaurantName} — Staff Dashboard`;
    } catch (err) {
      console.error(err);
    }
  }

  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      restaurantName: settingResName.value.trim(),
      outletName: settingOutletName.value.trim(),
      tagline: settingTagline.value.trim(),
      currency: settingCurrency.value.trim(),
      taxRate: Number(settingTaxRate.value),
      serviceChargeRate: Number(settingServiceChargeRate.value),
      tableCount: parseInt(settingTableCount.value, 10),
      footerNote: settingFooterNote.value.trim()
    };

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings.');

      showToast('Settings saved successfully!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  function formatElapsed(isoDate) {
    const diff = Math.max(0, Date.now() - new Date(isoDate).getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins === 1) return '1 min ago';
    if (mins < 60) return `${mins} mins ago`;
    const hours = Math.floor(mins / 60);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Start checking session
  checkSession();

})();
