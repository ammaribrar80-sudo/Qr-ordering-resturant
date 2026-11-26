'use strict';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-ordering-security-'));
const adminPin = 'test-passcode-123';
let serverProcess;
let baseUrl;

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

test('service requests are private to the guest token and never expose it in lists', async () => {
  const unauthenticatedAdmin = await fetch(`${baseUrl}/api/admin/service-requests`);
  assert.equal(unauthenticatedAdmin.status, 401);

  const publicWithoutToken = await fetch(`${baseUrl}/api/service-requests?table=1`);
  assert.equal(publicWithoutToken.status, 403);

  const invalidNote = await fetch(`${baseUrl}/api/service-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table: 1, type: 'water', note: { private: true } }),
  });
  assert.equal(invalidNote.status, 400);

  const createResponse = await fetch(`${baseUrl}/api/service-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table: 1, type: 'water', note: 'Please bring water.' }),
  });
  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()).serviceRequest;
  assert.match(created.guestToken, /^[a-f0-9]{48}$/);

  const wrongToken = await fetch(`${baseUrl}/api/service-requests?table=1`, {
    headers: { 'X-Guest-Token': 'not-the-token' },
  });
  assert.equal(wrongToken.status, 403);

  const guestRead = await fetch(`${baseUrl}/api/service-requests?table=1`, {
    headers: { 'X-Guest-Token': created.guestToken },
  });
  assert.equal(guestRead.status, 200);
  const guestRequests = (await guestRead.json()).serviceRequests;
  assert.equal(guestRequests.length, 1);
  assert.equal(guestRequests[0].note, 'Please bring water.');
  assert.equal(Object.hasOwn(guestRequests[0], 'guestToken'), false);

  const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: adminPin }),
  });
  assert.equal(loginResponse.status, 200);
  const setCookie = loginResponse.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=Strict/i);
  const cookie = setCookie.split(';', 1)[0];

  const formulaNoteOrder = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table: 1,
      items: [{ id: 'paneer-tikka', qty: 1 }],
      note: '=1+1',
    }),
  });
  assert.equal(formulaNoteOrder.status, 201);

  const adminRead = await fetch(`${baseUrl}/api/admin/service-requests`, {
    headers: { Cookie: cookie },
  });
  assert.equal(adminRead.status, 200);
  const adminRequests = (await adminRead.json()).serviceRequests;
  assert.equal(adminRequests.length, 1);
  assert.equal(Object.hasOwn(adminRequests[0], 'guestToken'), false);

  const invalidStatus = await fetch(`${baseUrl}/api/admin/service-requests/${created.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ status: 'unexpected' }),
  });
  assert.equal(invalidStatus.status, 400);

  const csvResponse = await fetch(`${baseUrl}/api/admin/orders.csv`, {
    headers: { Cookie: cookie },
  });
  assert.equal(csvResponse.status, 200);
  assert.match(await csvResponse.text(), /"'=1\+1"/);

  assert.equal(createResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(createResponse.headers.get('cache-control'), 'no-store');
});

test('service-request creation is rate-limited per client IP', async () => {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/service-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 1, type: 'water', note: '' }),
    });
    assert.equal(response.status, 201);
  }

  const limited = await fetch(`${baseUrl}/api/service-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table: 1, type: 'water', note: '' }),
  });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '600');
});

test('production refuses an admin passcode shorter than 12 characters', async () => {
  const shortPinDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-ordering-short-pin-'));
  const port = await findFreePort();
  const child = spawn(process.execPath, [path.join(repoRoot, 'server.js')], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ADMIN_PIN: '2468',
      DATA_DIR: shortPinDataDir,
      HOST: '127.0.0.1',
      NODE_ENV: 'production',
      PORT: String(port),
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  try {
    const exitCode = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Server did not reject the short production passcode.'));
      }, 5000);
      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('exit', (code) => {
        clearTimeout(timeout);
        resolve(code);
      });
    });
    assert.equal(exitCode, 1);
    assert.match(stderr, /at least 12 characters/);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once('exit', resolve));
    }
    fs.rmSync(shortPinDataDir, { recursive: true, force: true });
  }
});
