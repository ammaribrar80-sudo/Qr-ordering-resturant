'use strict';

(() => {
  const els = {
    brandName: document.getElementById('brandName'),
    restaurantName: document.getElementById('restaurantName'),
    tagline: document.getElementById('tagline'),
    heroEyebrow: document.getElementById('heroEyebrow'),
    heroMeta: document.getElementById('heroMeta'),
    footerNote: document.getElementById('footerNote'),
    tableChip: document.getElementById('tableChip'),
    tableChipText: document.getElementById('tableChipText'),
    dishCount: document.getElementById('dishCount'),
    categoryChips: document.getElementById('categoryChips'),
    searchInput: document.getElementById('searchInput'),
    menuMain: document.getElementById('menuMain'),
    cartBar: document.getElementById('cartBar'),
    cartCount: document.getElementById('cartCount'),
    cartBarTitle: document.getElementById('cartBarTitle'),
    cartBarTotal: document.getElementById('cartBarTotal'),
    openCartBtn: document.getElementById('openCartBtn'),
    backdrop: document.getElementById('backdrop'),
    cartSheet: document.getElementById('cartSheet'),
    closeCartBtn: document.getElementById('closeCartBtn'),
    sheetTable: document.getElementById('sheetTable'),
    cartItems: document.getElementById('cartItems'),
    cartEmpty: document.getElementById('cartEmpty'),
    orderNote: document.getElementById('orderNote'),
    cartTotal: document.getElementById('cartTotal'),
    placeOrderBtn: document.getElementById('placeOrderBtn'),
    tableModal: document.getElementById('tableModal'),
    tableModalTitle: document.getElementById('tableModalTitle'),
    tableModalClose: document.getElementById('tableModalClose'),
    tableSelect: document.getElementById('tableSelect'),
    tableConfirmBtn: document.getElementById('tableConfirmBtn'),
    successModal: document.getElementById('successModal'),
    successCode: document.getElementById('successCode'),
    successTable: document.getElementById('successTable'),
    successTotal: document.getElementById('successTotal'),
    successTrackLink: document.getElementById('successTrackLink'),
    successDoneBtn: document.getElementById('successDoneBtn'),
    toast: document.getElementById('toast'),
  };

  const state = {
    data: null,
    table: null,
    cart: new Map(),
    category: 'all',
    search: '',
    sending: false,
  };

  const CART_KEY = 'bbq-order-cart-';
  let toastTimer = null;
  let searchTimer = null;
  let lastFocus = null;

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                          */
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
    const currency = state.data?.restaurant?.currency || '$';
    const amount = Number(value || 0).toFixed(2);
    return currency.length > 1 ? `${currency} ${amount}` : `${currency}${amount}`;
  }

  async function api(url, options) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      const error = new Error((body && body.error) || 'Something went wrong. Please try again.');
      error.status = res.status;
      throw error;
    }
    return body;
  }

  function toast(message, type = '') {
    els.toast.textContent = message;
    els.toast.className = `toast show ${type}`.trim();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.className = 'toast';
    }, 2800);
  }

  function itemById(id) {
    return state.data?.items.find((item) => item.id === id) || null;
  }

  function categoryById(id) {
    return state.data?.categories.find((category) => category.id === id) || null;
  }

  function qtyOf(id) {
    return state.cart.get(id) || 0;
  }

  function totalItems() {
    let total = 0;
    for (const qty of state.cart.values()) total += qty;
    return total;
  }

  function cartSubtotal() {
    let total = 0;
    for (const [id, qty] of state.cart) {
      const item = itemById(id);
      if (item) total += item.price * qty;
    }
    return Math.round(total * 100) / 100;
  }

  function syncScrollLock() {
    const open =
      els.cartSheet.classList.contains('open') ||
      els.tableModal.classList.contains('open') ||
      els.successModal.classList.contains('open');
    document.body.classList.toggle('no-scroll', open);
  }

  function saveCart() {
    if (!state.table) return;
    const lines = [...state.cart].map(([id, qty]) => ({ id, qty }));
    try {
      if (lines.length === 0) localStorage.removeItem(CART_KEY + state.table);
      else localStorage.setItem(CART_KEY + state.table, JSON.stringify(lines));
    } catch {
      /* storage may be unavailable */
    }
  }

  function loadCart() {
    state.cart.clear();
    if (!state.table) return;
    try {
      const raw = localStorage.getItem(CART_KEY + state.table);
      if (!raw) return;
      const lines = JSON.parse(raw);
      if (!Array.isArray(lines)) return;
      for (const line of lines) {
        const item = itemById(line.id);
        const qty = Math.min(20, Math.max(1, Math.floor(Number(line.qty) || 0)));
        if (item && item.available && qty > 0) state.cart.set(item.id, qty);
      }
    } catch {
      /* ignore corrupt cart */
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Table selection                                                  */
  /* ---------------------------------------------------------------- */

  function buildTableOptions() {
    const count = state.data.tableCount;
    const options = ['<option value="">Select your table…</option>'];
    for (let i = 1; i <= count; i += 1) {
      options.push(`<option value="${i}">Table ${i}</option>`);
    }
    els.tableSelect.innerHTML = options.join('');
  }

  function updateTableUI() {
    if (state.table) {
      els.tableChipText.textContent = `Table ${state.table}`;
      els.heroEyebrow.textContent = `Table ${String(state.table).padStart(2, '0')} · dine in`;
      els.sheetTable.textContent = state.table;
      els.tableChip.setAttribute('aria-label', `Change table (currently table ${state.table})`);
    } else {
      els.tableChipText.textContent = 'Choose table';
      els.heroEyebrow.textContent = 'Welcome to the table';
      els.sheetTable.textContent = '—';
      els.tableChip.setAttribute('aria-label', 'Choose your table');
    }
  }

  function setTable(table, { announce = true } = {}) {
    const parsed = Number(table);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > state.data.tableCount) {
      toast('Please choose a valid table.');
      return false;
    }
    state.table = parsed;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('table', String(parsed));
      window.history.replaceState(null, '', url);
    } catch {
      /* ignore */
    }
    loadCart();
    updateTableUI();
    renderMenu();
    updateCartUI();
    closeTableModal();
    if (announce) toast(`You're ordering for table ${parsed}.`);
    return true;
  }

  function openTableModal() {
    lastFocus = document.activeElement;
    if (state.table) els.tableSelect.value = String(state.table);
    els.tableModal.classList.add('open');
    els.tableModal.setAttribute('aria-hidden', 'false');
    syncScrollLock();
    setTimeout(() => els.tableSelect.focus(), 120);
  }

  function closeTableModal() {
    els.tableModal.classList.remove('open');
    els.tableModal.setAttribute('aria-hidden', 'true');
    syncScrollLock();
  }

  /* ---------------------------------------------------------------- */
  /*  Menu rendering                                                   */
  /* ---------------------------------------------------------------- */

  function applyRestaurant() {
    const restaurant = state.data.restaurant;
    document.title = `${restaurant.name} — Menu`;
    els.brandName.textContent = restaurant.name;
    els.restaurantName.textContent = restaurant.name;
    els.tagline.textContent = restaurant.tagline || 'Live grills & buffet';
    els.footerNote.textContent = restaurant.footerNote || 'Please let your server know about any allergies.';
    const dishTotal = state.data.items.length;
    els.heroMeta.textContent = `${dishTotal} dishes · ${state.data.categories.length} categories`;
  }

  function renderChips() {
    const chips = [
      `<button class="chip ${state.category === 'all' ? 'active' : ''}" data-category="all" type="button">All</button>`,
      ...state.data.categories.map(
        (category) =>
          `<button class="chip ${state.category === category.id ? 'active' : ''}" data-category="${esc(category.id)}" type="button">${esc(category.name)}</button>`
      ),
    ];
    els.categoryChips.innerHTML = chips.join('');
  }

  function filteredItems() {
    const query = state.search.trim().toLowerCase();
    return state.data.items.filter((item) => {
      if (state.category !== 'all' && item.categoryId !== state.category) return false;
      if (!query) return true;
      const haystack = `${item.name} ${item.description} ${item.tag}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  function dishCard(item) {
    const qty = qtyOf(item.id);
    const inCart = qty > 0;
    const soldOut = !item.available;
    const category = categoryById(item.categoryId);
    const tag = item.tag
      ? `<span class="dish-tag">${esc(item.tag)}</span>`
      : '';
    const footLabel = category ? category.name : '';
    return `
      <article class="dish-card ${inCart ? 'in-cart' : ''} ${soldOut ? 'is-sold-out' : ''}" data-item-id="${esc(item.id)}">
        <div class="dish-art" data-cat="${esc(item.categoryId)}">
          ${tag}
          <span class="dish-emoji" aria-hidden="true">${esc(item.emoji || '🍽️')}</span>
          ${soldOut ? '<div class="sold-out-pill">Sold out</div>' : ''}
        </div>
        <div class="dish-body">
          <div class="dish-top">
            <h3 class="dish-name">${esc(item.name)}</h3>
            <span class="dish-price">${money(item.price)}</span>
          </div>
          <p class="dish-desc">${esc(item.description)}</p>
          <div class="dish-foot">
            <span class="dish-tag-inline">${esc(footLabel)}</span>
            ${
              soldOut
                ? ''
                : `<button class="add-btn ${inCart ? 'hidden' : ''}" type="button" data-add="${esc(item.id)}" aria-label="Add ${esc(item.name)}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                    Add
                  </button>
                  <div class="qty-stepper ${inCart ? '' : 'hidden'}" data-stepper="${esc(item.id)}">
                    <button class="qty-btn" type="button" data-dec="${esc(item.id)}" aria-label="Remove one ${esc(item.name)}">−</button>
                    <span class="qty-value" aria-live="polite">${qty}</span>
                    <button class="qty-btn" type="button" data-inc="${esc(item.id)}" aria-label="Add one more ${esc(item.name)}">+</button>
                  </div>`
            }
          </div>
        </div>
      </article>`;
  }

  function renderMenu() {
    if (!state.data) return;
    const items = filteredItems();
    els.dishCount.textContent = `${items.length} ${items.length === 1 ? 'dish' : 'dishes'}`;

    if (items.length === 0) {
      els.menuMain.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>Nothing on the menu matches.</h3>
          <p>Try another search, or browse all of our dishes.</p>
          <button class="btn btn-ghost btn-sm" type="button" data-clear-filters>Clear filters</button>
        </div>`;
      return;
    }

    const groups = state.data.categories
      .map((category) => ({
        category,
        items: items.filter((item) => item.categoryId === category.id),
      }))
      .filter((group) => group.items.length > 0);

    els.menuMain.innerHTML = groups
      .map(
        (group) => `
        <section class="menu-section" id="section-${esc(group.category.id)}">
          <div class="section-head">
            <h2>${esc(group.category.name)}</h2>
            <span class="section-rule" aria-hidden="true"></span>
            <span class="section-count">${group.items.length} ${group.items.length === 1 ? 'dish' : 'dishes'}</span>
          </div>
          <div class="dish-grid">${group.items.map(dishCard).join('')}</div>
        </section>`
      )
      .join('');
  }

  function updateCard(id) {
    const qty = qtyOf(id);
    for (const card of els.menuMain.querySelectorAll('.dish-card')) {
      if (card.dataset.itemId !== id) continue;
      card.classList.toggle('in-cart', qty > 0);
      const add = card.querySelector('[data-add]');
      const stepper = card.querySelector('[data-stepper]');
      if (add) add.classList.toggle('hidden', qty > 0);
      if (stepper) {
        stepper.classList.toggle('hidden', qty === 0);
        const value = stepper.querySelector('.qty-value');
        if (value) value.textContent = qty;
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Cart                                                             */
  /* ---------------------------------------------------------------- */

  function changeQty(id, delta) {
    if (!state.table) {
      openTableModal();
      toast('Choose your table to start an order.');
      return;
    }
    const item = itemById(id);
    if (!item || !item.available) {
      toast('That dish is sold out right now.');
      return;
    }
    const current = qtyOf(id);
    const next = Math.max(0, Math.min(20, current + delta));
    if (next === current) {
      if (delta > 0 && current >= 20) toast('Maximum 20 of one dish per order.');
      return;
    }
    if (next === 0) state.cart.delete(id);
    else state.cart.set(id, next);
    saveCart();
    updateCard(id);
    updateCartUI();
  }

  function cartItemRow(id) {
    const item = itemById(id);
    const qty = qtyOf(id);
    if (!item || qty === 0) return '';
    return `
      <div class="cart-item" data-cart-id="${esc(id)}">
        <div>
          <div class="cart-item-name">${esc(item.name)}</div>
          <div class="cart-item-unit">${money(item.price)} each</div>
        </div>
        <div class="cart-item-price">${money(item.price * qty)}</div>
        <div class="cart-item-actions">
          <div class="qty-stepper">
            <button class="qty-btn" type="button" data-cart-dec="${esc(id)}" aria-label="Remove one ${esc(item.name)}">−</button>
            <span class="qty-value">${qty}</span>
            <button class="qty-btn" type="button" data-cart-inc="${esc(id)}" aria-label="Add one more ${esc(item.name)}">+</button>
          </div>
          <button class="cart-item-remove" type="button" data-cart-remove="${esc(id)}">Remove</button>
        </div>
      </div>`;
  }

  function updateCartUI() {
    const count = totalItems();
    const subtotal = cartSubtotal();

    els.cartCount.textContent = count;
    els.cartBarTitle.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
    els.cartBarTotal.textContent = money(subtotal);
    els.cartTotal.textContent = money(subtotal);
    els.cartBar.classList.toggle('is-visible', count > 0);
    els.sheetTable.textContent = state.table || '—';

    const rows = [...state.cart.keys()].map(cartItemRow).join('');
    els.cartItems.innerHTML = rows;
    els.cartEmpty.classList.toggle('hidden', count > 0);

    const canOrder = count > 0 && Boolean(state.table) && !state.sending;
    els.placeOrderBtn.disabled = !canOrder;
    if (!state.sending) {
      els.placeOrderBtn.textContent = state.table
        ? 'Send order to the kitchen'
        : 'Choose a table to order';
    }
  }

  function openCart() {
    lastFocus = document.activeElement;
    updateCartUI();
    els.cartSheet.classList.add('open');
    els.cartSheet.setAttribute('aria-hidden', 'false');
    els.backdrop.classList.add('open');
    syncScrollLock();
    setTimeout(() => els.closeCartBtn.focus(), 120);
  }

  function closeCart() {
    els.cartSheet.classList.remove('open');
    els.cartSheet.setAttribute('aria-hidden', 'true');
    els.backdrop.classList.remove('open');
    syncScrollLock();
  }

  /* ---------------------------------------------------------------- */
  /*  Place order                                                      */
  /* ---------------------------------------------------------------- */

  async function placeOrder() {
    if (state.sending) return;
    if (!state.table) {
      closeCart();
      openTableModal();
      toast('Choose your table before sending the order.');
      return;
    }
    if (state.cart.size === 0) {
      toast('Add something to your order first.');
      return;
    }

    state.sending = true;
    els.placeOrderBtn.disabled = true;
    els.placeOrderBtn.textContent = 'Sending to the kitchen…';

    try {
      const payload = {
        table: state.table,
        items: [...state.cart].map(([id, qty]) => ({ id, qty })),
        note: els.orderNote.value.trim(),
      };
      const result = await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const order = result.order;

      state.cart.clear();
      saveCart();
      els.orderNote.value = '';
      updateCartUI();
      renderMenu();
      closeCart();

      try {
        localStorage.setItem('bbq-last-order', order.id);
      } catch {
        /* ignore */
      }

      els.successCode.textContent = `#${order.code}`;
      els.successTable.textContent = `Table ${order.table}`;
      els.successTotal.textContent = money(order.total);
      els.successTrackLink.href = `/order.html?id=${encodeURIComponent(order.id)}`;
      els.successModal.classList.add('open');
      els.successModal.setAttribute('aria-hidden', 'false');
      syncScrollLock();
    } catch (err) {
      toast(err.message || 'Could not send the order. Please try again.', 'error');
      updateCartUI();
    } finally {
      state.sending = false;
      updateCartUI();
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Events                                                           */
  /* ---------------------------------------------------------------- */

  function bindEvents() {
    els.categoryChips.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-category]');
      if (!chip) return;
      state.category = chip.dataset.category;
      renderChips();
      renderMenu();
      window.scrollTo({ top: Math.max(0, document.querySelector('.menu-tools').offsetTop - 2), behavior: 'smooth' });
    });

    els.searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = els.searchInput.value;
        renderMenu();
      }, 120);
    });

    els.menuMain.addEventListener('click', (event) => {
      const add = event.target.closest('[data-add]');
      const inc = event.target.closest('[data-inc]');
      const dec = event.target.closest('[data-dec]');
      const clear = event.target.closest('[data-clear-filters]');
      if (add) changeQty(add.dataset.add, 1);
      else if (inc) changeQty(inc.dataset.inc, 1);
      else if (dec) changeQty(dec.dataset.dec, -1);
      else if (clear) {
        state.search = '';
        state.category = 'all';
        els.searchInput.value = '';
        renderChips();
        renderMenu();
      }
    });

    els.cartItems.addEventListener('click', (event) => {
      const inc = event.target.closest('[data-cart-inc]');
      const dec = event.target.closest('[data-cart-dec]');
      const remove = event.target.closest('[data-cart-remove]');
      if (inc) changeQty(inc.dataset.cartInc, 1);
      else if (dec) changeQty(dec.dataset.cartDec, -1);
      else if (remove) {
        const id = remove.dataset.cartRemove;
        state.cart.delete(id);
        saveCart();
        updateCard(id);
        updateCartUI();
      }
    });

    els.openCartBtn.addEventListener('click', openCart);
    els.closeCartBtn.addEventListener('click', closeCart);
    els.backdrop.addEventListener('click', closeCart);

    els.tableChip.addEventListener('click', openTableModal);
    els.tableModalClose.addEventListener('click', closeTableModal);
    els.tableConfirmBtn.addEventListener('click', () => {
      const value = els.tableSelect.value;
      if (!value) {
        toast('Please pick a table first.');
        els.tableSelect.focus();
        return;
      }
      setTable(value);
    });
    els.tableSelect.addEventListener('change', () => {
      if (els.tableSelect.value) els.tableConfirmBtn.disabled = false;
    });
    els.tableModal.addEventListener('click', (event) => {
      if (event.target === els.tableModal) closeTableModal();
    });

    els.placeOrderBtn.addEventListener('click', placeOrder);

    els.successDoneBtn.addEventListener('click', () => {
      els.successModal.classList.remove('open');
      els.successModal.setAttribute('aria-hidden', 'true');
      syncScrollLock();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (els.successModal.classList.contains('open')) {
        els.successModal.classList.remove('open');
        els.successModal.setAttribute('aria-hidden', 'true');
        syncScrollLock();
        return;
      }
      if (els.cartSheet.classList.contains('open')) {
        closeCart();
        return;
      }
      if (els.tableModal.classList.contains('open')) closeTableModal();
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Init                                                             */
  /* ---------------------------------------------------------------- */

  async function init() {
    bindEvents();
    try {
      const data = await api('/api/menu');
      state.data = data;
      applyRestaurant();
      buildTableOptions();

      const params = new URLSearchParams(window.location.search);
      const requestedTable = Number(params.get('table'));
      if (Number.isInteger(requestedTable) && requestedTable >= 1 && requestedTable <= data.tableCount) {
        state.table = requestedTable;
        loadCart();
      }

      updateTableUI();
      renderChips();
      renderMenu();
      updateCartUI();

      if (!state.table) {
        setTimeout(openTableModal, 350);
      }
    } catch (err) {
      els.menuMain.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">😕</div>
          <h3>We couldn't load the menu.</h3>
          <p>${esc(err.message || 'Please check your connection and try again.')}</p>
          <button class="btn btn-primary btn-sm" type="button" onclick="window.location.reload()">Try again</button>
        </div>`;
      els.dishCount.textContent = 'Unavailable';
      els.heroMeta.textContent = 'Menu unavailable';
    }
  }

  init();
})();
