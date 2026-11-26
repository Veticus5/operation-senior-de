/**
 * Klient lokalnego runnera labów (apps/lab-runner). Czysta logika: protokół, parser strumienia
 * i stan uruchomienia. Komponent LabRunner tylko to wyświetla.
 *
 * Aplikacja jest statyczna i działa bez runnera. Runner to opcjonalny proces na 127.0.0.1,
 * którego interfejs szuka wyłącznie wtedy, gdy sam jest otwarty z tego samego komputera.
 */

export const RUNNER_URL: string = import.meta.env?.VITE_LAB_RUNNER_URL ?? 'http://127.0.0.1:8765';

export interface RunnerEnv {
  uv: { found: boolean; version: string | null };
  java: { found: boolean; version: string | null; major: number | null; required: number; ok: boolean; source: 'JAVA_HOME' | 'PATH' };
  deps: { ready: boolean };
}
export interface RunnerHealth {
  service: string;
  busy: boolean;
  labs: { id: string; script: string; timeoutSec: number; sha256: string }[];
  env: RunnerEnv;
}

export type RunEvent =
  | { type: 'start'; labId: string; command: string; cwd: string; timeoutSec: number; startedAt: string }
  | { type: 'stdout' | 'stderr'; data: string }
  | { type: 'end'; status: EndStatus; exitCode: number | null; signal: string | null; durationMs: number; message?: string };

export type EndStatus = 'ok' | 'failed' | 'cancelled' | 'timeout' | 'output-limit' | 'error';
export type RunStatus = 'idle' | 'running' | EndStatus;

export interface RunState {
  status: RunStatus;
  /** Wyjście procesu w kolejności nadejścia. Sąsiednie porcje tego samego strumienia są sklejone. */
  output: { stream: 'stdout' | 'stderr'; text: string }[];
  command: string | null;
  timeoutSec: number | null;
  exitCode: number | null;
  durationMs: number | null;
  message: string | null;
}

export const idleRun: RunState = { status: 'idle', output: [], command: null, timeoutSec: null, exitCode: null, durationMs: null, message: null };

/** Nowy stan po zdarzeniu z runnera. */
export function applyEvent(state: RunState, event: RunEvent): RunState {
  switch (event.type) {
    case 'start':
      return { ...idleRun, status: 'running', command: event.command, timeoutSec: event.timeoutSec };
    case 'stdout':
    case 'stderr': {
      const last = state.output[state.output.length - 1];
      const output = last && last.stream === event.type
        ? [...state.output.slice(0, -1), { stream: last.stream, text: last.text + event.data }]
        : [...state.output, { stream: event.type, text: event.data }];
      return { ...state, output };
    }
    case 'end':
      return { ...state, status: event.status, exitCode: event.exitCode, durationMs: event.durationMs, message: event.message ?? null };
  }
}

/** Uruchomienie urwane po stronie przeglądarki: przerwane przez użytkownika albo zerwane połączenie. */
export function endLocally(state: RunState, status: 'cancelled' | 'error', durationMs: number, message: string | null = null): RunState {
  return state.status === 'running' || state.status === 'idle' ? { ...state, status, durationMs, message } : state;
}

/**
 * Składa zdarzenia NDJSON z porcji tekstu. Porcja może kończyć się w połowie linii,
 * więc niedokończony ogon wraca do bufora.
 */
export function createEventParser(): (chunk: string) => RunEvent[] {
  let buffer = '';
  return chunk => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    return lines.filter(line => line.trim()).map(line => JSON.parse(line) as RunEvent);
  };
}

/**
 * Runnera szukamy tylko ze strony otwartej lokalnie. Ze strony opublikowanej w sieci zapytanie
 * do 127.0.0.1 i tak zostałoby odrzucone, a przeglądarka mogłaby pytać o dostęp do sieci lokalnej.
 */
export const isLocalPage = (hostname: string): boolean => ['localhost', '127.0.0.1', '[::1]'].includes(hostname) || hostname.endsWith('.localhost');

/** Stan runnera albo null, gdy nie odpowiada. */
export async function fetchHealth(): Promise<RunnerHealth | null> {
  try {
    const response = await fetch(`${RUNNER_URL}/api/health`, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    const health = (await response.json()) as RunnerHealth;
    return health.service === 'osde-lab-runner' ? health : null;
  } catch {
    return null;
  }
}

export class RunnerError extends Error {}

const REFUSALS: Record<string, string> = {
  busy: 'Runner wykonuje już inny lab. Poczekaj, aż skończy, albo przerwij go tam, gdzie został uruchomiony.',
  'unknown-lab': 'Runner nie zna tego labu. Uruchom runner z tej samej wersji repozytorium co aplikację.',
  'origin-not-allowed': 'Runner nie wpuszcza tego adresu strony. Dozwolone źródła ustawia zmienna LAB_RUNNER_ORIGINS.'
};

/**
 * Uruchamia lab i przekazuje zdarzenia w miarę napływania. Przerwanie sygnałem zamyka połączenie,
 * a runner po zamknięciu połączenia zabija proces.
 */
export async function runLab(labId: string, onEvent: (event: RunEvent) => void, signal: AbortSignal): Promise<void> {
  const response = await fetch(`${RUNNER_URL}/api/labs/${encodeURIComponent(labId)}/run`, { method: 'POST', signal });
  if (!response.ok || !response.body) {
    const code = await response.json().then(body => String(body.error), () => '');
    throw new RunnerError(REFUSALS[code] ?? `Runner odmówił uruchomienia (HTTP ${response.status}).`);
  }
  const parse = createEventParser();
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let ended = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const event of parse(value)) {
      if (event.type === 'end') ended = true;
      onEvent(event);
    }
  }
  if (!ended) throw new RunnerError('Połączenie z runnerem urwało się przed końcem uruchomienia.');
}

/** SHA-256 tekstu jako hex. Pozwala sprawdzić, czy kod na stronie to ten sam plik, który uruchomi runner. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Czas do pokazania: 0,8 s, 41,2 s, 2 min 05 s. */
export function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1).replace('.', ',')} s`;
  return `${Math.floor(seconds / 60)} min ${String(Math.floor(seconds % 60)).padStart(2, '0')} s`;
}
