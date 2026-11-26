(function() {
  'use strict';

  const qrModal = document.getElementById('qrModal');
  const qrModalTitle = document.getElementById('qrModalTitle');
  const qrModalSvg = document.getElementById('qrModalSvg');
  const qrModalUrl = document.getElementById('qrModalUrl');
  const openModalUrlBtn = document.getElementById('openModalUrlBtn');
  const copyModalUrlBtn = document.getElementById('copyModalUrlBtn');
  let currentModalLink = '';

  function showQrForTable(tableNum) {
    qrModalTitle.textContent = `Table ${tableNum} QR Code`;
    qrModalSvg.innerHTML = '<span style="color: #666;">Generating QR...</span>';
    qrModalUrl.textContent = '';
    qrModal.classList.add('active');

    fetch(`/api/qr?table=${tableNum}&json=1`)
      .then(res => res.json())
      .then(data => {
        qrModalSvg.innerHTML = data.svg;
        qrModalUrl.textContent = data.url;
        currentModalLink = data.url;
        openModalUrlBtn.href = data.url;
      })
      .catch(() => {
        qrModalSvg.innerHTML = '<span style="color: #ef4444;">Failed to load QR code.</span>';
      });
  }

  document.getElementById('closeQrModal').addEventListener('click', () => qrModal.classList.remove('active'));
  qrModal.addEventListener('click', (event) => {
    if (event.target === qrModal) qrModal.classList.remove('active');
  });

  document.getElementById('heroScanBtn').addEventListener('click', () => showQrForTable(1));
  copyModalUrlBtn.addEventListener('click', () => {
    if (!currentModalLink) return;
    navigator.clipboard.writeText(currentModalLink).then(() => {
      const originalLabel = copyModalUrlBtn.textContent;
      copyModalUrlBtn.textContent = '✅ Copied!';
      setTimeout(() => { copyModalUrlBtn.textContent = originalLabel; }, 2000);
    });
  });

  function renderTables(count = 17, filter = 'all') {
    const container = document.getElementById('tablesContainer');
    container.innerHTML = '';

    for (let tableNum = 1; tableNum <= count; tableNum++) {
      if (filter === 'grill' && (tableNum < 1 || tableNum > 8)) continue;
      if (filter === 'family' && (tableNum < 9 || tableNum > 14)) continue;
      if (filter === 'royal' && (tableNum < 15 || tableNum > 17)) continue;

      const paddedNumber = tableNum < 10 ? `0${tableNum}` : `${tableNum}`;
      const card = document.createElement('div');
      card.className = 'table-stand-card';
      card.innerHTML = `
        <div class="table-stand-tag">Table Stand</div>
        <div class="table-stand-num">${paddedNumber}</div>
        <div class="table-grill-badge">🟢 Grill Ready</div>
        <div class="table-card-actions">
          <a href="/menu?table=${tableNum}" class="table-btn-menu">Open</a>
          <button type="button" class="table-btn-qr" title="Scan QR" aria-label="Show QR code for table ${tableNum}">📱</button>
        </div>
      `;
      card.querySelector('.table-btn-qr').addEventListener('click', (event) => {
        event.stopPropagation();
        showQrForTable(tableNum);
      });
      card.addEventListener('click', () => {
        window.location.href = `/menu?table=${tableNum}`;
      });
      container.appendChild(card);
    }
  }

  document.querySelectorAll('.sim-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sim-tab').forEach(item => item.classList.remove('active'));
      tab.classList.add('active');
      renderTables(17, tab.getAttribute('data-filter'));
    });
  });

  fetch('/api/menu')
    .then(res => res.json())
    .then(data => renderTables(data.tableCount || 17, 'all'))
    .catch(() => renderTables(17, 'all'));
})();
