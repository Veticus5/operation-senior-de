/**
 * Lokalny runner labów. Uruchamia skrypty z allowlisty (labs/registry.json) i strumieniuje ich
 * prawdziwe wyjście do przeglądarki. Bez zależności: tylko moduły wbudowane w Node.
 *
 * Granice bezpieczeństwa, wszystkie egzekwowane tutaj:
 *  - nasłuch wyłącznie na 127.0.0.1 (adres nie jest konfigurowalny),
 *  - nagłówek Host musi wskazywać ten adres (ochrona przed DNS rebinding),
 *  - nagłówek Origin musi być na liście dozwolonych źródeł,
 *  - klient podaje wyłącznie identyfikator labu; polecenie i ścieżkę skryptu wyznacza allowlista,
 *  - proces startuje bez powłoki (shell: false), z okrojonym środowiskiem,
 *  - limity: czas, rozmiar wyjścia, jedno uruchomienie naraz.
 *
 * API:
 *  GET  /api/health          stan runnera, lista labów, diagnostyka środowiska
 *  POST /api/labs/<id>/run   uruchamia lab; odpowiedź to NDJSON: start, stdout/stderr, end.
 *                            Zamknięcie połączenia przez klienta przerywa uruchomienie.
 */
import http from 'node:http';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath } from 'node:url';

export const HOST = '127.0.0.1';
export const DEFAULT_PORT = 8765;
export const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];
export const DEFAULT_LIMITS = { maxOutputBytes: 2 * 1024 * 1024, maxTimeoutSec: 900, killGraceMs: 3000, maxBodyBytes: 1024 };
export const MIN_JAVA = 17;
export const DEFAULT_LABS_DIR = fileURLToPath(new URL('../../labs', import.meta.url));

/** Zmienne środowiskowe przekazywane do labu. Reszta środowiska runnera do procesu nie trafia. */
const ENV_PASSTHROUGH = ['PATH', 'HOME', 'USER', 'LANG', 'LC_ALL', 'TMPDIR', 'JAVA_HOME', 'UV_CACHE_DIR', 'XDG_CACHE_HOME', 'XDG_DATA_HOME'];

/**
 * Wczytuje allowlistę. Każdy wpis musi wskazywać istniejący plik .py wewnątrz katalogu labów
 * (także po rozwinięciu dowiązań), inaczej runner nie wystartuje.
 */
export function loadRegistry(labsDir = DEFAULT_LABS_DIR, limits = DEFAULT_LIMITS) {
  const root = realpathSync(labsDir);
  const { labs } = JSON.parse(readFileSync(path.join(root, 'registry.json'), 'utf8'));
  const registry = new Map();
  for (const lab of labs) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(lab.id)) throw new Error(`Niepoprawne id labu: ${lab.id}`);
    if (registry.has(lab.id)) throw new Error(`Powtórzone id labu: ${lab.id}`);
    if (!/^[a-z0-9_]+(\/[a-z0-9_]+)*\.py$/.test(lab.script)) throw new Error(`Niepoprawna ścieżka skryptu: ${lab.script}`);
    const file = path.join(root, lab.script);
    if (!existsSync(file)) throw new Error(`Brak skryptu: ${lab.script}`);
    if (!realpathSync(file).startsWith(root + path.sep)) throw new Error(`Skrypt poza katalogiem labów: ${lab.script}`);
    if (!(lab.timeoutSec > 0 && lab.timeoutSec <= limits.maxTimeoutSec)) throw new Error(`Niepoprawny limit czasu: ${lab.id}`);
    registry.set(lab.id, { id: lab.id, script: lab.script, timeoutSec: lab.timeoutSec, sha256: sha256File(file) });
  }
  return registry;
}

const exec = (cmd, args) =>
  new Promise(resolve => {
    execFile(cmd, args, { timeout: 5000, shell: false }, (error, stdout, stderr) => resolve({ ok: !error, text: `${stdout}\n${stderr}` }));
  });

/** `java -version` pisze np. `openjdk version "21.0.2"`, a stare wydania `"1.8.0_392"`. */
export function javaMajor(text) {
  const m = /version "(\d+)(?:\.(\d+))?/.exec(text);
  if (!m) return null;
  return m[1] === '1' && m[2] ? Number(m[2]) : Number(m[1]);
}

/** Sprawdza to, czego lab potrzebuje do startu. Zwraca fakty; komunikaty układa interfejs. */
export async function probeEnvironment(labsDir = DEFAULT_LABS_DIR) {
  // PySpark szuka Javy tak samo: najpierw JAVA_HOME, potem PATH.
  const javaBin = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'java') : 'java';
  const [uv, java] = await Promise.all([exec('uv', ['--version']), exec(javaBin, ['-version'])]);
  const major = java.ok ? javaMajor(java.text) : null;
  return {
    uv: { found: uv.ok, version: uv.ok ? uv.text.trim().split('\n')[0] : null },
    java: {
      found: java.ok,
      version: java.ok ? (/version "([^"]+)"/.exec(java.text)?.[1] ?? null) : null,
      major,
      required: MIN_JAVA,
      ok: major !== null && major >= MIN_JAVA,
      source: process.env.JAVA_HOME ? 'JAVA_HOME' : 'PATH'
    },
    // Bez .venv pierwsze `uv run` najpierw pobiera PySpark, co wlicza się do limitu czasu.
    deps: { ready: existsSync(path.join(labsDir, '.venv')) },
    platform: process.platform,
    node: process.version
  };
}

export function childEnv(source = process.env) {
  const env = {};
  for (const key of ENV_PASSTHROUGH) if (source[key] !== undefined) env[key] = source[key];
  env.PYTHONUNBUFFERED = '1'; // bez buforowania stdout wydruki labu docierają na żywo
  // Spark i jego interfejs WWW (port 4040) słuchają tylko na pętli zwrotnej, tak jak runner.
  // Ustawiane na końcu i nieprzekazywane z otoczenia: SPARK_LOCAL_IP runnera tego nie zmieni.
  env.SPARK_LOCAL_IP = '127.0.0.1';
  return env;
}

const sha256File = file => createHash('sha256').update(readFileSync(file)).digest('hex');

/** Czy skrypt na dysku jest tym samym plikiem, który runner zarejestrował przy starcie. */
export function scriptUnchanged(labsDir, lab) {
  try {
    return sha256File(path.join(labsDir, lab.script)) === lab.sha256;
  } catch {
    return false;
  }
}

/** Lab startuje we własnej grupie procesów, więc sygnał trafia też do JVM uruchomionej przez PySpark. */
function killGroup(child, signal) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    try { child.kill(signal); } catch { /* proces już nie istnieje */ }
  }
}

/**
 * Tworzy serwer runnera (bez nasłuchu). Opcje `command`, `probe` i `verify` istnieją dla testów:
 * nie da się ich ustawić przez HTTP ani przez zmienne środowiskowe.
 */
export function createLabRunner(options = {}) {
  const labsDir = options.labsDir ?? DEFAULT_LABS_DIR;
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  const registry = options.registry ?? loadRegistry(labsDir, limits);
  const origins = new Set(options.origins ?? DEFAULT_ORIGINS);
  const command = options.command ?? (lab => ({ cmd: 'uv', args: ['run', lab.script] }));
  const probe = options.probe ?? (() => probeEnvironment(labsDir));
  // Kod pokazany uczniowi i kod wykonany muszą być tym samym plikiem. Runner zapamiętuje skrót
  // skryptu przy starcie i odmawia uruchomienia, jeśli plik od tego czasu się zmienił.
  const verify = options.verify ?? (lab => scriptUnchanged(labsDir, lab));
  let active = null;

  const json = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
    res.end(JSON.stringify(body));
  };

  function run(lab, res, cors) {
    const { cmd, args } = command(lab);
    const started = performance.now();
    let stopReason = null;
    let done = false;
    let bytes = 0;
    let killTimer;
    const send = event => {
      if (!res.destroyed && !res.writableEnded) res.write(JSON.stringify(event) + '\n');
    };

    res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cors });
    const child = spawn(cmd, args, { cwd: labsDir, env: childEnv(), shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });

    const stop = reason => {
      if (stopReason || done) return;
      stopReason = reason;
      killGroup(child, 'SIGTERM');
      killTimer = setTimeout(() => killGroup(child, 'SIGKILL'), limits.killGraceMs);
    };
    const finish = result => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      clearTimeout(killTimer);
      active = null;
      send({ type: 'end', durationMs: Math.round(performance.now() - started), ...result });
      res.end();
    };
    const timeout = setTimeout(() => stop('timeout'), lab.timeoutSec * 1000);
    active = { id: lab.id, stop, closed: new Promise(resolve => child.once('close', resolve)) };

    send({ type: 'start', labId: lab.id, command: [cmd, ...args].join(' '), cwd: path.basename(labsDir), timeoutSec: lab.timeoutSec, startedAt: new Date().toISOString() });
    for (const stream of ['stdout', 'stderr']) {
      const decoder = new StringDecoder('utf8'); // znak UTF-8 może być rozcięty między porcjami
      child[stream].on('data', chunk => {
        if (stopReason) return;
        bytes += chunk.length;
        if (bytes > limits.maxOutputBytes) return stop('output-limit');
        const data = decoder.write(chunk);
        if (data) send({ type: stream, data });
      });
    }
    child.on('error', error => finish({ status: 'error', exitCode: null, signal: null, message: error.code === 'ENOENT' ? `Nie znaleziono polecenia: ${cmd}` : String(error.message) }));
    child.on('close', (exitCode, signal) => finish({ status: stopReason ?? (exitCode === 0 ? 'ok' : 'failed'), exitCode, signal }));
    res.on('close', () => stop('cancelled'));
  }

  async function handle(req, res) {
    const port = server.address()?.port;
    if (req.headers.host !== `${HOST}:${port}` && req.headers.host !== `localhost:${port}`) return json(res, 403, { error: 'host-not-allowed' });

    const origin = req.headers.origin;
    if (origin !== undefined && !origins.has(origin)) return json(res, 403, { error: 'origin-not-allowed' });
    // Wszystko poza odczytem stanu wymaga jawnego, dozwolonego źródła.
    if (origin === undefined && req.method !== 'GET') return json(res, 403, { error: 'origin-required' });
    const cors = origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};

    const { pathname } = new URL(req.url, `http://${HOST}`);
    const runMatch = /^\/api\/labs\/([^/]+)\/run$/.exec(pathname);
    if (pathname !== '/api/health' && !runMatch) return json(res, 404, { error: 'not-found' }, cors);

    const allowed = runMatch ? 'POST' : 'GET';
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': allowed, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
      return res.end();
    }
    if (req.method !== allowed) return json(res, 405, { error: 'method-not-allowed' }, { ...cors, Allow: allowed });

    if (!runMatch) {
      return json(res, 200, {
        service: 'osde-lab-runner',
        api: 1,
        busy: active !== null,
        labs: [...registry.values()].map(lab => ({ ...lab, changed: !verify(lab) })),
        limits: { maxOutputBytes: limits.maxOutputBytes, concurrentRuns: 1 },
        env: await probe()
      }, cors);
    }

    // Żądanie uruchomienia nie niesie żadnych danych: liczy się tylko id w ścieżce.
    if (Number(req.headers['content-length'] ?? 0) > limits.maxBodyBytes) return json(res, 413, { error: 'body-too-large' }, cors);
    let received = 0;
    req.on('data', chunk => {
      received += chunk.length;
      if (received > limits.maxBodyBytes) req.destroy();
    });

    const lab = registry.get(runMatch[1]);
    if (!lab) return json(res, 404, { error: 'unknown-lab' }, cors);
    if (active) return json(res, 409, { error: 'busy', labId: active.id }, cors);
    if (!verify(lab)) return json(res, 409, { error: 'script-changed', labId: lab.id }, cors);
    run(lab, res, cors);
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) json(res, 500, { error: 'internal' });
      else res.destroy();
    });
  });
  /**
   * Zamyka runner: przerywa trwający lab i czeka, aż jego grupa procesów naprawdę zniknie.
   * Najpierw SIGTERM, po `killGraceMs` SIGKILL. Czekanie jest ograniczone, żeby zamknięcie nie zawisło.
   */
  server.shutdown = async () => {
    const run = active;
    if (run) {
      run.stop('cancelled');
      await Promise.race([run.closed, new Promise(resolve => setTimeout(resolve, limits.killGraceMs + 2000))]);
    }
    await new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections();
    });
  };
  return server;
}

/** Konfiguracja z otoczenia: port i dodatkowe źródła. Adres nasłuchu jest stały. */
export function configFromEnv(env = process.env) {
  const port = env.LAB_RUNNER_PORT ? Number(env.LAB_RUNNER_PORT) : DEFAULT_PORT;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`Niepoprawny LAB_RUNNER_PORT: ${env.LAB_RUNNER_PORT}`);
  const extra = (env.LAB_RUNNER_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  for (const origin of extra) {
    let parsed;
    try { parsed = new URL(origin); } catch { throw new Error(`Niepoprawne źródło w LAB_RUNNER_ORIGINS: ${origin}`); }
    if (parsed.origin !== origin) throw new Error(`Źródło musi mieć postać schemat://host:port, bez ścieżki: ${origin}`);
  }
  return { port, origins: [...DEFAULT_ORIGINS, ...extra] };
}

/** Startuje runner i wypisuje, co wykrył. Zwraca serwer. */
export async function start() {
  const { port, origins } = configFromEnv();
  const server = createLabRunner({ origins });
  await new Promise((resolve, reject) => {
    server.once('error', error => reject(error.code === 'EADDRINUSE' ? new Error(`Port ${port} jest zajęty. Ustaw LAB_RUNNER_PORT (i VITE_LAB_RUNNER_URL dla aplikacji).`) : error));
    server.listen(port, HOST, resolve);
  });
  const env = await probeEnvironment();
  console.log(`[lab-runner] http://${HOST}:${port}  ·  dozwolone źródła: ${origins.join(', ')}`);
  console.log(`[lab-runner] uv: ${env.uv.version ?? 'nie znaleziono'}  ·  Java: ${env.java.version ?? 'nie znaleziono'} (wymagana ${MIN_JAVA}+)`);
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start().then(server => {
    let closing = false;
    const shutdown = () => {
      if (closing) return;
      closing = true;
      // Proces kończy się dopiero po sprzątnięciu labu: inaczej timer z SIGKILL nigdy by nie zadziałał.
      server.shutdown().then(() => process.exit(0));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }).catch(error => {
    console.error(`[lab-runner] ${error.message}`);
    process.exit(1);
  });
}
