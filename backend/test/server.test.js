const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');

process.env.ADMIN_USERNAME = 'test-editor';
process.env.ADMIN_PASSWORD = 'test-editor-password';
process.env.ADMIN_TOKEN_SECRET = 'test-only-secret-that-is-long-enough-for-hmac';

const { app } = require('../server');

let server;
let baseUrl;

before(async () => {
    server = await new Promise((resolve) => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
});

test('health endpoint reports the API and database status', async () => {
    const response = await fetch(`${baseUrl}/api/test`);
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.success, true);
    assert.equal(typeof result.database, 'string');
});

test('admin login returns a signed expiring token for configured credentials', async () => {
    const response = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test-editor', password: 'test-editor-password' })
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.success, true);
    assert.equal(typeof result.token, 'string');
    assert.ok(result.expiresIn > 0);
});

test('admin login rejects incorrect credentials', async () => {
    const response = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test-editor', password: 'wrong-password' })
    });

    assert.equal(response.status, 401);
});

test('job writes require a valid admin token', async () => {
    const response = await fetch(`${baseUrl}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Protected vacancy' })
    });
    const result = await response.json();

    assert.equal(response.status, 401);
    assert.equal(result.success, false);
});

test('job write validation rejects unsupported fields after authentication', async () => {
    const loginResponse = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test-editor', password: 'test-editor-password' })
    });
    const { token } = await loginResponse.json();

    const response = await fetch(`${baseUrl}/api/jobs`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ unsupported: true })
    });
    const result = await response.json();

    assert.equal(response.status, 400);
    assert.match(result.message, /supported job field/i);
});

test('job list rejects invalid pagination parameters', async () => {
    const response = await fetch(`${baseUrl}/api/jobs?page=0&limit=10`);

    assert.equal(response.status, 400);
});

test('job detail rejects malformed ids without querying the database', async () => {
    const response = await fetch(`${baseUrl}/api/jobs/not-an-object-id`);

    assert.equal(response.status, 400);
});
