// Guest Order Tracking JS
(function() {
  'use strict';

  let currentOrder = null;
  let pollInterval = null;

  const trackingContainer = document.getElementById('trackingContainer');
  const resName = document.getElementById('resName');
  const resOutlet = document.getElementById('resOutlet');
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

  function getOrderId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  async function fetchOrder() {
    const orderId = getOrderId();
    if (!orderId) {
      trackingContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--muted);">
          <div style="font-size: 36px; margin-bottom: 10px;">❓</div>
          <p style="font-weight: 700; font-size: 16px;">No Order ID specified</p>
          <a href="/menu" class="btn btn-primary" style="margin-top: 14px;">Browse Menu</a>
        </div>
      `;
      return;
    }

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Order not found.');

      currentOrder = data.order;
      if (data.restaurant) {
        resName.textContent = data.restaurant.name || 'Barbeque Nation';
        resOutlet.textContent = data.restaurant.outletName || 'Live Order Tracking';
      }

      renderOrder(data.order, data.restaurant);
    } catch (err) {
      trackingContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--red);">
          <div style="font-size: 36px; margin-bottom: 10px;">⚠️</div>
          <p style="font-weight: 700;">${escapeHtml(err.message)}</p>
          <a href="/menu" class="btn btn-outline" style="margin-top: 14px;">Return to Menu</a>
        </div>
      `;
      if (pollInterval) clearInterval(pollInterval);
    }
  }

  function renderOrder(order, restaurant) {
    const currency = (restaurant && restaurant.currency) || '₹';
    const status = order.status;

    let bannerText = '';
    let bannerClass = '';
    if (status === 'new') {
      bannerText = '✨ Order Received! Your order has been sent to the kitchen.';
      bannerClass = 'banner-new';
    } else if (status === 'preparing') {
      bannerText = '🍳 On the Grill! Our chefs are preparing your items.';
      bannerClass = 'banner-preparing';
    } else if (status === 'ready') {
      bannerText = '🔔 Order Ready! A server is bringing this to your table.';
      bannerClass = 'banner-ready';
    } else if (status === 'completed') {
      bannerText = '✅ Order Served! Enjoy your delicious meal.';
      bannerClass = 'banner-completed';
    } else if (status === 'cancelled') {
      bannerText = '❌ This order has been cancelled.';
      bannerClass = 'banner-cancelled';
    }

    // Stepper active calculation
    const steps = [
      { key: 'new', label: 'Received', icon: '📝' },
      { key: 'preparing', label: 'Cooking', icon: '🔥' },
      { key: 'ready', label: 'Ready', icon: '🔔' },
      { key: 'completed', label: 'Served', icon: '✨' }
    ];

    const orderRank = { new: 0, preparing: 1, ready: 2, completed: 3, cancelled: -1 };
    const currentRank = orderRank[status] ?? 0;

    let stepperHtml = '';
    if (status !== 'cancelled') {
      stepperHtml = `
        <div class="order-stepper">
          ${steps.map((st, idx) => {
            const isCompleted = currentRank > idx;
            const isActive = currentRank === idx;
            const cls = isCompleted ? 'completed' : isActive ? 'active' : '';
            return `
              <div class="step-item ${cls}">
                <div class="step-circle">${isCompleted ? '✓' : st.icon}</div>
                <span class="step-label">${st.label}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    const itemsHtml = order.items.map(item => `
      <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed var(--line); font-size: 14.5px;">
        <div>
          <strong>${item.qty}&times;</strong> ${escapeHtml(item.name)}
        </div>
        <div>${currency}${(item.price * item.qty).toFixed(2)}</div>
      </div>
    `).join('');

    const noteHtml = order.note ? `
      <div style="background: #fff9e6; border-left: 3px solid var(--amber); padding: 10px 14px; border-radius: 0 8px 8px 0; margin: 16px 0; font-size: 13.5px;">
        <strong>Kitchen Note:</strong> ${escapeHtml(order.note)}
      </div>
    ` : '';

    const cancelBtnHtml = status === 'new' ? `
      <button class="btn btn-danger btn-sm" id="cancelOrderBtn" style="margin-top: 10px;">
        Cancel Order
      </button>
    ` : '';

    const placedTime = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    trackingContainer.innerHTML = `
      <div class="order-status-banner ${bannerClass}">${bannerText}</div>

      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
        <div>
          <span style="font-size: 12px; color: var(--muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.08em;">Order #</span>
          <div style="font-family: var(--font-serif); font-size: 30px; font-weight: 700; color: var(--ink); line-height: 1.1;">
            ${escapeHtml(order.code)}
          </div>
          <div style="font-size: 12.5px; color: var(--muted); margin-top: 3px;">Placed at ${placedTime}</div>
        </div>
        <div style="text-align: right; background: var(--cream); border: 1.5px solid var(--line); border-radius: var(--radius-md); padding: 8px 16px;">
          <span style="font-size: 10.5px; color: var(--muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.1em; display: block;">Table</span>
          <span style="font-family: var(--font-serif); font-size: 26px; font-weight: 700; color: var(--ink); line-height: 1;">${order.table}</span>
        </div>
      </div>

      ${stepperHtml}

      <div style="margin-top: 24px;">
        <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 8px; color: var(--ink-light);">Order Summary</h3>
        ${itemsHtml}
        ${noteHtml}
        <div style="display: flex; justify-content: space-between; padding-top: 14px; font-size: 18px; font-weight: 700; color: var(--ink);">
          <span>Total</span>
          <span>${currency}${Number(order.total).toFixed(2)}</span>
        </div>
      </div>

      <div style="margin-top: 32px; display: flex; flex-direction: column; gap: 10px;">
        <a href="/menu?table=${order.table}" class="btn btn-primary btn-lg" style="width: 100%;">
          Order More Items
        </a>
        ${cancelBtnHtml}
      </div>
    `;

    // Attach cancel button event if present
    const cancelBtn = document.getElementById('cancelOrderBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to cancel this order?')) return;
        cancelBtn.disabled = true;
        cancelBtn.textContent = 'Cancelling...';

        try {
          const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}/cancel`, { method: 'POST' });
          const resData = await res.json();
          if (!res.ok) throw new Error(resData.error || 'Could not cancel order.');
          showToast('Order cancelled.', 'info');
          fetchOrder();
        } catch (err) {
          showToast(err.message, 'error');
          cancelBtn.disabled = false;
          cancelBtn.textContent = 'Cancel Order';
        }
      });
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Initial fetch and start auto-polling
  fetchOrder();
  pollInterval = setInterval(fetchOrder, 3500);

  // Stop polling if user leaves page
  window.addEventListener('beforeunload', () => {
    if (pollInterval) clearInterval(pollInterval);
  });

})();
