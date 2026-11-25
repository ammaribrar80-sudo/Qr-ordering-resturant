// Staff Dashboard JS
(function() {
  'use strict';

  let currentTab = 'orders';
  let ordersFilter = 'all';
  let ordersList = [];
  let menuCategories = [];
  let menuItems = [];
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

  // Tabs
  const navItems = document.querySelectorAll('.admin-nav-item');
  const tabPanes = {
    orders: document.getElementById('tab-orders'),
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

      const timeAgo = formatElapsed(order.createdAt);

      let actionButtons = '';
      if (order.status === 'new') {
        actionButtons = `
          <button class="btn btn-outline btn-sm btn-danger" onclick="window.updateOrderStatus('${order.id}', 'cancelled')">Cancel</button>
          <button class="btn btn-primary btn-sm" onclick="window.updateOrderStatus('${order.id}', 'preparing')">🍳 Start Cooking</button>
        `;
      } else if (order.status === 'preparing') {
        actionButtons = `
          <button class="btn btn-outline btn-sm btn-danger" onclick="window.updateOrderStatus('${order.id}', 'cancelled')">Cancel</button>
          <button class="btn btn-primary btn-sm" onclick="window.updateOrderStatus('${order.id}', 'ready')" style="background: var(--amber);">🔔 Mark Ready</button>
        `;
      } else if (order.status === 'ready') {
        actionButtons = `
          <button class="btn btn-primary btn-sm" onclick="window.updateOrderStatus('${order.id}', 'completed')" style="background: var(--green);">✅ Mark Served</button>
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
            ${order.paymentStatus === 'paid'
              ? `<span class="badge badge-paid">✅ PAID (${escapeHtml((order.paymentMethod || 'cash').toUpperCase())})</span>`
              : order.paymentStatus === 'pending_verification'
              ? `<span class="badge badge-pending-pay">⚠️ VERIFY ${(order.paymentMethod || 'upi').toUpperCase()}</span>`
              : `<span class="badge badge-unpaid">⏳ ${(order.paymentMethod || 'cash').toUpperCase()} (UNPAID)</span>`
            }
          </div>
        </div>

        <ul class="order-items-list">${itemsHtml}</ul>
        ${noteHtml}

        <div class="order-card-footer">
          <span class="order-total-amount">Total: ₹${Number(order.total).toFixed(2)}</span>
          <div class="order-actions" style="display: flex; align-items: center; gap: 8px;">
            <button class="btn-pay-toggle" onclick="window.toggleOrderPayment('${order.id}', '${order.paymentStatus === 'paid' ? 'pending' : 'paid'}')">
              ${order.paymentStatus === 'paid' ? 'Mark Unpaid' : '💵 Verify & Mark Paid'}
            </button>
            ${actionButtons}
          </div>
        </div>
      `;

      ordersContainer.appendChild(card);
    }
  }

  window.toggleOrderPayment = async function(orderId, nextPaymentStatus) {
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: nextPaymentStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update payment status.');
      showToast(`Order #${data.order.code} payment marked as ${nextPaymentStatus}.`, 'success');
      fetchOrders();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

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
          <button class="btn btn-primary btn-sm" onclick="window.resolveServiceRequest('${req.id}')" style="background: var(--green);">✅ Mark Resolved</button>
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
              <button class="btn btn-primary btn-sm" onclick="window.resolveServiceRequest('${req.id}')" style="background: var(--green);">
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

  window.updateOrderStatus = async function(orderId, nextStatus) {
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update order status.');
      showToast(`Order #${data.order.code} updated to ${nextStatus}.`, 'success');
      fetchOrders();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

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
            <button class="btn btn-outline btn-sm" onclick="window.editCategory('${cat.id}', '${escapeHtml(cat.name)}')">Edit Name</button>
            <button class="btn btn-outline btn-sm btn-danger" onclick="window.deleteCategory('${cat.id}')">Delete</button>
          </div>
        </div>
        <div class="menu-items-list" id="cat-items-${cat.id}"></div>
      `;

      const itemsListEl = group.querySelector(`#cat-items-${cat.id}`);

      if (catItems.length === 0) {
        itemsListEl.innerHTML = `<div style="padding: 16px 20px; font-size: 13.5px; color: var(--muted);">No dishes in this category yet. Click "+ Add Dish" above.</div>`;
      } else {
        for (const item of catItems) {
          const row = document.createElement('div');
          row.className = 'menu-item-row';
          row.innerHTML = `
            <div class="item-left">
              <div class="item-row-emoji">${item.emoji || '🍽️'}</div>
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
                <input type="checkbox" ${item.available ? 'checked' : ''} onchange="window.toggleItemStock('${item.id}', this.checked)">
                <span>${item.available ? 'Available' : 'Sold Out'}</span>
              </label>
              <button class="btn btn-outline btn-sm" onclick="window.editItem('${item.id}')">Edit</button>
              <button class="btn btn-outline btn-sm btn-danger" onclick="window.deleteItem('${item.id}')">&times;</button>
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
            <button class="btn btn-outline btn-sm" onclick="window.copyQrLink('${escapeHtml(t.url)}')">📋 Copy URL</button>
            <button class="btn btn-outline btn-sm" onclick="window.downloadQrSvg(${t.table})">⬇️ SVG</button>
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
  const settingTableCount = document.getElementById('settingTableCount');
  const settingUpiVpa = document.getElementById('settingUpiVpa');
  const settingUpiPayeeName = document.getElementById('settingUpiPayeeName');
  const settingFooterNote = document.getElementById('settingFooterNote');

  async function loadSettings() {
    try {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) return;
      const data = await res.json();
      const s = data.settings || {};
      settingResName.value = s.restaurantName || '';
      settingOutletName.value = s.outletName || '';
      settingTagline.value = s.tagline || '';
      settingCurrency.value = s.currency || '₹';
      settingTableCount.value = s.tableCount || 17;
      if (settingUpiVpa) settingUpiVpa.value = s.upiVpa || 'barbequenation@okaxis';
      if (settingUpiPayeeName) settingUpiPayeeName.value = s.upiPayeeName || s.restaurantName || '';
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
      tableCount: parseInt(settingTableCount.value, 10),
      upiVpa: settingUpiVpa ? settingUpiVpa.value.trim() : undefined,
      upiPayeeName: settingUpiPayeeName ? settingUpiPayeeName.value.trim() : undefined,
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
