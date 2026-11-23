'use strict';

(() => {
  const els = {
    shell: document.getElementById('orderShell'),
    brandName: document.getElementById('brandName'),
    backToMenu: document.getElementById('backToMenu'),
    toast: document.getElementById('toast'),
  };

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('id');

  const STATUS = {
    new: {
      label: 'Order received',
      pill: 'New',
      headline: "We've got it.",
      message: "Your order is with the kitchen. We'll update this page as it moves along.",
      step: 0,
    },
    preparing: {
      label: 'Preparing',
      pill: 'Preparing',
      headline: 'In the kitchen.',
      message: 'Your food is being prepared right now. Sit tight — it will not be long.',
      step: 1,
    },
    ready: {
      label: 'Ready',
      pill: 'Ready',
      headline: 'Ready for you.',
      message: 'Your order is ready. A server is bringing it over to your table.',
      step: 2,
    },
    completed: {
      label: 'Served',
      pill: 'Served',
      headline: 'Served. Enjoy!',
      message: 'Thanks for dining with us. Settle the bill at your table whenever you are ready.',
      step: 3,
    },
    cancelled: {
      label: 'Cancelled',
      pill: 'Cancelled',
      headline: 'Order cancelled.',
      message: 'This order was cancelled and nothing was charged. Ask a server if you need any help.',
      step: -1,
    },
  };

  let currentOrder = null;
  let restaurant = null;
  let pollTimer = null;
  let pollCount = 0;
  let toastTimer = null;

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function money(value) {
    const currency = restaurant?.currency || '$';
    const amount = Number(value || 0).toFixed(2);
    return currency.length > 1 ? `${currency} ${amount}` : `${currency}${amount}`;
  }

  function toast(message, type = '') {
    els.toast.textContent = message;
    els.toast.className = `toast show ${type}`.trim();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.className = 'toast';
    }, 3000);
  }

  function timeLabel(iso) {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '—';
    }
  }

  function dateLabel(iso) {
    try {
      return new Date(iso).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
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

  function trackerStep(index, status) {
    const info = STATUS[status];
    const done = info.step > index || status === 'completed';
    const active = info.step === index && status !== 'completed';
    const check = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg>`;
    return `
      <div class="tracker-step ${done ? 'done' : ''} ${active ? 'active' : ''}">
        <div class="tracker-dot">${done ? check : index + 1}</div>
        <div class="tracker-label">${['Received', 'Preparing', 'Ready', 'Served'][index]}</div>
      </div>`;
  }

  function renderOrder() {
    const order = currentOrder;
    if (!order) return;
    const info = STATUS[order.status] || STATUS.new;
    const isCancelled = order.status === 'cancelled';
    const isFinal = order.status === 'completed' || isCancelled;
    const progress = Math.max(0, Math.min(3, info.step)) / 3 * 75;

    document.title = `${info.label} · Order #${order.code} — ${restaurant?.name || 'Menu'}`;
    els.brandName.textContent = restaurant?.name || 'Your order';
    els.backToMenu.href = `/menu?table=${encodeURIComponent(order.table)}`;
    els.backToMenu.textContent = 'Order more';

    const lines = order.items
      .map(
        (line) => `
        <div class="order-line">
          <span class="order-line-qty">${line.qty}×</span>
          <span class="order-line-name">${esc(line.name)}</span>
          <span class="order-line-price">${money(line.price * line.qty)}</span>
        </div>`
      )
      .join('');

    const note = order.note
      ? `<div class="order-note"><strong>Kitchen note</strong>${esc(order.note)}</div>`
      : '';

    const actions = isFinal
      ? `<div class="order-actions">
           <a class="btn btn-dark" href="/menu?table=${encodeURIComponent(order.table)}">Order something else</a>
           <span class="live-note"><span class="live-dot"></span> Final update</span>
         </div>`
      : `<div class="order-actions">
           <a class="btn btn-dark" href="/menu?table=${encodeURIComponent(order.table)}">Add more items</a>
           <span class="live-note"><span class="live-dot"></span> Updating live · checked ${timeAgo(new Date().toISOString())}</span>
           ${order.status === 'new' ? '<button class="cancel-link" type="button" data-action="cancel">Cancel order</button>' : ''}
         </div>`;

    els.shell.innerHTML = `
      <article class="order-card">
        <header class="order-hero ${isCancelled ? 'cancelled' : ''}">
          <div class="order-hero-top">
            <span class="eyebrow light"><span class="dot"></span> Order #${esc(order.code)} · Table ${esc(order.table)}</span>
            <span class="status-pill ${esc(order.status)}"><span class="pill-dot"></span>${esc(info.pill)}</span>
          </div>
          <h1>${esc(info.headline)}</h1>
          <p>${esc(info.message)}</p>
        </header>

        ${
          isCancelled
            ? ''
            : `<div class="tracker">
                <div class="tracker-steps">
                  <div class="tracker-progress" style="width:${progress}%"></div>
                  ${[0, 1, 2, 3].map((index) => trackerStep(index, order.status)).join('')}
                </div>
              </div>`
        }

        <div class="order-meta">
          <div class="meta-item">
            <span>Table</span>
            <strong>Table ${esc(order.table)}</strong>
          </div>
          <div class="meta-item">
            <span>Placed</span>
            <strong>${esc(timeLabel(order.createdAt))} · ${esc(dateLabel(order.createdAt))}</strong>
          </div>
          <div class="meta-item">
            <span>Total</span>
            <strong>${money(order.total)}</strong>
          </div>
        </div>

        <div class="order-lines">
          ${lines}
        </div>
        <div class="order-total-row">
          <span>Order total</span>
          <strong>${money(order.total)}</strong>
        </div>
        ${note}
        ${actions}
      </article>
      <div class="order-below">
        <p>This page updates automatically. Keep it open to follow your order.</p>
        <p>${esc(restaurant?.footerNote || 'Please let your server know about any allergies.')}</p>
      </div>`;
  }

  function renderError(message, { retry = false } = {}) {
    document.title = 'Order not found — Barbeque Nation';
    els.shell.innerHTML = `
      <div class="order-error">
        <span aria-hidden="true">🥀</span>
        <h1>We can't find that order.</h1>
        <p>${esc(message || 'The tracking link may be incomplete. Scan the QR code on your table and order again, or ask a server for help.')}</p>
        <a class="btn btn-primary" href="/menu?table=1">Back to the menu</a>
        ${retry ? '<button class="btn btn-ghost" type="button" data-action="retry" style="margin-left:8px">Try again</button>' : ''}
      </div>`;
  }

  async function loadOrder({ silent = false } = {}) {
    try {
      const result = await api(`/api/orders/${encodeURIComponent(orderId)}`);
      currentOrder = result.order;
      restaurant = result.restaurant;
      pollCount += 1;
      renderOrder();
      if (currentOrder.status === 'completed' || currentOrder.status === 'cancelled') {
        clearTimeout(pollTimer);
        pollTimer = null;
      } else {
        schedulePoll();
      }
    } catch (err) {
      if (err.status === 404) {
        clearTimeout(pollTimer);
        renderError(err.message);
        return;
      }
      if (!silent) {
        renderError(err.message || 'We could not reach the kitchen. Please try again.', { retry: true });
      } else {
        schedulePoll(6000);
      }
    }
  }

  function schedulePoll(delay = 4000) {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(() => loadOrder({ silent: true }), delay);
  }

  async function cancelOrder() {
    if (!currentOrder) return;
    const confirmed = window.confirm('Cancel this order? The kitchen may already be preparing it.');
    if (!confirmed) return;
    try {
      const result = await api(`/api/orders/${encodeURIComponent(currentOrder.id)}/cancel`, { method: 'POST' });
      currentOrder = result.order;
      clearTimeout(pollTimer);
      renderOrder();
      toast('Your order has been cancelled.');
    } catch (err) {
      toast(err.message || 'Could not cancel the order.', 'error');
    }
  }

  els.shell.addEventListener('click', (event) => {
    const cancel = event.target.closest('[data-action="cancel"]');
    const retry = event.target.closest('[data-action="retry"]');
    if (cancel) cancelOrder();
    if (retry) {
      els.shell.innerHTML = `<div class="order-loading"><span class="spinner" aria-hidden="true"></span><p>Finding your order…</p></div>`;
      loadOrder();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentOrder && !['completed', 'cancelled'].includes(currentOrder.status)) {
      loadOrder({ silent: true });
    }
  });

  if (!orderId) {
    renderError('No order was selected. Scan the QR code on your table to start an order.');
  } else {
    loadOrder();
  }
})();
