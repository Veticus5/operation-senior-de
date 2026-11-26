import { useCallback, useEffect, useRef, useState } from 'react';
import { labById } from '@content/labs';
import { LAB_SOURCES } from '../lib/labSources';
import { RUNNER_URL, RunnerError, applyEvent, endLocally, fetchHealth, formatDuration, idleRun, isLocalPage, runLab, sha256Hex, type RunState, type RunnerHealth } from '../lib/labRunner';
import { CopyButton } from './CopyButton';
import { Html } from './Html';

function Command({ text }: { text: string }) {
  return (
    <div className="codewrap labr-cmd">
      <CopyButton text={text} />
      <pre className="code">{text}</pre>
    </div>
  );
}

function statusText(run: RunState, elapsed: number, timeoutSec: number | undefined): string {
  const took = run.durationMs === null ? '' : formatDuration(run.durationMs);
  switch (run.status) {
    case 'idle': return timeoutSec ? `Gotowy · limit czasu ${timeoutSec} s` : 'Gotowy';
    case 'running': return `Działa · ${formatDuration(elapsed)}`;
    case 'ok': return `Zakończony · kod wyjścia ${run.exitCode} · ${took}`;
    case 'failed': return `Błąd · kod wyjścia ${run.exitCode} · ${took}`;
    case 'cancelled': return `Przerwany po ${took}`;
    case 'timeout': return `Przerwany przez limit czasu (${run.timeoutSec} s)`;
    case 'output-limit': return `Przerwany po ${took}: wyjście przekroczyło limit runnera`;
    case 'error': return run.message ?? 'Uruchomienie nie powiodło się';
  }
}

/** Co trzeba naprawić w środowisku, zanim lab wystartuje. Pusta lista: można uruchamiać. */
function blockers(health: RunnerHealth, labId: string, sourceDiffers: boolean): string[] {
  const { uv, java } = health.env;
  const out: string[] = [];
  const known = health.labs.find(l => l.id === labId);
  // Kod pokazany na stronie i kod wykonany muszą być tym samym plikiem, inaczej wynik nie tłumaczy kodu.
  if (known?.changed) out.push('Skrypt labu zmienił się na dysku od startu runnera. Runner nie uruchomi zmienionego pliku: zatrzymaj go i uruchom ponownie.');
  else if (sourceDiffers) out.push('Kod pokazany wyżej różni się od pliku, który zarejestrował runner. Odśwież stronę albo przebuduj aplikację, żeby uruchomić dokładnie ten kod, który widzisz.');
  if (!known) out.push('Runner nie ma tego labu na liście dozwolonych skryptów. Uruchom go z tej samej wersji repozytorium co aplikację.');
  if (!uv.found) out.push('Nie znaleziono uv. Runner startuje laby poleceniem „uv run", więc zainstaluj uv (docs.astral.sh/uv) i uruchom runner ponownie.');
  if (!java.found) out.push(`Nie znaleziono Javy (runner szukał w ${java.source}). PySpark uruchamia Sparka w maszynie wirtualnej Javy, więc bez niej lab nie wystartuje. Zainstaluj JDK ${java.required} lub nowszy i uruchom runner ponownie.`);
  else if (!java.ok) out.push(`Znaleziona Java ${java.version} jest za stara: laby wymagają wersji ${java.required} lub nowszej. Ustaw JAVA_HOME na nowsze JDK i uruchom runner ponownie.`);
  return out;
}

/**
 * Lab z repozytorium: kod skryptu i, jeśli działa lokalny runner, przycisk, który naprawdę go uruchamia.
 * Wyjście pochodzi wyłącznie z procesu. Bez runnera komponent pokazuje kod i polecenie do terminala.
 */
export function LabRunner({ labId, sourceOpen = false, hint }: { labId: string; sourceOpen?: boolean; /** Krótka wskazówka tuż nad przyciskiem uruchomienia. */ hint?: string }) {
  const lab = labById(labId);
  const source = LAB_SOURCES[labId] ?? '';
  const local = isLocalPage(window.location.hostname);
  /** undefined: sprawdzam, null: runner nie odpowiada. */
  const [health, setHealth] = useState<RunnerHealth | null | undefined>(local ? undefined : null);
  const [run, setRun] = useState<RunState>(idleRun);
  const [elapsed, setElapsed] = useState(0);
  const [open, setOpen] = useState(sourceOpen);
  const [sourceDiffers, setSourceDiffers] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const out = useRef<HTMLPreElement>(null);
  const follow = useRef(true);

  const check = useCallback(async () => {
    setHealth(undefined);
    const next = await fetchHealth();
    if (mounted.current) setHealth(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (local) check();
    return () => {
      // Wyjście z widoku przerywa lab: runner zabija proces, gdy połączenie się zamknie.
      mounted.current = false;
      abort.current?.abort();
    };
  }, [local, check]);

  const runnerSha = health?.labs.find(l => l.id === labId)?.sha256;
  useEffect(() => {
    if (!runnerSha || !source) return;
    let live = true;
    sha256Hex(source).then(sha => live && setSourceDiffers(sha !== runnerSha), () => {});
    return () => { live = false; };
  }, [runnerSha, source]);

  useEffect(() => {
    if (follow.current && out.current) out.current.scrollTop = out.current.scrollHeight;
  }, [run.output]);

  if (!lab) return null;

  const start = async () => {
    const controller = new AbortController();
    abort.current = controller;
    const t0 = performance.now();
    follow.current = true;
    setRun({ ...idleRun, status: 'running' });
    setElapsed(0);
    const tick = window.setInterval(() => setElapsed(performance.now() - t0), 100);
    try {
      await runLab(lab.id, event => mounted.current && setRun(state => applyEvent(state, event)), controller.signal);
    } catch (error) {
      const ms = performance.now() - t0;
      if (!mounted.current) return;
      if (controller.signal.aborted) setRun(state => endLocally(state, 'cancelled', ms));
      else setRun(state => endLocally(state, 'error', ms, error instanceof RunnerError ? error.message : 'Runner przestał odpowiadać.'));
    } finally {
      window.clearInterval(tick);
      abort.current = null;
      // Po uruchomieniu stan środowiska mógł się zmienić (np. uv pobrał zależności) albo runner zniknął.
      const next = await fetchHealth();
      if (mounted.current) setHealth(next);
    }
  };

  const running = run.status === 'running';
  const problems = health ? blockers(health, lab.id, sourceDiffers) : [];
  const timeoutSec = health?.labs.find(l => l.id === lab.id)?.timeoutSec;
  const manual = `cd labs && uv run ${lab.script}`;

  return (
    <section className="labr" aria-label={`Lab: ${lab.title}`}>
      <p className="viz-k">Lab · labs/{lab.script}</p>
      <p className="labr-title">{lab.title}</p>
      <p className="labr-sum">{lab.summary}</p>

      <details className="deeper labr-src" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
        <summary>Kod skryptu · liczba linii: {source.trimEnd().split('\n').length}</summary>
        <div>
          <div className="codewrap">
            <CopyButton text={source} />
            <pre className="code">{source}</pre>
          </div>
        </div>
      </details>

      {health === undefined && <p className="labr-note">Sprawdzam, czy działa lokalny runner…</p>}

      {health === null && (
        <div className="labr-off">
          <p className="labr-note">
            <b>Uruchamianie z tej strony jest teraz wyłączone.</b>{' '}
            {local
              ? `Lokalny runner nie odpowiada pod adresem ${RUNNER_URL}. Reszta aplikacji działa bez niego.`
              : 'Ta strona nie jest otwarta z Twojego komputera, a laby uruchamia tylko runner działający lokalnie.'}
          </p>
          <p className="labr-note">Żeby uruchamiać laby z przeglądarki, wystartuj aplikację w katalogu repozytorium poleceniem:</p>
          <Command text="npm run dev:labs" />
          <p className="labr-note">Albo uruchom ten skrypt w terminalu (wymaga uv i Javy 17+):</p>
          <Command text={manual} />
          {local && <button type="button" className="btn" onClick={check}>Sprawdź ponownie</button>}
        </div>
      )}

      {health && (
        <>
          <ul className="labr-env" aria-label="Środowisko runnera">
            <li className={health.env.uv.found ? 'ok' : 'no'}>{health.env.uv.found ? health.env.uv.version?.replace(/\s*\(.*\)$/, '') : 'uv: brak'}</li>
            <li className={health.env.java.ok ? 'ok' : 'no'}>{health.env.java.found ? `Java ${health.env.java.version}` : 'Java: brak'}</li>
            <li className={health.env.deps.ready ? 'ok' : 'wait'}>{health.env.deps.ready ? 'środowisko Pythona gotowe' : 'środowisko Pythona: do utworzenia'}</li>
          </ul>
          {problems.map(text => <p key={text} className="labr-note bad">{text}</p>)}
          {problems.length > 0 && <button type="button" className="btn" onClick={check}>Sprawdź ponownie</button>}
          {problems.length === 0 && !health.env.deps.ready && !running && (
            <p className="labr-note">Pierwsze uruchomienie potrwa dłużej: uv najpierw utworzy środowisko i pobierze PySpark. Ten czas wlicza się do limitu.</p>
          )}
          {health.busy && !running && <p className="labr-note">Runner wykonuje teraz inny lab. Jednocześnie działa tylko jedno uruchomienie.</p>}

          {problems.length === 0 && (
            <>
              {hint && run.status === 'idle' && <p className="labr-note labr-hint">{hint}</p>}
              <div className="labr-bar">
                {running
                  ? <button type="button" className="btn" onClick={() => abort.current?.abort()}>Przerwij</button>
                  : <button type="button" className="btn solid" onClick={start}>{run.status === 'idle' ? 'Uruchom lab' : 'Uruchom ponownie'}</button>}
                <span className={`labr-status ${run.status}`} role="status">{statusText(run, elapsed, timeoutSec)}</span>
              </div>
              <p className="viz-k labr-out-k">
                <span>{run.command ? `Wyjście procesu · ${run.command}` : 'Wyjście procesu'}</span>
                <span>stdout jasny · stderr przygaszony</span>
              </p>
              <pre className="code labr-out" ref={out} tabIndex={0} role="log" aria-live="off" aria-label="Wyjście labu"
                onScroll={e => { const el = e.currentTarget; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24; }}>
                {run.output.length > 0
                  ? run.output.map((part, i) => <span key={i} className={part.stream}>{part.text}</span>)
                  : <span className="labr-empty">{running ? 'Proces wystartował, czekam na pierwsze linie…' : 'Tu pojawi się wyjście skryptu, linia po linii, prosto z procesu. Przed uruchomieniem pole jest puste: nic tu nie jest symulowane.'}</span>}
              </pre>
              {run.status === 'ok' && <span className="badge">Rzeczywiste wykonanie · przed chwilą, na tym komputerze</span>}
            </>
          )}
        </>
      )}

      <p className="scope"><b>Zakres wyniku.</b> <Html as="span" html={lab.scope} /></p>
    </section>
  );
}
