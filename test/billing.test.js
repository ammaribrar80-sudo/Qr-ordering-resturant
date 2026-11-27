'use strict';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-ordering-billing-'));
const adminPin = 'billing-test-passcode';
let serverProcess;
let baseUrl;
let adminCookie;

async function findFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (serverProcess.exitCode !== null) throw new Error('Test server exited before becoming ready.');
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error('Test server did not become ready.');
}

async function requestJson(route, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (adminCookie) headers.Cookie = adminCookie;
  const response = await fetch(`${baseUrl}${route}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { response, data: await response.json() };
}

before(async () => {
  const port = await findFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, [path.join(repoRoot, 'server.js')], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ADMIN_PIN: adminPin,
      DATA_DIR: dataDir,
      HOST: '127.0.0.1',
      NODE_ENV: 'production',
      PORT: String(port),
      PUBLIC_URL: baseUrl,
    },
    stdio: 'ignore',
  });
  await waitForServer();
});

after(async () => {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill();
    await new Promise((resolve) => serverProcess.once('exit', resolve));
  }
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('table bills include completed orders, audit edits, and lock finalized totals', async () => {
  const login = await requestJson('/api/admin/login', {
    method: 'POST',
    body: { pin: adminPin },
  });
  assert.equal(login.response.status, 200);
  adminCookie = login.response.headers.get('set-cookie').split(';', 1)[0];

  const createOrder = async (itemId, qty) => {
    const result = await requestJson('/api/orders', {
      method: 'POST',
      body: { table: 1, items: [{ id: itemId, qty }] },
    });
    assert.equal(result.response.status, 201);
    return result.data.order;
  };
  const completeOrder = async (order) => {
    for (const status of ['preparing', 'ready']) {
      const result = await requestJson(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        body: { status },
      });
      assert.equal(result.response.status, 200);
    }
    const result = await requestJson(`/api/admin/orders/${order.id}`, {
      method: 'PATCH',
      body: { status: 'completed', handoff: 'table' },
    });
    assert.equal(result.response.status, 200);
  };

  const firstOrder = await createOrder('paneer-tikka', 2);
  const secondOrder = await createOrder('butter-naan', 1);
  await completeOrder(firstOrder);
  await completeOrder(secondOrder);

  const abandonedDraftResponse = await requestJson('/api/admin/bills', {
    method: 'POST',
    body: { table: 1, staffName: 'A. Staff' },
  });
  assert.equal(abandonedDraftResponse.response.status, 201);
  const abandonedDraft = abandonedDraftResponse.data.bill;
  assert.equal(abandonedDraft.status, 'draft');
  assert.equal(abandonedDraft.subtotal, 715);

  const duplicateDraft = await requestJson('/api/admin/bills', {
    method: 'POST',
    body: { table: 1, staffName: 'A. Staff' },
  });
  assert.equal(duplicateDraft.response.status, 409);

  const voidResponse = await requestJson(`/api/admin/bills/${abandonedDraft.id}/void`, {
    method: 'POST',
    body: { staffName: 'A. Staff', reason: 'Wrong table selected' },
  });
  assert.equal(voidResponse.response.status, 200);
  assert.equal(voidResponse.data.bill.status, 'void');

  const draftResponse = await requestJson('/api/admin/bills', {
    method: 'POST',
    body: { table: 1, staffName: 'A. Staff' },
  });
  assert.equal(draftResponse.response.status, 201);
  const draft = draftResponse.data.bill;
  assert.equal(draft.status, 'draft');
  assert.deepEqual(new Set(draft.orderIds), new Set([firstOrder.id, secondOrder.id]));
  assert.equal(draft.subtotal, 715);

  const settings = await requestJson('/api/admin/settings', {
    method: 'PATCH',
    body: { taxRate: 5, serviceChargeRate: 10 },
  });
  assert.equal(settings.response.status, 200);

  const paneerLine = draft.items.find((item) => item.itemId === 'paneer-tikka');
  const quantityCorrection = await requestJson(`/api/admin/bills/${draft.id}/adjustments`, {
    method: 'POST',
    body: {
      action: 'set-quantity',
      lineId: paneerLine.id,
      quantity: 1,
      staffName: 'A. Staff',
      reason: 'One portion was not served',
    },
  });
  assert.equal(quantityCorrection.response.status, 200);
  assert.equal(quantityCorrection.data.bill.subtotal, 390);

  const addedItem = await requestJson(`/api/admin/bills/${draft.id}/adjustments`, {
    method: 'POST',
    body: {
      action: 'add-item',
      itemId: 'butter-chicken',
      quantity: 1,
      staffName: 'A. Staff',
      reason: 'Guest requested one additional dish',
    },
  });
  assert.equal(addedItem.response.status, 200);
  assert.equal(addedItem.data.bill.subtotal, 785);
  assert.equal(addedItem.data.bill.tax, 39.25);
  assert.equal(addedItem.data.bill.serviceCharge, 78.5);
  assert.equal(addedItem.data.bill.total, 902.75);
  assert.ok(addedItem.data.bill.adjustments.some((entry) => entry.reason === 'One portion was not served'));

  const orders = await requestJson('/api/admin/orders');
  assert.equal(orders.response.status, 200);
  const savedFirstOrder = orders.data.orders.find((order) => order.id === firstOrder.id);
  assert.equal(savedFirstOrder.items[0].qty, 2);

  const finalized = await requestJson(`/api/admin/bills/${draft.id}/finalize`, {
    method: 'POST',
    body: { staffName: 'A. Staff' },
  });
  assert.equal(finalized.response.status, 200);
  assert.equal(finalized.data.bill.status, 'finalized');
  assert.equal(finalized.data.bill.total, 902.75);

  const changedSettings = await requestJson('/api/admin/settings', {
    method: 'PATCH',
    body: { taxRate: 0, serviceChargeRate: 0 },
  });
  assert.equal(changedSettings.response.status, 200);
  const history = await requestJson('/api/admin/bills');
  assert.equal(history.response.status, 200);
  const savedBill = history.data.bills.find((bill) => bill.id === draft.id);
  assert.equal(savedBill.total, 902.75);
  assert.equal(savedBill.taxRate, 5);
  assert.equal(savedBill.serviceChargeRate, 10);

  const editFinalized = await requestJson(`/api/admin/bills/${draft.id}/adjustments`, {
    method: 'POST',
    body: {
      action: 'set-quantity',
      lineId: paneerLine.id,
      quantity: 0,
      staffName: 'A. Staff',
      reason: 'Attempt to edit a final bill',
    },
  });
  assert.equal(editFinalized.response.status, 409);

  const changeBilledOrder = await requestJson(`/api/admin/orders/${firstOrder.id}`, {
    method: 'PATCH',
    body: { status: 'cancelled' },
  });
  assert.equal(changeBilledOrder.response.status, 409);

  const rebill = await requestJson('/api/admin/bills', {
    method: 'POST',
    body: { table: 1, staffName: 'A. Staff' },
  });
  assert.equal(rebill.response.status, 409);
});
