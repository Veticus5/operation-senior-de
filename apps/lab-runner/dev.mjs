/**
 * `npm run dev:labs`: lokalny runner labów i serwer deweloperski Vite jednym poleceniem.
 * Vite dostaje --strictPort, bo runner wpuszcza tylko znane źródła: gdyby Vite po cichu
 * przeskoczył na inny port, przycisk uruchamiania przestałby działać bez wyjaśnienia.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { start } from './server.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));

let runner;
try {
  runner = await start();
} catch (error) {
  console.error(`[lab-runner] ${error.message}`);
  process.exit(1);
}

// Własna grupa procesów: npm uruchamia Vite jako proces potomny i sam sygnału dalej nie przekazuje,
// więc przy zamykaniu sygnał idzie do całej grupy. Inaczej Vite zostawałby na porcie 5173.
const vite = spawn('npm', ['run', 'dev', '-w', 'apps/web', '--', '--strictPort', '--port', '5173'], { cwd: root, stdio: 'inherit', shell: false, detached: true });
const stopVite = () => {
  try { process.kill(-vite.pid, 'SIGTERM'); } catch { /* już zakończony */ }
};

let closing = false;
const shutdown = async code => {
  if (closing) return;
  closing = true;
  stopVite();
  // Czeka, aż trwający lab (Python i JVM) naprawdę się zakończy, zanim proces wyjdzie.
  await runner.shutdown();
  process.exit(code);
};
vite.on('exit', code => shutdown(code ?? 0));
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
