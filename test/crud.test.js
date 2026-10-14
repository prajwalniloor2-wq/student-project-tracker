import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
const directory = mkdtempSync(join(tmpdir(), 'tracker-test-'));
const port = 3198;
let server;
async function start() {
  server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), DB_FILE: join(directory, 'projects.db') }, stdio: ['ignore', 'pipe', 'pipe'] });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://localhost:${port}/api/health`)).ok) return; } catch {} await new Promise(r => setTimeout(r, 50)); }
  throw new Error('Server did not start.');
}
async function stop() { if (!server || server.exitCode !== null) return; await new Promise(resolve => { server.once('exit', resolve); server.kill(); }); }
const url = `http://localhost:${port}/api/projects`;
const options = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
test('CRUD, validation, persistence, API errors and static frontend', async () => {
  try {
    await start();
    assert.deepEqual(await (await fetch(url)).json(), []);
    assert.equal((await fetch(url, options('POST', { name: ' ', status: 'Planned' }))).status, 400);
    assert.equal((await fetch(url, options('POST', { name: 'IoT', status: 'Unknown' }))).status, 400);
    assert.equal((await fetch(url, options('POST', { name: 'x'.repeat(81), status: 'Planned' }))).status, 400);
    const response = await fetch(url, options('POST', { name: "  IoT Monitor's test  ", status: 'Planned' }));
    assert.equal(response.status, 201); const row = await response.json();
    assert.equal(row.name, "IoT Monitor's test");
    const updated = await fetch(`${url}/${row.id}`, options('PUT', { name: 'Smart Home', status: 'Completed' }));
    assert.equal((await updated.json()).status, 'Completed');
    await stop(); await start();
    assert.equal((await (await fetch(url)).json())[0].name, 'Smart Home');
    assert.equal((await fetch(`${url}/0`, { method: 'DELETE' })).status, 400);
    assert.equal((await fetch(`${url}/999999`, options('PUT', { name: 'Missing', status: 'Planned' }))).status, 404);
    assert.equal((await fetch(`${url}/${row.id}`, { method: 'DELETE' })).status, 200);
    assert.equal((await fetch(`${url}/${row.id}`, { method: 'DELETE' })).status, 404);
    assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
    assert.equal((await fetch('http://localhost:3198/api/unknown')).status, 404);
    assert.match(await (await fetch('http://localhost:3198/')).text(), /Student Project Tracker/);
    assert.deepEqual(await (await fetch(url)).json(), []);
  } finally { await stop(); rmSync(directory, { recursive: true, force: true }); }
});
