// Guest Menu JS
(function() {
  'use strict';

  let menuData = null;
  let activeTag = 'all';
  let searchTerm = '';
  let currentTable = 1;
  const cart = new Map(); // itemId -> qty

  // DOM Elements
  const restaurantNameEl = document.getElementById('restaurantName');
  const outletNameEl = document.getElementById('outletName');
  const taglineEl = document.getElementById('tagline');
  const tableNumDisplay = document.getElementById('tableNumDisplay');
  const changeTableBtn = document.getElementById('changeTableBtn');
  const categoryNav = document.getElementById('categoryNav');
  const searchInput = document.getElementById('searchInput');
  const tagBtns = document.querySelectorAll('.tag-btn');
  const menuContent = document.getElementById('menuContent');

  // Cart Elements
  const cartFloatingBar = document.getElementById('cartFloatingBar');
  const cartBarCount = document.getElementById('cartBarCount');
  const cartBarTotal = document.getElementById('cartBarTotal');
  const openCartBtn = document.getElementById('openCartBtn');
  const closeCartBtn = document.getElementById('closeCartBtn');
  const cartDrawerOverlay = document.getElementById('cartDrawerOverlay');
  const cartItemsList = document.getElementById('cartItemsList');
  const cartSubtotal = document.getElementById('cartSubtotal');
  const cartTotal = document.getElementById('cartTotal');
  const cartTableNum = document.getElementById('cartTableNum');
  const orderNote = document.getElementById('orderNote');
  const submitOrderBtn = document.getElementById('submitOrderBtn');

  // Call Waiter Elements
  const openWaiterModalBtn = document.getElementById('openWaiterModalBtn');
  const closeWaiterModal = document.getElementById('closeWaiterModal');
  const waiterModal = document.getElementById('waiterModal');
  const waiterTableNum = document.getElementById('waiterTableNum');
  const waiterOptBtns = document.querySelectorAll('.waiter-opt-btn');
  const waiterNote = document.getElementById('waiterNote');
  const waiterActiveStatus = document.getElementById('waiterActiveStatus');
  const submitWaiterBtn = document.getElementById('submitWaiterBtn');
  let selectedWaiterType = 'water';

  // Table Modal Elements
  const tableModal = document.getElementById('tableModal');
  const closeTableModal = document.getElementById('closeTableModal');
  const tableSelect = document.getElementById('tableSelect');
  const saveTableBtn = document.getElementById('saveTableBtn');
  const toastContainer = document.getElementById('toastContainer');

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

  function getUrlTable() {
    const params = new URLSearchParams(window.location.search);
    const t = parseInt(params.get('table'), 10);
    return isNaN(t) || t < 1 ? 1 : t;
  }

  function setTable(t) {
    currentTable = t;
    tableNumDisplay.textContent = t;
    cartTableNum.textContent = t;
    if (waiterTableNum) waiterTableNum.textContent = t;
    const url = new URL(window.location);
    url.searchParams.set('table', t);
    window.history.replaceState({}, '', url);
  }

  // Load Menu from API
  async function loadMenu() {
    try {
      const res = await fetch('/api/menu');
      if (!res.ok) throw new Error('Could not load menu.');
      menuData = await res.json();

      // Populate Restaurant Details
      if (menuData.restaurant) {
        restaurantNameEl.textContent = menuData.restaurant.name || 'Barbeque Nation';
        outletNameEl.textContent = menuData.restaurant.outletName || '';
        taglineEl.textContent = menuData.restaurant.tagline || '';
        document.title = `${menuData.restaurant.name} — Menu`;
      }

      // Populate Table Selector Options
      tableSelect.innerHTML = '';
      const totalTables = menuData.tableCount || 17;
      for (let i = 1; i <= totalTables; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `Table ${i}`;
        if (i === currentTable) opt.selected = true;
        tableSelect.appendChild(opt);
      }

      renderCategoryNav();
      renderMenu();
    } catch (err) {
      menuContent.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--red);">${err.message}</div>`;
      showToast('Error loading menu: ' + err.message, 'error');
    }
  }

  function renderCategoryNav() {
    categoryNav.innerHTML = '';
    const allPill = document.createElement('button');
    allPill.className = 'cat-pill active';
    allPill.textContent = 'All Items';
    allPill.onclick = () => {
      document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      allPill.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    categoryNav.appendChild(allPill);

    for (const cat of menuData.categories) {
      const pill = document.createElement('button');
      pill.className = 'cat-pill';
      pill.textContent = cat.name;
      pill.onclick = () => {
        document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const section = document.getElementById(`cat-${cat.id}`);
        if (section) section.scrollIntoView({ behavior: 'smooth' });
      };
      categoryNav.appendChild(pill);
    }
  }

  function renderMenu() {
    if (!menuData) return;
    const currency = (menuData.restaurant && menuData.restaurant.currency) || '₹';
    menuContent.innerHTML = '';

    let matchCount = 0;

    for (const cat of menuData.categories) {
      const catItems = menuData.items.filter(item => {
        if (item.categoryId !== cat.id) return false;
        if (activeTag !== 'all') {
          if ((item.tag || '').toLowerCase() !== activeTag.toLowerCase()) return false;
        }
        if (searchTerm) {
          const matchName = item.name.toLowerCase().includes(searchTerm);
          const matchDesc = (item.description || '').toLowerCase().includes(searchTerm);
          if (!matchName && !matchDesc) return false;
        }
        return true;
      });

      if (catItems.length === 0) continue;
      matchCount += catItems.length;

      const section = document.createElement('section');
      section.className = 'category-section';
      section.id = `cat-${cat.id}`;

      const title = document.createElement('h2');
      title.className = 'category-title';
      title.textContent = cat.name;
      section.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'items-grid';

      for (const item of catItems) {
        const card = document.createElement('article');
        card.className = `menu-card ${!item.available ? 'sold-out' : ''}`;

        const qty = cart.get(item.id) || 0;
        let tagBadge = '';
        if (item.tag) {
          const tLower = item.tag.toLowerCase();
          const badgeClass = tLower.includes('veg') && !tLower.includes('non') ? 'badge-veg' : tLower.includes('non') ? 'badge-nonveg' : 'badge-bestseller';
          tagBadge = `<span class="badge ${badgeClass}">${item.tag}</span>`;
        }

        card.innerHTML = `
          <div class="card-top">
            <div class="item-emoji">${item.emoji || '🍽️'}</div>
            <div class="item-info">
              <div class="item-title-row">
                <span class="item-name">${escapeHtml(item.name)}</span>
                ${tagBadge}
              </div>
              <p class="item-desc">${escapeHtml(item.description || '')}</p>
            </div>
          </div>
          <div class="card-bottom">
            <span class="item-price">${currency}${item.price.toFixed(2)}</span>
            <div class="item-action" id="action-${item.id}">
              ${renderItemAction(item, qty)}
            </div>
          </div>
        `;
        grid.appendChild(card);
      }

      section.appendChild(grid);
      menuContent.appendChild(section);
    }

    if (matchCount === 0) {
      menuContent.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--muted);">
          <div style="font-size: 40px; margin-bottom: 12px;">🔍</div>
          <p style="font-size: 16px; font-weight: 600;">No dishes found matching your search</p>
          <p style="font-size: 13.5px; margin-top: 6px;">Try clearing filters or searching for something else.</p>
        </div>
      `;
    }

    updateCartUI();
  }

  function renderItemAction(item, qty) {
    if (!item.available) {
      return `<span style="font-size: 12px; font-weight: 700; color: var(--red); background: #fdedec; padding: 4px 10px; border-radius: var(--radius-pill);">Sold Out</span>`;
    }
    if (qty > 0) {
      return `
        <div class="qty-stepper">
          <button class="qty-btn" onclick="window.updateItemQty('${item.id}', -1)">&minus;</button>
          <span class="qty-count">${qty}</span>
          <button class="qty-btn" onclick="window.updateItemQty('${item.id}', 1)">&plus;</button>
        </div>
      `;
    }
    return `
      <button class="btn btn-outline btn-sm" onclick="window.updateItemQty('${item.id}', 1)" style="border-color: var(--accent); color: var(--accent); font-weight: 700;">
        + Add
      </button>
    `;
  }

  window.updateItemQty = function(itemId, delta) {
    const item = menuData.items.find(i => i.id === itemId);
    if (!item || !item.available) return;

    const currentQty = cart.get(itemId) || 0;
    const newQty = Math.max(0, Math.min(20, currentQty + delta));

    if (newQty === 0) {
      cart.delete(itemId);
    } else {
      cart.set(itemId, newQty);
    }

    // Update button in card
    const actionEl = document.getElementById(`action-${itemId}`);
    if (actionEl) {
      actionEl.innerHTML = renderItemAction(item, newQty);
    }

    updateCartUI();
  };

  function updateCartUI() {
    if (!menuData) return;
    const currency = (menuData.restaurant && menuData.restaurant.currency) || '₹';
    let totalItems = 0;
    let totalPrice = 0;

    cartItemsList.innerHTML = '';

    for (const [id, qty] of cart) {
      const item = menuData.items.find(i => i.id === id);
      if (!item) continue;
      totalItems += qty;
      totalPrice += item.price * qty;

      const row = document.createElement('div');
      row.className = 'cart-item-row';
      row.innerHTML = `
        <div class="cart-item-info">
          <div class="cart-item-name">${item.emoji || ''} ${escapeHtml(item.name)}</div>
          <div class="cart-item-price">${currency}${item.price.toFixed(2)} &times; ${qty} = <strong>${currency}${(item.price * qty).toFixed(2)}</strong></div>
        </div>
        <div class="qty-stepper">
          <button class="qty-btn" onclick="window.updateItemQty('${item.id}', -1)">&minus;</button>
          <span class="qty-count">${qty}</span>
          <button class="qty-btn" onclick="window.updateItemQty('${item.id}', 1)">&plus;</button>
        </div>
      `;
      cartItemsList.appendChild(row);
    }

    if (totalItems === 0) {
      cartItemsList.innerHTML = `<div style="text-align: center; padding: 40px 10px; color: var(--muted);">Your cart is empty. Add delicious items from the menu!</div>`;
      submitOrderBtn.disabled = true;
      submitOrderBtn.style.opacity = '0.5';
    } else {
      submitOrderBtn.disabled = false;
      submitOrderBtn.style.opacity = '1';
    }

    const formattedTotal = `${currency}${totalPrice.toFixed(2)}`;
    cartBarCount.textContent = `${totalItems} ${totalItems === 1 ? 'item' : 'items'}`;
    cartBarTotal.textContent = formattedTotal;
    cartSubtotal.textContent = formattedTotal;
    cartTotal.textContent = formattedTotal;

    if (totalItems > 0) {
      cartFloatingBar.classList.add('visible');
    } else {
      cartFloatingBar.classList.remove('visible');
    }
  }

  // Call Waiter Button & Modal Logic
  if (openWaiterModalBtn) {
    openWaiterModalBtn.addEventListener('click', () => {
      if (waiterTableNum) waiterTableNum.textContent = currentTable;
      waiterModal.classList.add('active');
      checkActiveTableService();
    });
  }

  if (closeWaiterModal) {
    closeWaiterModal.addEventListener('click', () => {
      waiterModal.classList.remove('active');
    });
  }

  if (waiterModal) {
    waiterModal.addEventListener('click', (e) => {
      if (e.target === waiterModal) waiterModal.classList.remove('active');
    });
  }

  waiterOptBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      waiterOptBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedWaiterType = btn.dataset.type;
    });
  });

  async function checkActiveTableService() {
    try {
      const res = await fetch(`/api/service-requests?table=${currentTable}`);
      if (!res.ok) return;
      const data = await res.json();
      const pending = (data.serviceRequests || []).filter(r => r.status === 'pending');
      if (pending.length > 0 && waiterActiveStatus) {
        const latest = pending[0];
        waiterActiveStatus.style.display = 'flex';
        waiterActiveStatus.innerHTML = `<span>⏳ Request Pending: Staff alerted for <strong>${escapeHtml(latest.type)}</strong>. Someone is on their way!</span>`;
      } else if (waiterActiveStatus) {
        waiterActiveStatus.style.display = 'none';
      }
    } catch {}
  }

  if (submitWaiterBtn) {
    submitWaiterBtn.addEventListener('click', async () => {
      submitWaiterBtn.disabled = true;
      submitWaiterBtn.textContent = 'Notifying Staff...';
      try {
        const res = await fetch('/api/service-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: currentTable,
            type: selectedWaiterType,
            note: waiterNote ? waiterNote.value.trim() : ''
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send request.');

        showToast(`Staff notified! Team member dispatched to Table ${currentTable}.`, 'success');
        if (waiterNote) waiterNote.value = '';
        if (waiterActiveStatus) {
          waiterActiveStatus.style.display = 'flex';
          waiterActiveStatus.innerHTML = `<span>✅ Staff notified for <strong>${escapeHtml(selectedWaiterType)}</strong>! Arriving at Table ${currentTable} shortly.</span>`;
        }
        setTimeout(() => {
          if (waiterModal) waiterModal.classList.remove('active');
        }, 1600);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        submitWaiterBtn.disabled = false;
        submitWaiterBtn.textContent = '🔔 Notify Staff Now';
      }
    });
  }

  // Submit Order to Kitchen
  submitOrderBtn.addEventListener('click', async () => {
    if (cart.size === 0) {
      showToast('Please add items to your cart first.', 'error');
      return;
    }

    submitOrderBtn.disabled = true;
    submitOrderBtn.textContent = 'Submitting order...';

    const orderPayload = {
      table: currentTable,
      items: Array.from(cart.entries()).map(([id, qty]) => ({ id, qty })),
      note: orderNote.value.trim(),
      paymentMethod: 'counter'
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order.');
      }

      showToast('Order placed successfully! Sending to kitchen...', 'success');
      cart.clear();
      setTimeout(() => {
        window.location.href = `/order?id=${data.order.id}`;
      }, 600);

    } catch (err) {
      showToast(err.message, 'error');
      submitOrderBtn.disabled = false;
      submitOrderBtn.textContent = 'Send Order to Kitchen';
    }
  });

  // Open & Close Cart Drawer
  openCartBtn.addEventListener('click', () => {
    cartDrawerOverlay.classList.add('active');
  });

  closeCartBtn.addEventListener('click', () => {
    cartDrawerOverlay.classList.remove('active');
  });

  cartDrawerOverlay.addEventListener('click', (e) => {
    if (e.target === cartDrawerOverlay) cartDrawerOverlay.classList.remove('active');
  });

  // Change Table Modal
  changeTableBtn.addEventListener('click', () => {
    tableSelect.value = currentTable;
    tableModal.classList.add('active');
  });

  changeTableBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      changeTableBtn.click();
    }
  });

  closeTableModal.addEventListener('click', () => {
    tableModal.classList.remove('active');
  });

  saveTableBtn.addEventListener('click', () => {
    setTable(parseInt(tableSelect.value, 10));
    tableModal.classList.remove('active');
    showToast(`Switched to Table ${currentTable}`);
  });

  // Search and Filter Events
  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    renderMenu();
  });

  tagBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tagBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTag = btn.dataset.tag;
      renderMenu();
    });
  });

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Initialize
  setTable(getUrlTable());
  loadMenu();

})();
