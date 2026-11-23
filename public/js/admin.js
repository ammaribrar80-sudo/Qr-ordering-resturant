// Staff Dashboard JS
(function() {
  'use strict';

  let currentTab = 'orders';
  let ordersFilter = 'all';
  let ordersList = [];
  let menuCategories = [];
  let menuItems = [];
  let knownOrderIds = new Set();
  let pollTimer = null;
  let audioEnabled = true;

  // Web Audio Chime Generator
  let audioCtx = null;
  function playKitchenChime() {
    if (!audioEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioCtx) audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
      // High chime tone
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.6);

      // Low harmonizing tone
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174.66, now + 0.12); // D6
      gain2.gain.setValueAtTime(0.3, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.9);
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }

  // DOM Elements
  const loginModal = document.getElementById('loginModal');
  const loginForm = document.getElementById('loginForm');
  const pinInput = document.getElementById('pinInput');
  const logoutBtn = document.getElementById('logoutBtn');
  const chimeToggleBtn = document.getElementById('chimeToggleBtn');
  const chimeIcon = document.getElementById('chimeIcon');
  const chimeLabel = document.getElementById('chimeLabel');
  const navResName = document.getElementById('navResName');
  const newOrdersCount = document.getElementById('newOrdersCount');
  const toastContainer = document.getElementById('toastContainer');

  // Tabs
  const navItems = document.querySelectorAll('.admin-nav-item');
  const tabPanes = {
    orders: document.getElementById('tab-orders'),
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
      playKitchenChime();
    } else {
      chimeIcon.textContent = '🔕';
      chimeLabel.textContent = 'Sound Alert: OFF';
      chimeToggleBtn.classList.add('muted');
    }
  });

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

    if (tab === 'orders') fetchOrders();
    if (tab === 'menu') loadMenuData();
    if (tab === 'tables') loadTables();
    if (tab === 'settings') loadSettings();
  }

  function initDashboard() {
    loadSettings();
    switchTab('orders');
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (currentTab === 'orders') fetchOrders(true);
    }, 3500);
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
      if (isPolling && knownOrderIds.size > 0) {
        let hasNewIncoming = false;
        for (const order of newOrders) {
          if (!knownOrderIds.has(order.id) && order.status === 'new') {
            hasNewIncoming = true;
            break;
          }
        }
        if (hasNewIncoming) {
          playKitchenChime();
          showToast('🔔 New table order received!', 'success');
        }
      }

      knownOrderIds = new Set(newOrders.map(o => o.id));
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
          <span class="badge badge-status status-${order.status}">${order.status}</span>
        </div>

        <ul class="order-items-list">${itemsHtml}</ul>
        ${noteHtml}

        <div class="order-card-footer">
          <span class="order-total-amount">Total: ₹${Number(order.total).toFixed(2)}</span>
          <div class="order-actions">${actionButtons}</div>
        </div>
      `;

      ordersContainer.appendChild(card);
    }
  }

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
      settingFooterNote.value = s.footerNote || '';

      if (navResName) navResName.textContent = s.restaurantName || 'Barbeque Nation';
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
      if (navResName) navResName.textContent = data.settings.restaurantName;
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
