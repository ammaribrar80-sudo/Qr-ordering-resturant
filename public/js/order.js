// Guest Order Tracking JS
(function() {
  'use strict';

  let currentOrder = null;
  let pollInterval = null;
  let activePayTab = 'upi';
  let qrLoadedForOrderId = null;

  const trackingContainer = document.getElementById('trackingContainer');
  const resName = document.getElementById('resName');
  const resOutlet = document.getElementById('resOutlet');
  const toastContainer = document.getElementById('toastContainer');

  async function fetchOrderUpiQr(order) {
    if (qrLoadedForOrderId === order.id && document.getElementById('orderUpiQrSvg').querySelector('svg')) return;
    try {
      const res = await fetch(`/api/upi-qr?amount=${order.total}&table=${order.table}&code=${encodeURIComponent(order.code)}`);
      if (!res.ok) return;
      const data = await res.json();
      qrLoadedForOrderId = order.id;
      const qrEl = document.getElementById('orderUpiQrSvg');
      if (qrEl) qrEl.innerHTML = data.svg;
      const deepLink = document.getElementById('orderUpiDeepLink');
      if (deepLink) deepLink.href = data.upiUri;
      const ph = document.getElementById('orderPhonepeLink');
      if (ph) ph.href = data.upiUri;
      const gp = document.getElementById('orderGpayLink');
      if (gp) gp.href = data.upiUri;
      const pt = document.getElementById('orderPaytmLink');
      if (pt) pt.href = data.upiUri;
      const vpa = document.getElementById('orderVpaText');
      if (vpa) vpa.textContent = data.vpa || 'barbequenation@okaxis';
    } catch (e) {
      console.warn('Could not load UPI QR:', e);
    }
  }

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

    let paymentCardHtml = '';
    if (status !== 'cancelled') {
      if (order.paymentStatus === 'paid') {
        paymentCardHtml = `
          <div style="background: #eafaf1; border: 1.5px solid #a9dfbf; border-radius: var(--radius-md); padding: 18px; margin-top: 24px; text-align: center;">
            <div style="font-size: 32px; margin-bottom: 4px;">✅</div>
            <h4 style="font-size: 17px; color: #1e8449; margin: 0 0 4px; font-weight: 700;">Bill Settled &amp; Paid</h4>
            <p style="font-size: 13px; color: #27ae60; margin: 0;">Payment confirmed by restaurant staff. Thank you for dining with us!</p>
          </div>
        `;
      } else if (order.paymentStatus === 'pending_verification') {
        paymentCardHtml = `
          <div style="background: #fef9e7; border: 1.5px solid #fae8a4; border-radius: var(--radius-md); padding: 18px; margin-top: 24px; text-align: center;">
            <div style="font-size: 32px; margin-bottom: 4px;">⏳</div>
            <h4 style="font-size: 17px; color: #b78103; margin: 0 0 4px; font-weight: 700;">UPI Payment Pending Verification</h4>
            <p style="font-size: 13px; color: #7d5a00; margin: 0;">Staff has been alerted to verify the soundbox/SMS for ${currency}${Number(order.total).toFixed(2)}. This screen updates automatically.</p>
          </div>
        `;
      } else {
        paymentCardHtml = `
          <div style="background: #fff; border: 1.5px solid var(--line); border-radius: var(--radius-md); padding: 20px; margin-top: 24px; box-shadow: var(--shadow-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <div>
                <h4 style="font-size: 16px; font-weight: 700; color: var(--ink); margin: 0;">Settle Bill &amp; Pay</h4>
                <p style="font-size: 12.5px; color: var(--muted); margin: 2px 0 0;">Pay when you are done eating at table or counter</p>
              </div>
              <span style="font-size: 22px;">💳</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px;">
              <button type="button" class="btn btn-sm ${activePayTab === 'upi' ? 'btn-primary' : 'btn-outline'}" id="payTabUpiBtn" style="font-weight: 700;">
                ⚡ Instant UPI
              </button>
              <button type="button" class="btn btn-sm ${activePayTab === 'cash' ? 'btn-primary' : 'btn-outline'}" id="payTabCashBtn" style="font-weight: 700;">
                💵 Pay with Cash
              </button>
            </div>

            <div id="payUpiSection" style="${activePayTab === 'upi' ? 'display:block;' : 'display:none;'}">
              <div style="text-align: center; margin-bottom: 12px;">
                <div id="orderUpiQrSvg" style="display: flex; justify-content: center; min-height: 150px; align-items: center;">Loading UPI QR...</div>
                <div style="font-size: 12px; color: var(--muted); font-weight: 600; margin-top: 4px;">Scan with PhonePe, GPay, Paytm or BHIM</div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;">
                <a href="#" id="orderUpiDeepLink" class="btn-upi-app btn-upi-universal" style="text-align: center;">⚡ Open Installed UPI App</a>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
                  <a href="#" id="orderPhonepeLink" class="upi-quick-btn phonepe-color" style="text-align: center;">🟣 PhonePe</a>
                  <a href="#" id="orderGpayLink" class="upi-quick-btn gpay-color" style="text-align: center;">🔵 GPay</a>
                  <a href="#" id="orderPaytmLink" class="upi-quick-btn paytm-color" style="text-align: center;">🟦 Paytm</a>
                </div>
              </div>

              <div class="upi-vpa-row" style="margin-bottom: 14px;">
                <span>UPI ID:</span>
                <strong id="orderVpaText">${escapeHtml((restaurant && restaurant.upiVpa) || 'barbequenation@okaxis')}</strong>
                <button type="button" class="btn-copy-vpa" id="orderCopyVpaBtn">Copy</button>
              </div>

              <button type="button" class="btn btn-outline btn-sm" id="confirmUpiPaidBtn" style="width: 100%; border-color: var(--green); color: var(--green); font-weight: 700; padding: 10px;">
                ✓ I Have Paid via UPI (Alert Staff)
              </button>
            </div>

            <div id="payCashSection" style="${activePayTab === 'cash' ? 'display:block;' : 'display:none;'} text-align: center; padding: 12px 6px;">
              <p style="font-size: 13.5px; color: var(--ink); margin-bottom: 12px;">
                Ready to settle in cash? You can call the server with the printed bill to Table <strong>${order.table}</strong>, or pay at the front reception counter upon exit.
              </p>
              <button type="button" class="btn btn-outline btn-sm" id="requestCashBillBtn" style="width: 100%; border-color: var(--accent); color: var(--accent); font-weight: 700; padding: 10px;">
                🛎️ Call Waiter with Cash Bill
              </button>
            </div>
          </div>
        `;
      }
    }

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

      ${paymentCardHtml}

      <div style="margin-top: 28px; display: flex; flex-direction: column; gap: 10px;">
        <a href="/menu?table=${order.table}" class="btn btn-primary btn-lg" style="width: 100%;">
          Order More Items
        </a>
        ${cancelBtnHtml}
      </div>
    `;

    // Hook up payment interactions
    if (order.paymentStatus === 'pending') {
      const payTabUpiBtn = document.getElementById('payTabUpiBtn');
      const payTabCashBtn = document.getElementById('payTabCashBtn');
      const payUpiSection = document.getElementById('payUpiSection');
      const payCashSection = document.getElementById('payCashSection');

      if (payTabUpiBtn && payTabCashBtn) {
        payTabUpiBtn.onclick = () => {
          activePayTab = 'upi';
          payTabUpiBtn.className = 'btn btn-sm btn-primary';
          payTabCashBtn.className = 'btn btn-sm btn-outline';
          payUpiSection.style.display = 'block';
          payCashSection.style.display = 'none';
        };
        payTabCashBtn.onclick = () => {
          activePayTab = 'cash';
          payTabCashBtn.className = 'btn btn-sm btn-primary';
          payTabUpiBtn.className = 'btn btn-sm btn-outline';
          payUpiSection.style.display = 'none';
          payCashSection.style.display = 'block';
        };
      }

      // Fetch dynamic UPI QR
      fetchOrderUpiQr(order);

      const orderCopyVpaBtn = document.getElementById('orderCopyVpaBtn');
      if (orderCopyVpaBtn) {
        orderCopyVpaBtn.onclick = () => {
          const vpaText = document.getElementById('orderVpaText').textContent;
          navigator.clipboard.writeText(vpaText).then(() => showToast('UPI ID copied!', 'success'));
        };
      }

      const confirmUpiPaidBtn = document.getElementById('confirmUpiPaidBtn');
      if (confirmUpiPaidBtn) {
        confirmUpiPaidBtn.onclick = async () => {
          confirmUpiPaidBtn.disabled = true;
          confirmUpiPaidBtn.textContent = 'Notifying Staff...';
          try {
            const r = await fetch(`/api/orders/${encodeURIComponent(order.id)}/pay`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ method: 'upi' })
            });
            if (!r.ok) throw new Error('Could not submit payment notice.');
            showToast('Staff alerted! They will verify and update your bill.', 'success');
            fetchOrder();
          } catch (e) {
            showToast(e.message, 'error');
            confirmUpiPaidBtn.disabled = false;
            confirmUpiPaidBtn.textContent = '✓ I Have Paid via UPI (Alert Staff)';
          }
        };
      }

      const requestCashBillBtn = document.getElementById('requestCashBillBtn');
      if (requestCashBillBtn) {
        requestCashBillBtn.onclick = async () => {
          requestCashBillBtn.disabled = true;
          requestCashBillBtn.textContent = 'Requesting Server...';
          try {
            const r = await fetch(`/api/orders/${encodeURIComponent(order.id)}/pay`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ method: 'cash' })
            });
            if (!r.ok) throw new Error('Could not request cash bill.');
            showToast('Staff requested with physical bill!', 'success');
            fetchOrder();
          } catch (e) {
            showToast(e.message, 'error');
            requestCashBillBtn.disabled = false;
            requestCashBillBtn.textContent = '🛎️ Call Waiter with Cash Bill';
          }
        };
      }
    }

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
