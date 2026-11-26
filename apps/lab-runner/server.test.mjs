/**
 * Testy runnera na prawdziwych procesach i prawdziwym HTTP. Zamiast `uv run` startuje tu
 * `node -e ...`, żeby test nie wymagał Javy ani PySpark: sprawdzamy mechanikę runnera, nie Sparka.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { HOST, configFromEnv, createLabRunner, javaMajor, loadRegistry } from './server.mjs';

const ORIGIN = 'http://localhost:5173';
const SCRIPTS = {
  hello: `console.log('zażółć gęślą jaźń'); console.error('uwaga'); console.log('koniec')`,
  fail: `console.error('boom'); process.exit(3)`,
  sleep: `console.log('start'); setTimeout(() => {}, 60000)`,
  flood: `const s = 'x'.repeat(1024); setInterval(() => console.log(s), 1)`,
  env: `console.log(JSON.stringify({ secret: process.env.OSDE_TEST_SECRET ?? null, unbuffered: process.env.PYTHONUNBUFFERED, sparkIp: process.env.SPARK_LOCAL_IP }))`,
  missing: null
};
const registry = new Map(Object.keys(SCRIPTS).map(id => [id, { id, script: `${id}.py`, timeoutSec: id === 'sleep' ? 0.4 : 20, sha256: 'x' }]));
registry.set('slow', { id: 'slow', script: 'slow.py', timeoutSec: 20, sha256: 'x' });

let server, base;
before(async () => {
  process.env.OSDE_TEST_SECRET = 'nie-dla-labu';
  server = createLabRunner({
    registry,
    labsDir: tmpdir(),
    origins: [ORIGIN],
    limits: { maxOutputBytes: 64 * 1024, killGraceMs: 500 },
    probe: async () => ({ uv: { found: true }, java: { found: false } }),
    command: lab => (lab.id === 'missing' ? { cmd: 'osde-nie-ma-takiego-polecenia', args: [] } : { cmd: process.execPath, args: ['-e', SCRIPTS[lab.id] ?? SCRIPTS.sleep] })
  });
  await new Promise(resolve => server.listen(0, HOST, resolve));
  base = `http://${HOST}:${server.address().port}`;
});
after(() => {
  server.closeAllConnections();
  server.close();
});

const post = (id, init = {}) => fetch(`${base}/api/labs/${id}/run`, { method: 'POST', headers: { Origin: ORIGIN }, ...init });
const events = async response => (await response.text()).trim().split('\n').map(line => JSON.parse(line));
/** Surowe żądanie: fetch nie pozwala ustawić nagłówka Host. */
const raw = (headers, method = 'GET', pathname = '/api/health') =>
  new Promise((resolve, reject) => {
    import('node:http').then(({ request }) => {
      const req = request({ host: HOST, port: server.address().port, path: pathname, method, headers }, res => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      });
      req.on('error', reject);
      req.end();
    });
  });

describe('granice dostępu', () => {
  it('nasłuchuje tylko na 127.0.0.1', () => {
    assert.equal(server.address().address, '127.0.0.1');
  });
  it('odrzuca obce źródło, także przy odczycie stanu', async () => {
    assert.equal((await fetch(`${base}/api/health`, { headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await post('hello', { headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await post('hello', { headers: { Origin: 'http://localhost:9999' } })).status, 403);
  });
  it('nie uruchamia niczego bez nagłówka Origin', async () => {
    assert.equal((await fetch(`${base}/api/labs/hello/run`, { method: 'POST' })).status, 403);
  });
  it('odrzuca obcy nagłówek Host (DNS rebinding)', async () => {
    assert.equal(await raw({ Host: 'evil.example:8765' }), 403);
    assert.equal(await raw({ Host: `${HOST}:${server.address().port}` }), 200);
  });
  it('odpowiada na preflight tylko dozwolonemu źródłu', async () => {
    const ok = await fetch(`${base}/api/labs/hello/run`, { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' } });
    assert.equal(ok.status, 204);
    assert.equal(ok.headers.get('access-control-allow-origin'), ORIGIN);
    const bad = await fetch(`${base}/api/labs/hello/run`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
    assert.equal(bad.status, 403);
    assert.equal(bad.headers.get('access-control-allow-origin'), null);
  });
  it('zna tylko laby z allowlisty i tylko dwie ścieżki', async () => {
    assert.equal((await post('nie-ma-takiego')).status, 404);
    assert.equal((await post(encodeURIComponent('../../etc/passwd'))).status, 404);
    assert.equal((await post(encodeURIComponent('hello; rm -rf /'))).status, 404);
    assert.equal((await fetch(`${base}/api/exec`, { method: 'POST', headers: { Origin: ORIGIN } })).status, 404);
    assert.equal((await fetch(`${base}/api/labs/hello/run`, { headers: { Origin: ORIGIN } })).status, 405);
  });
  it('ignoruje treść żądania i odrzuca zbyt dużą', async () => {
    const big = await post('hello', { headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ cmd: 'x'.repeat(4096) }) });
    assert.equal(big.status, 413);
    const small = await events(await post('hello', { headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ script: '/bin/sh', args: ['-c', 'id'] }) }));
    assert.match(small[0].command, /-e/);
    assert.equal(small.at(-1).status, 'ok');
  });
});

describe('uruchomienie', () => {
  it('stan: lista labów i diagnostyka środowiska', async () => {
    const health = await (await fetch(`${base}/api/health`, { headers: { Origin: ORIGIN } })).json();
    assert.equal(health.service, 'osde-lab-runner');
    assert.equal(health.busy, false);
    assert.ok(health.labs.some(lab => lab.id === 'hello'));
    assert.equal(health.env.java.found, false);
  });
  it('strumieniuje stdout i stderr osobno, bez psucia znaków UTF-8, i kończy statusem ok', async () => {
    const all = await events(await post('hello'));
    assert.equal(all[0].type, 'start');
    assert.equal(all[0].labId, 'hello');
    assert.equal(all.filter(e => e.type === 'stdout').map(e => e.data).join(''), 'zażółć gęślą jaźń\nkoniec\n');
    assert.equal(all.filter(e => e.type === 'stderr').map(e => e.data).join(''), 'uwaga\n');
    const end = all.at(-1);
    assert.deepEqual([end.type, end.status, end.exitCode], ['end', 'ok', 0]);
    assert.ok(end.durationMs >= 0);
  });
  it('zgłasza kod wyjścia nieudanego skryptu', async () => {
    const end = (await events(await post('fail'))).at(-1);
    assert.deepEqual([end.status, end.exitCode], ['failed', 3]);
  });
  it('zgłasza brak polecenia zamiast wisieć', async () => {
    const end = (await events(await post('missing'))).at(-1);
    assert.equal(end.status, 'error');
    assert.match(end.message, /Nie znaleziono polecenia/);
  });
  it('przekazuje labowi tylko wybrane zmienne środowiskowe', async () => {
    const out = (await events(await post('env'))).find(e => e.type === 'stdout');
    assert.deepEqual(JSON.parse(out.data), { secret: null, unbuffered: '1', sparkIp: '127.0.0.1' });
  });
});

describe('limity i przerywanie', () => {
  it('zabija proces po przekroczeniu limitu czasu', async () => {
    const end = (await events(await post('sleep'))).at(-1);
    assert.equal(end.status, 'timeout');
    assert.ok(end.durationMs < 5000);
  });
  it('zabija proces po przekroczeniu limitu wyjścia', async () => {
    const all = await events(await post('flood'));
    assert.equal(all.at(-1).status, 'output-limit');
    assert.ok(all.filter(e => e.type === 'stdout').reduce((n, e) => n + e.data.length, 0) <= 64 * 1024);
  });
  it('nie uruchamia drugiego labu, gdy pierwszy działa, a rozłączenie klienta przerywa uruchomienie', async () => {
    const controller = new AbortController();
    const first = await post('slow', { signal: controller.signal });
    const reader = first.body.getReader();
    await reader.read(); // zdarzenie start: proces już działa
    const second = await post('hello');
    assert.equal(second.status, 409);
    assert.equal((await second.json()).labId, 'slow');

    controller.abort();
    await reader.closed.catch(() => {});
    // Po rozłączeniu runner ubija proces i zwalnia miejsce.
    let health;
    for (let i = 0; i < 50; i++) {
      health = await (await fetch(`${base}/api/health`, { headers: { Origin: ORIGIN } })).json();
      if (!health.busy) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(health.busy, false);
    assert.equal((await events(await post('hello'))).at(-1).status, 'ok');
  });
});

describe('allowlista i konfiguracja', () => {
  it('prawdziwa allowlista wskazuje istniejące skrypty', () => {
    const real = loadRegistry();
    assert.ok(real.has('spark-lazy-evaluation-lab'));
    for (const lab of real.values()) assert.match(lab.sha256, /^[0-9a-f]{64}$/);
  });
  it('odrzuca wpisy wychodzące poza katalog labów', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'osde-registry-'));
    const write = labs => writeFileSync(path.join(dir, 'registry.json'), JSON.stringify({ labs }));
    try {
      mkdirSync(path.join(dir, 'ok'));
      writeFileSync(path.join(dir, 'ok', 'lab.py'), 'print(1)\n');
      symlinkSync('/etc/hostname', path.join(dir, 'ok', 'link.py'));
      write([{ id: 'a', script: 'ok/lab.py', timeoutSec: 10 }]);
      assert.equal(loadRegistry(dir).get('a').script, 'ok/lab.py');
      for (const bad of [
        { id: 'a', script: '../outside.py', timeoutSec: 10 },
        { id: 'a', script: '/etc/passwd', timeoutSec: 10 },
        { id: 'a', script: 'ok/lab.py; id', timeoutSec: 10 },
        { id: 'a', script: 'ok/missing.py', timeoutSec: 10 },
        { id: 'a', script: 'ok/link.py', timeoutSec: 10 },
        { id: 'A b', script: 'ok/lab.py', timeoutSec: 10 },
        { id: 'a', script: 'ok/lab.py', timeoutSec: 100000 }
      ]) {
        write([bad]);
        assert.throws(() => loadRegistry(dir), JSON.stringify(bad));
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('rozpoznaje wersję Javy w obu formatach', () => {
    assert.equal(javaMajor('openjdk version "21.0.2" 2024-01-16'), 21);
    assert.equal(javaMajor('openjdk version "17" 2021-09-14'), 17);
    assert.equal(javaMajor('java version "1.8.0_392"'), 8);
    assert.equal(javaMajor('command not found'), null);
  });
  it('port i dodatkowe źródła bierze z otoczenia, ale ich nie zgaduje', () => {
    assert.equal(configFromEnv({}).port, 8765);
    assert.ok(configFromEnv({ LAB_RUNNER_ORIGINS: 'http://localhost:3000' }).origins.includes('http://localhost:3000'));
    assert.throws(() => configFromEnv({ LAB_RUNNER_ORIGINS: '*' }));
    assert.throws(() => configFromEnv({ LAB_RUNNER_ORIGINS: 'http://localhost:3000/app' }));
    assert.throws(() => configFromEnv({ LAB_RUNNER_PORT: '80' }));
  });
});
