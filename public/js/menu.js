// Guest Menu JS
(function() {
  'use strict';

  let menuData = null;
  let searchTerm = '';
  let currentTable = 1;
  const cart = new Map(); // itemId -> qty
  const conveyorStates = new Map();
  let conveyorLanes = [];
  let dishDialogIndex = null;
  let dishDialogLaneId = null;
  let previousDishFocus = null;
  let resumeBeltAfterDialog = false;

  // DOM Elements
  const restaurantNameEl = document.getElementById('restaurantName');
  const outletNameEl = document.getElementById('outletName');
  const taglineEl = document.getElementById('tagline');
  const tableNumDisplay = document.getElementById('tableNumDisplay');
  const changeTableBtn = document.getElementById('changeTableBtn');
  const searchInput = document.getElementById('searchInput');
  const menuContent = document.getElementById('menuContent');
  const dishDialogOverlay = document.getElementById('dishDialogOverlay');
  const dishDialogCard = dishDialogOverlay.querySelector('[role="dialog"]');
  const dishDialogClose = document.getElementById('dishDialogClose');
  const dishDialogCategory = document.getElementById('dishDialogCategory');
  const dishDialogName = document.getElementById('dishDialogName');
  const dishDialogPlate = document.getElementById('dishDialogPlate');
  const dishDialogDescription = document.getElementById('dishDialogDescription');
  const dishDialogDetails = document.getElementById('dishDialogDetails');
  const dishDialogPrice = document.getElementById('dishDialogPrice');
  const dishDialogPrevious = document.getElementById('dishDialogPrevious');
  const dishDialogNext = document.getElementById('dishDialogNext');
  const dishDialogAdd = document.getElementById('dishDialogAdd');

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

      renderMenu();
    } catch (err) {
      menuContent.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--red);">${err.message}</div>`;
      showToast('Error loading menu: ' + err.message, 'error');
    }
  }

  function renderMenu() {
    if (!menuData) return;
    if (dishDialogOverlay.classList.contains('active')) closeDishDialog(false);
    const currency = (menuData.restaurant && menuData.restaurant.currency) || '₹';
    stopConveyor();
    const matchingItems = menuData.items.filter((item) => {
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        if (!item.name.toLowerCase().includes(query) && !(item.description || '').toLowerCase().includes(query)) return false;
      }
      return true;
    });

    const dessertCategoryIds = menuData.categories
      .filter((category) => /dessert/i.test(category.name))
      .map((category) => category.id);
    const dietaryType = (item) => (item.dietary || (['vegetarian', 'non-veg'].includes((item.tag || '').toLowerCase()) ? item.tag : '')).toLowerCase();
    const groups = [
      { id: 'vegetarian', title: 'Vegetarian', eyebrow: 'Veg favorites', items: matchingItems.filter((item) => dietaryType(item) === 'vegetarian') },
      { id: 'non-veg', title: 'Non-veg', eyebrow: 'From the grill and more', items: matchingItems.filter((item) => dietaryType(item) === 'non-veg') },
      { id: 'bestsellers', title: 'Bestsellers', eyebrow: 'Guest favorites', items: matchingItems.filter((item) => (item.tag || '').toLowerCase() === 'bestseller') },
      { id: 'desserts', title: 'Desserts', eyebrow: 'A sweet finish', items: matchingItems.filter((item) => dessertCategoryIds.includes(item.categoryId)) },
    ];
    conveyorLanes = groups
      .filter((group) => group.items.length > 0)
      .map((group) => {
        const state = getConveyorState(group.id);
        state.activeIndex = null;
        state.captionIndex = -1;
        return { ...group, state };
      });

    if (conveyorLanes.length === 0) {
      menuContent.innerHTML = `
        <div class="conveyor-empty">
          <div style="font-size: 40px; margin-bottom: 12px;">🔍</div>
          <p style="font-size: 16px; font-weight: 700;">No dishes found matching your filters</p>
          <p style="font-size: 13.5px; margin-top: 6px;">Try another category or clear your search.</p>
        </div>
      `;
      stopConveyor();
      updateCartUI();
      return;
    }

    menuContent.innerHTML = conveyorLanes.map((lane) => `
      <section class="conveyor-group" data-conveyor-group="${lane.id}">
        <div class="conveyor-heading">
          <div>
            <p class="conveyor-eyebrow">${escapeHtml(lane.eyebrow)}</p>
            <h2 class="conveyor-title">${escapeHtml(lane.title)}</h2>
          </div>
          <span class="conveyor-count">${lane.items.length} ${lane.items.length === 1 ? 'dish' : 'dishes'}</span>
        </div>
        <div class="conveyor-stage" data-belt-id="${lane.id}" role="group" aria-label="${escapeHtml(lane.title)} conveyor">
          <div class="conveyor-track" aria-hidden="true"></div>
          ${lane.items.map((item, index) => {
          const quantity = cart.get(item.id) || 0;
          const price = `${currency}${Number(item.price).toFixed(2)}`;
          const availability = item.available ? '' : ', sold out';
          return `
            <button type="button" class="conveyor-plate ${item.available ? '' : 'is-sold-out'}" data-dish-index="${index}" data-item-id="${escapeHtml(item.id)}" style="--plate-ring:${dishTierColor(item)};" aria-label="${escapeHtml(item.name)}, ${price}${availability}">
              <span class="conveyor-plate-surface" aria-hidden="true">
                <span class="conveyor-plate-food">${escapeHtml(item.emoji || '🍽️')}</span>
              </span>
              <span class="conveyor-plate-chip">${escapeHtml(item.name)} · ${price}</span>
              <span class="conveyor-plate-quantity ${quantity ? 'has-items' : ''}" aria-label="${quantity} in order">${quantity}</span>
            </button>
          `;
          }).join('')}
        </div>
        <div class="conveyor-controls" aria-label="${escapeHtml(lane.title)} belt controls">
          <button type="button" class="conveyor-control" data-belt-control="previous" aria-label="Previous dish">←</button>
          <button type="button" class="conveyor-control" data-belt-control="pause" aria-label="${lane.state.paused ? 'Resume belt' : 'Pause belt'}" aria-pressed="${lane.state.paused}">${lane.state.paused ? '▶ Resume' : 'Ⅱ Pause'}</button>
          <button type="button" class="conveyor-control" data-belt-control="next" aria-label="Next dish">→</button>
        </div>
        <div class="conveyor-caption" data-belt-caption="${lane.id}" aria-live="polite"></div>
      </section>
    `).join('');

    conveyorLanes.forEach((lane) => {
      bindConveyorControls(lane);
      paintConveyor(lane);
      startConveyor(lane);
    });
    updateCartUI();
  }

  function getConveyorState(id) {
    if (!conveyorStates.has(id)) {
      conveyorStates.set(id, { angle: 0, frame: 0, lastFrame: 0, paused: false, activeIndex: null, captionIndex: -1 });
    }
    return conveyorStates.get(id);
  }

  function dishTierColor(item) {
    const colors = ['#16a34a', '#0284c7', '#d97706', '#ea580c', '#dc2626'];
    const prices = [...new Set(menuData.items.map((entry) => Number(entry.price)).filter(Number.isFinite))].sort((a, b) => a - b);
    const rank = Math.max(0, prices.indexOf(Number(item.price)));
    const tier = Math.min(colors.length - 1, Math.floor((rank / Math.max(1, prices.length)) * colors.length));
    return colors[tier];
  }

  function bindConveyorControls(lane) {
    const group = menuContent.querySelector(`[data-conveyor-group="${lane.id}"]`);
    const state = lane.state;
    group.querySelectorAll('.conveyor-plate').forEach((plate) => {
      const index = Number(plate.dataset.dishIndex);
      plate.addEventListener('mouseenter', () => {
        state.activeIndex = index;
        paintConveyor(lane);
      });
      plate.addEventListener('focus', () => {
        state.activeIndex = index;
        paintConveyor(lane);
      });
      plate.addEventListener('click', () => openDishDialog(lane.id, index, plate));
    });

    const stage = group.querySelector('.conveyor-stage');
    stage.addEventListener('mouseleave', () => {
      if (!stage.contains(document.activeElement) && dishDialogLaneId !== lane.id) {
        state.activeIndex = null;
        paintConveyor(lane);
      }
    });

    group.querySelector('[data-belt-control="previous"]').addEventListener('click', () => selectConveyorDish(lane, (state.activeIndex ?? centerDishIndex(lane)) - 1));
    group.querySelector('[data-belt-control="next"]').addEventListener('click', () => selectConveyorDish(lane, (state.activeIndex ?? centerDishIndex(lane)) + 1));
    group.querySelector('[data-belt-control="pause"]').addEventListener('click', () => setConveyorPaused(lane, !state.paused));

    stage.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const current = Number(event.target.closest('.conveyor-plate')?.dataset.dishIndex);
        const base = Number.isInteger(current) ? current : centerDishIndex(lane);
        selectConveyorDish(lane, base + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
  }

  function centerDishIndex(lane) {
    if (!lane.items.length) return 0;
    let closest = 0;
    let smallestDistance = Infinity;
    lane.items.forEach((item, index) => {
      const angle = (index / lane.items.length) * Math.PI * 2 + lane.state.angle;
      const distance = Math.abs(Math.atan2(Math.sin(angle - Math.PI / 2), Math.cos(angle - Math.PI / 2)));
      if (distance < smallestDistance) {
        closest = index;
        smallestDistance = distance;
      }
    });
    return closest;
  }

  function selectConveyorDish(lane, index) {
    if (!lane.items.length) return;
    lane.state.activeIndex = (index % lane.items.length + lane.items.length) % lane.items.length;
    paintConveyor(lane);
    const plate = menuContent.querySelector(`[data-belt-id="${lane.id}"] [data-dish-index="${lane.state.activeIndex}"]`);
    if (plate) plate.focus({ preventScroll: true });
  }

  function updateConveyorCaption(lane, index) {
    const caption = menuContent.querySelector(`[data-belt-caption="${lane.id}"]`);
    const item = lane.items[index];
    if (!caption || !item || lane.state.captionIndex === index) return;
    lane.state.captionIndex = index;
    const currency = (menuData.restaurant && menuData.restaurant.currency) || '₹';
    caption.innerHTML = `
      <p class="conveyor-caption-name">${escapeHtml(item.name)} <span class="conveyor-caption-price">· ${currency}${Number(item.price).toFixed(2)}</span></p>
      ${item.description ? `<p class="conveyor-caption-description">${escapeHtml(item.description)}</p>` : ''}
    `;
  }

  function paintConveyor(lane) {
    const stage = menuContent.querySelector(`[data-belt-id="${lane.id}"]`);
    if (!stage || !lane.items.length) return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    const rx = width * 0.38;
    const ry = height * 0.28;
    const perimeter = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
    const baseSize = Math.max(36, Math.min(94, (perimeter / lane.items.length) * 0.78));
    const centerIndex = centerDishIndex(lane);
    const shownIndex = lane.state.activeIndex === null ? centerIndex : lane.state.activeIndex;

    lane.items.forEach((item, index) => {
      const plate = stage.querySelector(`[data-dish-index="${index}"]`);
      if (!plate) return;
      const active = lane.state.activeIndex === index;
      const angle = (index / lane.items.length) * Math.PI * 2 + lane.state.angle;
      const depth = (Math.sin(angle) + 1) / 2;
      const scale = 0.58 + depth * 0.42 + (active ? 0.08 : 0);
      const x = width / 2 + rx * Math.cos(angle);
      const y = height * 0.49 + ry * Math.sin(angle);
      const lift = active ? baseSize * 0.16 : 0;
      plate.style.width = `${baseSize}px`;
      plate.style.height = `${baseSize}px`;
      plate.style.opacity = String(0.72 + depth * 0.28);
      plate.style.zIndex = String(10 + Math.round(depth * 100) + (active ? 150 : 0));
      plate.style.transform = `translate3d(${(x - baseSize / 2).toFixed(1)}px,${(y - baseSize / 2 - lift).toFixed(1)}px,0) scale(${scale.toFixed(3)})`;
      plate.classList.toggle('is-active', active);
    });

    updateConveyorCaption(lane, shownIndex);
  }

  function startConveyor(lane) {
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const state = lane.state;
    if (state.frame || state.paused || document.hidden || reducedMotion || lane.items.length < 2) return;
    state.frame = window.requestAnimationFrame((timestamp) => animateConveyor(lane, timestamp));
  }

  function stopConveyor(lane) {
    const states = lane ? [lane.state] : [...conveyorStates.values()];
    states.forEach((state) => {
      if (state.frame) window.cancelAnimationFrame(state.frame);
      state.frame = 0;
      state.lastFrame = 0;
    });
  }

  function animateConveyor(lane, timestamp) {
    const state = lane.state;
    state.frame = 0;
    if (state.paused || document.hidden || !menuContent.querySelector(`[data-belt-id="${lane.id}"]`)) {
      state.lastFrame = 0;
      return;
    }
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      state.lastFrame = 0;
      return;
    }
    const delta = state.lastFrame ? Math.min((timestamp - state.lastFrame) / 1000, 0.05) : 0;
    state.lastFrame = timestamp;
    state.angle = (state.angle + delta * 0.18) % (Math.PI * 2);
    paintConveyor(lane);
    state.frame = window.requestAnimationFrame((nextTimestamp) => animateConveyor(lane, nextTimestamp));
  }

  function setConveyorPaused(lane, paused) {
    const state = lane.state;
    state.paused = paused;
    const button = menuContent.querySelector(`[data-conveyor-group="${lane.id}"] [data-belt-control="pause"]`);
    if (button) {
      button.setAttribute('aria-pressed', String(paused));
      button.setAttribute('aria-label', paused ? 'Resume belt' : 'Pause belt');
      button.textContent = paused ? '▶ Resume' : 'Ⅱ Pause';
    }
    if (paused) stopConveyor(lane);
    else startConveyor(lane);
  }

  function updateDishDialog(laneId, index) {
    const lane = conveyorLanes.find((entry) => entry.id === laneId);
    const item = lane && lane.items[index];
    if (!item) return;
    dishDialogLaneId = laneId;
    dishDialogIndex = index;
    lane.state.activeIndex = index;
    const currency = (menuData.restaurant && menuData.restaurant.currency) || '₹';
    const category = menuData.categories.find((entry) => entry.id === item.categoryId);
    dishDialogCategory.textContent = category ? category.name : 'Menu item';
    dishDialogName.textContent = item.name;
    dishDialogPlate.textContent = item.emoji || '🍽️';
    dishDialogPlate.style.setProperty('--plate-ring', dishTierColor(item));
    dishDialogDescription.textContent = item.description || 'Freshly prepared by our kitchen.';
    const dietaryDetail = item.dietary && item.dietary.toLowerCase() !== (item.tag || '').toLowerCase() ? item.dietary : '';
    dishDialogDetails.innerHTML = [item.tag, dietaryDetail, item.available ? 'Available' : 'Sold out']
      .filter(Boolean)
      .map((detail) => `<span class="dish-dialog-detail">${escapeHtml(detail)}</span>`)
      .join('');
    dishDialogPrice.textContent = `${currency}${Number(item.price).toFixed(2)}`;
    dishDialogAdd.disabled = !item.available;
    dishDialogAdd.textContent = item.available ? '＋ Add to order' : 'Sold out';
    dishDialogPrevious.disabled = lane.items.length < 2;
    dishDialogNext.disabled = lane.items.length < 2;
    paintConveyor(lane);
  }

  function openDishDialog(laneId, index, trigger) {
    const lane = conveyorLanes.find((entry) => entry.id === laneId);
    if (!lane || !lane.items[index]) return;
    previousDishFocus = trigger || document.activeElement;
    resumeBeltAfterDialog = !lane.state.paused;
    setConveyorPaused(lane, true);
    updateDishDialog(laneId, index);
    dishDialogOverlay.classList.add('active');
    dishDialogOverlay.setAttribute('aria-hidden', 'false');
    dishDialogClose.focus();
  }

  function closeDishDialog(restoreFocus = true) {
    if (!dishDialogOverlay.classList.contains('active')) return;
    dishDialogOverlay.classList.remove('active');
    dishDialogOverlay.setAttribute('aria-hidden', 'true');
    const lane = conveyorLanes.find((entry) => entry.id === dishDialogLaneId);
    if (lane) {
      lane.state.activeIndex = null;
      if (resumeBeltAfterDialog) setConveyorPaused(lane, false);
      paintConveyor(lane);
    }
    dishDialogIndex = null;
    dishDialogLaneId = null;
    if (restoreFocus && previousDishFocus && previousDishFocus.isConnected) {
      previousDishFocus.focus({ preventScroll: true });
    }
    previousDishFocus = null;
  }

  function updateConveyorQuantity(itemId) {
    const quantity = cart.get(itemId) || 0;
    menuContent.querySelectorAll('.conveyor-plate').forEach((plate) => {
      if (plate.dataset.itemId !== itemId) return;
      const badge = plate.querySelector('.conveyor-plate-quantity');
      badge.textContent = quantity;
      badge.setAttribute('aria-label', `${quantity} in order`);
      badge.classList.toggle('has-items', quantity > 0);
    });
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

    updateConveyorQuantity(itemId);
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

  dishDialogClose.addEventListener('click', () => closeDishDialog());
  dishDialogOverlay.addEventListener('click', (event) => {
    if (event.target === dishDialogOverlay) closeDishDialog();
  });

  dishDialogCard.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDishDialog();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = [...dishDialogCard.querySelectorAll('button:not(:disabled)')];
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  dishDialogPrevious.addEventListener('click', () => {
    const lane = conveyorLanes.find((entry) => entry.id === dishDialogLaneId);
    if (lane && dishDialogIndex !== null) updateDishDialog(lane.id, (dishDialogIndex - 1 + lane.items.length) % lane.items.length);
  });
  dishDialogNext.addEventListener('click', () => {
    const lane = conveyorLanes.find((entry) => entry.id === dishDialogLaneId);
    if (lane && dishDialogIndex !== null) updateDishDialog(lane.id, (dishDialogIndex + 1) % lane.items.length);
  });
  dishDialogAdd.addEventListener('click', () => {
    const lane = conveyorLanes.find((entry) => entry.id === dishDialogLaneId);
    const item = lane && dishDialogIndex !== null ? lane.items[dishDialogIndex] : null;
    if (!item || !item.available) return;
    window.updateItemQty(item.id, 1);
    showToast(`${item.name} added to your order.`, 'success');
    closeDishDialog();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopConveyor();
    else conveyorLanes.forEach(startConveyor);
  });
  window.addEventListener('resize', () => conveyorLanes.forEach(paintConveyor));
  window.addEventListener('pagehide', () => stopConveyor());
  if (window.matchMedia) {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionPreference = (event) => {
      if (event.matches) stopConveyor();
      else conveyorLanes.forEach(startConveyor);
    };
    if (motionPreference.addEventListener) motionPreference.addEventListener('change', handleMotionPreference);
    else if (motionPreference.addListener) motionPreference.addListener(handleMotionPreference);
  }

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
